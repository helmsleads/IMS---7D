import { createClient } from "@/lib/supabase";
import { ClientUser, ClientUserWithDetails, ClientUserRole, Client } from "@/types/database";

// Re-export types for convenience
export type { ClientUserWithDetails, ClientUserRole };

/**
 * Get all users associated with a client
 */
export async function getClientUsers(clientId: string): Promise<ClientUserWithDetails[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("client_users")
    .select(`
      *,
      client:clients (id, company_name, industry),
      user:user_profiles (id, email, full_name, phone, title)
    `)
    .eq("client_id", clientId)
    .order("created_at");

  if (error) {
    throw new Error(error.message);
  }

  return (data || []).map((item) => ({
    ...item,
    client: Array.isArray(item.client) ? item.client[0] : item.client,
    user: Array.isArray(item.user) ? item.user[0] : item.user,
  }));
}

/**
 * Get all clients a user has access to
 */
export async function getUserClients(userId: string): Promise<ClientUserWithDetails[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("client_users")
    .select(`
      *,
      client:clients (id, company_name, industry)
    `)
    .eq("user_id", userId)
    .order("is_primary", { ascending: false })
    .order("created_at");

  if (error) {
    throw new Error(error.message);
  }

  return (data || []).map((item) => ({
    ...item,
    client: Array.isArray(item.client) ? item.client[0] : item.client,
  }));
}

/**
 * Get the current user's clients (for portal)
 */
export async function getMyClients(): Promise<ClientUserWithDetails[]> {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Not authenticated");
  }

  return getUserClients(user.id);
}

/**
 * Get the current user's primary client
 */
export async function getMyPrimaryClient(): Promise<Client | null> {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return null;
  }

  // First try to find a primary client
  const { data: primaryData, error: primaryError } = await supabase
    .from("client_users")
    .select(`
      client:clients (*)
    `)
    .eq("user_id", user.id)
    .eq("is_primary", true)
    .single();

  if (!primaryError && primaryData?.client) {
    const client = Array.isArray(primaryData.client) ? primaryData.client[0] : primaryData.client;
    return client;
  }

  // If no primary, get the first one
  const { data: firstData, error: firstError } = await supabase
    .from("client_users")
    .select(`
      client:clients (*)
    `)
    .eq("user_id", user.id)
    .order("created_at")
    .limit(1)
    .single();

  if (firstError || !firstData?.client) {
    // Fall back to legacy auth_id lookup on clients table
    const { data: legacyClient } = await supabase
      .from("clients")
      .select("*")
      .eq("auth_id", user.id)
      .single();

    return legacyClient || null;
  }

  const client = Array.isArray(firstData.client) ? firstData.client[0] : firstData.client;
  return client;
}

/**
 * Add a user to a client
 */
