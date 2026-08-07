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

/** Container types that are snapshotted for qty visibility but not billed as pallets. */
export const NON_PALLET_CONTAINER_TYPES = new Set([
  "sample",
  "merchandise",
  "raw_materials",
  "empty_bottle",
]);

export interface BrandPalletDetailRow {
  id: string;
  snapshotDate: string;
  clientId: string;
  brandName: string;
  productId: string;
  productSku: string;
  productName: string;
  containerType: string | null;
  unitsPerCase: number;
  locationId: string | null;
  locationName: string | null;
  qtyOnHand: number;
  qtyReserved: number;
  palletCount: number;
  barrelCount: number;
  /** Cases estimate when units_per_case > 1; null for ML/sample-style units. */
  caseCount: number | null;
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
      product:products ( id, sku, name, container_type, units_per_case ),
      location:locations ( id, name )
    `
    )
    .eq("snapshot_date", params.snapshotDate)
    .eq("client_id", params.clientId)
    .order("pallet_count", { ascending: false });

  const { data, error } = await query;

  if (error) throw new Error(error.message);

  return (data || []).map((row) => {
    const client = asSingle<{ id: string; company_name: string }>(row.client);
    const product = asSingle<{
      id: string;
      sku: string;
      name: string;
      container_type: string | null;
      units_per_case: number | null;
    }>(row.product);
    const location = asSingle<{ id: string; name: string }>(row.location);
    const qtyOnHand = Number(row.qty_on_hand) || 0;
    const unitsPerCase = Math.max(Number(product?.units_per_case) || 1, 1);
    const containerType = product?.container_type || null;
    const isNonPallet =
      !!containerType && NON_PALLET_CONTAINER_TYPES.has(containerType);
    return {
      id: row.id,
      snapshotDate: String(row.snapshot_date),
      clientId: row.client_id,
      brandName: client?.company_name || "Unknown brand",
      productId: row.product_id,
      productSku: product?.sku || "—",
      productName: product?.name || "Unknown product",
      containerType,
      unitsPerCase,
      locationId: row.location_id,
      locationName: location?.name || null,
      qtyOnHand,
      qtyReserved: Number(row.qty_reserved) || 0,
      palletCount: Number(row.pallet_count) || 0,
      barrelCount: Number(row.barrel_count) || 0,
      caseCount:
        !isNonPallet && unitsPerCase > 1
          ? Math.round((qtyOnHand / unitsPerCase) * 10) / 10
          : null,
    };
  });
}

/**
 * Live estimate from inventory when no snapshot exists yet
 * (same formula as take_storage_snapshot: cases / cases_per_pallet).
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
        cases_per_pallet,
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
      cases_per_pallet: number | null;
      client: { id: string; company_name: string } | { id: string; company_name: string }[] | null;
    }>(row.product);
    if (!product?.client_id) continue;

    const client = asSingle<{ id: string; company_name: string }>(product.client);
    const qty = Number(row.qty_on_hand) || 0;
    const containerType = product.container_type || "";
    const isKeg = containerType === "keg";
    const isNonPallet = NON_PALLET_CONTAINER_TYPES.has(containerType);
    const unitsPerCase = Math.max(Number(product.units_per_case) || 1, 1);
    const casesPerPallet = Math.max(Number(product.cases_per_pallet) || 60, 1);
    const pallets =
      isKeg || isNonPallet
        ? 0
        : Math.round((qty / unitsPerCase / casesPerPallet) * 10000) / 10000;
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
 * Returns rows created (0 if a snapshot for that date already exists and force=false).
 */
export async function runStorageSnapshotNow(options?: {
  snapshotDate?: string;
  force?: boolean;
}): Promise<{
  rowsCreated: number;
  snapshotDate: string;
  alreadyExists: boolean;
  forced: boolean;
}> {
  const date = options?.snapshotDate || new Date().toISOString().split("T")[0];
  const force = Boolean(options?.force);
  const rowsCreated = await takeStorageSnapshot(date, force);
  return {
    rowsCreated,
    snapshotDate: date,
    alreadyExists: !force && rowsCreated === 0,
    forced: force,
  };
}

/** Types that increase on-hand stock for the movement report. */
const STOCK_IN_TYPES = new Set(["receive", "return_restock"]);
/** Types that decrease on-hand stock for the movement report. */
const STOCK_OUT_TYPES = new Set([
  "ship",
  "damage_writeoff",
  "expire",
  "quarantine",
]);
/** Net adjustments (can be + or −). */
const STOCK_ADJ_TYPES = new Set(["adjust", "cycle_count"]);

export interface BrandStockMovementRow {
  clientId: string;
  brandName: string;
  startQty: number;
  startPallets: number;
  startBarrels: number;
  inQty: number;
  outQty: number;
  adjQty: number;
  endQty: number;
  endPallets: number;
  endBarrels: number;
  /** start + in − out + adj − end; near 0 when data is complete. */
  varianceQty: number;
  hasStartSnapshot: boolean;
  hasEndSnapshot: boolean;
}

export interface BrandStockMovementReport {
  startDate: string;
  endDate: string;
  hasStartSnapshot: boolean;
  hasEndSnapshot: boolean;
  brands: BrandStockMovementRow[];
  totals: {
    startQty: number;
    startPallets: number;
    inQty: number;
    outQty: number;
    adjQty: number;
    endQty: number;
    endPallets: number;
    varianceQty: number;
  };
}

type SnapshotBrandAgg = {
  clientId: string;
  brandName: string;
  qtyOnHand: number;
  palletCount: number;
  barrelCount: number;
};

async function aggregateSnapshotsByBrand(
  snapshotDate: string,
  clientId?: string
): Promise<{ found: boolean; byClient: Map<string, SnapshotBrandAgg> }> {
  const supabase = createClient();
  let query = supabase
    .from("storage_snapshots")
    .select(
      `
      client_id,
      qty_on_hand,
      pallet_count,
      barrel_count,
      client:clients ( id, company_name ),
      product:products ( container_type )
    `
    )
    .eq("snapshot_date", snapshotDate);

  if (clientId) {
    query = query.eq("client_id", clientId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const found = (data || []).length > 0;
  const byClient = new Map<string, SnapshotBrandAgg>();
  for (const row of data || []) {
    const product = asSingle<{ container_type: string | null }>(row.product);
    const containerType = product?.container_type || "";
    // Exclude samples / merch / etc. from stock movement beginning/ending qty
    if (NON_PALLET_CONTAINER_TYPES.has(containerType)) continue;

    const client = asSingle<{ id: string; company_name: string }>(row.client);
    const id = row.client_id as string;
    const existing = byClient.get(id) || {
      clientId: id,
      brandName: client?.company_name || "Unknown brand",
      qtyOnHand: 0,
      palletCount: 0,
      barrelCount: 0,
    };
    existing.qtyOnHand += Number(row.qty_on_hand) || 0;
    existing.palletCount += Number(row.pallet_count) || 0;
    existing.barrelCount += Number(row.barrel_count) || 0;
    byClient.set(id, existing);
  }

  return { found, byClient };
}

/**
 * Date-range stock statement per brand:
 * start/end from storage_snapshots; in/out/adj from inventory_transactions.
 */
export async function getBrandStockMovementReport(params: {
  startDate: string;
  endDate: string;
  clientId?: string;
}): Promise<BrandStockMovementReport> {
  const { startDate, endDate, clientId } = params;
  if (!startDate || !endDate) {
    throw new Error("Start date and end date are required");
  }
  if (startDate > endDate) {
    throw new Error("Start date must be on or before end date");
  }

  const supabase = createClient();
  const [startAgg, endAgg] = await Promise.all([
    aggregateSnapshotsByBrand(startDate, clientId),
    aggregateSnapshotsByBrand(endDate, clientId),
  ]);

  type TxAgg = { inQty: number; outQty: number; adjQty: number; brandName: string };
  const txByClient = new Map<string, TxAgg>();

  const startIso = `${startDate}T00:00:00.000Z`;
  const endIso = `${endDate}T23:59:59.999Z`;
  const pageSize = 1000;
  let from = 0;

  for (;;) {
    let query = supabase
      .from("inventory_transactions")
      .select(
        `
        qty_change,
        transaction_type,
        product:products!inner (
          client_id,
          container_type,
          client:clients ( id, company_name )
        )
      `
      )
      .gte("created_at", startIso)
      .lte("created_at", endIso)
      .order("created_at", { ascending: true })
      .range(from, from + pageSize - 1);

    if (clientId) {
      query = query.eq("product.client_id", clientId);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    const rows = data || [];
    for (const row of rows) {
      const product = asSingle<{
        client_id: string | null;
        container_type: string | null;
        client: { id: string; company_name: string } | { id: string; company_name: string }[] | null;
      }>(row.product);
      if (!product?.client_id) continue;
      if (NON_PALLET_CONTAINER_TYPES.has(product.container_type || "")) continue;

      const client = asSingle<{ id: string; company_name: string }>(product.client);
      const qty = Number(row.qty_change) || 0;
      const type = String(row.transaction_type || "");
      const existing = txByClient.get(product.client_id) || {
        inQty: 0,
        outQty: 0,
        adjQty: 0,
        brandName: client?.company_name || "Unknown brand",
      };

      if (STOCK_IN_TYPES.has(type)) {
        existing.inQty += Math.abs(qty);
      } else if (STOCK_OUT_TYPES.has(type)) {
        existing.outQty += Math.abs(qty);
      } else if (STOCK_ADJ_TYPES.has(type)) {
        existing.adjQty += qty;
      }

      if (client?.company_name) existing.brandName = client.company_name;
      txByClient.set(product.client_id, existing);
    }

    if (rows.length < pageSize) break;
    from += pageSize;
  }

  const clientIds = new Set<string>([
    ...startAgg.byClient.keys(),
    ...endAgg.byClient.keys(),
    ...txByClient.keys(),
  ]);

  const brands: BrandStockMovementRow[] = Array.from(clientIds)
    .map((id) => {
      const start = startAgg.byClient.get(id);
      const end = endAgg.byClient.get(id);
      const tx = txByClient.get(id);
      const startQty = start?.qtyOnHand ?? 0;
      const endQty = end?.qtyOnHand ?? 0;
      const inQty = tx?.inQty ?? 0;
      const outQty = tx?.outQty ?? 0;
      const adjQty = tx?.adjQty ?? 0;
      return {
        clientId: id,
        brandName:
          start?.brandName || end?.brandName || tx?.brandName || "Unknown brand",
        startQty,
        startPallets: start?.palletCount ?? 0,
        startBarrels: start?.barrelCount ?? 0,
        inQty,
        outQty,
        adjQty,
        endQty,
        endPallets: end?.palletCount ?? 0,
        endBarrels: end?.barrelCount ?? 0,
        varianceQty: startQty + inQty - outQty + adjQty - endQty,
        hasStartSnapshot: Boolean(start),
        hasEndSnapshot: Boolean(end),
      };
    })
    .sort(
      (a, b) =>
        b.endPallets - a.endPallets || a.brandName.localeCompare(b.brandName)
    );

  const totals = brands.reduce(
    (acc, b) => {
      acc.startQty += b.startQty;
      acc.startPallets += b.startPallets;
      acc.inQty += b.inQty;
      acc.outQty += b.outQty;
      acc.adjQty += b.adjQty;
      acc.endQty += b.endQty;
      acc.endPallets += b.endPallets;
      acc.varianceQty += b.varianceQty;
      return acc;
    },
    {
      startQty: 0,
      startPallets: 0,
      inQty: 0,
      outQty: 0,
      adjQty: 0,
      endQty: 0,
      endPallets: 0,
      varianceQty: 0,
    }
  );

  return {
    startDate,
    endDate,
    hasStartSnapshot: startAgg.found,
    hasEndSnapshot: endAgg.found,
    brands,
    totals,
  };
}
