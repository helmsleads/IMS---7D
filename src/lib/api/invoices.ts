import { createClient } from "@/lib/supabase";
import { Invoice, InvoiceItem, InvoiceStatus, UsageRecord, WorkflowProfile } from "@/types/database";
import { getOrderSupplies } from "@/lib/api/supplies";

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

/**
 * Generate a draft invoice for a shipped outbound order.
 * Includes pick/pack fees, handling fee, packing supplies, and shipping cost
 * based on the client's workflow profile billing rates.
 */
export async function generateShipmentInvoice(orderId: string): Promise<Invoice | null> {
  const supabase = createClient();

  // 1. Fetch the order with items and shipping cost
  const { data: order, error: orderError } = await supabase
    .from("outbound_orders")
    .select(`
      id,
      order_number,
      client_id,
      shipped_date,
      client_shipping_cost,
      items:outbound_items (qty_shipped)
    `)
    .eq("id", orderId)
    .single();

  if (orderError || !order || !order.client_id) {
    return null;
  }

  // 2. Get the client's workflow profile for billing rates
  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("workflow_profile_id")
    .eq("id", order.client_id)
    .single();

  if (clientError || !client?.workflow_profile_id) {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from("workflow_profiles")
    .select("billing_enabled, billing_pick_rate, billing_pack_rate, billing_handling_fee")
    .eq("id", client.workflow_profile_id)
    .single();

  if (profileError || !profile || !profile.billing_enabled) {
    return null;
  }

  // 3. Calculate total units shipped
  const items = order.items as { qty_shipped: number }[];
  const totalUnitsShipped = items.reduce((sum, i) => sum + (i.qty_shipped || 0), 0);

  // 4. Fetch supply usage for this order
  const supplyUsage = await getOrderSupplies(orderId);

  // 5. Build invoice line items
  const lineItems: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    total: number;
  }> = [];

  const pickRate = profile.billing_pick_rate || 0;
  if (pickRate > 0 && totalUnitsShipped > 0) {
    lineItems.push({
      description: `Pick fee (${totalUnitsShipped} units)`,
      quantity: totalUnitsShipped,
      unit_price: pickRate,
      total: totalUnitsShipped * pickRate,
    });
  }

  const packRate = profile.billing_pack_rate || 0;
  if (packRate > 0 && totalUnitsShipped > 0) {
    lineItems.push({
      description: `Pack fee (${totalUnitsShipped} units)`,
      quantity: totalUnitsShipped,
      unit_price: packRate,
      total: totalUnitsShipped * packRate,
    });
  }

  const handlingFee = profile.billing_handling_fee || 0;
  if (handlingFee > 0) {
    lineItems.push({
      description: "Order handling fee",
      quantity: 1,
      unit_price: handlingFee,
      total: handlingFee,
    });
  }

  // Packing supplies — one line per supply used
  for (const usage of supplyUsage) {
    if (usage.quantity > 0 && usage.unit_price > 0) {
      const supplyName = typeof usage.supply === "object" && usage.supply
        ? usage.supply.name
        : "Packing supply";
      lineItems.push({
        description: `Packing supply: ${supplyName}`,
        quantity: usage.quantity,
        unit_price: usage.unit_price,
        total: usage.total || usage.quantity * usage.unit_price,
      });
    }
  }

  // Shipping cost
  const shippingCost = order.client_shipping_cost || 0;
  if (shippingCost > 0) {
    lineItems.push({
      description: "Shipping",
      quantity: 1,
      unit_price: shippingCost,
      total: shippingCost,
    });
  }

  // 6. If no line items, nothing to invoice
  if (lineItems.length === 0) {
    return null;
  }

  // 7. Generate invoice number and calculate totals
  const invoiceNumber = await generateInvoiceNumber();
  const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
  const shipDate = order.shipped_date || new Date().toISOString().split("T")[0];

  // 8. Create the invoice
  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .insert({
      client_id: order.client_id,
      invoice_number: invoiceNumber,
      period_start: shipDate,
      period_end: shipDate,
      subtotal,
      tax_rate: 0,
      tax_amount: 0,
      total: subtotal,
      status: "draft" as const,
      notes: `Auto-generated for order ${order.order_number}`,
    })
    .select()
    .single();

  if (invoiceError) {
    throw new Error(invoiceError.message);
  }

  // 9. Insert invoice items
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
    throw new Error(itemsError.message);
  }

  // 10. Mark supply_usage records as invoiced
  if (supplyUsage.length > 0) {
    const usageIds = supplyUsage.map((u) => u.id);
    const { error: usageUpdateError } = await supabase
      .from("supply_usage")
      .update({ invoiced: true, invoice_id: invoice.id })
      .in("id", usageIds);

    if (usageUpdateError) {
      console.error("Failed to mark supply usage as invoiced:", usageUpdateError.message);
    }
  }

  return invoice;
}
