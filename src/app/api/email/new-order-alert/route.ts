import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createServiceClient } from "@/lib/supabase-service";
import { sendNewOrderAlertForOrder } from "@/lib/api/notifications-server";

/**
 * POST /api/email/new-order-alert
 * Body: { orderId: string }
 *
 * Sends internal "new order" emails to staff with new_order notifications enabled.
 * Callable by authenticated portal clients (for their own orders) or internal staff.
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json().catch(() => ({}));
    const orderId = body?.orderId;
    if (!orderId || typeof orderId !== "string") {
      return NextResponse.json({ error: "Invalid or missing orderId" }, { status: 400 });
    }

    const serviceClient = createServiceClient();

    // Allow internal staff, or portal users whose client owns the order
    const { data: staffUser } = await serviceClient
      .from("users")
      .select("id, active")
      .or(`id.eq.${user.id},auth_id.eq.${user.id}`)
      .maybeSingle();

    if (staffUser && staffUser.active !== false) {
      const result = await sendNewOrderAlertForOrder(orderId);
      if (result.error) {
        return NextResponse.json(result, { status: 404 });
      }
      return NextResponse.json(result);
    }

    const { data: order } = await serviceClient
      .from("outbound_orders")
      .select("id, client_id")
      .eq("id", orderId)
      .maybeSingle();

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const { data: membership } = await serviceClient
      .from("client_users")
      .select("id")
      .eq("client_id", order.client_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const result = await sendNewOrderAlertForOrder(orderId);
    if (result.error) {
      return NextResponse.json(result, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error("new-order-alert email error:", err);
    const message = err instanceof Error ? err.message : "Failed to send new order alert";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
