import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-service";

/**
 * Daily Storage Snapshot
 * GET|POST /api/cron/daily-storage-snapshot
 *
 * Takes a snapshot of current inventory storage for billing calculations.
 * The `take_storage_snapshot` RPC records qty_on_hand per client/product/location
 * so monthly billing can calculate average storage usage.
 *
 * Schedule: 0 7 * * * (daily 07:00 UTC ≈ 2–3 AM US)
 * Auth: Bearer <CRON_SECRET>
 *
 * Vercel Cron invokes GET; external schedulers (QStash) typically use POST.
 */

async function runDailyStorageSnapshot(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("[daily-storage-snapshot] CRON_SECRET not configured");
    return NextResponse.json(
      { error: "Server misconfigured" },
      { status: 500 }
    );
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    console.error("[daily-storage-snapshot] Unauthorized cron request");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();

  try {
    const supabase = createServiceClient();
    // UTC calendar date — keep consistent with cron schedule timezone (UTC)
    const snapshotDate = new Date().toISOString().split("T")[0];

    // Always pass p_force so Postgres never hits an ambiguous overload
    const { data, error } = await supabase.rpc("take_storage_snapshot", {
      p_snapshot_date: snapshotDate,
      p_force: false,
    });

    if (error) {
      console.error("[daily-storage-snapshot] RPC error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const duration = Date.now() - startTime;
    const snapshotsCreated = data || 0;

    console.log(
      `[daily-storage-snapshot] Completed: ${snapshotsCreated} snapshots for ${snapshotDate} in ${duration}ms`
    );

    return NextResponse.json({
      success: true,
      snapshotDate,
      snapshotsCreated,
      alreadyExisted: snapshotsCreated === 0,
      duration: `${duration}ms`,
    });
  } catch (error) {
    console.error("[daily-storage-snapshot] Failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Cron job failed" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return runDailyStorageSnapshot(request);
}

export async function GET(request: NextRequest) {
  // Vercel Cron uses GET with Authorization: Bearer <CRON_SECRET>
  if (request.headers.get("authorization")) {
    return runDailyStorageSnapshot(request);
  }

  return NextResponse.json({
    endpoint: "/api/cron/daily-storage-snapshot",
    method: "GET or POST",
    auth: "Bearer <CRON_SECRET>",
    schedule: "0 7 * * * (daily 07:00 UTC)",
    description:
      "Takes a daily storage snapshot for billing calculations. Stores rows in storage_snapshots.",
  });
}
