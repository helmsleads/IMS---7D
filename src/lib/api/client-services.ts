import { createClient } from "@/lib/supabase";
import { ClientService, ClientAddon } from "@/types/database";

export interface ClientServiceWithDetails extends Omit<ClientService, 'service' | 'tier'> {
  service: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    base_price: number | null;
    price_unit: string | null;
  };
  tier: {
    id: string;
    name: string;
    slug: string;
  } | null;
}

export async function getClientServices(clientId: string): Promise<ClientServiceWithDetails[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("client_services")
    .select(`
      *,
      service:services (id, name, slug, description, base_price, price_unit),
      tier:service_tiers (id, name, slug)
    `)
    .eq("client_id", clientId)
    .order("created_at");

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export async function assignClientService(
  clientId: string,
  serviceId: string,
  tierId: string | null,
  customPrice?: number | null,
  customPriceUnit?: string | null
): Promise<ClientService> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("client_services")
    .insert({
      client_id: clientId,
      service_id: serviceId,
      tier_id: tierId,
      custom_price: customPrice ?? null,
      custom_price_unit: customPriceUnit ?? null,
      is_active: true,
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function updateClientService(
  id: string,
  data: Partial<ClientService>
): Promise<ClientService> {
  const supabase = createClient();

  const { data: updated, error } = await supabase
    .from("client_services")
    .update(data)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return updated;
}

export async function removeClientService(id: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from("client_services")
    .update({
      is_active: false,
      ended_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

export interface ClientAddonWithDetails extends Omit<ClientAddon, 'addon'> {
  addon: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    price: number | null;
    price_unit: string | null;
  };
}

export async function getClientAddons(clientId: string): Promise<ClientAddonWithDetails[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("client_addons")
    .select(`
      *,
      addon:service_addons (id, name, slug, description, price, price_unit)
    `)
    .eq("client_id", clientId)
    .order("created_at");

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export async function assignClientAddon(
  clientId: string,
  addonId: string,
  customPrice?: number | null
): Promise<ClientAddon> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("client_addons")
    .insert({
      client_id: clientId,
      addon_id: addonId,
      custom_price: customPrice ?? null,
      is_active: true,
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function updateClientAddon(
  id: string,
  data: Partial<ClientAddon>
): Promise<ClientAddon> {
  const supabase = createClient();

  const { data: updated, error } = await supabase
    .from("client_addons")
    .update(data)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return updated;
}

export async function removeClientAddon(id: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from("client_addons")
    .update({
      is_active: false,
      ended_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}
