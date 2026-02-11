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
 * Create a new internal user
 * Creates an auth user and a record in the users table
 */
export async function createInternalUser(
  userData: CreateInternalUserData
): Promise<{ success: boolean; message: string; user?: InternalUser }> {
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

  // Create the auth user
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: userData.email.toLowerCase(),
    password: userData.password,
    options: {
      data: {
        full_name: userData.name,
      },
    },
  });

  if (authError || !authData.user) {
    return {
      success: false,
      message: authError?.message || "Failed to create user account",
    };
  }

  // Create the internal user record
  const { data: newUser, error: userError } = await supabase
    .from("users")
    .insert({
      id: authData.user.id,
      name: userData.name,
      email: userData.email.toLowerCase(),
      role: userData.role,
      active: true,
    })
    .select()
    .single();

  if (userError) {
    return {
      success: false,
      message: userError.message || "Failed to create user record",
    };
  }

  return {
    success: true,
    message: "User created successfully",
    user: newUser,
  };
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
