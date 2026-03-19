import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { sendOrderShippedEmail } from "@/lib/api/email";

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

    const { data: { user } } = await userSupabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const orderId = body?.orderId;
    if (!orderId || typeof orderId !== "string") {
      return NextResponse.json({ error: "Invalid or missing orderId" }, { status: 400 });
    }

    const result = await sendOrderShippedEmail(orderId);
    return NextResponse.json(result);
  } catch (err) {
    console.error("order-shipped email error:", err);
    const message = err instanceof Error ? err.message : "Failed to send shipped email";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

