import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-service";
import { verifyDtcApiRequest } from "@/lib/server/dtc-auth";
import {
  ALCOHOL_RESTRICTED_STATES_KEY,
  DTC_SETTINGS_CATEGORY,
  resolveAlcoholRestrictedStates,
} from "@/lib/dtc/alcohol-restricted-states";

/**
 * GET /api/dtc/settings/alcohol-restricted-states
 *
 * Return the global US alcohol DTC restricted-state list for DTC checkout.
 */
export async function GET(request: NextRequest) {
  const authError = verifyDtcApiRequest(request);
  if (authError) {
    return authError;
  }

  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("system_settings")
      .select("setting_value")
      .eq("category", DTC_SETTINGS_CATEGORY)
      .eq("setting_key", ALCOHOL_RESTRICTED_STATES_KEY)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    const resolved = resolveAlcoholRestrictedStates(data?.setting_value);
    return NextResponse.json({
      country: "US",
      ...resolved,
    });
  } catch (error) {
    console.error("DTC alcohol restricted states error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load alcohol restricted states",
      },
      { status: 500 },
    );
  }
}
