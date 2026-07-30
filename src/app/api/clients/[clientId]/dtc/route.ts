import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createServiceClient } from "@/lib/supabase-service";

/**
 * GET /api/clients/:clientId/dtc
 *
 * Check if a client has DTC enabled.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> },
) {
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

    const { clientId } = await params;
    const serviceClient = createServiceClient();

    const { data: client, error: queryError } = await serviceClient
      .from("clients")
      .select("id, company_name, dtc_enabled")
      .eq("id", clientId)
      .single();

    if (queryError || !client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    return NextResponse.json({ client });
  } catch (err) {
    console.error("GET /clients/:id/dtc: unexpected error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/clients/:clientId/dtc
 *
 * Toggle dtc_enabled on a warehouse client. Requires an authenticated
 * internal staff user.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> },
) {
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

    const serviceClient = createServiceClient();

    const { data: callerUser } = await serviceClient
      .from("users")
      .select("id, role, active")
      .or(`id.eq.${user.id},auth_id.eq.${user.id}`)
      .maybeSingle();

    if (!callerUser || callerUser.active === false) {
      return NextResponse.json(
        { error: "Internal access required" },
        { status: 403 },
      );
    }

    const { clientId } = await params;
    const body = await request.json();

    if (typeof body.dtc_enabled !== "boolean") {
      return NextResponse.json(
        { error: "dtc_enabled (boolean) is required" },
        { status: 400 },
      );
    }

    const { data: updated, error: updateError } = await serviceClient
      .from("clients")
      .update({ dtc_enabled: body.dtc_enabled })
      .eq("id", clientId)
      .select("id, company_name, dtc_enabled")
      .single();

    if (updateError) {
      console.error("PATCH /clients/:id/dtc: update failed", updateError);
      return NextResponse.json(
        { error: "Failed to update client" },
        { status: 500 },
      );
    }

    if (!updated) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    return NextResponse.json({ client: updated });
  } catch (err) {
    console.error("PATCH /clients/:id/dtc: unexpected error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
