import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-service";

/**
 * Daily Storage Snapshot
 * POST /api/cron/daily-storage-snapshot
 *
 * Takes a snapshot of current inventory storage for billing calculations.
 * The `take_storage_snapshot` RPC records qty_on_hand per client/product/location
 * so monthly billing can calculate average storage usage.
 *
 * Schedule: 0 2 * * * (daily at 2 AM)
 * Auth: Bearer <CRON_SECRET>
 */
export async function POST(request: NextRequest) {
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
    const snapshotDate = new Date().toISOString().split("T")[0];

    const { data, error } = await supabase.rpc("take_storage_snapshot", {
      p_snapshot_date: snapshotDate,
    });

    if (error) {
      console.error("[daily-storage-snapshot] RPC error:", error.message);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
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

export async function GET() {
  return NextResponse.json({
    endpoint: "/api/cron/daily-storage-snapshot",
    method: "POST",
    auth: "Bearer <CRON_SECRET>",
    schedule: "0 2 * * * (daily at 2 AM)",
    description:
      "Takes a daily storage snapshot for billing calculations",
  });
}
