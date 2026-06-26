import { NextRequest, NextResponse } from "next/server";
import { findActiveClientByCompanyName } from "@/lib/api/dtc/clients";
import { verifyDtcApiRequest } from "@/lib/server/dtc-auth";

/**
 * POST /api/dtc/clients/match
 *
 * Resolve an active 7D warehouse client by company name.
 */
export async function POST(request: NextRequest) {
  const authError = verifyDtcApiRequest(request);
  if (authError) {
    return authError;
  }

  try {
    const body = await request.json();
    const companyName = body?.company_name?.trim();

    if (!companyName) {
      return NextResponse.json({ error: "company_name is required" }, { status: 400 });
    }

    const client = await findActiveClientByCompanyName(companyName);
    if (!client) {
      return NextResponse.json(
        { error: `No active 7D client found for company name "${companyName}"` },
        { status: 404 },
      );
    }

    return NextResponse.json({ client, matched_by: "company_name" });
  } catch (error) {
    const status = (error as Error & { status?: number }).status ?? 500;
    console.error("DTC client match error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to match client" },
      { status },
    );
  }
}
