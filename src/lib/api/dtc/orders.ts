import { createServiceClient } from "@/lib/supabase-service";
import { DTC_OUTBOUND_PLATFORM, formatDtcOrderNumber } from "./constants";

const MAX_VARCHAR_50 = 50;

function fitVarchar50(value: string, fallback: string): string {
  if (value.length <= MAX_VARCHAR_50) {
    return value;
  }
  return fallback.length <= MAX_VARCHAR_50 ? fallback : fallback.slice(0, MAX_VARCHAR_50);
}

export interface DtcShipTo {
  name?: string | null;
  company?: string | null;
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  country?: string | null;
  phone?: string | null;
  email?: string | null;
}

export interface DtcOrderItemInput {
  product_id: string;
  quantity: number;
  unit_price?: number;
}

export interface CreateDtcOutboundOrderInput {
  external_order_id: string;
  external_order_number?: string | null;
  ship_to?: DtcShipTo | null;
  items: DtcOrderItemInput[];
  notes?: string | null;
}

export async function findDtcOutboundOrder(clientId: string, externalOrderId: string) {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("outbound_orders")
    .select(
      "id, order_number, client_id, status, external_order_id, external_platform, external_order_number, tracking_number, carrier, shipped_date, delivered_date, created_at",
    )
    .eq("client_id", clientId)
    .eq("external_platform", DTC_OUTBOUND_PLATFORM)
    .eq("external_order_id", externalOrderId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function createDtcOutboundOrder(
  clientId: string,
  input: CreateDtcOutboundOrderInput,
) {
  const supabase = createServiceClient();

  const existing = await findDtcOutboundOrder(clientId, input.external_order_id);
  if (existing) {
    return { order: existing, created: false };
  }

  if (!Array.isArray(input.items) || input.items.length === 0) {
    const error = new Error("items are required");
    (error as Error & { status?: number }).status = 400;
    throw error;
  }

  const productIds = input.items.map((item) => item.product_id);
  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id, sku, base_price")
    .eq("client_id", clientId)
    .in("id", productIds);

  if (productsError) {
    throw new Error(productsError.message);
  }

  const productMap = new Map((products ?? []).map((product) => [product.id, product]));

  for (const item of input.items) {
    if (!productMap.has(item.product_id) || item.quantity < 1) {
      const error = new Error(`Invalid product or quantity: ${item.product_id}`);
      (error as Error & { status?: number }).status = 400;
      throw error;
    }
  }

  const shipTo = input.ship_to ?? {};
  const orderNumber = formatDtcOrderNumber(
    input.external_order_number ?? "",
    input.external_order_id,
  );
  const externalOrderNumber = fitVarchar50(
    input.external_order_number ?? input.external_order_id,
    input.external_order_id,
  );

  const { data: newOrder, error: orderError } = await supabase
    .from("outbound_orders")
    .insert({
      client_id: clientId,
      order_number: orderNumber,
      source: "api",
      status: "pending",
      external_order_id: input.external_order_id,
      external_platform: DTC_OUTBOUND_PLATFORM,
      external_order_number: externalOrderNumber,
      ship_to_name: shipTo.name ?? null,
      ship_to_company: shipTo.company ?? null,
      ship_to_address: shipTo.line1 ?? null,
      ship_to_address2: shipTo.line2 ?? null,
      ship_to_city: shipTo.city ?? null,
      ship_to_state: shipTo.state ?? null,
      ship_to_zip: shipTo.zip ?? null,
      ship_to_country: shipTo.country ?? "US",
      ship_to_phone: shipTo.phone ?? null,
      ship_to_email: shipTo.email ?? null,
      notes: input.notes ?? null,
      requested_at: new Date().toISOString(),
    })
    .select(
      "id, order_number, client_id, status, external_order_id, external_platform, external_order_number, tracking_number, carrier, shipped_date, delivered_date, created_at",
    )
    .single();

  if (orderError) {
    throw new Error(orderError.message);
  }

  const lineItems = input.items.map((item) => {
    const product = productMap.get(item.product_id)!;
    return {
      order_id: newOrder.id,
      product_id: item.product_id,
      qty_requested: item.quantity,
      qty_shipped: 0,
      unit_price: item.unit_price ?? Number(product.base_price ?? 0),
    };
  });

  const { error: itemsError } = await supabase.from("outbound_items").insert(lineItems);

  if (itemsError) {
    await supabase.from("outbound_orders").delete().eq("id", newOrder.id);
    throw new Error(itemsError.message);
  }

  await supabase.from("activity_log").insert({
    entity_type: "outbound_order",
    entity_id: newOrder.id,
    action: "created",
    user_id: null,
    details: {
      source: "dtc",
      external_order_id: input.external_order_id,
      item_count: lineItems.length,
    },
  });

  return { order: newOrder, created: true };
}
