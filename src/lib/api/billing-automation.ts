import { createClient } from "@/lib/supabase";

// Types
export interface ClientBillingConfig {
  id: string;
  client_id: string;
  billing_frequency: "weekly" | "biweekly" | "monthly";
  billing_day_of_month: number;
  billing_day_of_week: number;
  payment_terms_days: number;
  late_fee_percent: number;
  monthly_minimum: number;
  tax_rate: number;
  tax_exempt: boolean;
  auto_generate_invoices: boolean;
  auto_send_invoices: boolean;
  billing_email: string | null;
  billing_contact_name: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type RateCategory =
  | "storage"
  | "inbound"
  | "outbound"
  | "pick"
  | "pack"
  | "special"
  | "return"
  | "supply";

export interface VolumeTier {
  min_qty: number;
  max_qty: number | null;
  unit_price: number;
}

export interface ClientRateCard {
  id: string;
  client_id: string;
  rate_category: RateCategory;
  rate_code: string;
  rate_name: string;
  description: string | null;
  unit_price: number;
  price_unit: string;
  volume_tiers: VolumeTier[];
  minimum_charge: number;
  effective_date: string | null;
  expiration_date: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface DefaultRateTemplate {
  id: string;
  template_name: string;
  is_default: boolean;
  rate_category: RateCategory;
  rate_code: string;
  rate_name: string;
  description: string | null;
  unit_price: number;
  price_unit: string;
  volume_tiers: VolumeTier[];
  minimum_charge: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BillingRun {
  id: string;
  run_number: string;
  run_type: "scheduled" | "manual" | "retry";
  period_start: string;
  period_end: string;
  client_id: string | null;
  status: "pending" | "processing" | "completed" | "failed" | "partial";
  invoices_generated: number;
  total_billed: number;
  errors: Array<{ client_id: string; error: string }>;
  started_at: string | null;
  completed_at: string | null;
  started_by: string | null;
  created_at: string;
}

export interface StorageFeeResult {
  rate_code: string;
  rate_name: string;
  total_quantity: number;
  unit_price: number;
  price_unit: string;
  total_amount: number;
}

// ============================================
// Client Billing Config Functions
// ============================================

export async function getClientBillingConfig(
  clientId: string
): Promise<ClientBillingConfig | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("client_billing_config")
    .select("*")
    .eq("client_id", clientId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null; // No config exists
    }
    throw new Error(error.message);
  }

  return data;
}

export async function upsertClientBillingConfig(
  clientId: string,
  config: Partial<Omit<ClientBillingConfig, "id" | "client_id" | "created_at" | "updated_at">>
): Promise<ClientBillingConfig> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("client_billing_config")
    .upsert(
      {
        client_id: clientId,
        ...config,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "client_id" }
    )
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

// ============================================
// Client Rate Card Functions
// ============================================

export async function getClientRateCards(
  clientId: string,
  filters?: {
    category?: RateCategory;
    activeOnly?: boolean;
  }
): Promise<ClientRateCard[]> {
  const supabase = createClient();

  let query = supabase
    .from("client_rate_cards")
    .select("*")
    .eq("client_id", clientId)
    .order("rate_category")
    .order("rate_code");

  if (filters?.category) {
    query = query.eq("rate_category", filters.category);
  }

  if (filters?.activeOnly) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export async function getClientRateCard(
  clientId: string,
  rateCode: string
): Promise<ClientRateCard | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("client_rate_cards")
    .select("*")
    .eq("client_id", clientId)
    .eq("rate_code", rateCode)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(error.message);
  }

  return data;
}

