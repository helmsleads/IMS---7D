import { NextRequest, NextResponse } from "next/server";
import { getDtcCatalog } from "@/lib/api/dtc/catalog";
import { getActiveClient } from "@/lib/api/dtc/clients";
import { verifyDtcApiRequest } from "@/lib/server/dtc-auth";

/**
 * GET /api/dtc/clients/[clientId]/catalog
 *
 * DTC backend catalog source. Requires:
 *   Authorization: Bearer <DTC_API_KEY>
 *
 * Query: page, limit, sku
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
    const client = await getActiveClient(clientId);

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get("page") || "1");
    const limit = Number(searchParams.get("limit") || "20");
    const sku = searchParams.get("sku") || undefined;

    const catalog = await getDtcCatalog(clientId, { page, limit, sku });
    return NextResponse.json(catalog);
  } catch (error) {
    console.error("DTC catalog error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load catalog" },
      { status: 500 },
    );
  }
}
