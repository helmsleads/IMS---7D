import { createClient } from "@/lib/supabase";

export interface PortalAddress {
  id: string;
  label: string | null;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  zip: string;
  country: string;
  is_default: boolean;
  is_billing: boolean;
  created_at: string;
}

export interface CreateAddressData {
  label?: string | null;
  address_line1: string;
  address_line2?: string | null;
  city: string;
  state: string;
  zip: string;
  country?: string;
  is_default?: boolean;
  is_billing?: boolean;
}

export async function getMyAddresses(clientId: string): Promise<PortalAddress[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("client_addresses")
    .select(`
      id,
      label,
      address_line1,
      address_line2,
      city,
      state,
      zip,
      country,
      is_default,
      is_billing,
      created_at
    `)
    .eq("client_id", clientId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export async function createMyAddress(
  clientId: string,
  data: CreateAddressData
): Promise<PortalAddress> {
  const supabase = createClient();

  // If setting as default, clear existing default
  if (data.is_default) {
    await supabase
      .from("client_addresses")
      .update({ is_default: false })
      .eq("client_id", clientId)
      .eq("is_default", true);
  }

  // If setting as billing, clear existing billing
  if (data.is_billing) {
    await supabase
      .from("client_addresses")
      .update({ is_billing: false })
      .eq("client_id", clientId)
      .eq("is_billing", true);
  }

  const { data: address, error } = await supabase
    .from("client_addresses")
    .insert({
      client_id: clientId,
      label: data.label || null,
      address_line1: data.address_line1,
      address_line2: data.address_line2 || null,
      city: data.city,
      state: data.state,
      zip: data.zip,
      country: data.country || "USA",
      is_default: data.is_default || false,
      is_billing: data.is_billing || false,
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return address;
}

export async function updateMyAddress(
  clientId: string,
  addressId: string,
  data: Partial<CreateAddressData>
): Promise<PortalAddress> {
  const supabase = createClient();

  // Verify ownership
  const { data: existing, error: existError } = await supabase
    .from("client_addresses")
    .select("id")
    .eq("id", addressId)
    .eq("client_id", clientId)
    .single();

  if (existError || !existing) {
    throw new Error("Address not found or access denied");
  }

  // If setting as default, clear existing default
  if (data.is_default) {
    await supabase
      .from("client_addresses")
      .update({ is_default: false })
      .eq("client_id", clientId)
      .eq("is_default", true)
      .neq("id", addressId);
  }

  // If setting as billing, clear existing billing
  if (data.is_billing) {
    await supabase
      .from("client_addresses")
      .update({ is_billing: false })
      .eq("client_id", clientId)
      .eq("is_billing", true)
      .neq("id", addressId);
  }

  const { data: address, error } = await supabase
    .from("client_addresses")
    .update({
      label: data.label,
      address_line1: data.address_line1,
      address_line2: data.address_line2,
      city: data.city,
      state: data.state,
      zip: data.zip,
      country: data.country,
      is_default: data.is_default,
      is_billing: data.is_billing,
    })
    .eq("id", addressId)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return address;
}

export async function deleteMyAddress(
  clientId: string,
  addressId: string
): Promise<void> {
  const supabase = createClient();

  // Verify ownership
  const { data: existing, error: existError } = await supabase
    .from("client_addresses")
    .select("id, is_default")
    .eq("id", addressId)
    .eq("client_id", clientId)
    .single();

  if (existError || !existing) {
    throw new Error("Address not found or access denied");
  }

  // Check if address is used by any templates
  const { data: templates } = await supabase
    .from("order_templates")
    .select("id")
    .eq("address_id", addressId)
    .limit(1);

  if (templates && templates.length > 0) {
    throw new Error("Cannot delete address that is used by order templates");
  }

  const { error } = await supabase
    .from("client_addresses")
    .delete()
    .eq("id", addressId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function setMyDefaultAddress(
  clientId: string,
  addressId: string
): Promise<PortalAddress> {
  const supabase = createClient();

  // Verify ownership
  const { data: existing, error: existError } = await supabase
    .from("client_addresses")
    .select("id")
    .eq("id", addressId)
    .eq("client_id", clientId)
    .single();

  if (existError || !existing) {
    throw new Error("Address not found or access denied");
  }

  // Clear existing default
  await supabase
    .from("client_addresses")
    .update({ is_default: false })
    .eq("client_id", clientId)
    .eq("is_default", true);

  // Set new default
  const { data: address, error } = await supabase
    .from("client_addresses")
    .update({ is_default: true })
    .eq("id", addressId)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return address;
}

export async function getMyDefaultAddress(clientId: string): Promise<PortalAddress | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("client_addresses")
    .select(`
      id,
      label,
      address_line1,
      address_line2,
      city,
      state,
      zip,
      country,
      is_default,
      is_billing,
      created_at
    `)
    .eq("client_id", clientId)
    .eq("is_default", true)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(error.message);
  }

  return data;
}

export async function getMyBillingAddress(clientId: string): Promise<PortalAddress | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("client_addresses")
    .select(`
      id,
      label,
      address_line1,
      address_line2,
      city,
      state,
      zip,
      country,
      is_default,
      is_billing,
      created_at
    `)
    .eq("client_id", clientId)
    .eq("is_billing", true)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(error.message);
  }

  return data;
}