export async function createClientRateCard(
  rateCard: Omit<ClientRateCard, "id" | "created_at" | "updated_at">
): Promise<ClientRateCard> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("client_rate_cards")
    .insert(rateCard)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function updateClientRateCard(
  id: string,
  updates: Partial<Omit<ClientRateCard, "id" | "client_id" | "created_at" | "updated_at">>
): Promise<ClientRateCard> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("client_rate_cards")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function deleteClientRateCard(id: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from("client_rate_cards")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

// ============================================
// Default Rate Template Functions
// ============================================

export async function getDefaultRateTemplates(
  templateName?: string
): Promise<DefaultRateTemplate[]> {
  const supabase = createClient();

  let query = supabase
    .from("default_rate_templates")
    .select("*")
    .eq("is_active", true)
    .order("template_name")
    .order("rate_category")
    .order("rate_code");

  if (templateName) {
    query = query.eq("template_name", templateName);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export async function getTemplateNames(): Promise<string[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("default_rate_templates")
    .select("template_name")
    .eq("is_active", true);

  if (error) {
    throw new Error(error.message);
  }

  const uniqueNames = [...new Set(data?.map((t) => t.template_name) || [])];
  return uniqueNames;
}

export async function copyDefaultRatesToClient(
  clientId: string,
  templateName: string = "Standard"
): Promise<number> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc("copy_default_rates_to_client", {
    p_client_id: clientId,
    p_template_name: templateName,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data || 0;
}

// ============================================
// Billing Automation Functions
// ============================================

export async function recordBillableEvent(
  clientId: string,
  rateCode: string,
  quantity: number,
  options?: {
    referenceType?: string;
    referenceId?: string;
    usageDate?: string;
    notes?: string;
  }
): Promise<string | null> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc("record_billable_event", {
    p_client_id: clientId,
    p_rate_code: rateCode,
    p_quantity: quantity,
    p_reference_type: options?.referenceType || null,
    p_reference_id: options?.referenceId || null,
    p_usage_date: options?.usageDate || new Date().toISOString().split("T")[0],
    p_notes: options?.notes || null,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function calculateStorageFees(
  clientId: string,
  periodStart: string,
  periodEnd: string
): Promise<StorageFeeResult[]> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc("calculate_storage_fees", {
    p_client_id: clientId,
    p_period_start: periodStart,
    p_period_end: periodEnd,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export async function takeStorageSnapshot(
  snapshotDate?: string
): Promise<number> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc("take_storage_snapshot", {
    p_snapshot_date: snapshotDate || new Date().toISOString().split("T")[0],
  });

  if (error) {
    throw new Error(error.message);
  }

  return data || 0;
}

// ============================================
// Billing Run Functions
// ============================================

export async function getBillingRuns(
  filters?: {
    status?: BillingRun["status"];
    clientId?: string;
    limit?: number;
  }
): Promise<BillingRun[]> {
  const supabase = createClient();

  let query = supabase
    .from("billing_runs")
    .select("*")
    .order("created_at", { ascending: false });

  if (filters?.status) {
    query = query.eq("status", filters.status);
  }

  if (filters?.clientId) {
    query = query.eq("client_id", filters.clientId);
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

export async function createBillingRun(
  runType: BillingRun["run_type"],
  periodStart: string,
  periodEnd: string,
  clientId?: string
): Promise<BillingRun> {
  const supabase = createClient();

  // Generate run number
  const { data: runNumber, error: runNumberError } = await supabase.rpc(
    "generate_billing_run_number"
  );

  if (runNumberError) {
    throw new Error(runNumberError.message);
  }

  const { data, error } = await supabase
    .from("billing_runs")
    .insert({
      run_number: runNumber,
      run_type: runType,
      period_start: periodStart,
      period_end: periodEnd,
      client_id: clientId || null,
      status: "pending",
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function updateBillingRun(
  id: string,
  updates: Partial<Pick<BillingRun, "status" | "invoices_generated" | "total_billed" | "errors" | "started_at" | "completed_at">>
): Promise<BillingRun> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("billing_runs")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

// ============================================
// Automated Invoice Generation
// ============================================

export interface GenerateInvoiceOptions {
  clientId: string;
  periodStart: string;
  periodEnd: string;
  includeUsage?: boolean;
  includeStorage?: boolean;
  applyMinimum?: boolean;
  taxRate?: number;
}

export async function generateClientInvoice(
  options: GenerateInvoiceOptions
): Promise<{ invoiceId: string; total: number } | null> {
  const supabase = createClient();

  const {
    clientId,
    periodStart,
    periodEnd,
    includeUsage = true,
    includeStorage = true,
    applyMinimum = true,
  } = options;

  // Get client billing config
  const config = await getClientBillingConfig(clientId);
  const taxRate = options.taxRate ?? config?.tax_rate ?? 0;
  const monthlyMinimum = config?.monthly_minimum ?? 0;

  let subtotal = 0;
  const lineItems: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    total: number;
  }> = [];

  // Get uninvoiced usage records
  if (includeUsage) {
    const { data: usageRecords, error: usageError } = await supabase
      .from("usage_records")
      .select("*")
      .eq("client_id", clientId)
      .eq("invoiced", false)
      .gte("usage_date", periodStart)
      .lte("usage_date", periodEnd)
      .order("usage_date");

    if (usageError) {
      throw new Error(usageError.message);
    }

    // Group usage by type
    const groupedUsage = (usageRecords || []).reduce((acc, record) => {
      const key = record.usage_type;
      if (!acc[key]) {
        acc[key] = { quantity: 0, total: 0, unit_price: record.unit_price };
      }
      acc[key].quantity += record.quantity;
      acc[key].total += record.total;
      return acc;
    }, {} as Record<string, { quantity: number; total: number; unit_price: number }>);

    for (const [usageType, data] of Object.entries(groupedUsage)) {
      lineItems.push({
        description: usageType,
        quantity: data.quantity,
        unit_price: data.unit_price,
        total: data.total,
      });
      subtotal += data.total;
    }
  }

  // Add storage fees
  if (includeStorage) {
    const storageFees = await calculateStorageFees(clientId, periodStart, periodEnd);
    for (const fee of storageFees) {
      if (fee.total_amount > 0) {
        lineItems.push({
          description: fee.rate_name,
          quantity: fee.total_quantity,
          unit_price: fee.unit_price,
          total: fee.total_amount,
        });
        subtotal += fee.total_amount;
      }
    }
  }

  // Check if we have anything to invoice
  if (lineItems.length === 0 && subtotal === 0 && monthlyMinimum === 0) {
    return null; // Nothing to invoice
  }

  // Apply monthly minimum if needed
  if (applyMinimum && subtotal < monthlyMinimum) {
    const minimumAdjustment = monthlyMinimum - subtotal;
    lineItems.push({
      description: "Monthly Minimum Adjustment",
      quantity: 1,
      unit_price: minimumAdjustment,
      total: minimumAdjustment,
    });
    subtotal = monthlyMinimum;
  }

  // Calculate tax
  const taxAmount = config?.tax_exempt ? 0 : subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;

  // Generate invoice number
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;
  const { data: lastInvoice } = await supabase
    .from("invoices")
    .select("invoice_number")
    .like("invoice_number", `${prefix}%`)
    .order("invoice_number", { ascending: false })
    .limit(1);

  let nextNumber = 1;
  if (lastInvoice && lastInvoice.length > 0) {
    const lastSeq = parseInt(lastInvoice[0].invoice_number.replace(prefix, ""), 10);
    if (!isNaN(lastSeq)) {
      nextNumber = lastSeq + 1;
    }
  }
  const invoiceNumber = `${prefix}${nextNumber.toString().padStart(5, "0")}`;

  // Calculate due date
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + (config?.payment_terms_days || 30));

  // Create the invoice
  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .insert({
      client_id: clientId,
      invoice_number: invoiceNumber,
      period_start: periodStart,
      period_end: periodEnd,
      subtotal,
      tax_rate: taxRate,
      tax_amount: taxAmount,
      total,
      status: "draft",
      due_date: dueDate.toISOString().split("T")[0],
    })
    .select()
    .single();

  if (invoiceError) {
    throw new Error(invoiceError.message);
  }

  // Create invoice line items
  const invoiceItems = lineItems.map((item, index) => ({
    invoice_id: invoice.id,
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unit_price,
    total: item.total,
    sort_order: index,
  }));

  const { error: itemsError } = await supabase
    .from("invoice_items")
    .insert(invoiceItems);

  if (itemsError) {
    // Rollback invoice
    await supabase.from("invoices").delete().eq("id", invoice.id);
    throw new Error(itemsError.message);
  }

  // Mark usage records as invoiced
  if (includeUsage) {
    await supabase
      .from("usage_records")
      .update({
        invoiced: true,
        invoice_id: invoice.id,
      })
      .eq("client_id", clientId)
      .eq("invoiced", false)
      .gte("usage_date", periodStart)
      .lte("usage_date", periodEnd);
  }

  return {
    invoiceId: invoice.id,
    total,
  };
}

// ============================================
// Bulk Billing Operations
// ============================================

export async function runAutomatedBilling(
  periodStart: string,
  periodEnd: string,
  clientId?: string
): Promise<BillingRun> {
  const supabase = createClient();

  // Create billing run record
  const billingRun = await createBillingRun(
    clientId ? "manual" : "scheduled",
    periodStart,
    periodEnd,
    clientId
  );

  // Update status to processing
  await updateBillingRun(billingRun.id, {
    status: "processing",
    started_at: new Date().toISOString(),
  });

  try {
    // Get clients to bill
    let query = supabase
      .from("clients")
      .select("id, company_name")
      .eq("active", true);

    if (clientId) {
      query = query.eq("id", clientId);
    }

    const { data: clients, error: clientsError } = await query;

    if (clientsError) {
      throw new Error(clientsError.message);
    }

    let invoicesGenerated = 0;
    let totalBilled = 0;
    const errors: Array<{ client_id: string; error: string }> = [];

    // Process each client
    for (const client of clients || []) {
      try {
        const result = await generateClientInvoice({
          clientId: client.id,
          periodStart,
          periodEnd,
          includeUsage: true,
          includeStorage: true,
          applyMinimum: true,
        });

        if (result) {
          invoicesGenerated++;
          totalBilled += result.total;
        }
      } catch (err) {
        errors.push({
          client_id: client.id,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    // Update billing run with results
    const finalStatus =
      errors.length === 0
        ? "completed"
        : invoicesGenerated > 0
        ? "partial"
        : "failed";

    await updateBillingRun(billingRun.id, {
      status: finalStatus,
      invoices_generated: invoicesGenerated,
      total_billed: totalBilled,
      errors,
      completed_at: new Date().toISOString(),
    });

    return {
      ...billingRun,
      status: finalStatus,
      invoices_generated: invoicesGenerated,
      total_billed: totalBilled,
      errors,
      completed_at: new Date().toISOString(),
    };
  } catch (err) {
    // Update billing run with failure
    await updateBillingRun(billingRun.id, {
      status: "failed",
      errors: [
        {
          client_id: "system",
          error: err instanceof Error ? err.message : "Unknown error",
        },
      ],
      completed_at: new Date().toISOString(),
    });
    throw err;
  }
}

// ============================================
// Summary and Reporting Functions
// ============================================

export async function getClientBillingSummary(
  clientId: string,
  periodStart: string,
  periodEnd: string
): Promise<{
  usageTotal: number;
  storageTotal: number;
  subtotal: number;
  taxAmount: number;
  total: number;
  lineItems: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    total: number;
  }>;
}> {
  const supabase = createClient();
  const config = await getClientBillingConfig(clientId);
  const taxRate = config?.tax_rate ?? 0;

  const lineItems: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    total: number;
  }> = [];

  // Get usage records
  const { data: usageRecords } = await supabase
    .from("usage_records")
    .select("*")
    .eq("client_id", clientId)
    .eq("invoiced", false)
    .gte("usage_date", periodStart)
    .lte("usage_date", periodEnd);

  let usageTotal = 0;
  const groupedUsage = (usageRecords || []).reduce((acc, record) => {
    const key = record.usage_type;
    if (!acc[key]) {
      acc[key] = { quantity: 0, total: 0, unit_price: record.unit_price };
    }
    acc[key].quantity += record.quantity;
    acc[key].total += record.total;
    return acc;
  }, {} as Record<string, { quantity: number; total: number; unit_price: number }>);

  for (const [usageType, data] of Object.entries(groupedUsage)) {
    lineItems.push({
      description: usageType,
      quantity: data.quantity,
      unit_price: data.unit_price,
      total: data.total,
    });
    usageTotal += data.total;
  }

  // Get storage fees
  const storageFees = await calculateStorageFees(clientId, periodStart, periodEnd);
  let storageTotal = 0;
  for (const fee of storageFees) {
    if (fee.total_amount > 0) {
      lineItems.push({
        description: fee.rate_name,
        quantity: fee.total_quantity,
        unit_price: fee.unit_price,
        total: fee.total_amount,
      });
      storageTotal += fee.total_amount;
    }
  }

  const subtotal = usageTotal + storageTotal;
  const taxAmount = config?.tax_exempt ? 0 : subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;

  return {
    usageTotal,
    storageTotal,
    subtotal,
    taxAmount,
    total,
    lineItems,
  };
}
