import { createServiceClient } from "@/lib/supabase-service";
import { sendEmail } from "@/lib/api/email";
import { isEmailServiceConfigured } from "@/lib/email";
import {
  getAppUrl,
  getAuthCallbackUrl,
  getAppUrlConfigurationError,
} from "@/lib/server/app-url";
import type { ClientUserRole, UserRole } from "@/types/database";

export type InviteUserType = "internal" | "portal";

export type InviteFailureStep =
  | "configuration"
  | "auth_link"
  | "staff_record"
  | "portal_record"
  | "email";

export type InviteFailure = {
  success: false;
  error: string;
  step: InviteFailureStep;
  details?: string;
};

export type InviteSuccess = {
  success: true;
  userId: string;
  emailSent: boolean;
  emailWarning?: string;
  /** Present when email could not be sent — share manually with the user */
  inviteLink?: string;
};

export function formatInviteSuccessMessage(
  accountMessage: string,
  result: InviteSuccess
): string {
  if (result.emailSent) {
    return `${accountMessage} Invitation email was sent.`;
  }
  const detail = result.emailWarning ? ` (${result.emailWarning})` : "";
  return `${accountMessage} Invitation email could not be sent${detail} Copy the invitation link below and send it to the user.`;
}

export interface InviteUserParams {
  email: string;
  full_name: string;
  user_type: InviteUserType;
  role?: string;
  phone?: string;
  client_id?: string;
  invited_by?: string;
  /** Existing auth/user id when re-inviting */
  resend_user_id?: string;
}

export type SendUserInvitationOptions = {
  /** Use request host when env URL is missing (recommended on Vercel). */
  request?: Request;
};

function inviteEmailHtml(
  firstName: string,
  actionLink: string,
  userType: InviteUserType
): string {
  const portalName =
    userType === "portal"
      ? "7 Degrees client portal"
      : "7 Degrees admin dashboard";
  const greeting = firstName ? `Welcome, ${firstName}.` : "Welcome.";

  return `
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h1>You're invited to 7 Degrees</h1>
        <p>${greeting}</p>
        <p>
          You have been invited to the ${portalName}.
          Use the button below to create your password and activate your account.
        </p>
        <p style="margin: 24px 0;">
          <a href="${actionLink}" style="display: inline-block; background: #0d9488; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
            Set up your password
          </a>
        </p>
        <p><strong>Your login email</strong> is the address this message was sent to.</p>
        <p>You do not have a password yet — the link above is how you create one.</p>
        <p>If the button does not work, copy and paste this URL into your browser:</p>
        <p style="word-break: break-all; color: #555;">${actionLink}</p>
        <p>Thanks for joining!</p>
      </body>
    </html>
  `;
}

export async function findAuthUserIdByEmail(email: string): Promise<string | null> {
  const service = createServiceClient();
  const normalized = email.trim().toLowerCase();
  let page = 1;

  while (true) {
    const { data, error } = await service.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (error) throw error;

    const found = data.users.find(
      (user) => user.email?.toLowerCase() === normalized
    );
    if (found) return found.id;

    if (data.users.length < 1000) return null;
    page++;
  }
}

function checkInviteConfiguration(request?: Request): InviteFailure | null {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return {
      success: false,
      step: "configuration",
      error: "Supabase is not configured on the server.",
      details:
        "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.",
    };
  }

  const appUrlError = getAppUrlConfigurationError(request);
  if (appUrlError) {
    return {
      success: false,
      step: "configuration",
      error: "App URL is not configured.",
      details: appUrlError,
    };
  }

  return null;
}

async function generateAuthInviteLink(
  email: string,
  redirectTo: string,
  metadata?: Record<string, unknown>
): Promise<
  | { userId: string; actionLink: string }
  | { error: string; details?: string }
> {
  const service = createServiceClient();
  const normalizedEmail = email.trim().toLowerCase();

  const linkTypes: Array<"invite" | "recovery"> = ["invite", "recovery"];
  const attemptErrors: string[] = [];

  for (const type of linkTypes) {
    const { data, error } = await service.auth.admin.generateLink({
      type,
      email: normalizedEmail,
      options: {
        redirectTo,
        ...(metadata ? { data: metadata as { [key: string]: string } } : {}),
      },
    });

    if (!error && data?.properties?.action_link && data?.user?.id) {
      return {
        userId: data.user.id,
        actionLink: data.properties.action_link,
      };
    }

    if (error) {
      const label = type === "invite" ? "Invite link" : "Password reset link";
      attemptErrors.push(`${label}: ${error.message}`);
      const msg = error.message.toLowerCase();
      const retryWithRecovery =
        type === "invite" &&
        (msg.includes("already") ||
          msg.includes("registered") ||
          msg.includes("exists"));
      if (retryWithRecovery) continue;
      return {
        error: error.message,
        details: attemptErrors.join("; "),
      };
    }

    attemptErrors.push(
      `${type === "invite" ? "Invite link" : "Password reset link"}: no link returned from Supabase`
    );
  }

  return {
    error: "Could not create an invitation link for this email.",
    details: [
      ...attemptErrors,
      `Redirect URL used: ${redirectTo}`,
      "Ensure this URL is listed under Supabase → Authentication → URL Configuration → Redirect URLs.",
      "Required entries include /auth/callback and /reset-password for your app origin(s).",
    ].join(" "),
  };
}

