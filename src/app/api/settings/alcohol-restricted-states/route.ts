import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createServiceClient } from "@/lib/supabase-service";
import {
  ALCOHOL_RESTRICTED_STATES_KEY,
  DTC_SETTINGS_CATEGORY,
  normalizeStateCodeList,
  resolveAlcoholRestrictedStates,
} from "@/lib/dtc/alcohol-restricted-states";

async function getCallerAdmin(request: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {},
      },
    },
  );

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "Not authenticated", status: 401 as const };
  }

  const serviceClient = createServiceClient();
  const { data: callerUser } = await serviceClient
    .from("users")
    .select("id, role, active")
    .or(`id.eq.${user.id},auth_id.eq.${user.id}`)
    .maybeSingle();

  if (!callerUser || callerUser.active === false) {
    return { error: "Internal access required", status: 403 as const };
  }

  if (callerUser.role !== "admin") {
    return { error: "Admin access required", status: 403 as const };
  }

  return { callerUser, serviceClient };
}

async function readAlcoholRestrictedStates(
  serviceClient: ReturnType<typeof createServiceClient>,
) {
  const { data, error } = await serviceClient
    .from("system_settings")
    .select("setting_value")
    .eq("category", DTC_SETTINGS_CATEGORY)
    .eq("setting_key", ALCOHOL_RESTRICTED_STATES_KEY)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return resolveAlcoholRestrictedStates(data?.setting_value);
}

/**
 * GET /api/settings/alcohol-restricted-states
 * Admin-only: read the global alcohol DTC restricted state list.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getCallerAdmin(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const resolved = await readAlcoholRestrictedStates(auth.serviceClient);
    return NextResponse.json({
      country: "US",
      ...resolved,
    });
  } catch (err) {
    console.error("alcohol-restricted-states GET error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/settings/alcohol-restricted-states
 * Admin-only: replace the global alcohol DTC restricted state list.
 * Body: { restricted_states: string[] }
 */
export async function PUT(request: NextRequest) {
  try {
    const auth = await getCallerAdmin(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const restrictedStates = normalizeStateCodeList(body?.restricted_states);

    const { data, error } = await auth.serviceClient
      .from("system_settings")
      .upsert(
        {
          category: DTC_SETTINGS_CATEGORY,
          setting_key: ALCOHOL_RESTRICTED_STATES_KEY,
          setting_value: restrictedStates,
          description:
            "US state codes where alcohol DTC shipping is not offered",
          updated_at: new Date().toISOString(),
          updated_by: auth.callerUser.id,
        },
        { onConflict: "category,setting_key" },
      )
      .select("setting_value")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    const resolved = resolveAlcoholRestrictedStates(data.setting_value);
    return NextResponse.json({
      country: "US",
      ...resolved,
      saved: true,
    });
  } catch (err) {
    console.error("alcohol-restricted-states PUT error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 },
    );
  }
}
