import type { ShopifyClient } from '../client'
import type {
  ShopifyAddress,
  ShopifyFulfillment,
  ShopifyLineItem,
  ShopifyOrder,
  ShopifyShippingLine,
} from '@/types/database'

/** Shopify Admin GID → REST-style numeric id (e.g. gid://shopify/LineItem/123 → 123). */
function numericIdFromGid(gid: string | null | undefined): number {
  if (!gid) return 0
  const tail = gid.split('/').pop() ?? ''
  const n = Number(tail)
  return Number.isFinite(n) ? n : 0
}

/**
 * Order fields for sync. Includes `shippingAddress` (MailingAddress) so outbound
 * ship-to fields can be populated. That requires Partner **protected customer fields**
 * approval for **Address** (Level 2) on public apps. See:
 * https://shopify.dev/docs/apps/launch/protected-customer-data
 */
const SYNC_ORDERS_QUERY = `#graphql
  query SyncOrders($first: Int!, $after: String, $query: String) {
    orders(first: $first, after: $after, query: $query, sortKey: CREATED_AT, reverse: true) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          legacyResourceId
          name
          createdAt
          updatedAt
          displayFinancialStatus
          displayFulfillmentStatus
          cancelledAt
          note
          tags
          test
          sourceName
          fulfillments(first: 10) {
            createdAt
            status
            displayStatus
            deliveredAt
            trackingInfo(first: 5) {
              number
              company
            }
          }
          totalPriceSet {
            shopMoney {
              amount
              currencyCode
            }
          }
          shippingAddress {
            firstName
            lastName
            company
            address1
            address2
            city
            province
            provinceCode
            zip
            country
            countryCodeV2
            phone
          }
          shippingLines(first: 10) {
            edges {
              node {
                id
                title
              }
            }
          }
          lineItems(first: 250) {
            edges {
              node {
                id
                name
                title
                sku
                quantity
                fulfillableQuantity
                requiresShipping
                originalUnitPriceSet {
                  shopMoney {
                    amount
                  }
                }
                variant {
                  id
                }
                product {
                  id
                }
              }
            }
          }
        }
      }
    }
  }
`

interface GqlMoney {
  amount: string
  currencyCode?: string
}

interface GqlLineItemNode {
  id: string
  name: string
  title: string
  sku?: string | null
  quantity: number
  fulfillableQuantity: number
  requiresShipping: boolean
  originalUnitPriceSet?: { shopMoney: GqlMoney } | null
  variant?: { id: string } | null
  product?: { id: string } | null
}

/** GraphQL `MailingAddress` on Order — subset used for `ShopifyAddress`. */
interface GqlShippingAddress {
  firstName?: string | null
  lastName?: string | null
  company?: string | null
  address1?: string | null
  address2?: string | null
  city?: string | null
  province?: string | null
  provinceCode?: string | null
  zip?: string | null
  country?: string | null
  countryCodeV2?: string | null
  phone?: string | null
}

/** Order.fulfillments is `[Fulfillment!]!` — a list, not a connection. */
interface GqlFulfillmentNode {
  createdAt: string
  status?: string | null
  displayStatus?: string | null
  deliveredAt?: string | null
  trackingInfo?: Array<{ number?: string | null; company?: string | null }>
}

interface GqlOrderNode {
  legacyResourceId: string
  name: string
  createdAt: string
  updatedAt: string
  displayFinancialStatus?: string | null
  displayFulfillmentStatus?: string | null
  cancelledAt?: string | null
  note?: string | null
  fulfillments?: GqlFulfillmentNode[]
  tags?: string[] | null
  test: boolean
  sourceName?: string | null
  totalPriceSet?: { shopMoney: GqlMoney } | null
  shippingAddress?: GqlShippingAddress | null
  shippingLines: { edges: Array<{ node: { id: string; title: string } }> }
  lineItems: { edges: Array<{ node: GqlLineItemNode }> }
}

interface SyncOrdersData {
  orders: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null }
    edges: Array<{ node: GqlOrderNode }>
  }
}

function tagsToCommaString(tags: string[] | null | undefined): string {
  if (!tags?.length) return ''
  return tags.join(', ')
}

