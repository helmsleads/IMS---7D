import { createClient } from "@/lib/supabase";
import { SystemSetting, ClientSetting, PortalSetting } from "@/types/database";

export async function getSystemSettings(category?: string): Promise<SystemSetting[]> {
  const supabase = createClient();

  let query = supabase
    .from("system_settings")
    .select("*")
    .order("category")
    .order("setting_key");

  if (category) {
    query = query.eq("category", category);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export async function getSystemSetting(
  category: string,
  key: string
): Promise<SystemSetting | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("system_settings")
    .select("*")
    .eq("category", category)
    .eq("setting_key", key)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(error.message);
  }

  return data;
}

export async function setSystemSetting(
  category: string,
  key: string,
  value: unknown,
  description?: string
): Promise<SystemSetting> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("system_settings")
    .upsert(
      {
        category,
        setting_key: key,
        setting_value: value,
        description: description ?? null,
      },
      { onConflict: "category,setting_key" }
    )
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function deleteSystemSetting(
  category: string,
  key: string
): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from("system_settings")
    .delete()
    .eq("category", category)
    .eq("setting_key", key);

  if (error) {
    throw new Error(error.message);
  }
}

export async function getClientSettings(
  clientId: string,
  category?: string
): Promise<ClientSetting[]> {
  const supabase = createClient();

  let query = supabase
    .from("client_settings")
    .select("*")
    .eq("client_id", clientId)
    .order("category")
    .order("setting_key");

  if (category) {
    query = query.eq("category", category);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export async function getClientSetting(
  clientId: string,
  category: string,
  key: string
): Promise<ClientSetting | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("client_settings")
    .select("*")
    .eq("client_id", clientId)
    .eq("category", category)
    .eq("setting_key", key)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(error.message);
  }

  return data;
}

export async function setClientSetting(
  clientId: string,
  category: string,
  key: string,
  value: unknown
): Promise<ClientSetting> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("client_settings")
    .upsert(
      {
        client_id: clientId,
        category,
        setting_key: key,
        setting_value: value,
      },
      { onConflict: "client_id,category,setting_key" }
    )
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function deleteClientSetting(
  clientId: string,
  category: string,
  key: string
): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from("client_settings")
    .delete()
    .eq("client_id", clientId)
    .eq("category", category)
    .eq("setting_key", key);

  if (error) {
    throw new Error(error.message);
  }
}

export interface EffectiveSetting {
  value: unknown;
  source: "client" | "system" | "default";
}

export async function getEffectiveSetting(
  clientId: string,
  category: string,
  key: string,
  defaultValue?: unknown
): Promise<EffectiveSetting> {
  // First, check client-specific setting
  const clientSetting = await getClientSetting(clientId, category, key);
  if (clientSetting) {
    return {
      value: clientSetting.setting_value,
      source: "client",
    };
  }

  // Fall back to system setting
  const systemSetting = await getSystemSetting(category, key);
  if (systemSetting) {
    return {
      value: systemSetting.setting_value,
      source: "system",
    };
  }

  // Return default value
  return {
    value: defaultValue ?? null,
    source: "default",
  };
}

export async function getPortalSettings(): Promise<PortalSetting[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("portal_settings")
    .select("*")
    .order("setting_key");

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export async function getPortalSetting(key: string): Promise<PortalSetting | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("portal_settings")
    .select("*")
    .eq("setting_key", key)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(error.message);
  }

  return data;
}

export async function setPortalSetting(
  key: string,
  value: unknown
): Promise<PortalSetting> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("portal_settings")
    .upsert(
      {
        setting_key: key,
        setting_value: value,
      },
      { onConflict: "setting_key" }
    )
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}
