import { NextRequest, NextResponse } from "next/server";
import { getActiveClient } from "@/lib/api/dtc/clients";
import { createDtcOutboundOrder } from "@/lib/api/dtc/orders";
import { verifyDtcApiRequest } from "@/lib/server/dtc-auth";

/**
 * POST /api/dtc/clients/[clientId]/orders
 *
 * Create (or return existing) outbound order for a DTC paid order.
 * Idempotent on external_order_id + external_platform=dtc.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> },
) {
  const authError = verifyDtcApiRequest(request);
  if (authError) {
    return authError;
  }

  try {
    const { clientId } = await params;
    const client = await getActiveClient(clientId);

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const body = await request.json();
    const external_order_id = body?.external_order_id;

    if (!external_order_id || typeof external_order_id !== "string") {
      return NextResponse.json(
        { error: "external_order_id is required" },
        { status: 400 },
      );
    }

    const result = await createDtcOutboundOrder(clientId, {
      external_order_id,
      external_order_number: body.external_order_number ?? null,
      ship_to: body.ship_to ?? null,
      items: body.items ?? [],
      notes: body.notes ?? null,
    });

    return NextResponse.json(
      {
        outbound_order: result.order,
        created: result.created,
      },
      { status: result.created ? 201 : 200 },
    );
  } catch (error) {
    const status = (error as Error & { status?: number }).status ?? 500;
    console.error("DTC create order error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create order" },
      { status },
    );
  }
}
