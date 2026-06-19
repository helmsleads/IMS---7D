/** Default: 7 days (Supabase max for email OTP / invite links). */
export const DEFAULT_AUTH_EMAIL_OTP_EXPIRY_SECONDS = 604800;

export function getAuthEmailOtpExpirySeconds(): number {
  const raw = process.env.AUTH_EMAIL_OTP_EXPIRY_SECONDS?.trim();
  if (!raw) return DEFAULT_AUTH_EMAIL_OTP_EXPIRY_SECONDS;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 60) {
    return DEFAULT_AUTH_EMAIL_OTP_EXPIRY_SECONDS;
  }
  return parsed;
}

export function getSupabaseProjectRef(): string | null {
  const explicit = process.env.SUPABASE_PROJECT_REF?.trim();
  if (explicit) return explicit;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!url) return null;

  try {
    const hostname = new URL(url).hostname;
    const ref = hostname.split(".")[0];
    return ref || null;
  } catch {
    return null;
  }
}

let otpExpirySyncPromise: Promise<void> | null = null;

/**
 * Ensures hosted Supabase auth uses a longer invite/reset OTP lifetime.
 * Requires SUPABASE_ACCESS_TOKEN (personal access token with auth_config_write).
 * No-op when the token is not configured.
 */
export async function ensureSupabaseAuthOtpExpiry(): Promise<void> {
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN?.trim();
  const projectRef = getSupabaseProjectRef();
  if (!accessToken || !projectRef) return;

  if (!otpExpirySyncPromise) {
    otpExpirySyncPromise = syncSupabaseAuthOtpExpiry(accessToken, projectRef);
  }

  await otpExpirySyncPromise;
}

async function syncSupabaseAuthOtpExpiry(
  accessToken: string,
  projectRef: string
): Promise<void> {
  const otpExpiry = getAuthEmailOtpExpirySeconds();

  try {
    const response = await fetch(
      `https://api.supabase.com/v1/projects/${projectRef}/config/auth`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ mailer_otp_exp: otpExpiry }),
      }
    );

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.warn(
        `[supabase-auth-config] Failed to set mailer_otp_exp=${otpExpiry}:`,
        response.status,
        body.slice(0, 200)
      );
      return;
    }

    console.log(
      `[supabase-auth-config] mailer_otp_exp set to ${otpExpiry}s (${Math.round(otpExpiry / 86400)} days)`
    );
  } catch (err) {
    console.warn("[supabase-auth-config] OTP expiry sync error:", err);
  }
}

export function getAuthOtpExpiryInstructions(): string {
  const seconds = getAuthEmailOtpExpirySeconds();
  const days = Math.round(seconds / 86400);
  return [
    `Set invite/reset link expiry to ${seconds} seconds (${days} days):`,
    "Supabase Dashboard → Authentication → Providers → Email → Email OTP Expiration",
    `Or set AUTH_EMAIL_OTP_EXPIRY_SECONDS=${seconds} and SUPABASE_ACCESS_TOKEN for automatic sync.`,
  ].join(" ");
}
