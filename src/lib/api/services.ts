import { createClient } from "@/lib/supabase";
import { Service, ServiceAddon } from "@/types/database";

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

