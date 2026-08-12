import { NextRequest, NextResponse } from "next/server";
import { verifyDtcApiRequest } from "@/lib/server/dtc-auth";
import { getFedExCredentials, getRates } from "@/lib/api/fedex";

/**
 * POST /api/dtc/shipping/fedex/rates
 *
 * Service-to-service FedEx rate quotes for DTC checkout (no outbound order yet).
 * Auth: Authorization: Bearer <DTC_API_KEY>
 *
 * Body: {
 *   postal_code: string,
 *   country_code?: string,   // default US
 *   weight_lbs: number,
 *   ship_date?: string       // YYYY-MM-DD
 * }
 */
export async function POST(request: NextRequest) {
  const authError = verifyDtcApiRequest(request);
  if (authError) {
    return authError;
  }

  try {
    const body = await request.json().catch(() => ({}));
    const postalCode = String(body?.postal_code ?? body?.postalCode ?? "")
      .trim()
      .toUpperCase();
    const countryCode = String(body?.country_code ?? body?.countryCode ?? "US")
      .trim()
      .toUpperCase() || "US";
    const weightRaw = body?.weight_lbs ?? body?.weightLbs ?? body?.packageWeight;
    const weightLbs = typeof weightRaw === "number" ? weightRaw : Number(weightRaw);
    const shipDate =
      String(body?.ship_date ?? body?.shipDate ?? "").trim() ||
      new Date().toISOString().split("T")[0];

    if (!postalCode) {
      return NextResponse.json(
        { error: "postal_code is required" },
        { status: 400 },
      );
    }

    if (!Number.isFinite(weightLbs) || weightLbs <= 0) {
      return NextResponse.json(
        { error: "weight_lbs must be a positive number" },
        { status: 400 },
      );
    }

    const credentials = await getFedExCredentials();
    if (!credentials) {
      return NextResponse.json(
        {
          error:
            "FedEx is not configured. Add credentials in 7D Settings → System → FedEx.",
        },
        { status: 503 },
      );
    }

    const rates = await getRates(
      {
        shipDate,
        weightLbs,
        shipperPostalCode: credentials.shipper_zip,
        shipperCountryCode: credentials.shipper_country || "US",
        recipientPostalCode: postalCode,
        recipientCountryCode: countryCode,
      },
      credentials,
    );

    return NextResponse.json({
      postal_code: postalCode,
      country_code: countryCode,
      weight_lbs: weightLbs,
      ship_date: shipDate,
      shipper_postal_code: credentials.shipper_zip,
      options: rates.options ?? [],
    });
  } catch (err) {
    console.error("DTC FedEx rates error:", err);
    const message = err instanceof Error ? err.message : "Failed to get FedEx rates";
    const isAuth =
      typeof message === "string" &&
      (message.toLowerCase().includes("authorize your credentials") ||
        message.toLowerCase().includes("oauth failed") ||
        message.toLowerCase().includes("authentication") ||
        message.toLowerCase().includes("unauthorized"));

    return NextResponse.json(
      {
        error: message,
        hint: isAuth
          ? "FedEx rejected credentials. Confirm 7D Settings → System → FedEx and sandbox vs production."
          : null,
      },
      { status: isAuth ? 400 : 502 },
    );
  }
}
