import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-service";

/**
 * Daily Lot Expiration Processing
 * POST /api/cron/daily-lot-expiration
 *
 * Two jobs in one:
 * 1. Process expired lots — marks lots as expired, quarantines inventory
 * 2. Create notifications for lots expiring within 7 days
 *
 * Schedule: 0 3 * * * (daily at 3 AM)
 * Auth: Bearer <CRON_SECRET>
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("[daily-lot-expiration] CRON_SECRET not configured");
    return NextResponse.json(
      { error: "Server misconfigured" },
      { status: 500 }
    );
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    console.error("[daily-lot-expiration] Unauthorized cron request");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();
  const supabase = createServiceClient();

  try {
    // 1. Process expired lots — mark as expired, quarantine inventory
    const { data: expirationResult, error: expirationError } =
      await supabase.rpc("process_expired_lots");

    if (expirationError) {
      console.error(
        "[daily-lot-expiration] process_expired_lots error:",
        expirationError.message
      );
      throw new Error(expirationError.message);
    }

    const processed = expirationResult?.[0] || {
      lots_expired: 0,
      inventory_quarantined: 0,
      transactions_created: 0,
    };

    // 2. Create notifications for lots expiring within 7 days
    const { data: notificationsCreated, error: notifError } =
      await supabase.rpc("create_lot_expiration_notifications", {
        p_days: 7,
      });

    if (notifError) {
      console.error(
        "[daily-lot-expiration] create_lot_expiration_notifications error:",
        notifError.message
      );
      // Don't throw — notifications failing shouldn't block the main job
    }

    const duration = Date.now() - startTime;

    console.log(
      `[daily-lot-expiration] Completed in ${duration}ms: ${processed.lots_expired} expired, ${processed.inventory_quarantined} quarantined, ${notificationsCreated || 0} notifications`
    );

    return NextResponse.json({
      success: true,
      processing: {
        lotsExpired: processed.lots_expired,
        inventoryQuarantined: processed.inventory_quarantined,
        transactionsCreated: processed.transactions_created,
      },
      notificationsCreated: notificationsCreated || 0,
      duration: `${duration}ms`,
    });
  } catch (error) {
    console.error("[daily-lot-expiration] Failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Cron job failed" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: "/api/cron/daily-lot-expiration",
    method: "POST",
    auth: "Bearer <CRON_SECRET>",
    schedule: "0 3 * * * (daily at 3 AM)",
    description:
      "Processes expired lots and creates expiration warning notifications",
  });
}
