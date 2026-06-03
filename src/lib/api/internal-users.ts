import { createClient } from "@/lib/supabase";
import { User, UserRole } from "@/types/database";
import { parseFetchError } from "@/lib/api/parse-api-error";

export interface InternalUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
  created_at: string;
}

export interface CreateInternalUserData {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}

export interface InviteInternalUserData {
  name: string;
  email: string;
  role: UserRole;
}

/**
 * Get all internal users (staff)
 */
export async function getInternalUsers(): Promise<InternalUser[]> {
  const response = await fetch("/api/internal-users", {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || "Failed to fetch internal users");
  }

  return result.users || [];
}

/**
 * Create a new internal user via server-side admin API
 * Uses /api/internal-users to avoid affecting the current session
 */
export async function createInternalUser(
  userData: CreateInternalUserData
): Promise<{ success: boolean; message: string; user?: InternalUser }> {
  try {
    const response = await fetch("/api/internal-users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(userData),
    });

    const result = await response.json();

    if (!response.ok) {
      return {
        success: false,
        message: result.error || "Failed to create user",
      };
    }

    return {
      success: true,
      message: "User created successfully",
      user: result.user,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to create user",
    };
  }
}

/**
 * Invite a new internal user via email
 * Sends an invitation email - user sets their own password
 */
export async function inviteInternalUser(
  userData: InviteInternalUserData
): Promise<{
  success: boolean;
  message: string;
  emailSent?: boolean;
  warning?: boolean;
  inviteLink?: string;
}> {
  try {
    const response = await fetch("/api/internal-users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "invite",
        name: userData.name.trim(),
        email: userData.email.trim(),
        role: userData.role,
      }),
    });

    if (!response.ok) {
      return {
        success: false,
        message: await parseFetchError(response, "Failed to send invitation"),
      };
    }

    const result = await response.json().catch(() => ({}));
    const emailSent = (result as { emailSent?: boolean }).emailSent;
    return {
      success: true,
      message:
        (result as { message?: string }).message ||
        "Invitation email sent successfully",
      emailSent,
      warning: emailSent === false,
      inviteLink: (result as { inviteLink?: string }).inviteLink,
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to send invitation",
    };
  }
}

/**
 * Resend an invitation email to an existing internal user.
 */
export async function resendInternalUserInvite(
  userId: string,
  email: string
): Promise<{
  success: boolean;
  message: string;
  warning?: boolean;
  emailSent?: boolean;
  inviteLink?: string;
}> {
  try {
    const response = await fetch("/api/internal-users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "resend",
        userId,
        email: email.trim(),
      }),
    });

    if (!response.ok) {
      return {
        success: false,
        message: await parseFetchError(response, "Failed to resend invitation"),
      };
    }

    const result = await response.json().catch(() => ({}));
    const emailSent = (result as { emailSent?: boolean }).emailSent;
    return {
      success: true,
      message:
        (result as { message?: string }).message ||
        "The invitation has been resent.",
      emailSent,
      warning: emailSent === false,
      inviteLink: (result as { inviteLink?: string }).inviteLink,
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to resend invitation",
    };
  }
}

/**
 * Update an internal user
 */
export async function updateInternalUser(
  id: string,
  updates: { name?: string; role?: UserRole; active?: boolean }
): Promise<InternalUser> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("users")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

/**
 * Deactivate an internal user (soft delete)
 */
export async function deactivateInternalUser(id: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from("users")
    .update({ active: false })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Reactivate an internal user
 */
export async function reactivateInternalUser(id: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from("users")
    .update({ active: true })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}
