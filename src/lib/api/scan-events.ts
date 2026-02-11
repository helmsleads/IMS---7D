import { createClient } from "@/lib/supabase";

export type ScanType = "product" | "lpn" | "location" | "sublocation" | "lot";
export type WorkflowStage =
  | "receiving"
  | "putaway"
  | "picking"
  | "packing"
  | "shipping"
  | "cycle_count"
  | "transfer"
  | "return_processing"
  | "damage_inspection";
export type ScanResult = "success" | "error" | "warning";

export interface ScanEvent {
  id: string;
  scan_type: ScanType;
  barcode: string;
  product_id: string | null;
  lpn_id: string | null;
  location_id: string | null;
  sublocation_id: string | null;
  lot_id: string | null;
  workflow_stage: WorkflowStage;
  reference_type: string | null;
  reference_id: string | null;
  scanner_id: string | null;
  station_id: string | null;
  scan_result: ScanResult;
  error_message: string | null;
  qty_scanned: number | null;
  fill_status: "full" | "empty" | null;
  scanned_by: string | null;
  scanned_at: string;
}

export interface ScanEventWithDetails extends ScanEvent {
  product?: {
    id: string;
    sku: string;
    name: string;
  } | null;
  location?: {
    id: string;
    name: string;
  } | null;
  lpn?: {
    id: string;
    lpn_number: string;
  } | null;
}

export interface ScanFilters {
  workflowStage?: WorkflowStage;
  scanType?: ScanType;
  referenceType?: string;
  referenceId?: string;
  scannerId?: string;
  stationId?: string;
  scanResult?: ScanResult;
  startDate?: string;
  endDate?: string;
  limit?: number;
}

/**
 * Log a scan event
 */
