import { describe, it, expect } from 'vitest'
import {
  shopifyOrderHas7DTag,
  shopifyOrderHasTestTag,
  SHOPIFY_TEST_ORDER_TAG,
} from '@/lib/api/shopify/order-tag'
import { mergeShopifyTestTagNote } from '@/lib/api/shopify/order-sync'

describe('shopifyOrderHasTestTag', () => {
  it('matches test tag case-insensitively', () => {
    expect(shopifyOrderHasTestTag('7D, test')).toBe(true)
    expect(shopifyOrderHasTestTag(['7D', 'TEST'])).toBe(true)
    expect(shopifyOrderHasTestTag('7D')).toBe(false)
  })

  it('uses order tag name test', () => {
    expect(SHOPIFY_TEST_ORDER_TAG).toBe('test')
    expect(shopifyOrderHasTestTag('')).toBe(false)
  })
})

describe('mergeShopifyTestTagNote', () => {
  it('adds [test] when tag present', () => {
    expect(mergeShopifyTestTagNote('[7D]', '7D, test')).toBe('[test]\n[7D]')
  })

  it('removes [test] when tag absent', () => {
    expect(mergeShopifyTestTagNote('[test]\n[7D]', '7D')).toBe('[7D]')
  })
})

describe('shopifyOrderHas7DTag', () => {
  it('still matches 7D tag', () => {
    expect(shopifyOrderHas7DTag('test, 7D')).toBe(true)
  })
})
