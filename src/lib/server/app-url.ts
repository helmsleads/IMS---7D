/** Production app origin — update if your Vercel domain changes. */
export const PRODUCTION_APP_URL = "https://ims-7-d-jl3b.vercel.app";

function normalizeAppUrl(value: string | undefined | null): string | null {
  if (!value) return null;
  const trimmed = value.trim().replace(/\/$/, "");
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

export function isLocalhostUrl(url: string): boolean {
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

function configuredAppUrlCandidates(request?: Request): string[] {
  const fromRequest = request ? originFromRequest(request) : null;

  return [
    normalizeAppUrl(process.env.APP_URL),
    normalizeAppUrl(process.env.NEXT_PUBLIC_APP_URL),
    normalizeAppUrl(PRODUCTION_APP_URL),
    process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? normalizeAppUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL)
      : null,
    process.env.VERCEL_URL ? normalizeAppUrl(process.env.VERCEL_URL) : null,
    fromRequest,
  ].filter((value): value is string => !!value);
}

function pickAppUrl(candidates: string[], allowLocalhost: boolean): string | null {
  for (const candidate of candidates) {
    if (!allowLocalhost && isLocalhostUrl(candidate)) continue;
    return candidate;
  }
  return null;
}

function looksLikeProductionUrl(url: string | undefined | null): boolean {
  const normalized = normalizeAppUrl(url);
  if (!normalized || isLocalhostUrl(normalized)) return false;
  const hostname = new URL(normalized).hostname;
  if (hostname.includes("ngrok")) return false;
  return true;
}

function configuredAppUrlForExternalLinks(): string[] {
  return [
    normalizeAppUrl(process.env.APP_URL),
    normalizeAppUrl(PRODUCTION_APP_URL),
    process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? normalizeAppUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL)
      : null,
    process.env.VERCEL_URL ? normalizeAppUrl(process.env.VERCEL_URL) : null,
    looksLikeProductionUrl(process.env.NEXT_PUBLIC_APP_URL)
      ? normalizeAppUrl(process.env.NEXT_PUBLIC_APP_URL)
      : null,
  ].filter((value): value is string => !!value);
}

/**
 * Resolve the public app origin for server-generated links (invites, emails).
 * Never uses the request host — invite links must not depend on where the admin clicked.
 */
export function getAppUrlForExternalLinks(): string {
  const isProduction = process.env.NODE_ENV === "production";
  const picked = pickAppUrl(configuredAppUrlForExternalLinks(), !isProduction);

  if (picked) return picked;

  if (!isProduction) {
    return "http://localhost:3000";
  }

  return PRODUCTION_APP_URL;
}

/**
 * Resolve app origin (e.g. OAuth callbacks that can use the current request host).
 */
export function getAppUrl(request?: Request): string {
  const isProduction = process.env.NODE_ENV === "production";
  const picked = pickAppUrl(configuredAppUrlCandidates(request), !isProduction);

  if (picked) return picked;

  if (!isProduction) {
    return "http://localhost:3000";
  }

  return PRODUCTION_APP_URL;
}

export function getPasswordSetupRedirectUrl(options?: {
  request?: Request;
  forEmailLink?: boolean;
}): string {
  const origin = options?.forEmailLink
    ? getAppUrlForExternalLinks()
    : getAppUrl(options?.request);

  return `${origin}/reset-password`;
}

/** OAuth / code-exchange flows that need the server callback route. */
export function getAuthCallbackUrl(
  nextPath = "/reset-password",
  options?: { request?: Request; forEmailLink?: boolean }
): string {
  const origin = options?.forEmailLink
    ? getAppUrlForExternalLinks()
    : getAppUrl(options?.request);

  return `${origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;
}

export function getSupabaseAuthUrlInstructions(): string {
  return [
    `Site URL: ${PRODUCTION_APP_URL}`,
    `Redirect URLs: ${PRODUCTION_APP_URL}/reset-password`,
    `Redirect URLs: ${PRODUCTION_APP_URL}/auth/callback`,
    `Redirect URLs: ${PRODUCTION_APP_URL}/** (wildcard recommended)`,
    "Remove http://localhost:3000 from Site URL and Redirect URLs in production.",
  ].join("\n");
}

export function getAppUrlConfigurationError(): string | null {
  const url = getAppUrlForExternalLinks();
  if (process.env.NODE_ENV === "production" && isLocalhostUrl(url)) {
    return [
      "App URL resolves to localhost in production.",
      `Set APP_URL to ${PRODUCTION_APP_URL} in Vercel.`,
      "Update Supabase → Authentication → URL Configuration:",
      getSupabaseAuthUrlInstructions(),
    ].join(" ");
  }
  return null;
}

/**
 * Supabase may replace redirect_to with Site URL when the callback is not allowlisted.
 * Force the intended callback URL into the verify link we email to users.
 */
export function patchAuthActionLinkRedirect(
  actionLink: string,
  redirectTo: string
): string {
  try {
    const url = new URL(actionLink);
    url.searchParams.set("redirect_to", redirectTo);
    return url.toString();
  } catch {
    return actionLink;
  }
}

export function getRedirectToFromActionLink(actionLink: string): string | null {
  try {
    return new URL(actionLink).searchParams.get("redirect_to");
  } catch {
    return null;
  }
}
