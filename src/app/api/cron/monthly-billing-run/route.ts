import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-service";

/**
 * Monthly Automated Billing Run
 * POST /api/cron/monthly-billing-run
 *
 * Generates invoices for all active clients for the previous month.
 * Includes usage charges, storage fees, and monthly minimums.
 *
 * Schedule: 0 6 1 * * (1st of each month at 6 AM)
 * Auth: Bearer <CRON_SECRET>
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("[monthly-billing-run] CRON_SECRET not configured");
    return NextResponse.json(
      { error: "Server misconfigured" },
      { status: 500 }
    );
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    console.error("[monthly-billing-run] Unauthorized cron request");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();
  const supabase = createServiceClient();

  // Calculate previous month period
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    .toISOString()
    .split("T")[0];
  const periodEnd = new Date(now.getFullYear(), now.getMonth(), 0)
    .toISOString()
    .split("T")[0];

  try {
    // 1. Create billing run record
    const { data: runNumber, error: runNumError } = await supabase.rpc(
      "generate_billing_run_number"
    );

    if (runNumError) {
      throw new Error(`Failed to generate run number: ${runNumError.message}`);
    }

    const { data: billingRun, error: runError } = await supabase
      .from("billing_runs")
      .insert({
        run_number: runNumber,
        run_type: "scheduled",
        period_start: periodStart,
        period_end: periodEnd,
        status: "processing",
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (runError) {
      throw new Error(`Failed to create billing run: ${runError.message}`);
    }

    // 2. Get all active clients
    const { data: clients, error: clientsError } = await supabase
      .from("clients")
      .select("id, company_name")
      .eq("active", true);

    if (clientsError) {
      throw new Error(`Failed to fetch clients: ${clientsError.message}`);
    }

    let invoicesGenerated = 0;
    let totalBilled = 0;
    const errors: Array<{ client_id: string; error: string }> = [];

    // 3. Process each client
    for (const client of clients || []) {
      try {
        const result = await generateInvoiceForClient(
          supabase,
          client.id,
          periodStart,
          periodEnd
        );

        if (result) {
          invoicesGenerated++;
          totalBilled += result.total;
        }
      } catch (err) {
        errors.push({
          client_id: client.id,
          error: err instanceof Error ? err.message : "Unknown error",
        });
        console.error(
          `[monthly-billing-run] Failed for client ${client.company_name}:`,
          err
        );
      }
    }

    // 4. Update billing run with results
    const finalStatus =
      errors.length === 0
        ? "completed"
        : invoicesGenerated > 0
        ? "partial"
        : "failed";

    await supabase
      .from("billing_runs")
      .update({
        status: finalStatus,
        invoices_generated: invoicesGenerated,
        total_billed: totalBilled,
        errors,
        completed_at: new Date().toISOString(),
      })
      .eq("id", billingRun.id);

    const duration = Date.now() - startTime;

    console.log(
      `[monthly-billing-run] ${finalStatus}: ${invoicesGenerated} invoices, $${totalBilled.toFixed(2)} billed, ${errors.length} errors in ${duration}ms`
    );

    return NextResponse.json({
      success: finalStatus !== "failed",
      billingRunId: billingRun.id,
      period: { start: periodStart, end: periodEnd },
      status: finalStatus,
      invoicesGenerated,
      totalBilled,
      errors: errors.length,
      duration: `${duration}ms`,
    });
  } catch (error) {
    console.error("[monthly-billing-run] Failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Cron job failed" },
      { status: 500 }
    );
  }
}

/**
 * Generate an invoice for a single client using the service client.
 * Mirrors the logic in billing-automation.ts generateClientInvoice()
 * but uses the provided service client instead of browser client.
 */
async function generateInvoiceForClient(
  supabase: ReturnType<typeof createServiceClient>,
  clientId: string,
  periodStart: string,
  periodEnd: string
): Promise<{ invoiceId: string; total: number } | null> {
  // Get billing config
  type BillingConfig = {
    tax_rate: number;
    monthly_minimum: number;
    tax_exempt: boolean;
    payment_terms_days: number;
  };
  const { data: rawConfig } = await supabase
    .from("client_billing_config")
    .select("*")
    .eq("client_id", clientId)
    .single();
  const config = rawConfig as BillingConfig | null;

  const taxRate = config?.tax_rate ?? 0;
  const monthlyMinimum = config?.monthly_minimum ?? 0;

  let subtotal = 0;
  const lineItems: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    total: number;
  }> = [];

  // Get uninvoiced usage records
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
  type UsageGroup = { quantity: number; total: number; unit_price: number };
  const groupedUsage: Record<string, UsageGroup> = {};

  for (const record of usageRecords || []) {
    const key = (record as Record<string, unknown>).usage_type as string;
    const qty = (record as Record<string, unknown>).quantity as number;
    const tot = (record as Record<string, unknown>).total as number;
    const price = (record as Record<string, unknown>).unit_price as number;

    if (!groupedUsage[key]) {
      groupedUsage[key] = { quantity: 0, total: 0, unit_price: price };
    }
    groupedUsage[key].quantity += qty;
    groupedUsage[key].total += tot;
  }

  for (const [usageType, group] of Object.entries(groupedUsage)) {
    lineItems.push({
      description: usageType,
      quantity: group.quantity,
      unit_price: group.unit_price,
      total: group.total,
    });
    subtotal += group.total;
  }

  // Calculate storage fees via RPC
  const { data: storageFees, error: storageError } = await supabase.rpc(
    "calculate_storage_fees",
    {
      p_client_id: clientId,
      p_period_start: periodStart,
      p_period_end: periodEnd,
    }
  );

  if (!storageError && storageFees) {
    type StorageFee = { rate_name: string; total_quantity: number; unit_price: number; total_amount: number };
    const fees = storageFees as StorageFee[];
    for (const fee of fees) {
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

  // Nothing to invoice
  if (lineItems.length === 0 && subtotal === 0 && monthlyMinimum === 0) {
    return null;
  }

  // Apply monthly minimum
  if (subtotal < monthlyMinimum) {
    const minimumAdjustment = monthlyMinimum - subtotal;
    lineItems.push({
      description: "Monthly Minimum Adjustment",
      quantity: 1,
      unit_price: minimumAdjustment,
      total: minimumAdjustment,
    });
    subtotal = monthlyMinimum;
  }

  // Tax
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
    const lastSeq = parseInt(
      lastInvoice[0].invoice_number.replace(prefix, ""),
      10
    );
    if (!isNaN(lastSeq)) {
      nextNumber = lastSeq + 1;
    }
  }
  const invoiceNumber = `${prefix}${nextNumber.toString().padStart(5, "0")}`;

  // Due date
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + (config?.payment_terms_days || 30));

  // Create invoice
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

  // Create line items
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
    await supabase.from("invoices").delete().eq("id", invoice.id);
    throw new Error(itemsError.message);
  }

  // Mark usage records as invoiced
  await supabase
    .from("usage_records")
    .update({ invoiced: true, invoice_id: invoice.id })
    .eq("client_id", clientId)
    .eq("invoiced", false)
    .gte("usage_date", periodStart)
    .lte("usage_date", periodEnd);

  return { invoiceId: invoice.id, total };
}

export async function GET() {
  return NextResponse.json({
    endpoint: "/api/cron/monthly-billing-run",
    method: "POST",
    auth: "Bearer <CRON_SECRET>",
    schedule: "0 6 1 * * (1st of each month at 6 AM)",
    description:
      "Generates invoices for all active clients for the previous month",
  });
}
