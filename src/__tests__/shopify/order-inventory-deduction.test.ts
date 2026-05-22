import { describe, it, expect } from 'vitest'
import { shopifyInventoryQtyToDeduct } from '@/lib/api/shopify/order-inventory-deduction'

describe('shopifyInventoryQtyToDeduct', () => {
  it('returns delta between Shopify shipped and 7D qty_shipped', () => {
    expect(shopifyInventoryQtyToDeduct(5, 2)).toBe(3)
    expect(shopifyInventoryQtyToDeduct(3, 3)).toBe(0)
    expect(shopifyInventoryQtyToDeduct(0, 5)).toBe(0)
  })

  it('supports incremental partial fulfillments', () => {
    expect(shopifyInventoryQtyToDeduct(2, 0)).toBe(2)
    expect(shopifyInventoryQtyToDeduct(5, 2)).toBe(3)
  })
})
