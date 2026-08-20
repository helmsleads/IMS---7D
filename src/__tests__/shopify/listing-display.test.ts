import { describe, expect, it } from 'vitest'
import { resolveShopifyListingTitleForOrderItem } from '@/lib/api/shopify/listing-display'

describe('resolveShopifyListingTitleForOrderItem', () => {
  const map = new Map([['p1', 'Shopify Unit (1 count)']])

  it('uses mapping title for matched products', () => {
    expect(
      resolveShopifyListingTitleForOrderItem(
        { is_unmatched: false, product_id: 'p1', external_title: null },
        map
      )
    ).toBe('Shopify Unit (1 count)')
  })

  it('uses line external_title for unmatched items', () => {
    expect(
      resolveShopifyListingTitleForOrderItem(
        {
          is_unmatched: true,
          product_id: null,
          external_title: 'Highland Reserve Scotch',
        },
        map
      )
    ).toBe('Highland Reserve Scotch')
  })

  it('falls back to line external_title when no mapping', () => {
    expect(
      resolveShopifyListingTitleForOrderItem(
        {
          is_unmatched: false,
          product_id: 'other',
          external_title: 'Imported title',
        },
        map
      )
    ).toBe('Imported title')
  })
})
