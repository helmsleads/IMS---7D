import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createServiceClient } from "@/lib/supabase-service";

/**
 * Verify the caller is an authenticated admin user
 */
async function verifyAdmin(request: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll() {},
      },
    }
  );

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;

  const { data: callerUser } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!callerUser || callerUser.role !== "admin") return null;

  return user;
}

/**
 * POST /api/portal-users
 * Actions: verify, reset-password
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await verifyAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await request.json();
    const { action, userId, newPassword } = body;

    if (!action || !userId) {
      return NextResponse.json({ error: "action and userId are required" }, { status: 400 });
    }

    const serviceClient = createServiceClient();

    if (action === "verify") {
      // Get auth user details
      const { data: authUser, error: authError } = await serviceClient.auth.admin.getUserById(userId);

      if (authError || !authUser?.user) {
        return NextResponse.json({
          error: "User not found in auth system",
          status: "not_found",
        }, { status: 404 });
      }

      const user = authUser.user;

      // Get profile and client access info
      const { data: profile } = await serviceClient
        .from("user_profiles")
        .select("id, email, full_name, phone, title, created_at")
        .eq("id", userId)
        .single();

      const { data: clientAccess } = await serviceClient
        .from("client_users")
        .select(`
          id,
          role,
          is_primary,
          client:clients (id, company_name)
        `)
        .eq("user_id", userId);

      return NextResponse.json({
        auth: {
          id: user.id,
          email: user.email,
          email_confirmed: !!user.email_confirmed_at,
          confirmed_at: user.email_confirmed_at,
          last_sign_in: user.last_sign_in_at,
          created_at: user.created_at,
          banned: user.banned_until ? true : false,
          banned_until: user.banned_until,
        },
        profile: profile || null,
        client_access: (clientAccess || []).map((ca) => ({
          ...ca,
          client: Array.isArray(ca.client) ? ca.client[0] : ca.client,
        })),
      });
    }

    if (action === "reset-password") {
      if (!newPassword || newPassword.length < 8) {
        return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
      }

      const { error: updateError } = await serviceClient.auth.admin.updateUserById(userId, {
        password: newPassword,
      });

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: "Password reset successfully" });
    }

    if (action === "confirm-email") {
      const { error: updateError } = await serviceClient.auth.admin.updateUserById(userId, {
        email_confirm: true,
      });

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: "Email confirmed successfully" });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("Portal users route error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
