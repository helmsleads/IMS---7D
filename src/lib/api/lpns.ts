import { createClient } from "@/lib/supabase";

export type ContainerType = "pallet" | "case" | "tote" | "bin" | "carton" | "bag" | "other";
export type LPNStatus = "active" | "in_transit" | "shipped" | "empty" | "damaged" | "disposed";
export type LPNStage = "receiving" | "putaway" | "storage" | "picking" | "packing" | "staged" | "shipped";

export interface LPN {
  id: string;
  lpn_number: string;
  container_type: ContainerType;
  location_id: string | null;
  sublocation_id: string | null;
  status: LPNStatus;
  stage: LPNStage;
  parent_lpn_id: string | null;
  length_inches: number | null;
  width_inches: number | null;
  height_inches: number | null;
  weight_lbs: number | null;
  reference_type: string | null;
  reference_id: string | null;
  is_mixed: boolean;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface LPNContent {
  id: string;
  lpn_id: string;
  product_id: string;
  lot_id: string | null;
  qty: number;
  uom: string;
  fill_status: "full" | "empty";
  created_at: string;
  updated_at: string;
}

export interface LPNWithContents extends LPN {
  contents: Array<LPNContent & {
    product: {
      id: string;
      sku: string;
      name: string;
      container_type?: string;
      units_per_case?: number | null;
    };
    lot?: {
      id: string;
      lot_number: string;
      expiration_date: string | null;
    } | null;
  }>;
  location?: {
    id: string;
    name: string;
  } | null;
  sublocation?: {
    id: string;
    code: string;
    name: string | null;
  } | null;
  parent_lpn?: {
    id: string;
    lpn_number: string;
  } | null;
}

export interface LPNFilters {
  status?: LPNStatus;
  stage?: LPNStage;
  containerType?: ContainerType;
  locationId?: string;
  referenceType?: string;
  referenceId?: string;
}

/**
 * Generate a new LPN number
 */
export async function generateLPNNumber(prefix: string = "LPN"): Promise<string> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc("generate_lpn_number", {
    p_prefix: prefix,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

/**
 * Create a new LPN
 */
export async function createLPN(params: {
  containerType: ContainerType;
  locationId?: string;
  sublocationId?: string;
  parentLpnId?: string;
  referenceType?: string;
  referenceId?: string;
  notes?: string;
  createdBy?: string;
  dimensions?: {
    length?: number;
    width?: number;
    height?: number;
    weight?: number;
  };
}): Promise<LPN> {
  const supabase = createClient();

  const lpnNumber = await generateLPNNumber(
    params.containerType === "pallet" ? "PLT" : "LPN"
  );

  const { data, error } = await supabase
    .from("lpns")
    .insert({
      lpn_number: lpnNumber,
      container_type: params.containerType,
      location_id: params.locationId || null,
      sublocation_id: params.sublocationId || null,
      parent_lpn_id: params.parentLpnId || null,
      reference_type: params.referenceType || null,
      reference_id: params.referenceId || null,
      notes: params.notes || null,
      created_by: params.createdBy || null,
      length_inches: params.dimensions?.length || null,
      width_inches: params.dimensions?.width || null,
      height_inches: params.dimensions?.height || null,
      weight_lbs: params.dimensions?.weight || null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

/**
 * Get LPN by ID
 */
export async function getLPN(id: string): Promise<LPNWithContents | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("lpns")
    .select(`
      *,
      contents:lpn_contents (
        *,
        product:products (id, sku, name, container_type, units_per_case),
        lot:lots (id, lot_number, expiration_date)
      ),
      location:locations (id, name),
      sublocation:sublocations (id, code, name),
      parent_lpn:lpns!lpns_parent_lpn_id_fkey (id, lpn_number)
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

/**
 * Get LPN by barcode/number
 */
export async function getLPNByNumber(lpnNumber: string): Promise<LPNWithContents | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("lpns")
    .select(`
      *,
      contents:lpn_contents (
        *,
        product:products (id, sku, name, container_type, units_per_case),
        lot:lots (id, lot_number, expiration_date)
      ),
      location:locations (id, name),
      sublocation:sublocations (id, code, name),
      parent_lpn:lpns!lpns_parent_lpn_id_fkey (id, lpn_number)
    `)
    .eq("lpn_number", lpnNumber)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(error.message);
  }

  return data;
}

/**
 * Get LPNs with optional filtering
 */
export async function getLPNs(filters?: LPNFilters): Promise<LPNWithContents[]> {
  const supabase = createClient();

  let query = supabase
    .from("lpns")
    .select(`
      *,
      contents:lpn_contents (
        *,
        product:products (id, sku, name, container_type, units_per_case),
        lot:lots (id, lot_number, expiration_date)
      ),
      location:locations (id, name),
      sublocation:sublocations (id, code, name),
      parent_lpn:lpns!lpns_parent_lpn_id_fkey (id, lpn_number)
    `)
    .order("created_at", { ascending: false });

  if (filters?.status) {
    query = query.eq("status", filters.status);
  }

  if (filters?.stage) {
    query = query.eq("stage", filters.stage);
  }

  if (filters?.containerType) {
    query = query.eq("container_type", filters.containerType);
  }

  if (filters?.locationId) {
    query = query.eq("location_id", filters.locationId);
  }

  if (filters?.referenceType) {
    query = query.eq("reference_type", filters.referenceType);
  }

  if (filters?.referenceId) {
    query = query.eq("reference_id", filters.referenceId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

/**
 * Add content to an LPN
 */
export async function addLPNContent(params: {
  lpnId: string;
  productId: string;
  qty: number;
  lotId?: string;
  uom?: string;
  fillStatus?: "full" | "empty";
}): Promise<LPNContent> {
  const supabase = createClient();

  // Check if content already exists for this product/lot/fillStatus combo
  const { data: existing } = await supabase
    .from("lpn_contents")
    .select("id, qty")
    .eq("lpn_id", params.lpnId)
    .eq("product_id", params.productId)
    .eq("lot_id", params.lotId || null)
    .eq("fill_status", params.fillStatus || "full")
    .single();

  if (existing) {
    // Update existing content
    const { data, error } = await supabase
      .from("lpn_contents")
      .update({
        qty: existing.qty + params.qty,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }

  // Insert new content
  const { data, error } = await supabase
    .from("lpn_contents")
    .insert({
      lpn_id: params.lpnId,
      product_id: params.productId,
      qty: params.qty,
      lot_id: params.lotId || null,
      uom: params.uom || "each",
      fill_status: params.fillStatus || "full",
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  // Check if LPN is now mixed (multiple products)
  const { data: contentCount } = await supabase
    .from("lpn_contents")
    .select("product_id")
    .eq("lpn_id", params.lpnId);

  const uniqueProducts = new Set((contentCount || []).map(c => c.product_id));
  if (uniqueProducts.size > 1) {
    await supabase
      .from("lpns")
      .update({ is_mixed: true })
      .eq("id", params.lpnId);
  }

  return data;
}

/**
 * Remove content from an LPN
 */
export async function removeLPNContent(
  lpnId: string,
  productId: string,
  qty: number,
  lotId?: string,
  fillStatus?: "full" | "empty"
): Promise<void> {
  const supabase = createClient();

  const { data: existing, error: fetchError } = await supabase
    .from("lpn_contents")
    .select("id, qty")
    .eq("lpn_id", lpnId)
    .eq("product_id", productId)
    .eq("lot_id", lotId || null)
    .eq("fill_status", fillStatus || "full")
    .single();

  if (fetchError) {
    throw new Error(fetchError.message);
  }

  if (existing.qty <= qty) {
    // Remove entirely
    const { error } = await supabase
      .from("lpn_contents")
      .delete()
      .eq("id", existing.id);

    if (error) {
      throw new Error(error.message);
    }
  } else {
    // Reduce quantity
    const { error } = await supabase
      .from("lpn_contents")
      .update({
        qty: existing.qty - qty,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);

    if (error) {
      throw new Error(error.message);
    }
  }
}

/**
 * Update LPN status/stage
 */
export async function updateLPNStatus(
  id: string,
  status?: LPNStatus,
  stage?: LPNStage
): Promise<LPN> {
  const supabase = createClient();

  const updates: Partial<LPN> = {
    updated_at: new Date().toISOString(),
  };

  if (status) updates.status = status;
  if (stage) updates.stage = stage;

  const { data, error } = await supabase
    .from("lpns")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

/**
 * Move LPN to new location
 */
export async function moveLPN(
  id: string,
  locationId: string,
  sublocationId?: string
): Promise<LPN> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("lpns")
    .update({
      location_id: locationId,
      sublocation_id: sublocationId || null,
      stage: "storage",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

/**
 * Get child LPNs (e.g., cases on a pallet)
 */
export async function getChildLPNs(parentLpnId: string): Promise<LPNWithContents[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("lpns")
    .select(`
      *,
      contents:lpn_contents (
        *,
        product:products (id, sku, name, container_type, units_per_case),
        lot:lots (id, lot_number, expiration_date)
      ),
      location:locations (id, name),
      sublocation:sublocations (id, code, name)
    `)
    .eq("parent_lpn_id", parentLpnId);

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

/**
 * Get pallet-type LPNs with contents summary, optionally filtered by location.
 */
export async function getPalletLPNs(locationId?: string): Promise<LPNWithContents[]> {
  const supabase = createClient();

  let query = supabase
    .from("lpns")
    .select(`
      *,
      contents:lpn_contents (
        *,
        product:products (id, sku, name, container_type, units_per_case),
        lot:lots (id, lot_number, expiration_date)
      ),
      location:locations (id, name),
      sublocation:sublocations (id, code, name)
    `)
    .eq("container_type", "pallet")
    .in("status", ["active", "in_transit"])
    .order("created_at", { ascending: false });

  if (locationId) {
    query = query.eq("location_id", locationId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

/**
 * Get LPN by code (alias for getLPNByNumber for clarity).
 */
export async function getLPNByCode(code: string): Promise<LPNWithContents | null> {
  return getLPNByNumber(code);
}
