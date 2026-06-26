import { NextRequest, NextResponse } from "next/server";
import { getActiveClient } from "@/lib/api/dtc/clients";
import { verifyDtcApiRequest } from "@/lib/server/dtc-auth";

/**
 * GET /api/dtc/clients/:clientId
 *
 * Resolve an active 7D warehouse client by ID.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> },
) {
  const authError = verifyDtcApiRequest(request);
  if (authError) {
    return authError;
  }

  try {
    const { clientId } = await params;
    const normalizedId = clientId?.trim();

    if (!normalizedId) {
      return NextResponse.json({ error: "clientId is required" }, { status: 400 });
    }

    const client = await getActiveClient(normalizedId);
    if (!client) {
      return NextResponse.json(
        { error: `No active 7D client found for id "${normalizedId}"` },
        { status: 404 },
      );
    }

    return NextResponse.json({ client, matched_by: "client_id" });
  } catch (error) {
    const status = (error as Error & { status?: number }).status ?? 500;
    console.error("DTC client lookup by id error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to lookup client" },
      { status },
    );
  }
}
