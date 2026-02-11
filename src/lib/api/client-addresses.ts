import { createClient } from "@/lib/supabase";
import { ClientAddress } from "@/types/database";

export async function getClientAddresses(clientId: string): Promise<ClientAddress[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("client_addresses")
    .select("*")
    .eq("client_id", clientId)
    .order("is_default", { ascending: false })
    .order("created_at");

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export async function getClientAddress(id: string): Promise<ClientAddress | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("client_addresses")
    .select("*")
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

export async function createClientAddress(
  address: Partial<ClientAddress>
): Promise<ClientAddress> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("client_addresses")
    .insert(address)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function updateClientAddress(
  id: string,
  address: Partial<ClientAddress>
): Promise<ClientAddress> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("client_addresses")
    .update(address)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function deleteClientAddress(id: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from("client_addresses")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function setDefaultAddress(
  clientId: string,
  addressId: string
): Promise<ClientAddress> {
  const supabase = createClient();

  // Clear existing default
  const { error: clearError } = await supabase
    .from("client_addresses")
    .update({ is_default: false })
    .eq("client_id", clientId)
    .eq("is_default", true);

  if (clearError) {
    throw new Error(clearError.message);
  }

  // Set new default
  const { data, error } = await supabase
    .from("client_addresses")
    .update({ is_default: true })
    .eq("id", addressId)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function setBillingAddress(
  clientId: string,
  addressId: string
): Promise<ClientAddress> {
  const supabase = createClient();

  // Clear existing billing address
  const { error: clearError } = await supabase
    .from("client_addresses")
    .update({ is_billing: false })
    .eq("client_id", clientId)
    .eq("is_billing", true);

  if (clearError) {
    throw new Error(clearError.message);
  }

  // Set new billing address
  const { data, error } = await supabase
    .from("client_addresses")
    .update({ is_billing: true })
    .eq("id", addressId)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}
