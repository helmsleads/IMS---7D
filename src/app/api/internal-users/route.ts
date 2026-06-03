import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createServiceClient } from "@/lib/supabase-service";
import {
  sendUserInvitation,
  formatInviteSuccessMessage,
  type InviteFailure,
} from "@/lib/server/invite-user";
import type { UserRole } from "@/types/database";

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

async function getCallerInternalUser(
  request: NextRequest,
  fields = "id, auth_id, role, active"
) {
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

  const { data: { user }, error: authCheckError } = await supabase.auth.getUser();
  if (authCheckError) {
    return { supabase, user: null, callerUser: null, error: "Auth error: " + authCheckError.message };
  }
  if (!user) {
    return { supabase, user: null, callerUser: null, error: "Not authenticated" };
  }

  // Resolve caller with service role (bypass RLS) after auth is verified.
  // Support both mappings:
  // - users.id == auth user id (new/default)
  // - users.auth_id == auth user id (legacy)
  const serviceClient = createServiceClient();
  const { data: callerUser } = await serviceClient
    .from("users")
    .select(fields)
    .or(`id.eq.${user.id},auth_id.eq.${user.id}`)
    .maybeSingle();

  return {
    supabase,
    user,
    callerUser: callerUser as { id: string; auth_id?: string | null; role?: string; active?: boolean | null } | null,
    error: null,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { callerUser, error: authError } = await getCallerInternalUser(request, "id, auth_id, active");
    if (authError) {
      return NextResponse.json({ error: authError }, { status: 401 });
    }

    if (!callerUser || callerUser.active === false) {
      return NextResponse.json({ error: "Internal access required" }, { status: 403 });
    }

    const serviceClient = createServiceClient();
    const { data, error: usersError } = await serviceClient
      .from("users")
      .select("id, name, email, role, active, created_at")
      .order("name");

    if (usersError) {
      return NextResponse.json({ error: usersError.message }, { status: 500 });
    }

    return NextResponse.json({ users: data || [] });
  } catch (err) {
    console.error("Internal users GET route error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { callerUser, error: authLookupError } = await getCallerInternalUser(request, "id, auth_id, role, active");
    if (authLookupError) {
      return NextResponse.json({ error: authLookupError }, { status: 401 });
    }

    if (!callerUser || callerUser.active === false || callerUser.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await request.json();
    const action = body.action as string | undefined;

    if (action === "invite" || action === "resend") {
      const serviceClient = createServiceClient();

      if (action === "resend") {
        const userId = (body.userId || body.id || "").trim();
        const email = (body.email || "").trim().toLowerCase();

        if (!userId || !email) {
          return NextResponse.json(
            { error: "userId and email are required" },
            { status: 400 }
          );
        }

        const { data: staff } = await serviceClient
          .from("users")
          .select("name, role")
          .eq("id", userId)
          .maybeSingle();

        const inviteResult = await sendUserInvitation({
          email,
          full_name: staff?.name || email.split("@")[0],
          user_type: "internal",
          role: staff?.role,
          invited_by: callerUser.id,
          resend_user_id: userId,
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
          inviteLink: inviteResult.inviteLink,
        });
      }

      const name = (body.name || "").trim();
      const email = (body.email || "").trim().toLowerCase();
      const role = (body.role || "warehouse") as UserRole;

      if (!name || !email) {
        return NextResponse.json(
          { error: "Name and email are required" },
          { status: 400 }
        );
      }

      const { data: existing } = await serviceClient
        .from("users")
        .select("id, active")
        .eq("email", email)
        .maybeSingle();

      if (existing?.active) {
        const inviteResult = await sendUserInvitation({
          email,
          full_name: name,
          user_type: "internal",
          role,
          invited_by: callerUser.id,
          resend_user_id: existing.id,
        });

        if (!inviteResult.success) {
          return inviteErrorResponse(inviteResult);
        }

        return NextResponse.json({
          message: formatInviteSuccessMessage(
            "This user already exists. A new invitation link was generated.",
            inviteResult
          ),
          userId: inviteResult.userId,
          emailSent: inviteResult.emailSent,
          inviteLink: inviteResult.inviteLink,
        });
      }

      if (existing && !existing.active) {
        await serviceClient
          .from("users")
          .update({ name, role, active: true })
          .eq("id", existing.id);
      }

      const inviteResult = await sendUserInvitation({
        email,
        full_name: name,
        user_type: "internal",
        role,
        invited_by: callerUser.id,
        resend_user_id: existing?.id,
      });

      if (!inviteResult.success) {
        return inviteErrorResponse(inviteResult);
      }

      const accountMessage = existing
        ? "User was reactivated."
        : "User created successfully.";

      return NextResponse.json({
        message: formatInviteSuccessMessage(accountMessage, inviteResult),
        userId: inviteResult.userId,
        emailSent: inviteResult.emailSent,
        inviteLink: inviteResult.inviteLink,
      });
    }

    const { name, email, password, role } = body;

    if (!name || !email || !password || !role) {
      return NextResponse.json(
        { error: "Name, email, password, and role are required" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    const serviceClient = createServiceClient();

    // Check if email already exists
    const { data: existingUser } = await serviceClient
      .from("users")
      .select("id")
      .eq("email", email.toLowerCase())
      .single();

    if (existingUser) {
      return NextResponse.json(
        { error: "A user with this email already exists" },
        { status: 409 }
      );
    }

    // Create auth user via admin API (doesn't affect current session)
    const { data: authData, error: authError } =
      await serviceClient.auth.admin.createUser({
        email: email.toLowerCase(),
        password,
        email_confirm: true,
        user_metadata: { full_name: name },
      });

    if (authError || !authData.user) {
      console.error("Create user error:", authError?.message);
      return NextResponse.json(
        { error: authError?.message || "Failed to create user account" },
        { status: 500 }
      );
    }

    // Create the internal user record
    const { data: newUser, error: userError } = await serviceClient
      .from("users")
      .insert({
        id: authData.user.id,
        auth_id: authData.user.id,
        name,
        email: email.toLowerCase(),
        role,
        active: true,
      })
      .select()
      .single();

    if (userError) {
      // Clean up the auth user if the record insert fails
      await serviceClient.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json(
        { error: userError.message || "Failed to create user record" },
        { status: 500 }
      );
    }

    return NextResponse.json({ user: newUser });
  } catch (err) {
    console.error("Internal users route error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
