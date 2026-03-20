import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getAccessToken, getFedExCredentials } from "@/lib/api/fedex";

function mask(value: string, keep = 4) {
  if (!value) return value;
  const v = String(value);
  if (v.length <= keep) return "*".repeat(v.length);
  return `${"*".repeat(Math.max(0, v.length - keep))}${v.slice(-keep)}`;
}

/**
 * GET /api/shipping/fedex/diagnose
 *
 * Returns non-secret credential metadata + OAuth token check.
 * Use this to debug "We could not authorize your credentials".
 */
export async function GET(request: NextRequest) {
  try {
    const userSupabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll() {},
        },
      }
    );

    const {
      data: { user },
    } = await userSupabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const credentials = await getFedExCredentials();
    if (!credentials) {
      return NextResponse.json(
        { error: "FedEx is not configured (no credentials found)." },
        { status: 400 }
      );
    }

    const meta = {
      environment: credentials.environment,
      forcedSandbox: process.env.FEDEX_SANDBOX === "true",
      baseUrl:
        credentials.environment === "production"
          ? "https://apis.fedex.com"
          : "https://apis-sandbox.fedex.com",
      client_id_masked: mask(credentials.client_id),
      account_number_masked: mask(credentials.account_number),
      shipper: {
        company: credentials.shipper_company,
        zip: credentials.shipper_zip,
        country: credentials.shipper_country,
        phone_masked: mask(credentials.shipper_phone || "", 2),
      },
    };

    try {
      await getAccessToken(credentials);
      return NextResponse.json({ ok: true, ...meta, oauth: { ok: true } });
    } catch (e) {
      const message = e instanceof Error ? e.message : "OAuth failed";
      return NextResponse.json({
        ok: false,
        ...meta,
        oauth: { ok: false, error: message },
        hint: "If oauth fails: your client_id/client_secret are wrong OR sandbox/prod mismatch. If oauth ok but ship/rate fails: account permissions or account_number mismatch.",
      });
    }
  } catch (err) {
    console.error("FedEx diagnose error:", err);
    return NextResponse.json(
      { error: "Failed to run FedEx diagnostics" },
      { status: 500 }
    );
  }
}

