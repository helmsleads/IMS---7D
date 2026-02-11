import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-service";
import { sendEmail } from "@/lib/api/email";
import { lowStockAlertEmail } from "@/lib/email-templates/low-stock-alert";

/**
 * Daily Low-Stock Alerts
 * POST /api/cron/daily-low-stock-alerts
 *
 * Checks inventory levels against reorder points and sends email
 * alerts to users who have low_stock notifications enabled.
 * Also includes out-of-stock items (qty_on_hand = 0).
 *
 * Respects the system setting "send_low_stock_alerts" toggle.
 *
 * Schedule: 0 7 * * * (daily at 7 AM)
 * Auth: Bearer <CRON_SECRET>
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("[daily-low-stock-alerts] CRON_SECRET not configured");
    return NextResponse.json(
      { error: "Server misconfigured" },
      { status: 500 }
    );
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    console.error("[daily-low-stock-alerts] Unauthorized cron request");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();
  const supabase = createServiceClient();

  try {
    // 1. Check system setting — respect global toggle
    const { data: setting } = await supabase
      .from("system_settings")
      .select("setting_value")
      .eq("category", "notifications")
      .eq("setting_key", "send_low_stock_alerts")
      .single();

    if (setting?.setting_value === "false") {
      return NextResponse.json({
        success: true,
        message: "Low-stock alerts disabled in system settings",
        skipped: true,
      });
    }

    // 2. Get all inventory with product reorder points
    const { data: inventoryData, error: invError } = await supabase
      .from("inventory")
      .select(`
        id,
        product_id,
        location_id,
        qty_on_hand,
        product:products (id, sku, name, reorder_point),
        location:locations (id, name)
      `);

    if (invError) {
      throw new Error(`Failed to query inventory: ${invError.message}`);
    }

    // 3. Filter to low-stock and out-of-stock items
    type InvRow = {
      qty_on_hand: number;
      product: { id: string; sku: string; name: string; reorder_point: number } | null;
      location: { id: string; name: string } | null;
    };

    const lowStockItems = (inventoryData || [])
      .map((row) => {
        const product = Array.isArray(row.product) ? row.product[0] : row.product;
        const location = Array.isArray(row.location) ? row.location[0] : row.location;
        return { ...row, product, location } as InvRow;
      })
      .filter((item) => {
        const reorderPoint = item.product?.reorder_point || 0;
        if (reorderPoint <= 0) return false;
        return item.qty_on_hand <= reorderPoint;
      });

    if (lowStockItems.length === 0) {
      const duration = Date.now() - startTime;
      return NextResponse.json({
        success: true,
        message: "No low-stock items found",
        itemsChecked: (inventoryData || []).length,
        lowStockCount: 0,
        duration: `${duration}ms`,
      });
    }

    // 4. Get notification recipients (users with low_stock alerts enabled)
    const { data: recipients, error: recipError } = await supabase
      .from("notification_settings")
      .select(`
        user:users (email)
      `)
      .eq("notification_type", "low_stock")
      .eq("email_enabled", true);

    if (recipError) {
      console.error(
        "[daily-low-stock-alerts] Failed to get recipients:",
        recipError.message
      );
    }

    const emails: string[] = [];
    (recipients || []).forEach((setting) => {
      const user = Array.isArray(setting.user) ? setting.user[0] : setting.user;
      if ((user as { email?: string })?.email) {
        emails.push((user as { email: string }).email);
      }
    });

    if (emails.length === 0) {
      const duration = Date.now() - startTime;
      return NextResponse.json({
        success: true,
        message: "Low-stock items found but no recipients configured",
        lowStockCount: lowStockItems.length,
        recipients: 0,
        duration: `${duration}ms`,
      });
    }

    // 5. Build email data
    const emailItems = lowStockItems.map((item) => ({
      sku: item.product?.sku || "Unknown",
      productName: item.product?.name || "Unknown Product",
      currentQty: item.qty_on_hand,
      reorderPoint: item.product?.reorder_point || 0,
      locationName: item.location?.name || "Unknown Location",
    }));

    const { subject, html } = lowStockAlertEmail({ items: emailItems });

    // 6. Send emails
    let sent = 0;
    let errors = 0;

    for (const email of emails) {
      const result = await sendEmail(email, subject, html);
      if (result.success) {
        sent++;
      } else {
        errors++;
        console.error(
          `[daily-low-stock-alerts] Failed to send to ${email}:`,
          result.error
        );
      }
    }

    const duration = Date.now() - startTime;

    console.log(
      `[daily-low-stock-alerts] Completed in ${duration}ms: ${lowStockItems.length} low-stock items, ${sent} emails sent, ${errors} errors`
    );

    return NextResponse.json({
      success: true,
      lowStockCount: lowStockItems.length,
      outOfStockCount: lowStockItems.filter((i) => i.qty_on_hand === 0).length,
      emailsSent: sent,
      emailErrors: errors,
      duration: `${duration}ms`,
    });
  } catch (error) {
    console.error("[daily-low-stock-alerts] Failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Cron job failed" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: "/api/cron/daily-low-stock-alerts",
    method: "POST",
    auth: "Bearer <CRON_SECRET>",
    schedule: "0 7 * * * (daily at 7 AM)",
    description:
      "Sends low-stock email alerts to users who have notifications enabled",
  });
}
