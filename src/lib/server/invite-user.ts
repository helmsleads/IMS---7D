import { createServiceClient } from "@/lib/supabase-service";
import { sendEmail } from "@/lib/api/email";
import { isEmailServiceConfigured } from "@/lib/email";
import { userInviteEmail } from "@/lib/email-templates/user-invite";
import { getAppUrlConfigurationError, getAppUrlForExternalLinks } from "@/lib/server/app-url";
import { generateAuthEmailLink } from "@/lib/server/auth-email-links";
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

function checkInviteConfiguration(): InviteFailure | null {
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

  const appUrlError = getAppUrlConfigurationError();
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
  metadata?: Record<string, unknown>
): Promise<
  | { userId: string; actionLink: string }
  | { error: string; details?: string }
> {
  const result = await generateAuthEmailLink(
    email,
    ["invite", "recovery"],
    metadata
  );

  if ("error" in result) {
    return {
      error: result.error,
      details: result.details,
    };
  }

  return {
    userId: result.userId,
    actionLink: result.actionLink,
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
  params: InviteUserParams
): Promise<InviteSuccess | InviteFailure> {
  const configError = checkInviteConfiguration();
  if (configError) {
    console.error("invite configuration:", configError);
    return configError;
  }

  try {
    const firstName = params.full_name.trim().split(/\s+/)[0] || "";
    const linkResult = await generateAuthInviteLink(params.email, {
      full_name: params.full_name,
    });

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

    const emailContent = userInviteEmail({
      firstName,
      actionLink: linkResult.actionLink,
      userType: params.user_type,
      appUrl: getAppUrlForExternalLinks(),
    });

    const emailResult = await sendEmail(
      params.email.trim().toLowerCase(),
      emailContent.subject,
      emailContent.html
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
