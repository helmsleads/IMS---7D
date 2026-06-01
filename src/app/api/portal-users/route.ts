import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createServiceClient } from "@/lib/supabase-service";
import {
  sendUserInvitation,
  createPortalUserWithoutInvite,
  formatInviteSuccessMessage,
  type InviteFailure,
} from "@/lib/server/invite-user";
import type { ClientUserRole } from "@/types/database";

function inviteErrorResponse(failure: InviteFailure, status = 500) {
  return NextResponse.json(
    {
      error: failure.error,
      details: failure.details,
      step: failure.step,
    },
    { status }
  );
}

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

  const serviceClient = createServiceClient();
  const { data: callerUser } = await serviceClient
    .from("users")
    .select("id, role, active")
    .or(`id.eq.${user.id},auth_id.eq.${user.id}`)
    .maybeSingle();

  if (!callerUser || callerUser.active === false || callerUser.role !== "admin") {
    return null;
  }

  return { authUser: user, adminId: callerUser.id };
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
    const serviceClient = createServiceClient();

    if (action === "invite") {
      const clientId = (body.clientId || body.client_id || "").trim();
      const email = (body.email || "").trim().toLowerCase();
      const fullName = (body.full_name || body.fullName || "").trim();
      const phone = body.phone?.trim() || undefined;
      const role = (body.role || "member") as ClientUserRole;
      const sendEmail = body.send_email !== false;

      if (!clientId || !email) {
        return NextResponse.json(
          { error: "clientId and email are required" },
          { status: 400 }
        );
      }

      const displayName = fullName || email.split("@")[0];

      const { data: existingProfile } = await serviceClient
        .from("user_profiles")
        .select("id")
        .eq("email", email)
        .maybeSingle();

      if (existingProfile) {
        const { data: access } = await serviceClient
          .from("client_users")
          .select("id")
          .eq("user_id", existingProfile.id)
          .eq("client_id", clientId)
          .maybeSingle();

        if (access) {
          return NextResponse.json(
            { error: "This user already has access to this client." },
            { status: 409 }
          );
        }
      }

      if (!sendEmail) {
        const result = await createPortalUserWithoutInvite({
          email,
          full_name: displayName,
          phone,
          user_type: "portal",
          client_id: clientId,
          role,
          invited_by: admin.adminId,
          resend_user_id: existingProfile?.id,
        });

        if (!result.success) {
          return inviteErrorResponse(result);
        }

        return NextResponse.json({
          message:
            "User created successfully. You can send the invitation later.",
          userId: result.userId,
        });
      }

      const inviteResult = await sendUserInvitation({
        email,
        full_name: displayName,
        phone,
        user_type: "portal",
        client_id: clientId,
        role,
        invited_by: admin.adminId,
        resend_user_id: existingProfile?.id,
      });

      if (!inviteResult.success) {
        return inviteErrorResponse(inviteResult);
      }

      return NextResponse.json({
        message: formatInviteSuccessMessage(
          "User created successfully.",
          inviteResult
        ),
        userId: inviteResult.userId,
        emailSent: inviteResult.emailSent,
      });
    }

    if (action === "resend") {
      const email = (body.email || "").trim().toLowerCase();
      const resendUserId = (body.userId || userId || "").trim();

      if (!resendUserId || !email) {
        return NextResponse.json(
          { error: "userId and email are required" },
          { status: 400 }
        );
      }

      const { data: profile } = await serviceClient
        .from("user_profiles")
        .select("full_name")
        .eq("id", resendUserId)
        .maybeSingle();

      const { data: access } = await serviceClient
        .from("client_users")
        .select("role, client_id")
        .eq("user_id", resendUserId)
        .order("is_primary", { ascending: false })
        .limit(1)
        .maybeSingle();

      const inviteResult = await sendUserInvitation({
        email,
        full_name: profile?.full_name || email.split("@")[0],
        user_type: "portal",
        role: access?.role,
        client_id: access?.client_id,
        invited_by: admin.adminId,
        resend_user_id: resendUserId,
      });

      if (!inviteResult.success) {
        return inviteErrorResponse(inviteResult);
      }

      return NextResponse.json({
        message: formatInviteSuccessMessage(
          "Invitation processed.",
          inviteResult
        ),
        emailSent: inviteResult.emailSent,
      });
    }

    if (!action || !userId) {
      return NextResponse.json({ error: "action and userId are required" }, { status: 400 });
    }

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
