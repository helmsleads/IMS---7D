import { NextRequest, NextResponse } from "next/server";
import { getActiveClient } from "@/lib/api/dtc/clients";
import { findDtcOutboundOrder } from "@/lib/api/dtc/orders";
import { verifyDtcApiRequest } from "@/lib/server/dtc-auth";

/**
 * GET /api/dtc/clients/[clientId]/orders/[externalOrderId]
 *
 * Lookup DTC outbound order status + tracking by DTC external_order_id.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string; externalOrderId: string }> },
) {
  const authError = verifyDtcApiRequest(request);
  if (authError) {
    return authError;
  }

  try {
    const { clientId, externalOrderId } = await params;
    const client = await getActiveClient(clientId);

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const order = await findDtcOutboundOrder(clientId, externalOrderId);

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json({
      outbound_order: order,
      tracking_number: order.tracking_number,
      carrier: order.carrier,
      status: order.status,
    });
  } catch (error) {
    console.error("DTC order status error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load order" },
      { status: 500 },
    );
  }
}
