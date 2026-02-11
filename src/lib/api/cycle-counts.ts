import { createClient } from "@/lib/supabase";
import { CycleCount, CycleCountItem, CountStatus, CountType } from "@/types/database";
import { updateInventoryWithTransaction } from "./inventory-transactions";

export interface CycleCountFilters {
  locationId?: string;
  status?: CountStatus;
  countType?: CountType;
  assignedTo?: string;
  startDate?: string;
  endDate?: string;
}

export interface CycleCountWithItems extends CycleCount {
  items: CycleCountItemWithProduct[];
  location: {
    id: string;
    name: string;
  } | null;
}

export interface CycleCountItemWithProduct extends CycleCountItem {
  product: {
    id: string;
    sku: string;
    name: string;
    unit_cost: number;
  };
  sublocation?: {
    id: string;
    code: string;
    name: string | null;
  } | null;
}

export async function getCycleCounts(
  filters?: CycleCountFilters
): Promise<CycleCountWithItems[]> {
  const supabase = createClient();

  let query = supabase
    .from("cycle_counts")
    .select(`
      *,
      items:cycle_count_items (
        *,
        product:products (id, sku, name, unit_cost),
        sublocation:sublocations (id, code, name)
      ),
      location:locations (id, name)
    `)
    .order("created_at", { ascending: false });

  if (filters?.locationId) {
    query = query.eq("location_id", filters.locationId);
  }

  if (filters?.status) {
    query = query.eq("status", filters.status);
  }

  if (filters?.countType) {
    query = query.eq("count_type", filters.countType);
  }

  if (filters?.assignedTo) {
    query = query.eq("assigned_to", filters.assignedTo);
  }

  if (filters?.startDate) {
    query = query.gte("scheduled_date", filters.startDate);
  }

  if (filters?.endDate) {
    query = query.lte("scheduled_date", filters.endDate);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export async function getCycleCount(id: string): Promise<CycleCountWithItems | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("cycle_counts")
    .select(`
      *,
      items:cycle_count_items (
        *,
        product:products (id, sku, name, unit_cost),
        sublocation:sublocations (id, code, name)
      ),
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

export async function createCycleCount(
  count: Partial<CycleCount>
): Promise<CycleCount> {
  const supabase = createClient();

  // Generate count number if not provided
  if (!count.count_number) {
    count.count_number = await generateCountNumber();
  }

  const { data, error } = await supabase
    .from("cycle_counts")
    .insert({
      ...count,
      status: count.status || "pending",
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function updateCycleCount(
  id: string,
  count: Partial<CycleCount>
): Promise<CycleCount> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("cycle_counts")
    .update(count)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function startCycleCount(id: string): Promise<CycleCount> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("cycle_counts")
    .update({
      status: "in_progress",
      started_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function completeCycleCount(id: string): Promise<CycleCount> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("cycle_counts")
    .update({
      status: "pending_approval",
      completed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function approveCycleCount(
  id: string,
  approverId: string
): Promise<CycleCount> {
  const supabase = createClient();

  // Get the count with items
  const count = await getCycleCount(id);
  if (!count) {
    throw new Error("Cycle count not found");
  }

  // Apply inventory adjustments for items with variance using transaction logging
  for (const item of count.items) {
    if (item.counted_qty !== null && item.variance !== null && item.variance !== 0) {
      try {
        // Use transaction-logging RPC to adjust inventory
        await updateInventoryWithTransaction({
          productId: item.product_id,
          locationId: count.location_id,
          qtyChange: item.variance, // variance is the difference (counted - expected)
          transactionType: "cycle_count",
          referenceType: "cycle_count",
          referenceId: id,
          sublocationId: item.sublocation_id || undefined,
          reason: `Cycle count adjustment: expected ${item.expected_qty}, counted ${item.counted_qty}`,
          notes: item.notes || undefined,
          performedBy: approverId,
        });

        // Mark item as adjustment approved
        await supabase
          .from("cycle_count_items")
          .update({ adjustment_approved: true })
          .eq("id", item.id);
      } catch (inventoryError) {
        console.error(`Failed to adjust inventory for item ${item.id}:`, inventoryError);
        // Continue with other items but log the error
      }
    }
  }

  // Update the count status
  const { data, error } = await supabase
    .from("cycle_counts")
    .update({
      status: "completed",
      approved_by: approverId,
      approved_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function cancelCycleCount(id: string): Promise<CycleCount> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("cycle_counts")
    .update({ status: "cancelled" })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function rejectCycleCount(id: string): Promise<CycleCount> {
  const supabase = createClient();

  // Reset all count items - clear counted quantities and variances
  const { error: itemsError } = await supabase
    .from("cycle_count_items")
    .update({
      counted_qty: null,
      variance: null,
      variance_percent: null,
      counted_by: null,
      counted_at: null,
      adjustment_approved: false,
      notes: null,
    })
    .eq("count_id", id);

  if (itemsError) {
    throw new Error(itemsError.message);
  }

  // Reset the count status back to in_progress
  const { data, error } = await supabase
    .from("cycle_counts")
    .update({
      status: "in_progress",
      completed_at: null,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function generateCountNumber(): Promise<string> {
  const supabase = createClient();

  const year = new Date().getFullYear();
  const prefix = `CC-${year}-`;

  const { data, error } = await supabase
    .from("cycle_counts")
    .select("count_number")
    .like("count_number", `${prefix}%`)
    .order("count_number", { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(error.message);
  }

  let nextNumber = 1;

  if (data && data.length > 0) {
    const lastNumber = data[0].count_number;
    const lastSequence = parseInt(lastNumber.replace(prefix, ""), 10);
    if (!isNaN(lastSequence)) {
      nextNumber = lastSequence + 1;
    }
  }

  return `${prefix}${nextNumber.toString().padStart(5, "0")}`;
}

export async function getCycleCountItems(
  countId: string
): Promise<CycleCountItemWithProduct[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("cycle_count_items")
    .select(`
      *,
      product:products (id, sku, name, unit_cost),
      sublocation:sublocations (id, code, name)
    `)
    .eq("count_id", countId)
    .order("created_at");

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export async function addCycleCountItem(
  countId: string,
  productId: string,
  sublocationId?: string | null
): Promise<CycleCountItem> {
  const supabase = createClient();

  // Get the count to find the location
  const { data: count, error: countError } = await supabase
    .from("cycle_counts")
    .select("location_id, blind_count")
    .eq("id", countId)
    .single();

  if (countError) {
    throw new Error(countError.message);
  }

  // Get expected quantity from inventory (unless blind count)
  let expectedQty = 0;
  if (!count.blind_count && count.location_id) {
    const { data: inventory } = await supabase
      .from("inventory")
      .select("qty_on_hand")
      .eq("product_id", productId)
      .eq("location_id", count.location_id)
      .single();

    if (inventory) {
      expectedQty = inventory.qty_on_hand;
    }
  }

  const { data, error } = await supabase
    .from("cycle_count_items")
    .insert({
      count_id: countId,
      product_id: productId,
      sublocation_id: sublocationId ?? null,
      expected_qty: expectedQty,
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function recordCount(
  itemId: string,
  countedQty: number,
  countedBy: string,
  notes?: string | null
): Promise<CycleCountItem> {
  const supabase = createClient();

  // Get the item to calculate variance
  const { data: item, error: itemError } = await supabase
    .from("cycle_count_items")
    .select("expected_qty")
    .eq("id", itemId)
    .single();

  if (itemError) {
    throw new Error(itemError.message);
  }

  const variance = countedQty - item.expected_qty;
  const variancePercent = item.expected_qty > 0
    ? (variance / item.expected_qty) * 100
    : countedQty > 0 ? 100 : 0;

  const updateData: Record<string, unknown> = {
    counted_qty: countedQty,
    variance,
    variance_percent: variancePercent,
    counted_by: countedBy,
    counted_at: new Date().toISOString(),
  };

  if (notes !== undefined) {
    updateData.notes = notes || null;
  }

  const { data, error } = await supabase
    .from("cycle_count_items")
    .update(updateData)
    .eq("id", itemId)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function getCycleCountVariances(
  countId: string
): Promise<CycleCountItemWithProduct[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("cycle_count_items")
    .select(`
      *,
      product:products (id, sku, name, unit_cost),
      sublocation:sublocations (id, code, name)
    `)
    .eq("count_id", countId)
    .not("variance", "is", null)
    .neq("variance", 0)
    .order("variance_percent", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export async function approveVariance(itemId: string): Promise<CycleCountItem> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("cycle_count_items")
    .update({ adjustment_approved: true })
    .eq("id", itemId)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}
