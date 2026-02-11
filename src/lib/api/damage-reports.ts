import { createClient } from "@/lib/supabase";
import { DamageReport, DamageResolution } from "@/types/database";
import { updateInventoryWithTransaction } from "./inventory-transactions";

export interface DamageReportFilters {
  referenceType?: string;
  referenceId?: string;
  productId?: string;
  resolution?: DamageResolution;
  startDate?: string;
  endDate?: string;
}

export interface DamageReportWithProduct extends DamageReport {
  product: {
    id: string;
    sku: string;
    name: string;
  };
  credit_amount: number | null;
}

export async function getDamageReports(
  filters?: DamageReportFilters
): Promise<DamageReportWithProduct[]> {
  const supabase = createClient();

  let query = supabase
    .from("damage_reports")
    .select(`
      *,
      product:products (id, sku, name)
    `)
    .order("reported_at", { ascending: false });

  if (filters?.referenceType) {
    query = query.eq("reference_type", filters.referenceType);
  }

  if (filters?.referenceId) {
    query = query.eq("reference_id", filters.referenceId);
  }

  if (filters?.productId) {
    query = query.eq("product_id", filters.productId);
  }

  if (filters?.resolution) {
    query = query.eq("resolution", filters.resolution);
  }

  if (filters?.startDate) {
    query = query.gte("reported_at", filters.startDate);
  }

  if (filters?.endDate) {
    query = query.lte("reported_at", filters.endDate);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export async function getDamageReport(id: string): Promise<DamageReportWithProduct | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("damage_reports")
    .select(`
      *,
      product:products (id, sku, name)
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

export async function createDamageReport(
  report: Partial<DamageReport>
): Promise<DamageReport> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("damage_reports")
    .insert({
      ...report,
      reported_at: report.reported_at || new Date().toISOString(),
      resolution: report.resolution || "pending",
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function updateDamageReport(
  id: string,
  report: Partial<DamageReport>
): Promise<DamageReport> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("damage_reports")
    .update(report)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function resolveDamageReport(
  id: string,
  resolution: DamageResolution,
  notes: string | null,
  creditAmount?: number | null,
  locationId?: string,
  performedBy?: string
): Promise<DamageReport> {
  const supabase = createClient();

  // Get the damage report first
  const { data: report, error: reportError } = await supabase
    .from("damage_reports")
    .select("product_id, quantity")
    .eq("id", id)
    .single();

  if (reportError) {
    throw new Error(reportError.message);
  }

  const updateData: Record<string, unknown> = {
    resolution,
    resolution_notes: notes,
    resolved_at: new Date().toISOString(),
    resolved_by: performedBy || null,
  };

  // Only include credit_amount if it's provided and the resolution involves credit
  if (creditAmount !== undefined && (resolution === "credit_requested" || resolution === "credit_received")) {
    updateData.credit_amount = creditAmount;
  }

  const { data, error } = await supabase
    .from("damage_reports")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  // If resolution is 'written_off' and location is provided, deduct from inventory
  if (resolution === "written_off" && report.quantity > 0 && locationId) {
    try {
      await updateInventoryWithTransaction({
        productId: report.product_id,
        locationId,
        qtyChange: -report.quantity,
        transactionType: "damage_writeoff",
        referenceType: "damage_report",
        referenceId: id,
        reason: `Damage write-off: ${notes || "No notes"}`,
        performedBy,
      });
    } catch (inventoryError) {
      // Log but don't fail the resolution update
      console.error("Failed to update inventory for damage write-off:", inventoryError);
    }
  }

  // If resolution is 'restocked' and location is provided, add back to inventory
  if (resolution === "restocked" && report.quantity > 0 && locationId) {
    try {
      await updateInventoryWithTransaction({
        productId: report.product_id,
        locationId,
        qtyChange: report.quantity,
        transactionType: "return_restock",
        referenceType: "damage_report",
        referenceId: id,
        reason: `Damage restock: ${notes || "Items returned to inventory after inspection"}`,
        performedBy,
      });
    } catch (inventoryError) {
      console.error("Failed to update inventory for damage restock:", inventoryError);
    }
  }

  return data;
}

export async function getDamageReportsByProduct(
  productId: string
): Promise<DamageReportWithProduct[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("damage_reports")
    .select(`
      *,
      product:products (id, sku, name)
    `)
    .eq("product_id", productId)
    .order("reported_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export async function getPendingDamageReports(): Promise<DamageReportWithProduct[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("damage_reports")
    .select(`
      *,
      product:products (id, sku, name)
    `)
    .eq("resolution", "pending")
    .order("reported_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}
