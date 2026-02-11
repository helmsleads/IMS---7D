import { createClient } from "@/lib/supabase";
import { Return, ReturnItem, ReturnStatus, ItemCondition, ItemDisposition } from "@/types/database";
import { updateInventoryWithTransaction } from "./inventory-transactions";

export interface ReturnFilters {
  clientId?: string;
  status?: ReturnStatus;
}

export interface ReturnItemWithProduct extends ReturnItem {
  product: {
    id: string;
    name: string;
    sku: string;
  } | null;
}

export interface ReturnWithItems extends Omit<Return, 'client' | 'items'> {
  items: ReturnItemWithProduct[];
  client: {
    id: string;
    company_name: string;
  };
}

export async function getReturns(filters?: ReturnFilters): Promise<ReturnWithItems[]> {
  const supabase = createClient();

  let query = supabase
    .from("returns")
    .select(`
      *,
      items:return_items (*, product:products (id, name, sku)),
      client:clients (id, company_name)
    `)
    .order("created_at", { ascending: false });

  if (filters?.clientId) {
    query = query.eq("client_id", filters.clientId);
  }

  if (filters?.status) {
    query = query.eq("status", filters.status);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export async function getReturn(id: string): Promise<ReturnWithItems | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("returns")
    .select(`
      *,
      items:return_items (*, product:products (id, name, sku)),
      client:clients (id, company_name)
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

export async function createReturn(
  returnData: Partial<Return>,
  items: Partial<ReturnItem>[]
): Promise<Return> {
  const supabase = createClient();

  // Generate return number if not provided
  if (!returnData.return_number) {
    returnData.return_number = await generateReturnNumber();
  }

  // Create the return
  const { data: returnRecord, error: returnError } = await supabase
    .from("returns")
    .insert(returnData)
    .select()
    .single();

  if (returnError) {
    throw new Error(returnError.message);
  }

  // Create return items
  if (items.length > 0) {
    const returnItems = items.map((item) => ({
      ...item,
      return_id: returnRecord.id,
    }));

    const { error: itemsError } = await supabase
      .from("return_items")
      .insert(returnItems);

    if (itemsError) {
      throw new Error(itemsError.message);
    }
  }

  return returnRecord;
}

export async function updateReturn(
  id: string,
  returnData: Partial<Return>
): Promise<Return> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("returns")
    .update(returnData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function updateReturnStatus(
  id: string,
  status: ReturnStatus
): Promise<Return> {
  const supabase = createClient();

  const statusUpdates: Partial<Return> = { status };

  // Add timestamp based on status
  const now = new Date().toISOString();
  switch (status) {
    case "approved":
      statusUpdates.approved_at = now;
      break;
    case "received":
      statusUpdates.received_at = now;
      break;
    case "completed":
      statusUpdates.processed_at = now;
      break;
  }

  const { data, error } = await supabase
    .from("returns")
    .update(statusUpdates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function generateReturnNumber(): Promise<string> {
  const supabase = createClient();

  const year = new Date().getFullYear();
  const prefix = `RMA-${year}-`;

  const { data, error } = await supabase
    .from("returns")
    .select("return_number")
    .like("return_number", `${prefix}%`)
    .order("return_number", { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(error.message);
  }

  let nextNumber = 1;

  if (data && data.length > 0) {
    const lastNumber = data[0].return_number;
    const lastSequence = parseInt(lastNumber.replace(prefix, ""), 10);
    if (!isNaN(lastSequence)) {
      nextNumber = lastSequence + 1;
    }
  }

  return `${prefix}${nextNumber.toString().padStart(5, "0")}`;
}

export async function addReturnItem(
  returnId: string,
  item: Partial<ReturnItem>
): Promise<ReturnItem> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("return_items")
    .insert({
      ...item,
      return_id: returnId,
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function updateReturnItem(
  id: string,
  item: Partial<ReturnItem>
): Promise<ReturnItem> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("return_items")
    .update(item)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function deleteReturnItem(id: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from("return_items")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function receiveReturnItem(
  id: string,
  qtyReceived: number,
  condition: ItemCondition,
  disposition: ItemDisposition,
  locationId?: string,
  performedBy?: string
): Promise<ReturnItem> {
  const supabase = createClient();

  // Get the return item with return details
  const { data: item, error: itemError } = await supabase
    .from("return_items")
    .select(`
      *,
      return:returns (id, client_id)
    `)
    .eq("id", id)
    .single();

  if (itemError) {
    throw new Error(itemError.message);
  }

  // Update the return item
  const { data, error } = await supabase
    .from("return_items")
    .update({
      qty_received: qtyReceived,
      condition,
      disposition,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  // If disposition is 'restock' and location is provided, add to inventory
  if (disposition === "restock" && qtyReceived > 0 && locationId) {
    try {
      await updateInventoryWithTransaction({
        productId: item.product_id,
        locationId,
        qtyChange: qtyReceived,
        transactionType: "return_restock",
        referenceType: "return",
        referenceId: item.return_id,
        reason: `Return restock - ${condition} condition`,
        performedBy,
      });
    } catch (inventoryError) {
      // Log but don't fail the return item update
      console.error("Failed to update inventory for return restock:", inventoryError);
    }
  }

  // Record billable event for return processing (if client is set)
  const returnRecord = Array.isArray(item.return) ? item.return[0] : item.return;
  if (returnRecord?.client_id && qtyReceived > 0) {
    try {
      await supabase.rpc("record_billable_event", {
        p_client_id: returnRecord.client_id,
        p_rate_code: "RETURN_PROCESS",
        p_quantity: qtyReceived,
        p_reference_type: "return",
        p_reference_id: item.return_id,
        p_usage_date: new Date().toISOString().split("T")[0],
        p_notes: `Return processing - ${qtyReceived} units, ${condition} condition, ${disposition}`,
      });
    } catch (billingError) {
      // Log billing error but don't fail the return processing
      console.error("Failed to record return billable event:", billingError);
    }
  }

  return data;
}
