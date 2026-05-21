import type { OutboundStatus } from '@/types/database'

type ImsOrderStatus = OutboundStatus | 'cancelled'

/** Forward-only rank for IMS outbound statuses (cancelled handled separately). */
const IMS_STATUS_RANK: Record<ImsOrderStatus, number> = {
  pending: 0,
  confirmed: 1,
  processing: 2,
  packed: 3,
  shipped: 4,
  delivered: 5,
  cancelled: -1,
}

/**
 * Map Shopify order fulfillment state to an IMS outbound status.
 *
 * Shopify does not expose WMS steps like "processing" or "delivered" on the order
 * resource — only fulfillment lifecycle. We approximate:
 * - unfulfilled → pending
 * - partial / in progress → packed (some units fulfilled)
 * - fulfilled → shipped (tracking may be on fulfillments)
 */
export function mapShopifyFulfillmentToImsStatus(
  fulfillmentStatus: string | null | undefined,
  options?: { cancelled?: boolean }
): ImsOrderStatus {
  if (options?.cancelled) return 'cancelled'

  const normalized = (fulfillmentStatus ?? 'unfulfilled')
    .toLowerCase()
    .replace(/-/g, '_')
    .trim()

  if (normalized === 'fulfilled') return 'shipped'
  if (
    normalized === 'partial' ||
    normalized === 'partially_fulfilled' ||
    normalized === 'in_progress'
  ) {
    return 'packed'
  }

  return 'pending'
}

/** Only move status forward so warehouse progress in 7D is never downgraded by Shopify. */
export function shouldAdvanceImsStatus(
  current: string,
  next: ImsOrderStatus
): boolean {
  if (next === 'cancelled') {
    return !['shipped', 'delivered'].includes(current)
  }
  if (current === 'cancelled') return false

  const currentRank = IMS_STATUS_RANK[current as ImsOrderStatus] ?? 0
  const nextRank = IMS_STATUS_RANK[next] ?? 0
  return nextRank > currentRank
}

export interface ShopifyTrackingInfo {
  tracking_number?: string
  carrier?: string
  shipped_at?: string
}

/**
 * Read tracking from Shopify REST webhook payload (`fulfillments` array) or
 * GraphQL-mapped `fulfillments` on {@link ShopifyOrder}.
 */
export function extractShopifyTracking(
  source: Record<string, unknown> | { fulfillments?: ShopifyFulfillmentLike[] }
): ShopifyTrackingInfo {
  const fulfillments =
    'fulfillments' in source && Array.isArray(source.fulfillments)
      ? source.fulfillments
      : undefined

  if (!fulfillments?.length) return {}

  const sorted = [...fulfillments].sort((a, b) => {
    const ta = new Date(a.created_at ?? a.createdAt ?? 0).getTime()
    const tb = new Date(b.created_at ?? b.createdAt ?? 0).getTime()
    return ta - tb
  })

  const latest = sorted[sorted.length - 1] as ShopifyFulfillmentLike
  const trackingInfo = latest.tracking_info ?? latest.trackingInfo

  const tracking_number =
    (latest.tracking_number as string | undefined) ||
    trackingInfo?.number ||
    undefined

  const carrier =
    (latest.tracking_company as string | undefined) ||
    (latest.tracking_company_name as string | undefined) ||
    trackingInfo?.company ||
    undefined

  const shipped_at =
    (latest.created_at as string | undefined) ||
    (latest.createdAt as string | undefined) ||
    undefined

  return { tracking_number, carrier, shipped_at }
}

interface ShopifyFulfillmentLike {
  created_at?: string
  createdAt?: string
  tracking_number?: string
  tracking_company?: string
  tracking_company_name?: string
  tracking_info?: { number?: string; company?: string }
  trackingInfo?: { number?: string; company?: string }
}
