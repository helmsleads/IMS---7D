import { NextRequest, NextResponse } from "next/server";
import { resolveDtcIntegrationByEmail } from "@/lib/api/dtc/clients";
import { provisionDtcClientAndPortalUser } from "@/lib/api/dtc/provision";
import { verifyDtcApiRequest } from "@/lib/server/dtc-auth";

/**
 * GET /api/dtc/clients?email=&company_name=
 *
 * Resolve an existing 7D portal account by email and optional warehouse client.
 */
export async function GET(request: NextRequest) {
  const authError = verifyDtcApiRequest(request);
  if (authError) {
    return authError;
  }

  try {
    const email = request.nextUrl.searchParams.get("email")?.trim();
    const companyName = request.nextUrl.searchParams.get("company_name")?.trim() || null;
    const clientId = request.nextUrl.searchParams.get("client_id")?.trim() || null;
    if (!email) {
      return NextResponse.json({ error: "email query parameter is required" }, { status: 400 });
    }

    const result = await resolveDtcIntegrationByEmail(email, companyName, clientId);
    if (!result) {
      return NextResponse.json(
        {
          error:
            "No active 7D account found for this email. Use your 7 Degrees admin or client portal login.",
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

/**
 * POST /api/dtc/clients
 *
 * Provision a warehouse client + 7D portal invite for a DTC signup.
 * Body: { email, company_name, contact_name?, brand_affiliation?, signup_source? }
 */
export async function POST(request: NextRequest) {
  const authError = verifyDtcApiRequest(request);
  if (authError) {
    return authError;
  }

  try {
    const body = await request.json();
    const result = await provisionDtcClientAndPortalUser({
      email: body?.email,
      company_name: body?.company_name,
      contact_name: body?.contact_name ?? body?.name ?? null,
      brand_affiliation: body?.brand_affiliation ?? body?.company_name ?? null,
      signup_source: body?.signup_source === "7d_invitation" ? "7d_invitation" : "dtc",
      require_new_client: Boolean(body?.require_new_client),
      invite_portal_user: body?.invite_portal_user !== false,
      portal_role:
        body?.portal_role === "admin" ||
        body?.portal_role === "member" ||
        body?.portal_role === "viewer" ||
        body?.portal_role === "owner"
          ? body.portal_role
          : undefined,
    });

    return NextResponse.json(
      {
        client: result.client,
        created_client: result.created_client,
        portal_invite: result.portal_invite,
        signup_source: result.signup_source,
        brand_affiliation: result.brand_affiliation,
        account: {
          company_name: result.client.company_name,
          email: body?.email?.trim()?.toLowerCase() ?? null,
          first_name: null,
          last_name: null,
        },
      },
      { status: result.created_client ? 201 : 200 },
    );
  } catch (error) {
    const status = (error as Error & { status?: number }).status ?? 500;
    console.error("DTC client provision error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to provision 7D client",
        details: (error as Error & { details?: string }).details,
      },
      { status },
    );
  }
}
