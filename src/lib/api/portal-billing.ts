import { createClient } from "@/lib/supabase";

export interface PortalInvoice {
  id: string;
  invoice_number: string;
  period_start: string;
  period_end: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  status: string;
  due_date: string | null;
  sent_at: string | null;
  paid_at: string | null;
  created_at: string;
}

export interface PortalInvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  sort_order: number;
}

export interface PortalInvoiceWithItems extends PortalInvoice {
  items: PortalInvoiceItem[];
}

export async function getMyInvoices(clientId: string): Promise<PortalInvoice[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("invoices")
    .select(`
      id,
      invoice_number,
      period_start,
      period_end,
      subtotal,
      tax_rate,
      tax_amount,
      total,
      status,
      due_date,
      sent_at,
      paid_at,
      created_at
    `)
    .eq("client_id", clientId)
    .neq("status", "draft")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export async function getMyInvoice(
  clientId: string,
  invoiceId: string
): Promise<PortalInvoiceWithItems | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("invoices")
    .select(`
      id,
      invoice_number,
      period_start,
      period_end,
      subtotal,
      tax_rate,
      tax_amount,
      total,
      status,
      due_date,
      sent_at,
      paid_at,
      created_at,
      items:invoice_items (
        id,
        description,
        quantity,
        unit_price,
        total,
        sort_order
      )
    `)
    .eq("id", invoiceId)
    .eq("client_id", clientId)
    .neq("status", "draft")
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(error.message);
  }

  // Sort items by sort_order
  if (data.items) {
    data.items.sort((a: PortalInvoiceItem, b: PortalInvoiceItem) => a.sort_order - b.sort_order);
  }

  return data;
}

export interface InvoicePdfData {
  invoice: PortalInvoiceWithItems;
  client: {
    company_name: string;
    contact_name: string | null;
    email: string | null;
    address_line1: string | null;
    address_line2: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
  };
  company: {
    name: string;
    address: string;
    phone: string;
    email: string;
  };
}

export async function downloadInvoicePdf(invoiceId: string): Promise<InvoicePdfData> {
  const supabase = createClient();

  // Get invoice with items
  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select(`
      id,
      invoice_number,
      client_id,
      period_start,
      period_end,
      subtotal,
      tax_rate,
      tax_amount,
      total,
      status,
      due_date,
      sent_at,
      paid_at,
      created_at,
      items:invoice_items (
        id,
        description,
        quantity,
        unit_price,
        total,
        sort_order
      )
    `)
    .eq("id", invoiceId)
    .single();

  if (invoiceError) {
    throw new Error(invoiceError.message);
  }

  // Get client details
  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select(`
      company_name,
      contact_name,
      email,
      address_line1,
      address_line2,
      city,
      state,
      zip
    `)
    .eq("id", invoice.client_id)
    .single();

  if (clientError) {
    throw new Error(clientError.message);
  }

  // Get company settings from system settings or use defaults
  const { data: companySettings } = await supabase
    .from("system_settings")
    .select("setting_key, setting_value")
    .eq("category", "company");

  const settingsMap = new Map(
    (companySettings || []).map((s) => [s.setting_key, s.setting_value])
  );

  const company = {
    name: (settingsMap.get("name") as string) || "7 Degrees Co",
    address: (settingsMap.get("address") as string) || "",
    phone: (settingsMap.get("phone") as string) || "",
    email: (settingsMap.get("email") as string) || "",
  };

  // Sort items by sort_order
  if (invoice.items) {
    invoice.items.sort((a: PortalInvoiceItem, b: PortalInvoiceItem) => a.sort_order - b.sort_order);
  }

  return {
    invoice,
    client,
    company,
  };
}

export interface InvoiceSummary {
  totalInvoices: number;
  totalPaid: number;
  totalOutstanding: number;
  overdueCount: number;
  overdueAmount: number;
}

export async function getMyInvoiceSummary(clientId: string): Promise<InvoiceSummary> {
  const supabase = createClient();

  const { data: invoices, error } = await supabase
    .from("invoices")
    .select("total, status, due_date")
    .eq("client_id", clientId)
    .neq("status", "draft");

  if (error) {
    throw new Error(error.message);
  }

  const today = new Date().toISOString().split("T")[0];

  let totalPaid = 0;
  let totalOutstanding = 0;
  let overdueCount = 0;
  let overdueAmount = 0;

  (invoices || []).forEach((inv) => {
    if (inv.status === "paid") {
      totalPaid += inv.total || 0;
    } else if (inv.status !== "cancelled") {
      totalOutstanding += inv.total || 0;

      if (inv.due_date && inv.due_date < today) {
        overdueCount++;
        overdueAmount += inv.total || 0;
      }
    }
  });

  return {
    totalInvoices: invoices?.length || 0,
    totalPaid,
    totalOutstanding,
    overdueCount,
    overdueAmount,
  };
}
