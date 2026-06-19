function normalizeAppUrl(value: string | undefined | null): string | null {
  if (!value) return null;
  const trimmed = value.trim().replace(/\/$/, "");
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

function isLocalhostUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "[::1]"
    );
  } catch {
    return false;
  }
}

function originFromRequest(request: Request): string | null {
  const origin = request.headers.get("origin");
  if (origin) {
    const normalized = normalizeAppUrl(origin);
    if (normalized && !isLocalhostUrl(normalized)) return normalized;
  }

  const host =
    request.headers.get("x-forwarded-host") || request.headers.get("host");
  if (!host) return null;

  const proto =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    (host.includes("localhost") ? "http" : "https");

  const normalized = normalizeAppUrl(`${proto}://${host}`);
  if (!normalized || isLocalhostUrl(normalized)) return null;
  return normalized;
}

/**
 * Resolve the public app origin for server-generated links (invites, emails, OAuth).
 * Prefers explicit env vars, then the incoming request host on Vercel/production.
 */
export function getAppUrl(request?: Request): string {
  const fromRequest = request ? originFromRequest(request) : null;

  const candidates = [
    fromRequest,
    normalizeAppUrl(process.env.NEXT_PUBLIC_APP_URL),
    normalizeAppUrl(process.env.APP_URL),
    process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? normalizeAppUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL)
      : null,
    process.env.VERCEL_URL ? normalizeAppUrl(process.env.VERCEL_URL) : null,
  ].filter((value): value is string => !!value);

  const isProduction = process.env.NODE_ENV === "production";

  for (const candidate of candidates) {
    if (isProduction && isLocalhostUrl(candidate)) continue;
    return candidate;
  }

  if (!isProduction) {
    return "http://localhost:3000";
  }

  return candidates[0] || "http://localhost:3000";
}

export function getAuthCallbackUrl(
  nextPath = "/reset-password",
  request?: Request
): string {
  return `${getAppUrl(request)}/auth/callback?next=${encodeURIComponent(nextPath)}`;
}

export function getAppUrlConfigurationError(request?: Request): string | null {
  const url = getAppUrl(request);
  if (process.env.NODE_ENV === "production" && isLocalhostUrl(url)) {
    return [
      "App URL resolves to localhost in production.",
      "Set NEXT_PUBLIC_APP_URL to your production domain (e.g. https://ims-7-d-jl3b.vercel.app) in Vercel environment variables.",
      "Also set Supabase → Authentication → URL Configuration → Site URL to the same domain,",
      "and add https://your-domain.com/auth/callback to Redirect URLs.",
    ].join(" ");
  }
  if (
    !process.env.NEXT_PUBLIC_APP_URL &&
    !process.env.APP_URL &&
    !process.env.VERCEL_URL &&
    !request
  ) {
    return "Set NEXT_PUBLIC_APP_URL (used for invite redirect links). Example: https://your-domain.com";
  }
  return null;
}