export async function logScanEvent(params: {
  scanType: ScanType;
  barcode: string;
  workflowStage: WorkflowStage;
  productId?: string;
  lpnId?: string;
  locationId?: string;
  sublocationId?: string;
  lotId?: string;
  referenceType?: string;
  referenceId?: string;
  scannerId?: string;
  stationId?: string;
  scanResult?: ScanResult;
  errorMessage?: string;
  qtyScanned?: number;
  fillStatus?: "full" | "empty";
  scannedBy?: string;
}): Promise<ScanEvent> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("scan_events")
    .insert({
      scan_type: params.scanType,
      barcode: params.barcode,
      workflow_stage: params.workflowStage,
      product_id: params.productId || null,
      lpn_id: params.lpnId || null,
      location_id: params.locationId || null,
      sublocation_id: params.sublocationId || null,
      lot_id: params.lotId || null,
      reference_type: params.referenceType || null,
      reference_id: params.referenceId || null,
      scanner_id: params.scannerId || null,
      station_id: params.stationId || null,
      scan_result: params.scanResult || "success",
      error_message: params.errorMessage || null,
      qty_scanned: params.qtyScanned || null,
      fill_status: params.fillStatus || null,
      scanned_by: params.scannedBy || null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

/**
 * Get scan events with optional filtering
 */
export async function getScanEvents(
  filters?: ScanFilters
): Promise<ScanEventWithDetails[]> {
  const supabase = createClient();

  let query = supabase
    .from("scan_events")
    .select(`
      *,
      product:products (id, sku, name),
      location:locations (id, name),
      lpn:lpns (id, lpn_number)
    `)
    .order("scanned_at", { ascending: false });

  if (filters?.workflowStage) {
    query = query.eq("workflow_stage", filters.workflowStage);
  }

  if (filters?.scanType) {
    query = query.eq("scan_type", filters.scanType);
  }

  if (filters?.referenceType) {
    query = query.eq("reference_type", filters.referenceType);
  }

  if (filters?.referenceId) {
    query = query.eq("reference_id", filters.referenceId);
  }

  if (filters?.scannerId) {
    query = query.eq("scanner_id", filters.scannerId);
  }

  if (filters?.stationId) {
    query = query.eq("station_id", filters.stationId);
  }

  if (filters?.scanResult) {
    query = query.eq("scan_result", filters.scanResult);
  }

  if (filters?.startDate) {
    query = query.gte("scanned_at", filters.startDate);
  }

  if (filters?.endDate) {
    query = query.lte("scanned_at", filters.endDate);
  }

  if (filters?.limit) {
    query = query.limit(filters.limit);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

/**
 * Get scan history for a specific reference (order, return, etc.)
 */
export async function getScansByReference(
  referenceType: string,
  referenceId: string
): Promise<ScanEventWithDetails[]> {
  return getScanEvents({
    referenceType,
    referenceId,
  });
}

/**
 * Get scan events by barcode
 */
export async function getScansByBarcode(
  barcode: string,
  limit: number = 50
): Promise<ScanEventWithDetails[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("scan_events")
    .select(`
      *,
      product:products (id, sku, name),
      location:locations (id, name),
      lpn:lpns (id, lpn_number)
    `)
    .eq("barcode", barcode)
    .order("scanned_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

/**
 * Resolve a barcode to its entity type and ID
 */
export async function resolveBarcode(barcode: string): Promise<{
  type: ScanType;
  id: string;
  data: Record<string, unknown>;
} | null> {
  const supabase = createClient();

  // Check products first (by barcode or SKU)
  const { data: product } = await supabase
    .from("products")
    .select("id, sku, name, barcode")
    .or(`barcode.eq.${barcode},sku.eq.${barcode}`)
    .single();

  if (product) {
    return {
      type: "product",
      id: product.id,
      data: product,
    };
  }

  // Check product UOM barcodes
  const { data: uom } = await supabase
    .from("product_uom")
    .select("product_id, uom, qty_per_uom, products (id, sku, name)")
    .eq("barcode", barcode)
    .single();

  if (uom) {
    return {
      type: "product",
      id: uom.product_id,
      data: {
        ...uom.products,
        uom: uom.uom,
        qty_per_uom: uom.qty_per_uom,
      },
    };
  }

  // Check LPNs
  const { data: lpn } = await supabase
    .from("lpns")
    .select("id, lpn_number, container_type, status, stage")
    .eq("lpn_number", barcode)
    .single();

  if (lpn) {
    return {
      type: "lpn",
      id: lpn.id,
      data: lpn,
    };
  }

  // Check locations
  const { data: location } = await supabase
    .from("locations")
    .select("id, name, code")
    .eq("code", barcode)
    .single();

  if (location) {
    return {
      type: "location",
      id: location.id,
      data: location,
    };
  }

  // Check sublocations
  const { data: sublocation } = await supabase
    .from("sublocations")
    .select("id, code, name, location_id")
    .eq("code", barcode)
    .single();

  if (sublocation) {
    return {
      type: "sublocation",
      id: sublocation.id,
      data: sublocation,
    };
  }

  // Check lots
  const { data: lot } = await supabase
    .from("lots")
    .select("id, lot_number, product_id, expiration_date, status")
    .eq("lot_number", barcode)
    .single();

  if (lot) {
    return {
      type: "lot",
      id: lot.id,
      data: lot,
    };
  }

  return null;
}

/**
 * Get scan statistics for a time period
 */
export async function getScanStats(
  startDate: string,
  endDate: string
): Promise<{
  totalScans: number;
  successfulScans: number;
  errorScans: number;
  scansByStage: Record<WorkflowStage, number>;
  scansByType: Record<ScanType, number>;
}> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("scan_events")
    .select("scan_type, workflow_stage, scan_result")
    .gte("scanned_at", startDate)
    .lte("scanned_at", endDate);

  if (error) {
    throw new Error(error.message);
  }

  const stats = {
    totalScans: data?.length || 0,
    successfulScans: 0,
    errorScans: 0,
    scansByStage: {} as Record<WorkflowStage, number>,
    scansByType: {} as Record<ScanType, number>,
  };

  for (const scan of data || []) {
    if (scan.scan_result === "success") {
      stats.successfulScans++;
    } else if (scan.scan_result === "error") {
      stats.errorScans++;
    }

    stats.scansByStage[scan.workflow_stage as WorkflowStage] =
      (stats.scansByStage[scan.workflow_stage as WorkflowStage] || 0) + 1;

    stats.scansByType[scan.scan_type as ScanType] =
      (stats.scansByType[scan.scan_type as ScanType] || 0) + 1;
  }

  return stats;
}
