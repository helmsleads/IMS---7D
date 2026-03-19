import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-service";
import { getFedExCredentials, trackShipment } from "@/lib/api/fedex";

/**
 * GET /api/cron/shipping/fedex-track
 *
 * Protected by CRON_SECRET (Authorization: Bearer <CRON_SECRET>)
 * Polls FedEx tracking for recently shipped orders and updates:
 * - outbound_orders.tracking_status
 * - outbound_orders.tracking_status_updated_at
 * - outbound_orders.delivered_date (when delivered)
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const credentials = await getFedExCredentials();
  if (!credentials) {
    return NextResponse.json({ error: "FedEx not configured" }, { status: 400 });
  }

  // Poll small batches to avoid rate limits
  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get("limit") || 25), 50);
  const staleHours = Math.min(Number(url.searchParams.get("staleHours") || 6), 48);
  const staleCutoff = new Date(Date.now() - staleHours * 60 * 60 * 1000).toISOString();

  const { data: orders, error } = await supabase
    .from("outbound_orders")
    .select("id, tracking_number, tracking_status_updated_at, delivered_date")
    .not("tracking_number", "is", null)
    .is("delivered_date", null)
    // Only re-poll stale ones
    .or(`tracking_status_updated_at.is.null,tracking_status_updated_at.lt.${staleCutoff}`)
    .order("tracking_status_updated_at", { ascending: true, nullsFirst: true })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let updated = 0;
  const errors: { orderId: string; error: string }[] = [];

  for (const o of orders || []) {
    try {
      const tracking = await trackShipment(o.tracking_number, credentials);
      const update: Record<string, unknown> = {
        tracking_status: tracking.statusDescription,
        tracking_status_updated_at: new Date().toISOString(),
      };
      if (tracking.actualDelivery) {
        update.delivered_date = tracking.actualDelivery;
      }

      const { error: upErr } = await supabase
        .from("outbound_orders")
        .update(update)
        .eq("id", o.id);

      if (upErr) throw new Error(upErr.message);
      updated += 1;
    } catch (e) {
      errors.push({
        orderId: o.id,
        error: e instanceof Error ? e.message : "Unknown error",
      });
    }
  }

  return NextResponse.json({
    success: true,
    scanned: orders?.length || 0,
    updated,
    errors,
  });
}

