import { NextRequest, NextResponse } from "next/server";
import { listClientsForDtcConnect } from "@/lib/api/dtc/clients";
import { verifyDtcApiRequest } from "@/lib/server/dtc-auth";

/**
 * GET /api/dtc/clients/list
 *
 * List active 7D warehouse clients for DTC connect dropdowns.
 */
export async function GET(request: NextRequest) {
  const authError = verifyDtcApiRequest(request);
  if (authError) {
    return authError;
  }

  try {
    const email = request.nextUrl.searchParams.get("email")?.trim() || null;
    const clients = await listClientsForDtcConnect(email);
    return NextResponse.json({ clients });
  } catch (error) {
    const status = (error as Error & { status?: number }).status ?? 500;
    console.error("DTC client list error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list clients" },
      { status },
    );
  }
}
