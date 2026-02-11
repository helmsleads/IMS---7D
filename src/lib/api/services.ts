import { createClient } from "@/lib/supabase";
import { Service, ServiceAddon, ServiceTier, ServiceTierPricing } from "@/types/database";

export interface ServiceWithAddons extends Service {
  service_addons: ServiceAddon[];
}

export async function getServices(): Promise<ServiceWithAddons[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("services")
    .select(`
      *,
      service_addons (*)
    `)
    .eq("status", "active")
    .order("sort_order");

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export async function getService(id: string): Promise<ServiceWithAddons | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("services")
    .select(`
      *,
      service_addons (*)
    `)
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(error.message);
  }

  return data;
}

export async function createService(
  service: Partial<Service>
): Promise<Service> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("services")
    .insert(service)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function updateService(
  id: string,
  service: Partial<Service>
): Promise<Service> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("services")
    .update(service)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function deleteService(id: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from("services")
    .update({ status: "archived" })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function getServiceAddons(serviceId: string): Promise<ServiceAddon[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("service_addons")
    .select("*")
    .eq("service_id", serviceId)
    .order("sort_order");

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export async function createServiceAddon(
  addon: Partial<ServiceAddon>
): Promise<ServiceAddon> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("service_addons")
    .insert(addon)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function updateServiceAddon(
  id: string,
  addon: Partial<ServiceAddon>
): Promise<ServiceAddon> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("service_addons")
    .update(addon)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function deleteServiceAddon(id: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from("service_addons")
    .update({ status: "archived" })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

export interface ServiceTierWithPricing extends ServiceTier {
  service_tier_pricing: ServiceTierPricing[];
}

export async function getServiceTiers(): Promise<ServiceTier[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("service_tiers")
    .select("*")
    .order("sort_order");

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export async function getServiceTier(id: string): Promise<ServiceTierWithPricing | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("service_tiers")
    .select(`
      *,
      service_tier_pricing (*)
    `)
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(error.message);
  }

  return data;
}

export async function createServiceTier(
  tier: Partial<ServiceTier>
): Promise<ServiceTier> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("service_tiers")
    .insert(tier)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function updateServiceTier(
  id: string,
  tier: Partial<ServiceTier>
): Promise<ServiceTier> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("service_tiers")
    .update(tier)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function deleteServiceTier(id: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from("service_tiers")
    .update({ status: "archived" })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function getServiceTierPricing(tierId: string): Promise<ServiceTierPricing[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("service_tier_pricing")
    .select("*")
    .eq("tier_id", tierId);

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export async function setServiceTierPrice(
  serviceId: string,
  tierId: string,
  price: number | null,
  priceUnit: string | null
): Promise<ServiceTierPricing> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("service_tier_pricing")
    .upsert(
      {
        service_id: serviceId,
        tier_id: tierId,
        price: price,
        price_unit: priceUnit,
      },
      { onConflict: "service_id,tier_id" }
    )
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}
