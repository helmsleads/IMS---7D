import { NextRequest, NextResponse } from "next/server";
import { resolveDtcIntegrationByEmail } from "@/lib/api/dtc/clients";
import { verifyDtcApiRequest } from "@/lib/server/dtc-auth";

/**
 * POST /api/dtc/clients/lookup
 *
 * Resolve an existing 7D portal account by email and optional warehouse client.
 */
export async function POST(request: NextRequest) {
  const authError = verifyDtcApiRequest(request);
  if (authError) {
    return authError;
  }

  try {
    const body = await request.json();
    const email = body?.email?.trim();
    const companyName = body?.company_name?.trim() || null;
    const clientId = body?.client_id?.trim() || null;

    if (!email) {
      return NextResponse.json({ error: "email is required" }, { status: 400 });
    }

    const result = await resolveDtcIntegrationByEmail(email, companyName, clientId);
    if (!result) {
      return NextResponse.json(
        {
          error: "No active 7D account found for this email. Use your 7 Degrees admin or client portal login.",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      admin_user: result.admin_user,
      client: result.client,
      portal_user: result.portal_user,
      account: result.account,
      matched_by: result.matched_by,
    });
  } catch (error) {
    const status = (error as Error & { status?: number }).status ?? 500;
    console.error("DTC admin lookup error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to lookup admin user" },
      { status },
    );
  }
}
