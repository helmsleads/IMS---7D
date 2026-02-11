import { createClient } from "@/lib/supabase";

export interface ProfitabilitySummary {
  periodStart: string;
  periodEnd: string;
  totalRevenue: number;
  totalCost: number;
  grossProfit: number;
  marginPercent: number;
  orderCount: number;
  itemsShipped: number;
}

export interface ProductProfitabilityItem {
  productId: string;
  productSku: string;
  productName: string;
  totalQuantity: number;
  totalRevenue: number;
  totalCost: number;
  grossProfit: number;
  marginPercent: number;
  orderCount: number;
}

export interface ProductValue {
  id: string;
  productId: string;
  productSku: string;
  productName: string;
  salePrice: number | null;
  cost: number | null;
  defaultUnitCost: number;
}

export async function getMyProfitability(
  clientId: string,
  startDate: string,
  endDate: string
): Promise<ProfitabilitySummary> {
  const supabase = createClient();

  // Get shipped/delivered orders for the period
  const { data: orders, error: ordersError } = await supabase
    .from("outbound_orders")
    .select(`
      id,
      items:outbound_items (
        qty_shipped,
        unit_price,
        product_id
      )
    `)
    .eq("client_id", clientId)
    .in("status", ["shipped", "delivered"])
    .gte("shipped_date", startDate)
    .lte("shipped_date", endDate);

  if (ordersError) {
    throw new Error(ordersError.message);
  }

  // Get client's product values for custom pricing
  const { data: productValues } = await supabase
    .from("client_product_values")
    .select("product_id, sale_price, cost")
    .eq("client_id", clientId);

  const valueMap = new Map(
    (productValues || []).map((v) => [v.product_id, v])
  );

  // Get product costs for any products we need
  const productIds = new Set<string>();
  (orders || []).forEach((order) => {
    (order.items || []).forEach((item: any) => {
      productIds.add(item.product_id);
    });
  });

  const { data: products } = await supabase
    .from("products")
    .select("id, unit_cost")
    .in("id", Array.from(productIds));

  const productCostMap = new Map(
    (products || []).map((p) => [p.id, p.unit_cost])
  );

  let totalRevenue = 0;
  let totalCost = 0;
  let itemsShipped = 0;

  (orders || []).forEach((order) => {
    (order.items || []).forEach((item: any) => {
      const qty = item.qty_shipped || 0;
      const customValue = valueMap.get(item.product_id);

      const unitPrice = customValue?.sale_price ?? item.unit_price ?? 0;
      const unitCost = customValue?.cost ?? productCostMap.get(item.product_id) ?? 0;

      totalRevenue += qty * unitPrice;
      totalCost += qty * unitCost;
      itemsShipped += qty;
    });
  });

  const grossProfit = totalRevenue - totalCost;
  const marginPercent = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

  return {
    periodStart: startDate,
    periodEnd: endDate,
    totalRevenue,
    totalCost,
    grossProfit,
    marginPercent,
    orderCount: orders?.length || 0,
    itemsShipped,
  };
}

export async function getMyProductProfitability(
  clientId: string,
  startDate: string,
  endDate: string
): Promise<ProductProfitabilityItem[]> {
  const supabase = createClient();

  // Get shipped/delivered orders for the period with items
  const { data: orders, error: ordersError } = await supabase
    .from("outbound_orders")
    .select(`
      id,
      items:outbound_items (
        qty_shipped,
        unit_price,
        product_id,
        product:products (id, sku, name, unit_cost)
      )
    `)
    .eq("client_id", clientId)
    .in("status", ["shipped", "delivered"])
    .gte("shipped_date", startDate)
    .lte("shipped_date", endDate);

  if (ordersError) {
    throw new Error(ordersError.message);
  }

  // Get client's product values
  const { data: productValues } = await supabase
    .from("client_product_values")
    .select("product_id, sale_price, cost")
    .eq("client_id", clientId);

  const valueMap = new Map(
    (productValues || []).map((v) => [v.product_id, v])
  );

  // Aggregate by product
  const productMap = new Map<string, {
    productId: string;
    productSku: string;
    productName: string;
    totalQuantity: number;
    totalRevenue: number;
    totalCost: number;
    orderIds: Set<string>;
  }>();

  (orders || []).forEach((order) => {
    (order.items || []).forEach((item: any) => {
      const product = Array.isArray(item.product) ? item.product[0] : item.product;
      if (!product) return;

      const qty = item.qty_shipped || 0;
      if (qty === 0) return;

      const customValue = valueMap.get(item.product_id);
      const unitPrice = customValue?.sale_price ?? item.unit_price ?? 0;
      const unitCost = customValue?.cost ?? product.unit_cost ?? 0;

      const existing = productMap.get(item.product_id);
      if (existing) {
        existing.totalQuantity += qty;
        existing.totalRevenue += qty * unitPrice;
        existing.totalCost += qty * unitCost;
        existing.orderIds.add(order.id);
      } else {
        productMap.set(item.product_id, {
          productId: item.product_id,
          productSku: product.sku,
          productName: product.name,
          totalQuantity: qty,
          totalRevenue: qty * unitPrice,
          totalCost: qty * unitCost,
          orderIds: new Set([order.id]),
        });
      }
    });
  });

  // Convert to array and calculate margins
  return Array.from(productMap.values())
    .map((p) => ({
      productId: p.productId,
      productSku: p.productSku,
      productName: p.productName,
      totalQuantity: p.totalQuantity,
      totalRevenue: p.totalRevenue,
      totalCost: p.totalCost,
      grossProfit: p.totalRevenue - p.totalCost,
      marginPercent: p.totalRevenue > 0
        ? ((p.totalRevenue - p.totalCost) / p.totalRevenue) * 100
        : 0,
      orderCount: p.orderIds.size,
    }))
    .sort((a, b) => b.grossProfit - a.grossProfit);
}

export async function getMyProductValues(clientId: string): Promise<ProductValue[]> {
  const supabase = createClient();

  // Get all products the client has in their inventory or has ordered
  const { data: clientProducts, error: productsError } = await supabase
    .from("products")
    .select("id, sku, name, unit_cost")
    .eq("active", true)
    .order("name");

  if (productsError) {
    throw new Error(productsError.message);
  }

  // Get client's custom values
  const { data: productValues } = await supabase
    .from("client_product_values")
    .select("id, product_id, sale_price, cost")
    .eq("client_id", clientId);

  const valueMap = new Map(
    (productValues || []).map((v) => [v.product_id, v])
  );

  return (clientProducts || []).map((product) => {
    const customValue = valueMap.get(product.id);
    return {
      id: customValue?.id || "",
      productId: product.id,
      productSku: product.sku,
      productName: product.name,
      salePrice: customValue?.sale_price ?? null,
      cost: customValue?.cost ?? null,
      defaultUnitCost: product.unit_cost,
    };
  });
}

export async function updateMyProductValue(
  clientId: string,
  productId: string,
  salePrice: number | null,
  cost: number | null
): Promise<ProductValue> {
  const supabase = createClient();

  // Upsert the product value
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

  // Get product details
  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id, sku, name, unit_cost")
    .eq("id", productId)
    .single();

  if (productError) {
    throw new Error(productError.message);
  }

  return {
    id: data.id,
    productId: product.id,
    productSku: product.sku,
    productName: product.name,
    salePrice: data.sale_price,
    cost: data.cost,
    defaultUnitCost: product.unit_cost,
  };
}
