import { createClient } from "@/lib/supabase";
import { User, UserRole } from "@/types/database";

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
  const supabase = createClient();

  const { data, error } = await supabase
    .from("users")
    .select("id, name, email, role, active, created_at")
    .order("name");

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
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
): Promise<{ success: boolean; message: string }> {
  const supabase = createClient();

  // Check if email already exists in users table
  const { data: existingUser } = await supabase
    .from("users")
    .select("id")
    .eq("email", userData.email.toLowerCase())
    .single();

  if (existingUser) {
    return {
      success: false,
      message: "A user with this email already exists.",
    };
  }

  // Get the current session for the auth header
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return {
      success: false,
      message: "Not authenticated",
    };
  }

  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/invite-user`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          email: userData.email,
          full_name: userData.name,
          user_type: "internal",
          role: userData.role,
        }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      return {
        success: false,
        message: result.error || "Failed to send invitation",
      };
    }

    return {
      success: true,
      message: "Invitation email sent successfully",
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to send invitation",
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
