import type { SupabaseClient } from "@supabase/supabase-js";

export type RemoveUserResult =
  | { success: true; fullyRemoved?: boolean }
  | { success: false; error: string };

/**
 * Permanently remove an internal staff user (users row + Supabase auth account).
 */
export async function removeInternalStaffUser(
  service: SupabaseClient,
  userId: string,
  callerUserId: string
): Promise<RemoveUserResult> {
  if (userId === callerUserId) {
    return { success: false, error: "You cannot remove your own account." };
  }

  const { data: target } = await service
    .from("users")
    .select("id, role, active")
    .eq("id", userId)
    .maybeSingle();

  if (!target) {
    return { success: false, error: "User not found." };
  }

  if (target.role === "admin" && target.active) {
    const { count } = await service
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin")
      .eq("active", true);

    if ((count ?? 0) <= 1) {
      return {
        success: false,
        error: "Cannot remove the last active administrator.",
      };
    }
  }

  await service
    .from("clients")
    .update({ account_manager_id: null })
    .eq("account_manager_id", userId);

  await service
    .from("conversation_participants")
    .update({ added_by: null })
    .eq("added_by", userId);

  await service
    .from("inbound_orders")
    .update({ appointment_approved_by: null })
    .eq("appointment_approved_by", userId);

  const { error: deleteRowError } = await service
    .from("users")
    .delete()
    .eq("id", userId);

  if (deleteRowError) {
    return { success: false, error: deleteRowError.message };
  }

  const { error: authError } = await service.auth.admin.deleteUser(userId);
  if (authError) {
    console.error("removeInternalStaffUser auth delete failed:", authError.message);
    return {
      success: false,
      error: `Staff record removed but auth account could not be deleted: ${authError.message}`,
    };
  }

  return { success: true, fullyRemoved: true };
}

/**
 * Remove portal access and delete the auth account when no access remains.
 */
export async function removePortalUser(
  service: SupabaseClient,
  userId: string,
  clientId?: string
): Promise<RemoveUserResult> {
  const { data: staff } = await service
    .from("users")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (staff) {
    return {
      success: false,
      error:
        "This account is an internal staff user. Remove them from System Settings instead.",
    };
  }

  let accessQuery = service.from("client_users").delete().eq("user_id", userId);
  if (clientId) {
    accessQuery = accessQuery.eq("client_id", clientId);
  }

  const { error: accessError } = await accessQuery;
  if (accessError) {
    return { success: false, error: accessError.message };
  }

  const { count } = await service
    .from("client_users")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  if ((count ?? 0) > 0) {
    return { success: true, fullyRemoved: false };
  }

  const { error: profileError } = await service
    .from("user_profiles")
    .delete()
    .eq("id", userId);

  if (profileError) {
    return { success: false, error: profileError.message };
  }

  const { error: authError } = await service.auth.admin.deleteUser(userId);
  if (authError) {
    return { success: false, error: authError.message };
  }

  return { success: true, fullyRemoved: true };
}
