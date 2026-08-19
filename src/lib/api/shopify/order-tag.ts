/** Shopify order tag that marks an order as assigned to 7 Degrees for fulfillment. */
export const SHOPIFY_7D_ORDER_TAG = '7D'

/** Shopify order tag the client adds in Admin to mark a test order (not a product flag). */
export const SHOPIFY_TEST_ORDER_TAG = 'test'

function parseShopifyOrderTags(
  tags: string | string[] | null | undefined
): string[] {
  if (tags == null) return []
  return (Array.isArray(tags) ? tags : String(tags).split(',')).map((t) =>
    t.trim()
  )
}

function shopifyOrderHasTag(
  tags: string | string[] | null | undefined,
  tag: string
): boolean {
  const want = tag.trim().toLowerCase()
  return parseShopifyOrderTags(tags).some((t) => t.toLowerCase() === want)
}

/**
 * True when the order carries the 7D tag (case-insensitive exact tag match).
 * Shopify sends tags as a comma-separated string (REST) or string[] (GraphQL → joined).
 */
export function shopifyOrderHas7DTag(
  tags: string | string[] | null | undefined
): boolean {
  return shopifyOrderHasTag(tags, SHOPIFY_7D_ORDER_TAG)
}

/** True when the client tagged the order `test` in Shopify Admin. */
export function shopifyOrderHasTestTag(
  tags: string | string[] | null | undefined
): boolean {
  return shopifyOrderHasTag(tags, SHOPIFY_TEST_ORDER_TAG)
}
