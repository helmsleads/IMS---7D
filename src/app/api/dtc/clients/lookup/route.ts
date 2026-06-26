import { NextRequest, NextResponse } from "next/server";
import { findActiveClientByPortalEmail } from "@/lib/api/dtc/clients";
import { verifyDtcApiRequest } from "@/lib/server/dtc-auth";

/**
 * POST /api/dtc/clients/lookup
 *
 * Resolve an active 7D client for a portal user email (DTC integration linking).
 */
export async function POST(request: NextRequest) {
  const authError = verifyDtcApiRequest(request);
  if (authError) {
    return authError;
  }

  try {
    const body = await request.json();
    const email = body?.email?.trim();

    if (!email) {
      return NextResponse.json({ error: "email is required" }, { status: 400 });
    }

    const result = await findActiveClientByPortalEmail(email);
    if (!result) {
      return NextResponse.json(
        { error: "No active 7D account found for this email" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      client: result.client,
      portal_user: result.portal_user,
      account: result.account,
      matched_by: result.matched_by,
    });
  } catch (error) {
    const status = (error as Error & { status?: number }).status ?? 500;
    console.error("DTC client lookup error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to lookup client" },
      { status },
    );
  }
}
