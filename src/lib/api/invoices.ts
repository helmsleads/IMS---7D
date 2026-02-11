import { createClient } from "@/lib/supabase";
import { Invoice, InvoiceItem, InvoiceStatus, UsageRecord } from "@/types/database";

export interface InvoiceFilters {
  clientId?: string;
  status?: InvoiceStatus;
  startDate?: string;
  endDate?: string;
}

export interface UsageFilters {
  clientId?: string;
  serviceId?: string;
  addonId?: string;
  startDate?: string;
  endDate?: string;
  invoiced?: boolean;
}

export interface InvoiceWithItems extends Omit<Invoice, 'client' | 'items'> {
  items: InvoiceItem[];
  client: {
    id: string;
    company_name: string;
    email: string | null;
  };
}

export async function getInvoices(filters?: InvoiceFilters): Promise<InvoiceWithItems[]> {
  const supabase = createClient();

  let query = supabase
    .from("invoices")
    .select(`
      *,
      items:invoice_items (*),
      client:clients (id, company_name, email)
    `)
    .order("created_at", { ascending: false });

  if (filters?.clientId) {
    query = query.eq("client_id", filters.clientId);
  }

  if (filters?.status) {
    query = query.eq("status", filters.status);
  }

  if (filters?.startDate) {
    query = query.gte("period_start", filters.startDate);
  }

  if (filters?.endDate) {
    query = query.lte("period_end", filters.endDate);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export async function getInvoice(id: string): Promise<InvoiceWithItems | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("invoices")
    .select(`
      *,
      items:invoice_items (*),
      client:clients (id, company_name, email)
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

export async function createInvoice(
  invoice: Partial<Invoice>
): Promise<Invoice> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("invoices")
    .insert(invoice)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function updateInvoice(
  id: string,
  invoice: Partial<Invoice>
): Promise<Invoice> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("invoices")
    .update(invoice)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function deleteInvoice(id: string): Promise<void> {
  const supabase = createClient();

  // Only allow deleting draft invoices
  const { error } = await supabase
    .from("invoices")
    .delete()
    .eq("id", id)
    .eq("status", "draft");

  if (error) {
    throw new Error(error.message);
  }
}

export async function sendInvoice(id: string): Promise<Invoice> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("invoices")
    .update({
      status: "sent",
      sent_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function markInvoicePaid(id: string): Promise<Invoice> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("invoices")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function generateInvoiceNumber(): Promise<string> {
  const supabase = createClient();

  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;

  const { data, error } = await supabase
    .from("invoices")
    .select("invoice_number")
    .like("invoice_number", `${prefix}%`)
    .order("invoice_number", { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(error.message);
  }

  let nextNumber = 1;

  if (data && data.length > 0) {
    const lastNumber = data[0].invoice_number;
    const lastSequence = parseInt(lastNumber.replace(prefix, ""), 10);
    if (!isNaN(lastSequence)) {
      nextNumber = lastSequence + 1;
    }
  }

  return `${prefix}${nextNumber.toString().padStart(5, "0")}`;
}

export async function addInvoiceItem(
  invoiceId: string,
  item: Partial<InvoiceItem>
): Promise<InvoiceItem> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("invoice_items")
    .insert({
      ...item,
      invoice_id: invoiceId,
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function updateInvoiceItem(
  id: string,
  item: Partial<InvoiceItem>
): Promise<InvoiceItem> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("invoice_items")
    .update(item)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function deleteInvoiceItem(id: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from("invoice_items")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function calculateInvoiceTotals(invoiceId: string): Promise<Invoice> {
  const supabase = createClient();

  // Get all items for this invoice
  const { data: items, error: itemsError } = await supabase
    .from("invoice_items")
    .select("total")
    .eq("invoice_id", invoiceId);

  if (itemsError) {
    throw new Error(itemsError.message);
  }

  // Get the invoice to get tax rate
  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select("tax_rate")
    .eq("id", invoiceId)
    .single();

  if (invoiceError) {
    throw new Error(invoiceError.message);
  }

  // Calculate totals
  const subtotal = items?.reduce((sum, item) => sum + (item.total || 0), 0) || 0;
  const taxRate = invoice.tax_rate || 0;
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;

  // Update the invoice
  const { data: updated, error: updateError } = await supabase
    .from("invoices")
    .update({
      subtotal,
      tax_amount: taxAmount,
      total,
    })
    .eq("id", invoiceId)
    .select()
    .single();

  if (updateError) {
    throw new Error(updateError.message);
  }

  return updated;
}

export async function getUsageRecords(filters?: UsageFilters): Promise<UsageRecord[]> {
  const supabase = createClient();

  let query = supabase
    .from("usage_records")
    .select("*")
    .order("usage_date", { ascending: false });

  if (filters?.clientId) {
    query = query.eq("client_id", filters.clientId);
  }

  if (filters?.serviceId) {
    query = query.eq("service_id", filters.serviceId);
  }

  if (filters?.addonId) {
    query = query.eq("addon_id", filters.addonId);
  }

  if (filters?.startDate) {
    query = query.gte("usage_date", filters.startDate);
  }

  if (filters?.endDate) {
    query = query.lte("usage_date", filters.endDate);
  }

  if (filters?.invoiced !== undefined) {
    query = query.eq("invoiced", filters.invoiced);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export async function createUsageRecord(
  usage: Partial<UsageRecord>
): Promise<UsageRecord> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("usage_records")
    .insert(usage)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function getUninvoicedUsage(clientId: string): Promise<UsageRecord[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("usage_records")
    .select("*")
    .eq("client_id", clientId)
    .eq("invoiced", false)
    .order("usage_date");

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export async function markUsageInvoiced(
  usageIds: string[],
  invoiceId: string
): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from("usage_records")
    .update({
      invoiced: true,
      invoice_id: invoiceId,
    })
    .in("id", usageIds);

  if (error) {
    throw new Error(error.message);
  }
}

export async function generateInvoiceFromUsage(
  clientId: string,
  periodStart: string,
  periodEnd: string
): Promise<Invoice> {
  const supabase = createClient();

  // Get uninvoiced usage for the period
  const { data: usage, error: usageError } = await supabase
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

  if (!usage || usage.length === 0) {
    throw new Error("No uninvoiced usage found for the specified period");
  }

  // Generate invoice number
  const invoiceNumber = await generateInvoiceNumber();

  // Calculate subtotal from usage
  const subtotal = usage.reduce((sum, record) => sum + (record.total || 0), 0);

  // Create the invoice
  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .insert({
      client_id: clientId,
      invoice_number: invoiceNumber,
      period_start: periodStart,
      period_end: periodEnd,
      subtotal,
      tax_rate: 0,
      tax_amount: 0,
      total: subtotal,
      status: "draft",
    })
    .select()
    .single();

  if (invoiceError) {
    throw new Error(invoiceError.message);
  }

  // Create invoice items from usage
  const invoiceItems = usage.map((record, index) => ({
    invoice_id: invoice.id,
    description: `${record.usage_type}: ${record.quantity} x $${record.unit_price}`,
    quantity: record.quantity,
    unit_price: record.unit_price,
    total: record.total,
    service_id: record.service_id,
    addon_id: record.addon_id,
    sort_order: index,
  }));

  const { error: itemsError } = await supabase
    .from("invoice_items")
    .insert(invoiceItems);

  if (itemsError) {
    throw new Error(itemsError.message);
  }

  // Mark usage as invoiced
  const usageIds = usage.map((record) => record.id);
  await markUsageInvoiced(usageIds, invoice.id);

  return invoice;
}
