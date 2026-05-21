import { describe, it, expect } from 'vitest'
import {
  mapShopifyFulfillmentToImsStatus,
  shouldAdvanceImsStatus,
  extractShopifyTracking,
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

  it('maps cancelled flag to cancelled', () => {
    expect(mapShopifyFulfillmentToImsStatus('fulfilled', { cancelled: true })).toBe('cancelled')
  })
})

describe('shouldAdvanceImsStatus', () => {
  it('allows forward progression', () => {
    expect(shouldAdvanceImsStatus('pending', 'packed')).toBe(true)
    expect(shouldAdvanceImsStatus('packed', 'shipped')).toBe(true)
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
