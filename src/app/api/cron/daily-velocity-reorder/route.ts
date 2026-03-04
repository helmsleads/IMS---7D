import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-service";

/**
 * Daily Velocity-Based Reorder Point Recalculation
 * POST /api/cron/daily-velocity-reorder
 *
 * For products with velocity_reorder_enabled = true, recalculates reorder_point
 * based on shipping velocity: ceil(avgDailyVelocity * lead_time_days * safetyMultiplier)
 *
 * Zero-velocity products are skipped to preserve manual reorder values.
 *
 * Schedule: 0 6 * * * (daily at 6 AM — before 7 AM low-stock alerts cron)
 * Auth: Bearer <CRON_SECRET>
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("[daily-velocity-reorder] CRON_SECRET not configured");
    return NextResponse.json(
      { error: "Server misconfigured" },
      { status: 500 }
    );
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    console.error("[daily-velocity-reorder] Unauthorized cron request");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();
  const supabase = createServiceClient();

  try {
    // 1. Load velocity settings
    const { data: settingsData } = await supabase
      .from("system_settings")
      .select("setting_key, setting_value")
      .eq("category", "inventory")
      .in("setting_key", [
        "velocity_window_days",
        "default_lead_time_days",
        "safety_stock_multiplier",
      ]);

    const settingsMap = new Map(
      (settingsData || []).map((r) => [r.setting_key, r.setting_value])
    );

    const windowDays =
      parseInt(settingsMap.get("velocity_window_days") || "30") || 30;
    const defaultLeadTime =
      parseInt(settingsMap.get("default_lead_time_days") || "7") || 7;
    const safetyMultiplier =
      parseFloat(settingsMap.get("safety_stock_multiplier") || "1.5") || 1.5;

    // 2. Get all active products with velocity_reorder_enabled
    const { data: products, error: prodError } = await supabase
      .from("products")
      .select("id, lead_time_days, reorder_point")
      .eq("active", true)
      .eq("velocity_reorder_enabled", true);

    if (prodError) {
      throw new Error(`Failed to query products: ${prodError.message}`);
    }

    if (!products || products.length === 0) {
      const duration = Date.now() - startTime;
      return NextResponse.json({
        success: true,
        message: "No velocity-enabled products found",
        productsChecked: 0,
        updated: 0,
        duration: `${duration}ms`,
      });
    }

    // 3. Get outbound velocity data for the window
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - windowDays);

    const { data: usageData, error: usageError } = await supabase
      .from("outbound_items")
      .select(`
        qty_shipped,
        product_id,
        order:outbound_orders!inner (shipped_date)
      `)
      .gt("qty_shipped", 0)
      .gte("order.shipped_date", cutoffDate.toISOString());

    if (usageError) {
      throw new Error(`Failed to query outbound data: ${usageError.message}`);
    }

    // Build velocity map: product_id -> total shipped
    const velocityMap = new Map<string, number>();
    for (const row of usageData || []) {
      velocityMap.set(
        row.product_id,
        (velocityMap.get(row.product_id) || 0) + (row.qty_shipped || 0)
      );
    }

    // 4. Calculate and update reorder points
    let updated = 0;
    let skipped = 0;

    for (const product of products) {
      const totalShipped = velocityMap.get(product.id) || 0;
      const avgDailyVelocity = totalShipped / windowDays;

      // Skip zero-velocity products — preserve their manual reorder_point
      if (avgDailyVelocity <= 0) {
        skipped++;
        continue;
      }

      const leadTime = product.lead_time_days || defaultLeadTime;
      const newReorderPoint = Math.ceil(
        avgDailyVelocity * leadTime * safetyMultiplier
      );

      // Only update if the value changed
      if (newReorderPoint !== product.reorder_point) {
        const { error: updateError } = await supabase
          .from("products")
          .update({ reorder_point: newReorderPoint })
          .eq("id", product.id);

        if (updateError) {
          console.error(
            `[daily-velocity-reorder] Failed to update product ${product.id}:`,
            updateError.message
          );
        } else {
          updated++;
        }
      }
    }

    const duration = Date.now() - startTime;

    console.log(
      `[daily-velocity-reorder] Completed in ${duration}ms: ${products.length} products checked, ${updated} updated, ${skipped} skipped (zero velocity)`
    );

    return NextResponse.json({
      success: true,
      productsChecked: products.length,
      updated,
      skippedZeroVelocity: skipped,
      settings: { windowDays, defaultLeadTime, safetyMultiplier },
      duration: `${duration}ms`,
    });
  } catch (error) {
    console.error("[daily-velocity-reorder] Failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Cron job failed",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: "/api/cron/daily-velocity-reorder",
    method: "POST",
    auth: "Bearer <CRON_SECRET>",
    schedule: "0 6 * * * (daily at 6 AM)",
    description:
      "Recalculates reorder points for velocity-enabled products based on shipping velocity",
  });
}
