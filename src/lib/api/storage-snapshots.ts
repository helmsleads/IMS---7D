import { createClient } from "@/lib/supabase";
import { takeStorageSnapshot } from "@/lib/api/billing-automation";

export interface BrandPalletSummary {
  clientId: string;
  brandName: string;
  snapshotDate: string;
  palletCount: number;
  barrelCount: number;
  productCount: number;
  locationCount: number;
  qtyOnHand: number;
}

export interface BrandPalletDetailRow {
  id: string;
  snapshotDate: string;
  clientId: string;
  brandName: string;
  productId: string;
  productSku: string;
  productName: string;
  locationId: string | null;
  locationName: string | null;
  qtyOnHand: number;
  qtyReserved: number;
  palletCount: number;
  barrelCount: number;
}

export interface StorageSnapshotOverview {
  latestDate: string | null;
  availableDates: string[];
  totals: {
    brands: number;
    pallets: number;
    barrels: number;
    products: number;
    qtyOnHand: number;
  };
}

export interface LiveBrandPalletEstimate {
  clientId: string;
  brandName: string;
  palletCount: number;
  barrelCount: number;
  productCount: number;
  qtyOnHand: number;
  isLiveEstimate: true;
}

function asSingle<T>(value: unknown): T | null {
  if (value == null) return null;
  const item = Array.isArray(value) ? value[0] : value;
  if (item == null) return null;
  return item as T;
}

/**
 * Distinct snapshot dates, newest first.
 */
export async function getStorageSnapshotDates(limit = 60): Promise<string[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("storage_snapshots")
    .select("snapshot_date")
    .order("snapshot_date", { ascending: false })
    .limit(2000);

  if (error) throw new Error(error.message);

  const dates: string[] = [];
  const seen = new Set<string>();
  for (const row of data || []) {
    const d = String(row.snapshot_date);
    if (!seen.has(d)) {
      seen.add(d);
      dates.push(d);
    }
    if (dates.length >= limit) break;
  }
  return dates;
}

/**
 * Aggregate storage_snapshots by brand for a given date.
 */
