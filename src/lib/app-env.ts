/**
 * Client-safe app environment helpers (login banners, etc.).
 */

export const PRODUCTION_APP_ORIGIN = "https://app.7degreesco.com";

export function isProductionHostname(hostname: string): boolean {
  const host = hostname.trim().toLowerCase();
  return host === "app.7degreesco.com" || host === "www.app.7degreesco.com";
}

function isLocalHostname(hostname: string): boolean {
  const host = hostname.trim().toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
}

/**
 * True on staging / preview hosts that are not production and not local.
 * Used so former production URLs (now staging) warn users to switch.
 */
export function shouldShowStagingLoginBanner(hostname?: string): boolean {
  if (process.env.NEXT_PUBLIC_APP_ENV === "production") return false;
  if (process.env.NEXT_PUBLIC_APP_ENV === "staging") return true;

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").toLowerCase();
  if (appUrl.includes("app.7degreesco.com")) return false;

  const host =
    hostname ??
    (typeof window !== "undefined" ? window.location.hostname : "");

  if (host) {
    if (isProductionHostname(host) || isLocalHostname(host)) return false;
    return true;
  }

  if (!appUrl || appUrl.includes("localhost") || appUrl.includes("127.0.0.1")) {
    return false;
  }

  // Deployed non-production URL (e.g. *.vercel.app staging)
  return true;
}
