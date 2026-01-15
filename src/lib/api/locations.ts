import { createClient } from "@/lib/supabase";

export interface Location {
  id: string;
  name: string;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  active: boolean;
  created_at: string;
}

export async function getLocations(): Promise<Location[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("locations")
    .select("*")
    .order("name");

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export async function getLocation(id: string): Promise<Location | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("locations")
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

export async function createLocation(
  location: Omit<Location, "id" | "created_at">
): Promise<Location> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("locations")
    .insert(location)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function updateLocation(
  id: string,
  location: Partial<Omit<Location, "id" | "created_at">>
): Promise<Location> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("locations")
    .update(location)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function deleteLocation(id: string): Promise<void> {
  const supabase = createClient();

  // Check if location has any inventory
  const { data: inventory, error: inventoryError } = await supabase
    .from("inventory")
    .select("id")
    .eq("location_id", id)
    .limit(1);

  if (inventoryError) {
    throw new Error(inventoryError.message);
  }

  if (inventory && inventory.length > 0) {
    throw new Error("Cannot delete location with existing inventory. Please transfer or remove all inventory first.");
  }

  // Check if location has any pending transfers
  const { data: transfers, error: transfersError } = await supabase
    .from("stock_transfers")
    .select("id")
    .or(`from_location_id.eq.${id},to_location_id.eq.${id}`)
    .eq("status", "pending")
    .limit(1);

  if (transfersError) {
    throw new Error(transfersError.message);
  }

  if (transfers && transfers.length > 0) {
    throw new Error("Cannot delete location with pending transfers. Please complete or cancel all transfers first.");
  }

  const { error } = await supabase
    .from("locations")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}
