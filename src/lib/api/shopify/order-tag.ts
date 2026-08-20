/** Shopify order tag that marks an order as assigned to 7 Degrees for fulfillment. */
export const SHOPIFY_7D_ORDER_TAG = '7D'

/** Shopify order tag the client adds in Admin to mark a test order (not a product flag). */
export const SHOPIFY_TEST_ORDER_TAG = 'test'

/** Stored in IMS notes when the client marks test from the 7D portal (not overwritten by Shopify sync). */
export const PORTAL_TEST_ORDER_NOTE = '[test:portal]'

const SHOPIFY_TEST_NOTE = '[test]'

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

/** True when IMS notes include the portal test marker. */
export function isPortalTestOrderNote(
  notes: string | null | undefined
): boolean {
  if (!notes) return false
  return notes
    .split('\n')
    .some((line) => line.trim().toLowerCase() === PORTAL_TEST_ORDER_NOTE.toLowerCase())
}

/** True when IMS notes include `[test]` synced from Shopify Admin tag. */
export function isShopifySyncedTestOrderNote(
  notes: string | null | undefined
): boolean {
  if (!notes) return false
  return notes
    .split('\n')
    .some((line) => line.trim().toLowerCase() === SHOPIFY_TEST_NOTE.toLowerCase())
}

/** Add or remove the portal test marker in IMS order notes. */
export function mergePortalTestOrderNote(
  existingNotes: string | null | undefined,
  isTest: boolean
): string | null {
  const portalMarker = PORTAL_TEST_ORDER_NOTE.toLowerCase()
  const lines = String(existingNotes || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(
      (line) => line && line.toLowerCase() !== portalMarker
    )

  if (isTest) {
    lines.unshift(PORTAL_TEST_ORDER_NOTE)
  }

  return lines.length > 0 ? lines.join('\n') : null
}
