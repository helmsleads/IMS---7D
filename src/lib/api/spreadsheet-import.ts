import { createClient } from "@/lib/supabase";

export interface SpreadsheetImportSummary {
  id: string;
  filename: string;
  file_type: string;
  import_type: string;
  status: string;
  total_rows: number;
  products_created: number;
  products_updated: number;
  inventory_updated: number;
  rows_skipped: number;
  created_at: string;
  completed_at: string | null;
  notes: string | null;
}

export interface SpreadsheetImportDetail extends SpreadsheetImportSummary {
  discrepancies: Array<{
    sku: string;
    name: string;
    sheetQty: number;
    systemQty: number;
    difference: number;
  }>;
  errors: Array<{ row: number; sku: string; error: string }>;
  applied_data: Array<{
    sku: string;
    name: string;
    action: string;
    qty: number;
    clientId: string | null;
  }>;
  brand_client_map: Record<string, string | null>;
  location_id: string | null;
  imported_by: string | null;
}

export async function getImportHistory(): Promise<SpreadsheetImportSummary[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("spreadsheet_imports")
    .select(
      "id, filename, file_type, import_type, status, total_rows, products_created, products_updated, inventory_updated, rows_skipped, created_at, completed_at, notes"
    )
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw new Error(error.message);
  return data || [];
}

export async function getImport(id: string): Promise<SpreadsheetImportDetail> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("spreadsheet_imports")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw new Error(error.message);
  return data;
}
