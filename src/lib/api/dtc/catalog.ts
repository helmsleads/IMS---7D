import { createServiceClient } from "@/lib/supabase-service";

export interface DtcCatalogQuery {
  page?: number;
  limit?: number;
  sku?: string;
}

function mapProduct(row: Record<string, unknown>) {
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
  };
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

  const total = count ?? 0;

  return {
    products: (data ?? []).map((row) => mapProduct(row as Record<string, unknown>)),
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

  return data ? mapProduct(data as Record<string, unknown>) : null;
}
