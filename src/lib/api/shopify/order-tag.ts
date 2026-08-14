/** Shopify order tag that marks an order as assigned to 7 Degrees for fulfillment. */
export const SHOPIFY_7D_ORDER_TAG = '7D'

/**
 * True when the order carries the 7D tag (case-insensitive exact tag match).
 * Shopify sends tags as a comma-separated string (REST) or string[] (GraphQL → joined).
 */
export function shopifyOrderHas7DTag(
  tags: string | string[] | null | undefined
): boolean {
  if (tags == null) return false
  const list = Array.isArray(tags) ? tags : String(tags).split(',')
  return list.some((t) => t.trim().toLowerCase() === SHOPIFY_7D_ORDER_TAG.toLowerCase())
}
