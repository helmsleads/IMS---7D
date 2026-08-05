import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-service";
import { getAppUrl } from "@/lib/server/app-url";

const DTC_BACKEND_URL =
  process.env.DTC_BACKEND_URL || "http://127.0.0.1:3001";

/**
 * POST /api/cross-login/exchange
 *
 * DTC -> 7D cross-login. Validates the DTC token, finds the linked 7D user,
 * and returns a hashed OTP so the browser can establish a session without
 * depending on Supabase Site URL (which may still point at :3000).
 */
export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token || typeof token !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid token" },
        { status: 400 },
      );
    }

    const dtcRes = await fetch(`${DTC_BACKEND_URL}/v1/cross-login/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });

    if (!dtcRes.ok) {
      const status = dtcRes.status === 401 || dtcRes.status === 403 ? 401 : 502;
      return NextResponse.json(
        { error: "Invalid or expired cross-login token" },
        { status },
      );
    }

    const { user: dtcUser } = await dtcRes.json();

    if (!dtcUser?.id) {
      return NextResponse.json(
        { error: "DTC validation returned no user" },
        { status: 502 },
      );
    }

    const supabase = createServiceClient();

    // Prefer explicit link; fall back to seven_d_user_id / matching email (common for staging).
    let profile: { id: string; email: string | null } | null = null;

    const { data: byDtcId, error: byDtcIdError } = await supabase
      .from("user_profiles")
      .select("id, email")
      .eq("dtc_user_id", dtcUser.id)
      .maybeSingle();

    if (byDtcIdError) {
      console.error("cross-login/exchange: profile lookup by dtc_user_id failed", byDtcIdError);
      return NextResponse.json(
        { error: "Failed to look up linked user" },
        { status: 500 },
      );
    }
    profile = byDtcId;

    if (!profile?.email && dtcUser.seven_d_user_id) {
      const { data: bySevenDId, error: bySevenDError } = await supabase
        .from("user_profiles")
        .select("id, email")
        .eq("id", dtcUser.seven_d_user_id)
        .maybeSingle();
      if (bySevenDError) {
        console.error(
          "cross-login/exchange: profile lookup by seven_d_user_id failed",
          bySevenDError,
        );
      } else {
        profile = bySevenDId;
      }
    }

    if (!profile?.email && dtcUser.email) {
      const email = String(dtcUser.email).trim().toLowerCase();
      const { data: byEmail, error: byEmailError } = await supabase
        .from("user_profiles")
        .select("id, email")
        .ilike("email", email)
        .maybeSingle();
      if (byEmailError) {
        console.error("cross-login/exchange: profile lookup by email failed", byEmailError);
      } else {
        profile = byEmail;
      }
    }

    if (!profile?.email) {
      return NextResponse.json(
        {
          error:
            "No linked 7D account found for this DTC user. Open 7D first and use DTC Commerce once to link accounts, or ensure the same email exists as a 7D portal user.",
        },
        { status: 403 },
      );
    }

    // Persist link for next DTC → 7D hop
    if (dtcUser.id) {
      const { error: linkError } = await supabase
        .from("user_profiles")
        .update({ dtc_user_id: dtcUser.id })
        .eq("id", profile.id)
        .is("dtc_user_id", null);
      if (linkError) {
        console.warn("cross-login/exchange: could not auto-link dtc_user_id", linkError);
      }
    }

    const appOrigin = getAppUrl(request);
    const { data: linkData, error: linkError } =
      await supabase.auth.admin.generateLink({
        type: "magiclink",
        email: profile.email,
        options: {
          redirectTo: `${appOrigin}/portal/dashboard`,
        },
      });

    const tokenHash = linkData?.properties?.hashed_token;
    if (linkError || !tokenHash) {
      console.error("cross-login/exchange: magic link generation failed", linkError);
      return NextResponse.json(
        { error: "Failed to generate sign-in link" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      email: profile.email,
      token_hash: tokenHash,
      type: "magiclink",
      next: "/portal/dashboard",
    });
  } catch (err) {
    console.error("cross-login/exchange: unexpected error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
