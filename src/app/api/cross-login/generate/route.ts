import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createServiceClient } from "@/lib/supabase-service";

const DTC_BACKEND_URL =
  process.env.DTC_BACKEND_URL || "http://127.0.0.1:3001";
const DTC_FRONTEND_URL =
  process.env.DTC_FRONTEND_URL || "http://localhost:5173";
const ADMIN_API_TOKEN = process.env.ADMIN_API_TOKEN;

/**
 * POST /api/cross-login/generate
 *
 * Authenticated 7D portal user requests a DTC cross-login URL.
 * If the client is approved for DTC but the user is not linked yet,
 * provisions/links a DTC account first.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll() {},
        },
      },
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    if (!ADMIN_API_TOKEN) {
      console.error("cross-login/generate: ADMIN_API_TOKEN not configured");
      return NextResponse.json(
        { error: "Server misconfigured: ADMIN_API_TOKEN is missing in 7D env" },
        { status: 500 },
      );
    }

    const serviceClient = createServiceClient();

    const { data: profile, error: profileError } = await serviceClient
      .from("user_profiles")
      .select("id, dtc_user_id, email, full_name")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("cross-login/generate: profile lookup failed", profileError);
      return NextResponse.json(
        { error: "Failed to look up user profile" },
        { status: 500 },
      );
    }

    if (!profile) {
      return NextResponse.json(
        { error: "Portal user profile not found" },
        { status: 404 },
      );
    }

    // Find an approved DTC-enabled client for this user
    const { data: accessRows, error: accessError } = await serviceClient
      .from("client_users")
      .select("client_id, client:clients(id, company_name, dtc_enabled)")
      .eq("user_id", user.id);

    if (accessError) {
      console.error("cross-login/generate: client access lookup failed", accessError);
      return NextResponse.json(
        { error: "Failed to look up client access" },
        { status: 500 },
      );
    }

    const approved = (accessRows || [])
      .map((row) => {
        const client = Array.isArray(row.client) ? row.client[0] : row.client;
        return client as
          | { id: string; company_name: string; dtc_enabled?: boolean }
          | null;
      })
      .find((client) => client?.dtc_enabled);

    if (!approved) {
      return NextResponse.json(
        {
          error:
            "DTC Commerce is not approved for your brand yet. Ask your 7D admin to approve access.",
        },
        { status: 403 },
      );
    }

    let dtcUserId = profile.dtc_user_id;

    // First click after approval: create/link DTC account
    if (!dtcUserId) {
      const enableRes = await fetch(`${DTC_BACKEND_URL}/v1/cross-login/enable`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": ADMIN_API_TOKEN,
        },
        body: JSON.stringify({
          email: profile.email || user.email,
          name: profile.full_name || profile.email || user.email,
          company_name: approved.company_name,
          seven_d_client_id: approved.id,
          seven_d_user_id: profile.id,
        }),
      });

      if (!enableRes.ok) {
        const body = await enableRes.text();
        console.error(
          "cross-login/generate: DTC enable failed",
          enableRes.status,
          body,
        );
        return NextResponse.json(
          {
            error:
              "Could not create DTC account. Check DTC backend is running and ADMIN_API_TOKEN matches.",
          },
          { status: 502 },
        );
      }

      const enableData = await enableRes.json();
      dtcUserId = enableData.user?.id;

      if (!dtcUserId) {
        return NextResponse.json(
          { error: "DTC enable did not return a user id" },
          { status: 502 },
        );
      }

      const { error: linkError } = await serviceClient
        .from("user_profiles")
        .update({ dtc_user_id: dtcUserId })
        .eq("id", profile.id);

      if (linkError) {
        console.error("cross-login/generate: failed to save dtc_user_id", linkError);
        return NextResponse.json(
          { error: "Failed to link DTC account" },
          { status: 500 },
        );
      }
    }

    const dtcRes = await fetch(
      `${DTC_BACKEND_URL}/v1/cross-login/generate-server`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": ADMIN_API_TOKEN,
        },
        body: JSON.stringify({ user_id: dtcUserId }),
      },
    );

    if (!dtcRes.ok) {
      const body = await dtcRes.text();
      console.error("cross-login/generate: DTC token error", dtcRes.status, body);
      return NextResponse.json(
        {
          error:
            "Failed to generate DTC login token. Is DTC backend running on port 3001?",
        },
        { status: 502 },
      );
    }

    const { token } = await dtcRes.json();
    if (!token) {
      return NextResponse.json(
        { error: "DTC backend returned no token" },
        { status: 502 },
      );
    }

    return NextResponse.json({
      redirect_url: `${DTC_FRONTEND_URL}/cross-login?token=${encodeURIComponent(token)}`,
    });
  } catch (err) {
    console.error("cross-login/generate: unexpected error", err);
    const cause = err instanceof Error ? String((err as Error & { cause?: unknown }).cause ?? err.message) : "";
    if (
      cause.includes("ECONNREFUSED") ||
      cause.includes("fetch failed") ||
      (err instanceof TypeError && String(err.message).includes("fetch failed"))
    ) {
      return NextResponse.json(
        {
          error: `Cannot reach DTC backend at ${DTC_BACKEND_URL}. Start DTC_backend (port 3001) and try again.`,
        },
        { status: 502 },
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