export async function addClientUser(
  clientId: string,
  userId: string,
  role: ClientUserRole = "member",
  isPrimary: boolean = false
): Promise<ClientUser> {
  const supabase = createClient();

  const { data: { user: currentUser } } = await supabase.auth.getUser();

  // If setting as primary, unset any existing primary for this user
  if (isPrimary) {
    await supabase
      .from("client_users")
      .update({ is_primary: false })
      .eq("user_id", userId)
      .eq("is_primary", true);
  }

  const { data, error } = await supabase
    .from("client_users")
    .insert({
      client_id: clientId,
      user_id: userId,
      role,
      is_primary: isPrimary,
      invited_by: currentUser?.id || null,
      accepted_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

/**
 * Update a client user's role or primary status
 */
export async function updateClientUser(
  id: string,
  updates: { role?: ClientUserRole; is_primary?: boolean }
): Promise<ClientUser> {
  const supabase = createClient();

  // If setting as primary, we need to get the user_id first to unset other primaries
  if (updates.is_primary) {
    const { data: existing } = await supabase
      .from("client_users")
      .select("user_id")
      .eq("id", id)
      .single();

    if (existing) {
      await supabase
        .from("client_users")
        .update({ is_primary: false })
        .eq("user_id", existing.user_id)
        .eq("is_primary", true)
        .neq("id", id);
    }
  }

  const { data, error } = await supabase
    .from("client_users")
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
 * Remove a user from a client
 */
export async function removeClientUser(id: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from("client_users")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Set a client as the user's primary
 */
export async function setPrimaryClient(clientId: string): Promise<void> {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Not authenticated");
  }

  // Unset all primaries for this user
  await supabase
    .from("client_users")
    .update({ is_primary: false })
    .eq("user_id", user.id);

  // Set the new primary
  const { error } = await supabase
    .from("client_users")
    .update({ is_primary: true })
    .eq("user_id", user.id)
    .eq("client_id", clientId);

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Check if user has access to a client
 */
export async function userHasClientAccess(
  userId: string,
  clientId: string
): Promise<boolean> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("client_users")
    .select("id")
    .eq("user_id", userId)
    .eq("client_id", clientId)
    .single();

  if (error) {
    return false;
  }

  return !!data;
}

/**
 * Get user's role for a specific client
 */
export async function getUserClientRole(
  userId: string,
  clientId: string
): Promise<ClientUserRole | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("client_users")
    .select("role")
    .eq("user_id", userId)
    .eq("client_id", clientId)
    .single();

  if (error || !data) {
    return null;
  }

  return data.role as ClientUserRole;
}

/**
 * Add a user to a client by email
 * Looks up the user in user_profiles and adds them to the client
 */
export async function addUserToClientByEmail(
  clientId: string,
  email: string,
  role: ClientUserRole = "member"
): Promise<{ success: boolean; message: string; clientUser?: ClientUser }> {
  const supabase = createClient();

  // Check if user exists by email in user_profiles
  const { data: existingUser, error: lookupError } = await supabase
    .from("user_profiles")
    .select("id, email")
    .eq("email", email.toLowerCase())
    .single();

  if (lookupError || !existingUser) {
    return {
      success: false,
      message: "User not found. They must create an account first before being added.",
    };
  }

  // Check if user is already associated with this client
  const { data: existingAssociation } = await supabase
    .from("client_users")
    .select("id")
    .eq("client_id", clientId)
    .eq("user_id", existingUser.id)
    .single();

  if (existingAssociation) {
    return {
      success: false,
      message: "This user already has access to this client.",
    };
  }

  // User exists, add them to the client
  try {
    const clientUser = await addClientUser(clientId, existingUser.id, role, false);
    return {
      success: true,
      message: "User added successfully",
      clientUser,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to add user",
    };
  }
}

export interface CreateUserData {
  email: string;
  full_name: string;
  phone?: string;
  title?: string;
  password: string;
}

export interface InviteUserData {
  email: string;
  full_name?: string;
  phone?: string;
  title?: string;
}

/**
 * Create a new portal user and assign them to a client
 * This creates the auth user, user_profile, and client_users entry
 */
export async function createPortalUser(
  clientId: string,
  userData: CreateUserData,
  role: ClientUserRole = "member",
  isPrimary: boolean = false
): Promise<{ success: boolean; message: string; clientUser?: ClientUser }> {
  const supabase = createClient();

  // Check if user with this email already exists
  const { data: existingUser } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("email", userData.email.toLowerCase())
    .single();

  if (existingUser) {
    return {
      success: false,
      message: "A user with this email already exists. Use 'Add Existing User' instead.",
    };
  }

  // Create the auth user via signup
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: userData.email.toLowerCase(),
    password: userData.password,
    options: {
      data: {
        full_name: userData.full_name,
      },
    },
  });

  if (authError || !authData.user) {
    return {
      success: false,
      message: authError?.message || "Failed to create user account",
    };
  }

  // Wait a moment for the trigger to create the user_profile
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Update the user_profile with additional info
  const { error: profileError } = await supabase
    .from("user_profiles")
    .update({
      full_name: userData.full_name,
      phone: userData.phone || null,
      title: userData.title || null,
    })
    .eq("id", authData.user.id);

  if (profileError) {
    console.error("Failed to update user profile:", profileError);
    // Continue anyway - the user was created
  }

  // Add the user to the client
  try {
    const clientUser = await addClientUser(clientId, authData.user.id, role, isPrimary);
    return {
      success: true,
      message: "User created and added successfully",
      clientUser,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to add user to client",
    };
  }
}

/**
 * Invite a new portal user via email
 * Sends an invitation email - user sets their own password
 * Set sendEmail to false to create the user without sending an invite (can send later)
 */
export async function invitePortalUser(
  clientId: string,
  userData: InviteUserData,
  role: ClientUserRole = "member",
  sendEmail: boolean = true
): Promise<{ success: boolean; message: string; userId?: string }> {
  const supabase = createClient();

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
          full_name: userData.full_name,
          phone: userData.phone,
          title: userData.title,
          user_type: "portal",
          client_id: clientId,
          role: role,
          send_email: sendEmail,
        }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      return {
        success: false,
        message: result.error || "Failed to create user",
      };
    }

    return {
      success: true,
      message: sendEmail
        ? "Invitation email sent successfully"
        : "User created successfully. You can send the invitation later.",
      userId: result.user?.id,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to create user",
    };
  }
}

/**
 * Send or resend an invitation email to a portal user
 */
export async function sendPortalUserInvite(
  userId: string,
  email: string
): Promise<{ success: boolean; message: string }> {
  const supabase = createClient();

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
          email: email,
          user_type: "portal",
          resend_user_id: userId,
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
 * Update a user profile's contact information
 */
export async function updateUserProfile(
  userId: string,
  updates: { full_name?: string; phone?: string; title?: string }
): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from("user_profiles")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (error) {
    throw new Error(error.message);
  }
}