async function ensureStaffUserRecord(
  userId: string,
  email: string,
  fullName: string,
  role: string
) {
  const service = createServiceClient();

  const { data: existing } = await service
    .from("users")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (existing) {
    const { error } = await service
      .from("users")
      .update({
        name: fullName,
        email: email.toLowerCase(),
        role,
        active: true,
      })
      .eq("id", userId);
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await service.from("users").insert({
    id: userId,
    auth_id: userId,
    email: email.toLowerCase(),
    name: fullName,
    role,
    active: true,
  });

  if (error) throw new Error(error.message);
}

async function ensurePortalUserRecords(
  userId: string,
  params: InviteUserParams
) {
  const service = createServiceClient();
  const email = params.email.trim().toLowerCase();

  const { error: profileError } = await service.from("user_profiles").upsert(
    {
      id: userId,
      email,
      full_name: params.full_name,
      phone: params.phone || null,
    },
    { onConflict: "id" }
  );

  if (profileError) throw new Error(profileError.message);

  if (!params.client_id) {
    throw new Error("Client is required for portal invitations");
  }

  const { data: existingAccess } = await service
    .from("client_users")
    .select("id")
    .eq("user_id", userId)
    .eq("client_id", params.client_id)
    .maybeSingle();

  if (!existingAccess) {
    const { error: accessError } = await service.from("client_users").insert({
      client_id: params.client_id,
      user_id: userId,
      role: (params.role as ClientUserRole) || "member",
      is_primary: false,
      invited_by: params.invited_by || null,
      invited_at: new Date().toISOString(),
      accepted_at: null,
    });

    if (accessError) throw new Error(accessError.message);
  }
}

/**
 * Create or update auth user, provision DB records, and email an invite link.
 * Replaces the missing Supabase `invite-user` edge function.
 */
export async function sendUserInvitation(
  params: InviteUserParams,
  options?: SendUserInvitationOptions
): Promise<InviteSuccess | InviteFailure> {
  const configError = checkInviteConfiguration(options?.request);
  if (configError) {
    console.error("invite configuration:", configError);
    return configError;
  }

  try {
    const firstName = params.full_name.trim().split(/\s+/)[0] || "";
    const redirectTo = getAuthCallbackUrl("/reset-password", options?.request);

    const linkResult = await generateAuthInviteLink(
      params.email,
      redirectTo,
      { full_name: params.full_name }
    );

    if ("error" in linkResult) {
      console.error("generateLink failed:", linkResult, params);
      return {
        success: false,
        step: "auth_link",
        error: linkResult.error,
        details: linkResult.details,
      };
    }

    const userId = params.resend_user_id || linkResult.userId;

    if (params.user_type === "internal") {
      try {
        await ensureStaffUserRecord(
          userId,
          params.email,
          params.full_name,
          (params.role as UserRole) || "warehouse"
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          success: false,
          step: "staff_record",
          error: "Could not save the staff user record.",
          details: message,
        };
      }
    } else {
      try {
        await ensurePortalUserRecords(userId, params);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          success: false,
          step: "portal_record",
          error: "Could not save the portal user record.",
          details: message,
        };
      }
    }

    if (!isEmailServiceConfigured()) {
      console.warn(
        "AWS SES not configured — user created without invitation email:",
        params.email
      );
      return {
        success: true,
        userId,
        emailSent: false,
        emailWarning: "Email service is not configured (AWS_REGION / SES).",
        inviteLink: linkResult.actionLink,
      };
    }

    const emailResult = await sendEmail(
      params.email.trim().toLowerCase(),
      "You're invited to 7 Degrees",
      inviteEmailHtml(firstName, linkResult.actionLink, params.user_type)
    );

    if (!emailResult.success) {
      console.error("Invitation email failed (user was still created):", emailResult.error);
      return {
        success: true,
        userId,
        emailSent: false,
        emailWarning:
          emailResult.error ||
          "Check AWS credentials, AWS_REGION, SES_FROM_EMAIL, and your verified SES domain",
        inviteLink: linkResult.actionLink,
      };
    }

    return { success: true, userId, emailSent: true };
  } catch (err) {
    console.error("sendUserInvitation error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      step: "auth_link",
      error: "An unexpected error occurred while sending the invitation.",
      details: message,
    };
  }
}

/**
 * Create portal auth + profile + client access without sending an invite email.
 */
export async function createPortalUserWithoutInvite(
  params: InviteUserParams
): Promise<{ success: true; userId: string } | InviteFailure> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return {
      success: false,
      step: "configuration",
      error: "Supabase is not configured on the server.",
    };
  }

  if (!params.client_id) {
    return {
      success: false,
      step: "portal_record",
      error: "Client is required for portal users.",
    };
  }

  try {
    const service = createServiceClient();
    const email = params.email.trim().toLowerCase();

    const { data: existingProfile } = await service
      .from("user_profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existingProfile) {
      const { data: access } = await service
        .from("client_users")
        .select("id")
        .eq("user_id", existingProfile.id)
        .eq("client_id", params.client_id)
        .maybeSingle();

      if (access) {
        return {
          success: false,
          step: "portal_record",
          error: "This user already has access to this client.",
        };
      }
    }

    let userId = existingProfile?.id;

    if (!userId) {
      const { data: authData, error: authError } =
        await service.auth.admin.createUser({
          email,
          email_confirm: false,
          user_metadata: { full_name: params.full_name },
        });

      if (authError || !authData.user) {
        return {
          success: false,
          step: "auth_link",
          error: authError?.message || "Failed to create user account",
        };
      }
      userId = authData.user.id;
    }

    await ensurePortalUserRecords(userId, params);
    return { success: true, userId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      step: "portal_record",
      error: "Could not create the portal user.",
      details: message,
    };
  }
}
