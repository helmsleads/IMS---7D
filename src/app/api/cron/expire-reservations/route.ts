import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-service";

const DEFAULT_EXPIRATION_DAYS = 14;

/**
 * Reservation Expiration
 * POST /api/cron/expire-reservations
 *
 * Releases inventory reservations for confirmed orders that have
 * not been picked/shipped within the expiration threshold.
 *
 * Logic:
 * 1. Find orders in "confirmed" status older than threshold
 * 2. Look up reserve transactions to get product/location pairs
 * 3. Release each reservation via the release_reservation RPC
 * 4. Add a note to the order indicating reservations were expired
 *
 * Schedule: 0 4 * * * (daily at 4 AM)
 * Auth: Bearer <CRON_SECRET>
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("[expire-reservations] CRON_SECRET not configured");
    return NextResponse.json(
      { error: "Server misconfigured" },
      { status: 500 }
    );
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    console.error("[expire-reservations] Unauthorized cron request");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();
  const supabase = createServiceClient();

  // Allow override via query param, otherwise use default
  const url = new URL(request.url);
  const expirationDays = parseInt(
    url.searchParams.get("days") || String(DEFAULT_EXPIRATION_DAYS),
    10
  );

  const cutoffDate = new Date(
    Date.now() - expirationDays * 24 * 60 * 60 * 1000
  ).toISOString();

  try {
    // 1. Find stale confirmed orders
    const { data: staleOrders, error: ordersError } = await supabase
      .from("outbound_orders")
      .select("id, order_number, client_id, confirmed_at, notes")
      .eq("status", "confirmed")
      .lt("confirmed_at", cutoffDate);

    if (ordersError) {
      throw new Error(`Failed to query stale orders: ${ordersError.message}`);
    }

    if (!staleOrders || staleOrders.length === 0) {
      const duration = Date.now() - startTime;
      return NextResponse.json({
        success: true,
        message: "No stale reservations found",
        ordersProcessed: 0,
        reservationsReleased: 0,
        duration: `${duration}ms`,
      });
    }

    let totalReleased = 0;
    const errors: Array<{ orderId: string; error: string }> = [];

    // 2. Process each stale order
    for (const order of staleOrders) {
      try {
        // Find reserve transactions for this order to get product/location pairs
        const { data: reserveTxns, error: txnError } = await supabase
          .from("inventory_transactions")
          .select("product_id, location_id, qty_change")
          .eq("reference_type", "outbound_order")
          .eq("reference_id", order.id)
          .eq("transaction_type", "reserve");

        if (txnError) {
          throw new Error(txnError.message);
        }

        if (!reserveTxns || reserveTxns.length === 0) {
          // No reserve transactions found — may have already been released
          continue;
        }

        // Check if any reservation is still active by verifying inventory
        let releasedForOrder = 0;

        for (const txn of reserveTxns) {
          // Check if inventory still has qty_reserved for this product/location
          const { data: inv } = await supabase
            .from("inventory")
            .select("qty_reserved")
            .eq("product_id", txn.product_id)
            .eq("location_id", txn.location_id)
            .gt("qty_reserved", 0)
            .single();

          if (!inv || inv.qty_reserved <= 0) {
            continue; // Already released
          }

          // Release the reservation (qty_change from reserve txn is the reserved amount)
          const qtyToRelease = Math.min(
            Math.abs(txn.qty_change),
            inv.qty_reserved
          );

          if (qtyToRelease <= 0) continue;

          const { error: releaseError } = await supabase.rpc(
            "release_reservation",
            {
              p_product_id: txn.product_id,
              p_location_id: txn.location_id,
              p_qty_to_release: qtyToRelease,
              p_also_deduct: false, // Don't deduct — just release hold
              p_reference_type: "outbound_order",
              p_reference_id: order.id,
              p_performed_by: null,
            }
          );

          if (releaseError) {
            console.error(
              `[expire-reservations] Failed to release for order ${order.order_number}:`,
              releaseError.message
            );
          } else {
            releasedForOrder++;
            totalReleased++;
          }
        }

        // Add note to the order about expired reservations
        if (releasedForOrder > 0) {
          const existingNotes = (order as { notes?: string }).notes || "";
          const expirationNote = `[Auto] Reservations expired after ${expirationDays} days (${new Date().toISOString().split("T")[0]})`;
          await supabase
            .from("outbound_orders")
            .update({
              notes: existingNotes
                ? `${existingNotes}\n${expirationNote}`
                : expirationNote,
            })
            .eq("id", order.id);
        }
      } catch (err) {
        errors.push({
          orderId: order.id,
          error: err instanceof Error ? err.message : "Unknown error",
        });
        console.error(
          `[expire-reservations] Error processing order ${order.order_number}:`,
          err
        );
      }
    }

    const duration = Date.now() - startTime;

    console.log(
      `[expire-reservations] Completed in ${duration}ms: ${staleOrders.length} stale orders, ${totalReleased} reservations released, ${errors.length} errors`
    );

    return NextResponse.json({
      success: true,
      expirationDays,
      cutoffDate,
      ordersProcessed: staleOrders.length,
      reservationsReleased: totalReleased,
      errors: errors.length,
      duration: `${duration}ms`,
    });
  } catch (error) {
    console.error("[expire-reservations] Failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Cron job failed" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: "/api/cron/expire-reservations",
    method: "POST",
    auth: "Bearer <CRON_SECRET>",
    schedule: "0 4 * * * (daily at 4 AM)",
    queryParams: { days: "Expiration threshold in days (default: 14)" },
    description:
      "Releases inventory reservations for orders stuck in confirmed status past the threshold",
  });
}
