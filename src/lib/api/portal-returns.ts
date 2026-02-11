import { createClient } from "@/lib/supabase";

export interface PortalReturn {
  id: string;
  return_number: string;
  status: string;
  reason: string | null;
  reason_details: string | null;
  requested_at: string | null;
  approved_at: string | null;
  received_at: string | null;
  processed_at: string | null;
  credit_amount: number | null;
  notes: string | null;
  created_at: string;
  original_order: {
    id: string;
    order_number: string;
  } | null;
}

export interface PortalReturnItem {
  id: string;
  product_id: string;
  product_sku: string;
  product_name: string;
  qty_requested: number;
  qty_received: number | null;
  condition: string | null;
  disposition: string;
  notes: string | null;
}

export interface PortalReturnWithItems extends PortalReturn {
  items: PortalReturnItem[];
}

export interface ReturnRequestItem {
  product_id: string;
  qty_requested: number;
  notes?: string | null;
}

export interface ReturnReason {
  value: string;
  label: string;
  requiresDetails: boolean;
}

export async function getMyReturns(clientId: string): Promise<PortalReturn[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("returns")
    .select(`
      id,
      return_number,
      status,
      reason,
      reason_details,
      requested_at,
      approved_at,
      received_at,
      processed_at,
      credit_amount,
      notes,
      created_at,
      original_order:outbound_orders (id, order_number)
    `)
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data || []).map((ret) => ({
    ...ret,
    original_order: Array.isArray(ret.original_order)
      ? ret.original_order[0]
      : ret.original_order,
  }));
}

export async function getMyReturn(
  clientId: string,
  returnId: string
): Promise<PortalReturnWithItems | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("returns")
    .select(`
      id,
      return_number,
      status,
      reason,
      reason_details,
      requested_at,
      approved_at,
      received_at,
      processed_at,
      credit_amount,
      notes,
      created_at,
      original_order:outbound_orders (id, order_number),
      items:return_items (
        id,
        product_id,
        qty_requested,
        qty_received,
        condition,
        disposition,
        notes,
        product:products (id, sku, name)
      )
    `)
    .eq("id", returnId)
    .eq("client_id", clientId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(error.message);
  }

  // Transform the data
  const items: PortalReturnItem[] = (data.items || []).map((item: any) => {
    const product = Array.isArray(item.product) ? item.product[0] : item.product;
    return {
      id: item.id,
      product_id: item.product_id,
      product_sku: product?.sku || "",
      product_name: product?.name || "Unknown",
      qty_requested: item.qty_requested,
      qty_received: item.qty_received,
      condition: item.condition,
      disposition: item.disposition,
      notes: item.notes,
    };
  });

  return {
    id: data.id,
    return_number: data.return_number,
    status: data.status,
    reason: data.reason,
    reason_details: data.reason_details,
    requested_at: data.requested_at,
    approved_at: data.approved_at,
    received_at: data.received_at,
    processed_at: data.processed_at,
    credit_amount: data.credit_amount,
    notes: data.notes,
    created_at: data.created_at,
    original_order: Array.isArray(data.original_order)
      ? data.original_order[0]
      : data.original_order,
    items,
  };
}

export async function requestReturn(
  clientId: string,
  reason: string,
  reasonDetails: string | null,
  items: ReturnRequestItem[],
  orderId?: string | null
): Promise<PortalReturn> {
  const supabase = createClient();

  // Generate return number
  const year = new Date().getFullYear();
  const prefix = `RMA-${year}-`;

  const { data: lastReturn } = await supabase
    .from("returns")
    .select("return_number")
    .like("return_number", `${prefix}%`)
    .order("return_number", { ascending: false })
    .limit(1);

  let nextNumber = 1;
  if (lastReturn && lastReturn.length > 0) {
    const lastSequence = parseInt(lastReturn[0].return_number.replace(prefix, ""), 10);
    if (!isNaN(lastSequence)) {
      nextNumber = lastSequence + 1;
    }
  }

  const returnNumber = `${prefix}${nextNumber.toString().padStart(5, "0")}`;

  // Create the return
  const { data: returnRecord, error: returnError } = await supabase
    .from("returns")
    .insert({
      return_number: returnNumber,
      client_id: clientId,
      original_order_id: orderId || null,
      status: "requested",
      reason,
      reason_details: reasonDetails,
      requested_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (returnError) {
    throw new Error(returnError.message);
  }

  // Create return items
  if (items.length > 0) {
    const returnItems = items.map((item) => ({
      return_id: returnRecord.id,
      product_id: item.product_id,
      qty_requested: item.qty_requested,
      disposition: "pending",
      notes: item.notes || null,
    }));

    const { error: itemsError } = await supabase
      .from("return_items")
      .insert(returnItems);

    if (itemsError) {
      // Rollback the return if items fail
      await supabase.from("returns").delete().eq("id", returnRecord.id);
      throw new Error(itemsError.message);
    }
  }

  // Log activity
  await supabase.from("activity_log").insert({
    entity_type: "return",
    entity_id: returnRecord.id,
    action: "requested",
    details: {
      return_number: returnNumber,
      client_id: clientId,
      reason,
      item_count: items.length,
    },
  });

  return {
    ...returnRecord,
    original_order: null,
  };
}

export function getReturnReasons(): ReturnReason[] {
  return [
    {
      value: "defective",
      label: "Defective or Damaged",
      requiresDetails: true,
    },
    {
      value: "wrong_item",
      label: "Wrong Item Received",
      requiresDetails: true,
    },
    {
      value: "not_as_described",
      label: "Not as Described",
      requiresDetails: true,
    },
    {
      value: "no_longer_needed",
      label: "No Longer Needed",
      requiresDetails: false,
    },
    {
      value: "ordered_by_mistake",
      label: "Ordered by Mistake",
      requiresDetails: false,
    },
    {
      value: "quality_issue",
      label: "Quality Not as Expected",
      requiresDetails: true,
    },
    {
      value: "other",
      label: "Other",
      requiresDetails: true,
    },
  ];
}

export async function getReturnableOrders(clientId: string): Promise<{
  id: string;
  order_number: string;
  shipped_date: string | null;
  items: {
    product_id: string;
    product_sku: string;
    product_name: string;
    qty_shipped: number;
  }[];
}[]> {
  const supabase = createClient();

  // Get orders shipped within the last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data, error } = await supabase
    .from("outbound_orders")
    .select(`
      id,
      order_number,
      shipped_date,
      items:outbound_items (
        product_id,
        qty_shipped,
        product:products (id, sku, name)
      )
    `)
    .eq("client_id", clientId)
    .in("status", ["shipped", "delivered"])
    .gte("shipped_date", thirtyDaysAgo.toISOString())
    .order("shipped_date", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data || []).map((order) => ({
    id: order.id,
    order_number: order.order_number,
    shipped_date: order.shipped_date,
    items: (order.items || []).map((item: any) => {
      const product = Array.isArray(item.product) ? item.product[0] : item.product;
      return {
        product_id: item.product_id,
        product_sku: product?.sku || "",
        product_name: product?.name || "Unknown",
        qty_shipped: item.qty_shipped,
      };
    }),
  }));
}
