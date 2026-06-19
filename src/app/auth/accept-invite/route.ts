import { createServerClient } from "@supabase/ssr";
import { type EmailOtpType } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const VALID_OTP_TYPES = new Set<string>([
  "invite",
  "recovery",
  "signup",
  "magiclink",
  "email",
]);

/**
 * Verify invite/recovery token_hash on our domain (no Supabase redirect URL config needed).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  const failUrl = new URL("/reset-password", origin);
  failUrl.searchParams.set("expired", "1");

  if (!tokenHash || !type || !VALID_OTP_TYPES.has(type)) {
    return NextResponse.redirect(failUrl);
  }

  const successUrl = new URL("/reset-password", origin);
  let response = NextResponse.redirect(successUrl);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: type as EmailOtpType,
  });

  if (error) {
    console.error("accept-invite verifyOtp failed:", error.message);
    failUrl.searchParams.set("error", "auth_callback");
    return NextResponse.redirect(failUrl);
  }

  return response;
}
