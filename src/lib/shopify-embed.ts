/**
 * Helpers for when the 7D app is loaded as a Shopify Admin embedded app
 * (App URL iframe). Cookie-based Supabase auth does not work reliably there.
 *
 * Product rule: never show a password login form inside Shopify Admin.
 * Break out to a top-level portal tab, then connect Shopify from Integrations.
 */

export const SHOPIFY_PORTAL_CONNECT_PATH =
  "/client-login?redirect=%2Fportal%2Fintegrations";

/** Dedicated App URL entry — no password form. Point Partner App URL here. */
export const SHOPIFY_APP_ENTRY_PATH = "/shopify/entry";

export function isInIframe(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.self !== window.top;
  } catch {
    // Cross-origin frame access can throw; treat as embedded.
    return true;
  }
}

/** Shopify Admin appends embedded/host/shop/hmac when loading the App URL. */
export function isShopifyEmbeddedRequest(search?: string): boolean {
  if (typeof window === "undefined" && search == null) return false;
  const params = new URLSearchParams(
    search ?? (typeof window !== "undefined" ? window.location.search : "")
  );
  return (
    params.get("embedded") === "1" ||
    params.has("host") ||
    params.has("hmac") ||
    (params.has("shop") && params.get("shop")!.includes("myshopify.com"))
  );
}

/** Server-side: detect Shopify Admin embed query params on a request URL. */
export function isShopifyEmbeddedSearchParams(
  searchParams: URLSearchParams | { get(name: string): string | null; has(name: string): boolean }
): boolean {
  const shop = searchParams.get("shop") || "";
  return (
    searchParams.get("embedded") === "1" ||
    searchParams.has("host") ||
    searchParams.has("hmac") ||
    (Boolean(shop) && shop.includes("myshopify.com"))
  );
}

export function shouldBreakOutOfShopifyEmbed(search?: string): boolean {
  return isInIframe() || isShopifyEmbeddedRequest(search);
}

function toAbsoluteUrl(path: string): string {
  if (path.startsWith("http")) return path;
  if (typeof window === "undefined") return path;
  return `${window.location.origin}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Navigate the top window so login runs first-party (cookies work).
 * Returns:
 * - "top" — assigned window.top (left the iframe)
 * - "blocked" — still in iframe; caller MUST show a target="_top" CTA (do not navigate in-frame)
 * - "direct" — not in iframe; navigated current window
 * - "ssr" — no window
 */
export function breakOutToPortalLogin(
  path = SHOPIFY_PORTAL_CONNECT_PATH
): "top" | "blocked" | "direct" | "ssr" {
  if (typeof window === "undefined") return "ssr";
  const url = toAbsoluteUrl(path);

  if (isInIframe()) {
    try {
      if (window.top && window.top !== window.self) {
        window.top.location.assign(url);
        return "top";
      }
    } catch {
      // Cross-origin or sandbox blocked top navigation.
    }
    // Never fall through to window.location.assign — that keeps the password
    // form inside Shopify Admin and clients get stuck (Hapa-class bug).
    return "blocked";
  }

  window.location.assign(url);
  return "direct";
}
