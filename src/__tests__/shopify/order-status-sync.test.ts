import { describe, it, expect } from 'vitest'
import {
  mapShopifyFulfillmentToImsStatus,
  shouldAdvanceImsStatus,
  extractShopifyTracking,
  extractDeliveryDate,
  shopifyLineItemQtyShipped,
} from '@/lib/api/shopify/order-status-sync'

describe('mapShopifyFulfillmentToImsStatus', () => {
  it('maps unfulfilled to pending', () => {
    expect(mapShopifyFulfillmentToImsStatus('unfulfilled')).toBe('pending')
    expect(mapShopifyFulfillmentToImsStatus(null)).toBe('pending')
  })

  it('maps partial fulfillment to packed', () => {
    expect(mapShopifyFulfillmentToImsStatus('partial')).toBe('packed')
    expect(mapShopifyFulfillmentToImsStatus('PARTIALLY_FULFILLED')).toBe('packed')
    expect(mapShopifyFulfillmentToImsStatus('in_progress')).toBe('packed')
  })

  it('maps fulfilled to shipped', () => {
    expect(mapShopifyFulfillmentToImsStatus('fulfilled')).toBe('shipped')
    expect(mapShopifyFulfillmentToImsStatus('FULFILLED')).toBe('shipped')
  })

  it('maps delivered fulfillments to delivered even when order status is fulfilled', () => {
    expect(
      mapShopifyFulfillmentToImsStatus('fulfilled', {
        fulfillments: [{ created_at: '2024-01-01', delivered_at: '2024-01-05' }],
      })
    ).toBe('delivered')
    expect(
      mapShopifyFulfillmentToImsStatus('fulfilled', {
        fulfillments: [{ created_at: '2024-01-01', display_status: 'DELIVERED' }],
      })
    ).toBe('delivered')
    expect(
      mapShopifyFulfillmentToImsStatus('fulfilled', {
        fulfillments: [{ created_at: '2024-01-01', shipment_status: 'delivered' }],
      })
    ).toBe('delivered')
  })

  it('maps cancelled flag to cancelled', () => {
    expect(mapShopifyFulfillmentToImsStatus('fulfilled', { cancelled: true })).toBe('cancelled')
  })
})

describe('shouldAdvanceImsStatus', () => {
  it('allows forward progression', () => {
    expect(shouldAdvanceImsStatus('pending', 'packed')).toBe(true)
    expect(shouldAdvanceImsStatus('packed', 'shipped')).toBe(true)
    expect(shouldAdvanceImsStatus('shipped', 'delivered')).toBe(true)
  })

  it('blocks downgrade', () => {
    expect(shouldAdvanceImsStatus('shipped', 'pending')).toBe(false)
    expect(shouldAdvanceImsStatus('packed', 'pending')).toBe(false)
  })

  it('blocks cancel after shipped', () => {
    expect(shouldAdvanceImsStatus('shipped', 'cancelled')).toBe(false)
    expect(shouldAdvanceImsStatus('delivered', 'cancelled')).toBe(false)
  })

  it('allows cancel from early statuses', () => {
    expect(shouldAdvanceImsStatus('pending', 'cancelled')).toBe(true)
    expect(shouldAdvanceImsStatus('packed', 'cancelled')).toBe(true)
  })
})

describe('extractShopifyTracking', () => {
  it('reads latest fulfillment tracking from REST-style payload', () => {
    const payload = {
      fulfillments: [
        {
          created_at: '2024-01-01T10:00:00Z',
          tracking_number: 'OLD',
          tracking_company: 'UPS',
        },
        {
          created_at: '2024-01-02T12:00:00Z',
          tracking_number: '1Z999',
          tracking_company: 'FedEx',
        },
      ],
    }

    expect(extractShopifyTracking(payload)).toEqual({
      tracking_number: '1Z999',
      carrier: 'FedEx',
      shipped_at: '2024-01-02T12:00:00Z',
    })
  })

  it('reads GraphQL-mapped fulfillments', () => {
    expect(
      extractShopifyTracking({
        fulfillments: [
          {
            created_at: '2024-06-01T00:00:00Z',
            tracking_number: '9400',
            tracking_company: 'USPS',
          },
        ],
      })
    ).toMatchObject({ tracking_number: '9400', carrier: 'USPS' })
  })
})

describe('extractDeliveryDate', () => {
  it('returns the latest delivered_at from fulfillments', () => {
    expect(
      extractDeliveryDate({
        fulfillments: [
          { delivered_at: '2024-01-01T00:00:00Z' },
          { delivered_at: '2024-01-10T12:00:00Z' },
        ],
      })
    ).toBe('2024-01-10T12:00:00Z')
  })
})

describe('shopifyLineItemQtyShipped', () => {
  it('uses ordered quantity minus fulfillable quantity', () => {
    expect(
      shopifyLineItemQtyShipped({ quantity: 5, fulfillable_quantity: 2 })
    ).toBe(3)
    expect(
      shopifyLineItemQtyShipped({ quantity: 3, fulfillable_quantity: 0 })
    ).toBe(3)
  })
})
