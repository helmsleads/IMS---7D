import { describe, it, expect } from 'vitest'
import { normalizeShopifyOrderPayload } from '@/lib/api/shopify/shopify-order-payload'
import { shopifyInventoryQtyToDeduct } from '@/lib/api/shopify/order-inventory-deduction'

describe('normalizeShopifyOrderPayload', () => {
  it('sets fulfillable_quantity to 0 when fulfilled and field is missing', () => {
    const result = normalizeShopifyOrderPayload({
      fulfillment_status: 'fulfilled',
      line_items: [
        {
          id: 1,
          variant_id: 99,
          quantity: 3,
          requires_shipping: true,
        },
      ],
    }) as { line_items: Array<{ fulfillable_quantity: number; quantity: number }> }

    expect(result.line_items[0].fulfillable_quantity).toBe(0)
    expect(result.line_items[0].quantity - result.line_items[0].fulfillable_quantity).toBe(3)
  })

  it('preserves explicit fulfillable_quantity', () => {
    const result = normalizeShopifyOrderPayload({
      fulfillment_status: 'partial',
      line_items: [{ id: 1, quantity: 5, fulfillable_quantity: 2 }],
    }) as { line_items: Array<{ fulfillable_quantity: number }> }

    expect(result.line_items[0].fulfillable_quantity).toBe(2)
  })
})

describe('shopifyInventoryQtyToDeduct recovery scenario', () => {
  it('zero delta when qty_shipped already matches Shopify', () => {
    expect(shopifyInventoryQtyToDeduct(5, 5)).toBe(0)
  })
})