export async function getPalletsByBrand(params?: {
  snapshotDate?: string;
  clientId?: string;
}): Promise<{
  snapshotDate: string | null;
  brands: BrandPalletSummary[];
  overview: StorageSnapshotOverview;
}> {
  const supabase = createClient();
  const dates = await getStorageSnapshotDates();
  const snapshotDate = params?.snapshotDate || dates[0] || null;

  const overview: StorageSnapshotOverview = {
    latestDate: dates[0] || null,
    availableDates: dates,
    totals: { brands: 0, pallets: 0, barrels: 0, products: 0, qtyOnHand: 0 },
  };

  if (!snapshotDate) {
    return { snapshotDate: null, brands: [], overview };
  }

  let query = supabase
    .from("storage_snapshots")
    .select(
      `
      id,
      snapshot_date,
      client_id,
      product_id,
      location_id,
      qty_on_hand,
      qty_reserved,
      pallet_count,
      barrel_count,
      client:clients ( id, company_name ),
      product:products ( id, sku, name ),
      location:locations ( id, name )
    `
    )
    .eq("snapshot_date", snapshotDate);

  if (params?.clientId) {
    query = query.eq("client_id", params.clientId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const byClient = new Map<
    string,
    BrandPalletSummary & { productIds: Set<string>; locationIds: Set<string> }
  >();

  for (const row of data || []) {
    const client = asSingle<{ id: string; company_name: string }>(row.client);
    const clientId = row.client_id as string;
    const existing = byClient.get(clientId) || {
      clientId,
      brandName: client?.company_name || "Unknown brand",
      snapshotDate,
      palletCount: 0,
      barrelCount: 0,
      productCount: 0,
      locationCount: 0,
      qtyOnHand: 0,
      productIds: new Set<string>(),
      locationIds: new Set<string>(),
    };

    existing.palletCount += Number(row.pallet_count) || 0;
    existing.barrelCount += Number(row.barrel_count) || 0;
    existing.qtyOnHand += Number(row.qty_on_hand) || 0;
    if (row.product_id) existing.productIds.add(row.product_id);
    if (row.location_id) existing.locationIds.add(row.location_id);
    byClient.set(clientId, existing);
  }

  const brands: BrandPalletSummary[] = Array.from(byClient.values())
    .map(({ productIds, locationIds, ...rest }) => ({
      ...rest,
      productCount: productIds.size,
      locationCount: locationIds.size,
    }))
    .sort((a, b) => b.palletCount - a.palletCount || a.brandName.localeCompare(b.brandName));

  overview.totals = {
    brands: brands.length,
    pallets: brands.reduce((s, b) => s + b.palletCount, 0),
    barrels: brands.reduce((s, b) => s + b.barrelCount, 0),
    products: brands.reduce((s, b) => s + b.productCount, 0),
    qtyOnHand: brands.reduce((s, b) => s + b.qtyOnHand, 0),
  };

  return { snapshotDate, brands, overview };
}

/**
 * Product/location detail rows for one brand on a snapshot date.
 */
export async function getBrandPalletDetails(params: {
  snapshotDate: string;
  clientId: string;
}): Promise<BrandPalletDetailRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("storage_snapshots")
    .select(
      `
      id,
      snapshot_date,
      client_id,
      product_id,
      location_id,
      qty_on_hand,
      qty_reserved,
      pallet_count,
      barrel_count,
      client:clients ( id, company_name ),
      product:products ( id, sku, name ),
      location:locations ( id, name )
    `
    )
    .eq("snapshot_date", params.snapshotDate)
    .eq("client_id", params.clientId)
    .order("pallet_count", { ascending: false });

  if (error) throw new Error(error.message);

  return (data || []).map((row) => {
    const client = asSingle<{ id: string; company_name: string }>(row.client);
    const product = asSingle<{ id: string; sku: string; name: string }>(row.product);
    const location = asSingle<{ id: string; name: string }>(row.location);
    return {
      id: row.id,
      snapshotDate: String(row.snapshot_date),
      clientId: row.client_id,
      brandName: client?.company_name || "Unknown brand",
      productId: row.product_id,
      productSku: product?.sku || "—",
      productName: product?.name || "Unknown product",
      locationId: row.location_id,
      locationName: location?.name || null,
      qtyOnHand: Number(row.qty_on_hand) || 0,
      qtyReserved: Number(row.qty_reserved) || 0,
      palletCount: Number(row.pallet_count) || 0,
      barrelCount: Number(row.barrel_count) || 0,
    };
  });
}

/**
 * Live estimate from inventory when no snapshot exists yet
 * (same formula as take_storage_snapshot: cases / 60).
 */
export async function getLivePalletsByBrand(params?: {
  clientId?: string;
}): Promise<LiveBrandPalletEstimate[]> {
  const supabase = createClient();

  let query = supabase
    .from("inventory")
    .select(
      `
      qty_on_hand,
      product:products!inner (
        id,
        client_id,
        container_type,
        units_per_case,
        client:clients ( id, company_name )
      )
    `
    )
    .gt("qty_on_hand", 0);

  if (params?.clientId) {
    query = query.eq("product.client_id", params.clientId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const byClient = new Map<
    string,
    LiveBrandPalletEstimate & { productIds: Set<string> }
  >();

  for (const row of data || []) {
    const product = asSingle<{
      id: string;
      client_id: string | null;
      container_type: string | null;
      units_per_case: number | null;
      client: { id: string; company_name: string } | { id: string; company_name: string }[] | null;
    }>(row.product);
    if (!product?.client_id) continue;

    const client = asSingle<{ id: string; company_name: string }>(product.client);
    const qty = Number(row.qty_on_hand) || 0;
    const isKeg = product.container_type === "keg";
    const unitsPerCase = Math.max(Number(product.units_per_case) || 1, 1);
    const pallets = isKeg ? 0 : Math.max(1, Math.ceil(qty / unitsPerCase / 60));
    const barrels = isKeg ? qty : 0;

    const existing = byClient.get(product.client_id) || {
      clientId: product.client_id,
      brandName: client?.company_name || "Unknown brand",
      palletCount: 0,
      barrelCount: 0,
      productCount: 0,
      qtyOnHand: 0,
      isLiveEstimate: true as const,
      productIds: new Set<string>(),
    };

    existing.palletCount += pallets;
    existing.barrelCount += barrels;
    existing.qtyOnHand += qty;
    existing.productIds.add(product.id);
    byClient.set(product.client_id, existing);
  }

  return Array.from(byClient.values())
    .map(({ productIds, ...rest }) => ({
      ...rest,
      productCount: productIds.size,
    }))
    .sort((a, b) => b.palletCount - a.palletCount || a.brandName.localeCompare(b.brandName));
}

/**
 * Run the same RPC used by the daily cron.
 * Returns rows created (0 if a snapshot for that date already exists).
 */
export async function runStorageSnapshotNow(snapshotDate?: string): Promise<{
  rowsCreated: number;
  snapshotDate: string;
  alreadyExists: boolean;
}> {
  const date = snapshotDate || new Date().toISOString().split("T")[0];
  const rowsCreated = await takeStorageSnapshot(date);
  return {
    rowsCreated,
    snapshotDate: date,
    alreadyExists: rowsCreated === 0,
  };
}
