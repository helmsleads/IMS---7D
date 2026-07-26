import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createServiceClient } from "@/lib/supabase-service";
import {
  listAllUserNotificationSettings,
  updateUserNotificationSettingAdmin,
} from "@/lib/api/notifications-server";
import type { NotificationType } from "@/lib/api/notifications";

const VALID_TYPES: NotificationType[] = [
  "new_order",
  "order_shipped",
  "low_stock",
  "inbound_arrived",
];

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
    }
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

  return { callerUser };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await getCallerAdmin(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const users = await listAllUserNotificationSettings();
    return NextResponse.json({ users });
  } catch (err) {
    console.error("notification-settings GET error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await getCallerAdmin(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json().catch(() => ({}));
    const userId = body?.userId;
    const notificationType = body?.notificationType as NotificationType;
    const enabled = body?.enabled;

    if (!userId || typeof userId !== "string") {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }
    if (!VALID_TYPES.includes(notificationType)) {
      return NextResponse.json({ error: "Invalid notificationType" }, { status: 400 });
    }
    if (typeof enabled !== "boolean") {
      return NextResponse.json({ error: "enabled must be a boolean" }, { status: 400 });
    }

    await updateUserNotificationSettingAdmin(userId, notificationType, enabled);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("notification-settings PATCH error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
