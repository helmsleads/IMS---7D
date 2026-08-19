import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  buildShopifyOutboundLineItems,
  describeShopifyLineItemsForImport,
} from '@/lib/api/shopify/order-sync'
import type { ShopifyOrder } from '@/types/database'

vi.mock('@/lib/supabase-service', () => ({
  createServiceClient: () => ({
    from: () => ({
      select: () => ({
        eq: async () => ({ data: [], error: null }),
      }),
    }),
  }),
}))

function orderWithLines(
  lines: Array<{
    name: string
    quantity: number
    requires_shipping: boolean
    sku?: string
  }>
): ShopifyOrder {
  return {
    id: 1631,
    name: '#1631',
    email: '',
    created_at: '',
    financial_status: 'paid',
    fulfillment_status: 'fulfilled',
    line_items: lines.map((l, i) => ({
      id: i + 1,
      product_id: 100,
      variant_id: 200 + i,
      sku: l.sku ?? 'TEST-SKU',
      name: l.name,
      title: l.name,
      quantity: l.quantity,
      price: '10',
      fulfillable_quantity: 0,
      requires_shipping: l.requires_shipping,
    })),
    shipping_address: null,
    shipping_lines: [],
    note: null,
    tags: '7D',
    test: true,
    total_price: '10',
    currency: 'USD',
  } as unknown as ShopifyOrder
}

describe('buildShopifyOutboundLineItems', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('imports non-shipping lines when no shippable lines exist', async () => {
    const order = orderWithLines([
      { name: 'Svöl Test Can', quantity: 1, requires_shipping: false },
    ])

    const result = await buildShopifyOutboundLineItems(order, 'integration-1', {
      importNonShippingIfNoShippable: true,
    })

    expect(result.lineItems).toHaveLength(1)
    expect(result.importedNonShippingFallback).toBe(true)
    expect(result.lineItems[0].is_unmatched).toBe(true)
    expect(result.lineItems[0].virtual_qty).toBe(1)
  })

  it('describeShopifyLineItemsForImport explains non-shipping lines', () => {
    const order = orderWithLines([
      { name: 'Svöl Test Can', quantity: 1, requires_shipping: false },
    ])
    const text = describeShopifyLineItemsForImport(order)
    expect(text).toContain('does NOT require shipping')
    expect(text).toContain('Svöl Test Can')
  })
})
