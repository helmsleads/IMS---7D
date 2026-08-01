import { createServiceClient } from "@/lib/supabase-service";

export interface DtcCatalogQuery {
  page?: number;
  limit?: number;
  sku?: string;
}

function mapProduct(row: Record<string, unknown>, qtyAvailable: number | null = null) {
  const basePrice = Number(row.base_price ?? 0);

  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    description: row.description ?? null,
    base_price: basePrice,
    base_price_cents: Math.round(basePrice * 100),
    active: row.active !== false,
    image_url: row.image_url ?? null,
    container_type: row.container_type ?? null,
    qty_available: qtyAvailable,
  };
}

async function loadQtyAvailableByProductIds(
  supabase: ReturnType<typeof createServiceClient>,
  productIds: string[],
): Promise<Map<string, number>> {
  const qtyByProduct = new Map<string, number>();
  if (productIds.length === 0) {
    return qtyByProduct;
  }

  const { data, error } = await supabase
    .from("inventory")
    .select("product_id, qty_on_hand, qty_reserved")
    .in("product_id", productIds);

  if (error) {
    throw new Error(error.message);
  }

  for (const row of data ?? []) {
    const productId = String(row.product_id);
    const available = Math.max(
      0,
      Number(row.qty_on_hand ?? 0) - Number(row.qty_reserved ?? 0),
    );
    qtyByProduct.set(productId, (qtyByProduct.get(productId) ?? 0) + available);
  }

  return qtyByProduct;
}

export async function getDtcCatalog(clientId: string, query: DtcCatalogQuery = {}) {
  const page = Math.max(query.page ?? 1, 1);
  const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);
  const sku = query.sku?.trim();
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const supabase = createServiceClient();

  let builder = supabase
    .from("products")
    .select(
      "id, sku, name, description, base_price, active, image_url, container_type",
      { count: "exact" },
    )
    .eq("client_id", clientId)
    .eq("active", true)
    .order("name");

  if (sku) {
    builder = builder.ilike("sku", `%${sku}%`);
  }

  const { data, error, count } = await builder.range(from, to);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as Record<string, unknown>[];
  const productIds = rows.map((row) => String(row.id));
  const qtyByProduct = await loadQtyAvailableByProductIds(supabase, productIds);
  const total = count ?? 0;

  return {
    products: rows.map((row) =>
      mapProduct(row, qtyByProduct.get(String(row.id)) ?? 0),
    ),
    pagination: {
      page,
      limit,
      total,
      total_pages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

export async function getDtcProduct(clientId: string, productId: string) {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("products")
    .select("id, sku, name, description, base_price, active, image_url, container_type")
    .eq("client_id", clientId)
    .eq("id", productId)
    .eq("active", true)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  const qtyByProduct = await loadQtyAvailableByProductIds(supabase, [productId]);
  return mapProduct(data as Record<string, unknown>, qtyByProduct.get(productId) ?? 0);
}