function mapLineItem(n: GqlLineItemNode): ShopifyLineItem {
  const price = n.originalUnitPriceSet?.shopMoney?.amount ?? '0'
  const variantId = numericIdFromGid(n.variant?.id)
  const productId = numericIdFromGid(n.product?.id)
  return {
    id: numericIdFromGid(n.id),
    product_id: productId,
    variant_id: variantId,
    sku: n.sku ?? '',
    name: n.name,
    title: n.title,
    quantity: n.quantity,
    price,
    fulfillable_quantity: n.fulfillableQuantity,
    requires_shipping: n.requiresShipping,
  }
}

function mapShippingLines(edges: Array<{ node: { id: string; title: string } }>): ShopifyShippingLine[] {
  return edges.map(({ node }) => ({
    id: numericIdFromGid(node.id),
    title: node.title,
    price: '0',
    code: '',
  }))
}

function mapShippingAddress(a: GqlShippingAddress | null | undefined): ShopifyAddress | null {
  if (!a) return null
  const line1 = (a.address1 ?? '').trim()
  const city = (a.city ?? '').trim()
  const zip = (a.zip ?? '').trim()
  if (!line1 && !city && !zip) return null
  const phone = a.phone?.trim()
  return {
    first_name: (a.firstName ?? '').trim(),
    last_name: (a.lastName ?? '').trim(),
    company: a.company?.trim() || null,
    address1: line1,
    address2: a.address2?.trim() || null,
    city: city || '',
    province: (a.province ?? '').trim(),
    province_code: (a.provinceCode ?? '').trim(),
    zip: zip || '',
    country: (a.country ?? '').trim(),
    country_code: (a.countryCodeV2 ?? '').trim(),
    phone: phone ? phone : null,
  }
}

function mapFulfillments(
  fulfillments: GqlFulfillmentNode[] | undefined
): ShopifyFulfillment[] {
  if (!fulfillments?.length) return []
  return fulfillments.map((f) => ({
    created_at: f.createdAt,
    delivered_at: f.deliveredAt ?? null,
    display_status: f.displayStatus ?? null,
    tracking_number: f.trackingInfo?.[0]?.number ?? null,
    tracking_company: f.trackingInfo?.[0]?.company ?? null,
  }))
}

function mapOrderNode(node: GqlOrderNode): ShopifyOrder {
  const money = node.totalPriceSet?.shopMoney
  return {
    id: Number(node.legacyResourceId),
    name: node.name,
    email: '',
    created_at: node.createdAt,
    updated_at: node.updatedAt,
    financial_status: (node.displayFinancialStatus ?? 'unknown').toLowerCase(),
    fulfillment_status: (node.displayFulfillmentStatus ?? 'unfulfilled').toLowerCase(),
    cancelled_at: node.cancelledAt ?? null,
    line_items: node.lineItems.edges.map(({ node: li }) => mapLineItem(li)),
    shipping_address: mapShippingAddress(node.shippingAddress),
    shipping_lines: mapShippingLines(node.shippingLines.edges),
    fulfillments: mapFulfillments(node.fulfillments),
    note: node.note ?? null,
    tags: tagsToCommaString(node.tags ?? []),
    total_price: money?.amount ?? '0',
    currency: money?.currencyCode ?? 'USD',
    test: node.test,
    source_name: node.sourceName ?? '',
  }
}

/**
 * Build Shopify Admin order search string (same intent as legacy REST:
 * open + unfulfilled, optional created_at lower bound).
 */
/**
 * Orders changed since `since` (any fulfillment state) — used to import new rows
 * and to push status/tracking updates onto existing IMS orders.
 */
export function buildOrdersSyncSearchQuery(since?: Date): string {
  if (since && !Number.isNaN(since.getTime())) {
    return `updated_at:>='${since.toISOString()}'`
  }
  return 'fulfillment_status:unfulfilled AND status:open'
}

/**
 * Pull orders via Admin GraphQL (replaces REST GET /orders.json).
 */
export async function fetchOrdersForSync(
  client: ShopifyClient,
  since?: Date
): Promise<ShopifyOrder[]> {
  const queryStr = buildOrdersSyncSearchQuery(since)
  const pageSize = 50
  const orders: ShopifyOrder[] = []
  let after: string | null = null
  let hasNext = true

  while (hasNext) {
    const data: SyncOrdersData = await client.graphql<SyncOrdersData>(SYNC_ORDERS_QUERY, {
      first: pageSize,
      after,
      query: queryStr,
    })

    const conn = data.orders
    for (const edge of conn.edges) {
      orders.push(mapOrderNode(edge.node))
    }

    hasNext = conn.pageInfo.hasNextPage
    after = conn.pageInfo.endCursor ?? null
  }

  return orders
}
