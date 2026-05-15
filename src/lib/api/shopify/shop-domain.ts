/**
 * Normalize a Shopify shop hostname for Admin API URLs.
 * Handles values stored with protocol, trailing slash, or path segments.
 */
export function normalizeShopifyShopDomain(raw: string): string {
  let s = raw.trim().toLowerCase()
  s = s.replace(/^https?:\/\//i, '')
  const slash = s.indexOf('/')
  if (slash !== -1) {
    s = s.slice(0, slash)
  }
  return s.replace(/\.$/, '')
}
