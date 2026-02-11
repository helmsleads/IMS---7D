import { createClient } from "@/lib/supabase";
import { LocationType } from "@/types/database";

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
  location_type: LocationType;
  is_pickable: boolean;
  capacity: number | null;
  current_occupancy: number;
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

export async function getLocationsByType(type: LocationType): Promise<Location[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("locations")
    .select("*")
    .eq("location_type", type)
    .eq("active", true)
    .order("name");

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export async function updateLocationType(
  id: string,
  type: LocationType
): Promise<Location> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("locations")
    .update({ location_type: type })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function getPickableLocations(): Promise<Location[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("locations")
    .select("*")
    .eq("is_pickable", true)
    .eq("active", true)
    .order("name");

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export async function updateLocationOccupancy(id: string): Promise<Location> {
  const supabase = createClient();

  // Calculate total inventory quantity at this location
  const { data: inventory, error: invError } = await supabase
    .from("inventory")
    .select("qty_on_hand")
    .eq("location_id", id);

  if (invError) {
    throw new Error(invError.message);
  }

  const currentOccupancy = (inventory || []).reduce(
    (sum, item) => sum + (item.qty_on_hand || 0),
    0
  );

  // Update the location
  const { data, error } = await supabase
    .from("locations")
    .update({ current_occupancy: currentOccupancy })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}
