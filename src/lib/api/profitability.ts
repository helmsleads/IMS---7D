import { createClient } from "@/lib/supabase";
import { ClientProductValue } from "@/types/database";

export interface ClientProductValueWithProduct extends Omit<ClientProductValue, 'product'> {
  product: {
    id: string;
    sku: string;
    name: string;
  };
}

export async function getClientProductValues(clientId: string): Promise<ClientProductValueWithProduct[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("client_product_values")
    .select(`
      *,
      product:products (id, sku, name)
    `)
    .eq("client_id", clientId)
    .order("created_at");

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export async function getClientProductValue(
  clientId: string,
  productId: string
): Promise<ClientProductValue | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("client_product_values")
    .select("*")
    .eq("client_id", clientId)
    .eq("product_id", productId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(error.message);
  }

  return data;
}

export async function setClientProductValue(
  clientId: string,
  productId: string,
  salePrice: number | null,
  cost: number | null
): Promise<ClientProductValue> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("client_product_values")
    .upsert(
      {
        client_id: clientId,
        product_id: productId,
        sale_price: salePrice,
        cost: cost,
      },
      { onConflict: "client_id,product_id" }
    )
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export interface ProductValueInput {
  productId: string;
  salePrice: number | null;
  cost: number | null;
}

export async function bulkSetClientProductValues(
  clientId: string,
  values: ProductValueInput[]
): Promise<ClientProductValue[]> {
  const supabase = createClient();

  const records = values.map((value) => ({
    client_id: clientId,
    product_id: value.productId,
    sale_price: value.salePrice,
    cost: value.cost,
  }));

  const { data, error } = await supabase
    .from("client_product_values")
    .upsert(records, { onConflict: "client_id,product_id" })
    .select();

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export async function deleteClientProductValue(
  clientId: string,
  productId: string
): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from("client_product_values")
    .delete()
    .eq("client_id", clientId)
    .eq("product_id", productId);

  if (error) {
    throw new Error(error.message);
  }
}

export interface OrderProfitability {
  orderId: string;
  orderNumber: string;
  totalRevenue: number;
  totalCost: number;
  grossProfit: number;
  marginPercent: number;
  items: {
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    unitCost: number;
    revenue: number;
    cost: number;
    profit: number;
  }[];
}

export async function calculateOrderProfitability(orderId: string): Promise<OrderProfitability> {
  const supabase = createClient();

  // Get order with items
  const { data: order, error: orderError } = await supabase
    .from("outbound_orders")
    .select(`
      id,
      order_number,
      client_id,
      items:outbound_items (
        product_id,
        qty_shipped,
        unit_price,
        product:products (id, name, unit_cost)
      )
    `)
    .eq("id", orderId)
    .single();

  if (orderError) {
    throw new Error(orderError.message);
  }

  // Get client product values for custom costs
  const { data: productValues, error: valuesError } = await supabase
    .from("client_product_values")
    .select("product_id, sale_price, cost")
    .eq("client_id", order.client_id);

  if (valuesError) {
    throw new Error(valuesError.message);
  }

  const valueMap = new Map(
    productValues?.map((v) => [v.product_id, v]) || []
  );

  let totalRevenue = 0;
  let totalCost = 0;

  const items = order.items.map((item: any) => {
    const customValue = valueMap.get(item.product_id);
    const unitPrice = customValue?.sale_price ?? item.unit_price ?? 0;
    const unitCost = customValue?.cost ?? item.product?.unit_cost ?? 0;
    const quantity = item.qty_shipped || 0;
    const revenue = quantity * unitPrice;
    const cost = quantity * unitCost;

    totalRevenue += revenue;
    totalCost += cost;

    return {
      productId: item.product_id,
      productName: item.product?.name || "Unknown",
      quantity,
      unitPrice,
      unitCost,
      revenue,
      cost,
      profit: revenue - cost,
    };
  });

  const grossProfit = totalRevenue - totalCost;
  const marginPercent = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

  return {
    orderId: order.id,
    orderNumber: order.order_number,
    totalRevenue,
    totalCost,
    grossProfit,
    marginPercent,
    items,
  };
}

export interface ClientProfitability {
  clientId: string;
  periodStart: string;
  periodEnd: string;
  totalRevenue: number;
  totalCost: number;
  grossProfit: number;
  marginPercent: number;
  orderCount: number;
}

export async function calculateClientProfitability(
  clientId: string,
  startDate: string,
  endDate: string
): Promise<ClientProfitability> {
  const supabase = createClient();

  // Get shipped orders for the period
  const { data: orders, error: ordersError } = await supabase
    .from("outbound_orders")
    .select("id")
    .eq("client_id", clientId)
    .in("status", ["shipped", "delivered"])
    .gte("shipped_date", startDate)
    .lte("shipped_date", endDate);

  if (ordersError) {
    throw new Error(ordersError.message);
  }

  let totalRevenue = 0;
  let totalCost = 0;

  for (const order of orders || []) {
    const profitability = await calculateOrderProfitability(order.id);
    totalRevenue += profitability.totalRevenue;
    totalCost += profitability.totalCost;
  }

  const grossProfit = totalRevenue - totalCost;
  const marginPercent = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

  return {
    clientId,
    periodStart: startDate,
    periodEnd: endDate,
    totalRevenue,
    totalCost,
    grossProfit,
    marginPercent,
    orderCount: orders?.length || 0,
  };
}

