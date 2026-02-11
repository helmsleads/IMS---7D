import { createClient } from "@/lib/supabase";
import { Lot, LotInventory, LotStatus } from "@/types/database";

export interface LotFilters {
  productId?: string;
  status?: LotStatus;
  expiringSoon?: boolean;
}

export interface LotWithInventory extends Omit<Lot, 'product'> {
  lot_inventory: LotInventory[];
  product: {
    id: string;
    sku: string;
    name: string;
  };
}

export async function getLots(filters?: LotFilters): Promise<LotWithInventory[]> {
  const supabase = createClient();

  let query = supabase
    .from("lots")
    .select(`
      *,
      lot_inventory (*),
      product:products (id, sku, name)
    `)
    .order("created_at", { ascending: false });

  if (filters?.productId) {
    query = query.eq("product_id", filters.productId);
  }

  if (filters?.status) {
    query = query.eq("status", filters.status);
  }

  if (filters?.expiringSoon) {
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    query = query.lte("expiration_date", thirtyDaysFromNow.toISOString().split("T")[0]);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export async function getLot(id: string): Promise<LotWithInventory | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("lots")
    .select(`
      *,
      lot_inventory (*),
      product:products (id, sku, name)
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

export async function createLot(lot: Partial<Lot>): Promise<Lot> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("lots")
    .insert(lot)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function updateLot(id: string, lot: Partial<Lot>): Promise<Lot> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("lots")
    .update(lot)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export interface LotInventoryWithLocation extends Omit<LotInventory, 'lot' | 'location' | 'sublocation'> {
  location: {
    id: string;
    name: string;
  };
  sublocation: {
    id: string;
    code: string;
    name: string | null;
  } | null;
}

export async function getLotInventory(lotId: string): Promise<LotInventoryWithLocation[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("lot_inventory")
    .select(`
      *,
      location:locations (id, name),
      sublocation:sublocations (id, code, name)
    `)
    .eq("lot_id", lotId);

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export async function adjustLotInventory(
  lotId: string,
  locationId: string,
  adjustment: number,
  reason: string
): Promise<LotInventory> {
  const supabase = createClient();

  // Get current inventory for this lot at this location
  const { data: existing, error: fetchError } = await supabase
    .from("lot_inventory")
    .select("*")
    .eq("lot_id", lotId)
    .eq("location_id", locationId)
    .single();

  if (fetchError && fetchError.code !== "PGRST116") {
    throw new Error(fetchError.message);
  }

  if (existing) {
    // Update existing inventory
    const newQty = existing.qty_on_hand + adjustment;
    if (newQty < 0) {
      throw new Error("Adjustment would result in negative inventory");
    }

    const { data, error } = await supabase
      .from("lot_inventory")
      .update({ qty_on_hand: newQty })
      .eq("id", existing.id)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data;
  } else {
    // Create new inventory record
    if (adjustment < 0) {
      throw new Error("Cannot create inventory record with negative quantity");
    }

    const { data, error } = await supabase
      .from("lot_inventory")
      .insert({
        lot_id: lotId,
        location_id: locationId,
        qty_on_hand: adjustment,
        qty_reserved: 0,
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }
}

export async function getExpiringLots(daysAhead: number): Promise<LotWithInventory[]> {
  const supabase = createClient();

  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysAhead);

  const { data, error } = await supabase
    .from("lots")
    .select(`
      *,
      lot_inventory (*),
      product:products (id, sku, name)
    `)
    .eq("status", "active")
    .not("expiration_date", "is", null)
    .lte("expiration_date", futureDate.toISOString().split("T")[0])
    .order("expiration_date");

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export async function markLotDepleted(id: string): Promise<Lot> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("lots")
    .update({ status: "depleted" })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}
