import { createClient } from "@/lib/supabase";

/**
 * Resolves the portal tenant for the current session: client_users first,
 * then legacy clients.auth_id = auth user id.
 */
export async function resolveCurrentPortalClientId(): Promise<string | null> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: clientUsers } = await supabase
    .from("client_users")
    .select("client_id, is_primary")
    .eq("user_id", user.id)
    .order("is_primary", { ascending: false })
    .limit(1);

  if (clientUsers && clientUsers.length > 0) {
    return clientUsers[0].client_id;
  }

  const { data: legacyClient } = await supabase
    .from("clients")
    .select("id")
    .eq("auth_id", user.id)
    .limit(1)
    .single();

  return legacyClient?.id ?? null;
}
