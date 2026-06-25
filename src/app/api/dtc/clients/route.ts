import { NextRequest, NextResponse } from "next/server";
import { createDtcClient } from "@/lib/api/dtc/clients";
import { verifyDtcApiRequest } from "@/lib/server/dtc-auth";

/**
 * POST /api/dtc/clients
 *
 * Provision a new 7D client for a DTC portal signup.
 * Service-to-service only — not linked to 7D portal login credentials.
 */
export async function POST(request: NextRequest) {
  const authError = verifyDtcApiRequest(request);
  if (authError) {
    return authError;
  }

  try {
    const body = await request.json();
    const company_name = body?.company_name;
    const email = body?.email;
    const contact_name = body?.contact_name ?? null;
    const dtc_portal_user_id = body?.dtc_portal_user_id ?? null;

    if (!company_name || typeof company_name !== "string") {
      return NextResponse.json({ error: "company_name is required" }, { status: 400 });
    }

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "email is required" }, { status: 400 });
    }

    const result = await createDtcClient({
      company_name,
      email,
      contact_name,
      dtc_portal_user_id,
    });

    return NextResponse.json(
      {
        client: result.client,
        created: result.created,
      },
      { status: 201 },
    );
  } catch (error) {
    const status = (error as Error & { status?: number }).status ?? 500;
    console.error("DTC client create error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create client" },
      { status },
    );
  }
}
