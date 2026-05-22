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



interface ShopifyFulfillmentLike {

  created_at?: string

  createdAt?: string

  delivered_at?: string | null

  deliveredAt?: string | null

  display_status?: string | null

  displayStatus?: string | null

  shipment_status?: string | null

  tracking_number?: string | null

  tracking_company?: string | null

  tracking_company_name?: string

  tracking_info?: { number?: string; company?: string }

  trackingInfo?: { number?: string; company?: string }

}



function isFulfillmentDelivered(f: ShopifyFulfillmentLike): boolean {

  if (f.delivered_at || f.deliveredAt) return true

  const display = String(f.display_status ?? f.displayStatus ?? '')

    .toUpperCase()

    .trim()

  if (display === 'DELIVERED') return true

  const shipment = String(f.shipment_status ?? '')

    .toLowerCase()

    .replace(/-/g, '_')

  return shipment === 'delivered'

}



function fulfillmentsFromSource(

  source: Record<string, unknown> | { fulfillments?: ShopifyFulfillmentLike[] }

): ShopifyFulfillmentLike[] | undefined {

  if ('fulfillments' in source && Array.isArray(source.fulfillments)) {

    return source.fulfillments as ShopifyFulfillmentLike[]

  }

  return undefined

}



/**

 * Map Shopify order fulfillment state to an IMS outbound status.

 *

 * Order-level `fulfillment_status` stays `fulfilled` when delivery is marked in Shopify;

 * delivery is detected from fulfillment `deliveredAt` / `displayStatus` / `shipment_status`.

 */

export function mapShopifyFulfillmentToImsStatus(

  fulfillmentStatus: string | null | undefined,

  options?: {

    cancelled?: boolean

    fulfillments?: ShopifyFulfillmentLike[]

  }

): ImsOrderStatus {

  if (options?.cancelled) return 'cancelled'



  const fulfillments = options?.fulfillments ?? []

  if (fulfillments.some(isFulfillmentDelivered)) {

    return 'delivered'

  }



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



/** Shipped units on a Shopify line item (ordered qty minus still fulfillable). */

export function shopifyLineItemQtyShipped(lineItem: {

  quantity: number

  fulfillable_quantity: number

}): number {

  return Math.max(0, lineItem.quantity - lineItem.fulfillable_quantity)

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

  const fulfillments = fulfillmentsFromSource(source)



  if (!fulfillments?.length) return {}



  const sorted = [...fulfillments].sort((a, b) => {

    const ta = new Date(a.created_at ?? a.createdAt ?? 0).getTime()

    const tb = new Date(b.created_at ?? b.createdAt ?? 0).getTime()

    return ta - tb

  })



  const latest = sorted[sorted.length - 1]

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



/** Latest delivery timestamp from Shopify fulfillments (REST or GraphQL-mapped). */

export function extractDeliveryDate(

  source: Record<string, unknown> | { fulfillments?: ShopifyFulfillmentLike[] }

): string | undefined {

  const fulfillments = fulfillmentsFromSource(source)

  if (!fulfillments?.length) return undefined



  let latest: string | undefined

  for (const f of fulfillments) {

    const at = f.delivered_at ?? f.deliveredAt

    if (!at) continue

    if (!latest || new Date(at).getTime() > new Date(latest).getTime()) {

      latest = at

    }

  }

  return latest

}