export interface ProfitabilityReport extends ClientProfitability {
  productBreakdown: {
    productId: string;
    productName: string;
    totalQuantity: number;
    totalRevenue: number;
    totalCost: number;
    grossProfit: number;
    marginPercent: number;
  }[];
  orderBreakdown: OrderProfitability[];
}

export async function getClientProfitabilityReport(
  clientId: string,
  startDate: string,
  endDate: string
): Promise<ProfitabilityReport> {
  const supabase = createClient();

  // Get shipped orders for the period
  const { data: orders, error: ordersError } = await supabase
    .from("outbound_orders")
    .select("id")
    .eq("client_id", clientId)
    .in("status", ["shipped", "delivered"])
    .gte("shipped_date", startDate)
    .lte("shipped_date", endDate);

  if (ordersError) {
    throw new Error(ordersError.message);
  }

  let totalRevenue = 0;
  let totalCost = 0;
  const orderBreakdown: OrderProfitability[] = [];
  const productMap = new Map<string, {
    productId: string;
    productName: string;
    totalQuantity: number;
    totalRevenue: number;
    totalCost: number;
  }>();

  for (const order of orders || []) {
    const profitability = await calculateOrderProfitability(order.id);
    totalRevenue += profitability.totalRevenue;
    totalCost += profitability.totalCost;
    orderBreakdown.push(profitability);

    // Aggregate by product
    for (const item of profitability.items) {
      const existing = productMap.get(item.productId);
      if (existing) {
        existing.totalQuantity += item.quantity;
        existing.totalRevenue += item.revenue;
        existing.totalCost += item.cost;
      } else {
        productMap.set(item.productId, {
          productId: item.productId,
          productName: item.productName,
          totalQuantity: item.quantity,
          totalRevenue: item.revenue,
          totalCost: item.cost,
        });
      }
    }
  }

  const grossProfit = totalRevenue - totalCost;
  const marginPercent = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

  const productBreakdown = Array.from(productMap.values()).map((product) => ({
    ...product,
    grossProfit: product.totalRevenue - product.totalCost,
    marginPercent: product.totalRevenue > 0
      ? ((product.totalRevenue - product.totalCost) / product.totalRevenue) * 100
      : 0,
  }));

  return {
    clientId,
    periodStart: startDate,
    periodEnd: endDate,
    totalRevenue,
    totalCost,
    grossProfit,
    marginPercent,
    orderCount: orders?.length || 0,
    productBreakdown,
    orderBreakdown,
  };
}

export interface ProductProfitability {
  clientId: string;
  productId: string;
  productName: string;
  periodStart: string;
  periodEnd: string;
  totalQuantity: number;
  totalRevenue: number;
  totalCost: number;
  grossProfit: number;
  marginPercent: number;
  orderCount: number;
}

export async function getProductProfitability(
  clientId: string,
  productId: string,
  startDate: string,
  endDate: string
): Promise<ProductProfitability> {
  const supabase = createClient();

  // Get product details
  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id, name, unit_cost")
    .eq("id", productId)
    .single();

  if (productError) {
    throw new Error(productError.message);
  }

  // Get client product value for custom pricing
  const { data: customValue } = await supabase
    .from("client_product_values")
    .select("sale_price, cost")
    .eq("client_id", clientId)
    .eq("product_id", productId)
    .single();

  // Get shipped orders containing this product
  const { data: orderItems, error: itemsError } = await supabase
    .from("outbound_items")
    .select(`
      qty_shipped,
      unit_price,
      order:outbound_orders!inner (
        id,
        client_id,
        status,
        shipped_date
      )
    `)
    .eq("product_id", productId)
    .eq("order.client_id", clientId)
    .in("order.status", ["shipped", "delivered"])
    .gte("order.shipped_date", startDate)
    .lte("order.shipped_date", endDate);

  if (itemsError) {
    throw new Error(itemsError.message);
  }

  const unitCost = customValue?.cost ?? product.unit_cost ?? 0;
  let totalQuantity = 0;
  let totalRevenue = 0;
  const orderIds = new Set<string>();

  for (const item of orderItems || []) {
    const qty = item.qty_shipped || 0;
    const unitPrice = customValue?.sale_price ?? item.unit_price ?? 0;
    totalQuantity += qty;
    totalRevenue += qty * unitPrice;
    orderIds.add((item.order as any).id);
  }

  const totalCost = totalQuantity * unitCost;
  const grossProfit = totalRevenue - totalCost;
  const marginPercent = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

  return {
    clientId,
    productId,
    productName: product.name,
    periodStart: startDate,
    periodEnd: endDate,
    totalQuantity,
    totalRevenue,
    totalCost,
    grossProfit,
    marginPercent,
    orderCount: orderIds.size,
  };
}
