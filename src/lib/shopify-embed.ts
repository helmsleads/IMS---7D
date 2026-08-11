/**
 * Helpers for when the 7D app is loaded as a Shopify Admin embedded app
 * (App URL iframe). Cookie-based Supabase auth does not work reliably there.
 */

export const SHOPIFY_PORTAL_CONNECT_PATH =
  "/client-login?redirect=%2Fportal%2Fintegrations";

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

export function shouldBreakOutOfShopifyEmbed(search?: string): boolean {
  return isInIframe() || isShopifyEmbeddedRequest(search);
}

/** Navigate the top window so login runs first-party (cookies work). */
export function breakOutToPortalLogin(path = SHOPIFY_PORTAL_CONNECT_PATH): boolean {
  if (typeof window === "undefined") return false;
  const url = path.startsWith("http")
    ? path
    : `${window.location.origin}${path.startsWith("/") ? path : `/${path}`}`;
  try {
    if (window.top && window.top !== window.self) {
      window.top.location.assign(url);
      return true;
    }
  } catch {
    // Fall through — caller should render a target="_top" link.
  }
  window.location.assign(url);
  return true;
}
