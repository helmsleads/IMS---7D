import { createClient } from "@/lib/supabase";
import { Sublocation } from "@/types/database";

export interface SublocationWithLocation extends Sublocation {
  location: {
    id: string;
    name: string;
  };
}

export async function getSublocations(locationId?: string): Promise<SublocationWithLocation[]> {
  const supabase = createClient();

  let query = supabase
    .from("sublocations")
    .select(`
      *,
      location:locations (id, name)
    `)
    .order("zone")
    .order("aisle")
    .order("rack")
    .order("shelf")
    .order("bin");

  if (locationId) {
    query = query.eq("location_id", locationId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export async function getSublocation(id: string): Promise<SublocationWithLocation | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("sublocations")
    .select(`
      *,
      location:locations (id, name)
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

export async function createSublocation(
  sublocation: Partial<Sublocation>
): Promise<Sublocation> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("sublocations")
    .insert(sublocation)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function updateSublocation(
  id: string,
  sublocation: Partial<Sublocation>
): Promise<Sublocation> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("sublocations")
    .update(sublocation)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function deleteSublocation(id: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from("sublocations")
    .update({ is_active: false })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function getSublocationByBarcode(
  barcode: string
): Promise<SublocationWithLocation | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("sublocations")
    .select(`
      *,
      location:locations (id, name)
    `)
    .eq("barcode", barcode)
    .eq("is_active", true)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(error.message);
  }

  return data;
}

export async function generateSublocationBarcode(
  locationId: string,
  code: string
): Promise<string> {
  const supabase = createClient();

  // Get location for prefix
  const { data: location, error: locationError } = await supabase
    .from("locations")
    .select("name")
    .eq("id", locationId)
    .single();

  if (locationError) {
    throw new Error(locationError.message);
  }

  // Generate barcode: LOC-{location prefix}-{code}
  const locationPrefix = location.name
    .substring(0, 3)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

  const barcode = `LOC-${locationPrefix}-${code}`;

  return barcode;
}
