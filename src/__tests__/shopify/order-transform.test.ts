import { describe, it, expect } from 'vitest'

/**
 * Tests for Shopify order transformation logic
 * These test the data transformation without database dependencies
 */

interface ShopifyOrder {
  id: number
  name: string
  email: string
  created_at: string
  financial_status: string
  fulfillment_status: string | null
  line_items: ShopifyLineItem[]
  shipping_address: ShopifyAddress
  shipping_lines: ShopifyShippingLine[]
  note: string | null
  tags: string
  test: boolean
}

interface ShopifyLineItem {
  id: number
  product_id: number
  variant_id: number
  sku: string
  name: string
  quantity: number
  price: string
  fulfillable_quantity: number
  requires_shipping: boolean
}

interface ShopifyAddress {
  first_name: string
  last_name: string
  company: string | null
  address1: string
  address2: string | null
  city: string
  province_code: string
  zip: string
  country_code: string
  phone: string | null
}

interface ShopifyShippingLine {
  title: string
  price: string
}

// Helper to create mock Shopify order
function createMockShopifyOrder(overrides: Partial<ShopifyOrder> = {}): ShopifyOrder {
  return {
    id: 12345678901234,
    name: '#1001',
    email: 'customer@example.com',
    created_at: '2024-01-15T10:30:00-05:00',
    financial_status: 'paid',
    fulfillment_status: null,
    line_items: [
      {
        id: 1,
        product_id: 100,
        variant_id: 200,
        sku: 'TEST-SKU-001',
        name: 'Test Product',
        quantity: 2,
        price: '29.99',
        fulfillable_quantity: 2,
        requires_shipping: true,
      },
    ],
    shipping_address: {
      first_name: 'John',
      last_name: 'Doe',
      company: 'Acme Inc',
      address1: '123 Main St',
      address2: 'Suite 100',
      city: 'New York',
      province_code: 'NY',
      zip: '10001',
      country_code: 'US',
      phone: '+1-555-123-4567',
    },
    shipping_lines: [
      {
        title: 'Standard Shipping',
        price: '5.99',
      },
    ],
    note: 'Please gift wrap',
    tags: '',
    test: false,
    ...overrides,
  }
}

describe('Order Number Transformation', () => {
  function transformOrderNumber(shopifyName: string): string {
    return `SH-${shopifyName.replace('#', '').replace(/\s/g, '')}`
  }

  it('should transform standard order number', () => {
    expect(transformOrderNumber('#1001')).toBe('SH-1001')
  })

  it('should handle order number without hash', () => {
    expect(transformOrderNumber('1002')).toBe('SH-1002')
  })

  it('should handle order number with spaces', () => {
    expect(transformOrderNumber('# 1003')).toBe('SH-1003')
  })

  it('should handle draft order format', () => {
    expect(transformOrderNumber('#D1')).toBe('SH-D1')
  })
})

describe('Shipping Address Transformation', () => {
  function transformAddress(addr: ShopifyAddress) {
    return {
      ship_to_name: `${addr.first_name} ${addr.last_name}`.trim(),
      ship_to_company: addr.company || null,
      ship_to_address: addr.address1,
      ship_to_address2: addr.address2 || null,
      ship_to_city: addr.city,
      ship_to_state: addr.province_code,
      ship_to_postal_code: addr.zip,
      ship_to_country: addr.country_code,
      ship_to_phone: addr.phone || null,
    }
  }

  it('should transform complete address', () => {
    const order = createMockShopifyOrder()
    const result = transformAddress(order.shipping_address)

    expect(result.ship_to_name).toBe('John Doe')
    expect(result.ship_to_company).toBe('Acme Inc')
    expect(result.ship_to_address).toBe('123 Main St')
    expect(result.ship_to_address2).toBe('Suite 100')
    expect(result.ship_to_city).toBe('New York')
    expect(result.ship_to_state).toBe('NY')
    expect(result.ship_to_postal_code).toBe('10001')
    expect(result.ship_to_country).toBe('US')
    expect(result.ship_to_phone).toBe('+1-555-123-4567')
  })

  it('should handle missing optional fields', () => {
    const addr: ShopifyAddress = {
      first_name: 'Jane',
      last_name: 'Smith',
      company: null,
      address1: '456 Oak Ave',
      address2: null,
      city: 'Los Angeles',
      province_code: 'CA',
      zip: '90001',
      country_code: 'US',
      phone: null,
    }

    const result = transformAddress(addr)

    expect(result.ship_to_company).toBeNull()
    expect(result.ship_to_address2).toBeNull()
    expect(result.ship_to_phone).toBeNull()
  })

  it('should handle single name', () => {
    const addr: ShopifyAddress = {
      first_name: 'Madonna',
      last_name: '',
      company: null,
      address1: '789 Star Blvd',
      address2: null,
      city: 'Miami',
      province_code: 'FL',
      zip: '33101',
      country_code: 'US',
      phone: null,
    }

    const result = transformAddress(addr)

    expect(result.ship_to_name).toBe('Madonna')
  })
})

describe('Line Item Transformation', () => {
  function shouldIncludeLineItem(item: ShopifyLineItem): boolean {
    return item.requires_shipping && item.fulfillable_quantity > 0
  }

  it('should include shippable items', () => {
    const item: ShopifyLineItem = {
      id: 1,
      product_id: 100,
      variant_id: 200,
      sku: 'TEST',
      name: 'Test',
      quantity: 2,
      price: '10.00',
      fulfillable_quantity: 2,
      requires_shipping: true,
    }

    expect(shouldIncludeLineItem(item)).toBe(true)
  })

  it('should exclude digital products', () => {
    const item: ShopifyLineItem = {
      id: 1,
      product_id: 100,
      variant_id: 200,
      sku: 'DIGITAL',
      name: 'E-Book',
      quantity: 1,
      price: '9.99',
      fulfillable_quantity: 1,
      requires_shipping: false,
    }

    expect(shouldIncludeLineItem(item)).toBe(false)
  })

  it('should exclude already fulfilled items', () => {
    const item: ShopifyLineItem = {
      id: 1,
      product_id: 100,
      variant_id: 200,
      sku: 'TEST',
      name: 'Test',
      quantity: 2,
      price: '10.00',
      fulfillable_quantity: 0, // Already fulfilled
      requires_shipping: true,
    }

    expect(shouldIncludeLineItem(item)).toBe(false)
  })
})

describe('Rush Order Detection', () => {
  function isRushOrder(order: ShopifyOrder): boolean {
    const shippingMethod = order.shipping_lines[0]?.title || ''
    return (
      order.tags?.toLowerCase().includes('rush') ||
      shippingMethod.toLowerCase().includes('express') ||
      shippingMethod.toLowerCase().includes('overnight') ||
      shippingMethod.toLowerCase().includes('priority')
    )
  }

  it('should detect rush tag', () => {
    const order = createMockShopifyOrder({ tags: 'rush, vip' })
    expect(isRushOrder(order)).toBe(true)
  })

  it('should detect express shipping', () => {
    const order = createMockShopifyOrder({
      shipping_lines: [{ title: 'Express Shipping', price: '15.99' }],
    })
    expect(isRushOrder(order)).toBe(true)
  })

  it('should detect overnight shipping', () => {
    const order = createMockShopifyOrder({
      shipping_lines: [{ title: 'Overnight Delivery', price: '29.99' }],
    })
    expect(isRushOrder(order)).toBe(true)
  })

  it('should detect priority shipping', () => {
    const order = createMockShopifyOrder({
      shipping_lines: [{ title: 'USPS Priority Mail', price: '12.99' }],
    })
    expect(isRushOrder(order)).toBe(true)
  })

  it('should not flag standard shipping as rush', () => {
    const order = createMockShopifyOrder({
      tags: '',
      shipping_lines: [{ title: 'Standard Shipping', price: '5.99' }],
    })
    expect(isRushOrder(order)).toBe(false)
  })
})

describe('Order Filtering', () => {
  function shouldImportOrder(order: ShopifyOrder): { import: boolean; reason?: string } {
    if (order.fulfillment_status === 'fulfilled') {
      return { import: false, reason: 'Already fulfilled' }
    }

    if (order.test === true) {
      return { import: true, reason: 'Test order - importing for dev' }
    }

    const shippableItems = order.line_items.filter(
      (item) => item.requires_shipping && item.fulfillable_quantity > 0
    )

    if (shippableItems.length === 0) {
      return { import: false, reason: 'No shippable items' }
    }

    return { import: true }
  }

  it('should import unfulfilled orders', () => {
    const order = createMockShopifyOrder({ fulfillment_status: null })
    expect(shouldImportOrder(order).import).toBe(true)
  })

  it('should skip fulfilled orders', () => {
    const order = createMockShopifyOrder({ fulfillment_status: 'fulfilled' })
    const result = shouldImportOrder(order)
    expect(result.import).toBe(false)
    expect(result.reason).toBe('Already fulfilled')
  })

  it('should import test orders with note', () => {
    const order = createMockShopifyOrder({ test: true })
    const result = shouldImportOrder(order)
    expect(result.import).toBe(true)
    expect(result.reason).toContain('Test order')
  })

  it('should skip orders with no shippable items', () => {
    const order = createMockShopifyOrder({
      line_items: [
        {
          id: 1,
          product_id: 100,
          variant_id: 200,
          sku: 'DIGITAL',
          name: 'Digital Download',
          quantity: 1,
          price: '9.99',
          fulfillable_quantity: 1,
          requires_shipping: false,
        },
      ],
    })
    const result = shouldImportOrder(order)
    expect(result.import).toBe(false)
    expect(result.reason).toBe('No shippable items')
  })
})

describe('Carrier Mapping', () => {
  function mapCarrierToShopify(carrier: string): string {
    const carrierMap: Record<string, string> = {
      ups: 'UPS',
      UPS: 'UPS',
      usps: 'USPS',
      USPS: 'USPS',
      fedex: 'FedEx',
      FedEx: 'FedEx',
      FEDEX: 'FedEx',
      dhl: 'DHL Express',
      DHL: 'DHL Express',
      'DHL Express': 'DHL Express',
      ontrac: 'OnTrac',
      OnTrac: 'OnTrac',
      lasership: 'LaserShip',
      LaserShip: 'LaserShip',
    }
    return carrierMap[carrier] || carrier
  }

  it('should map lowercase carriers', () => {
    expect(mapCarrierToShopify('ups')).toBe('UPS')
    expect(mapCarrierToShopify('usps')).toBe('USPS')
    expect(mapCarrierToShopify('fedex')).toBe('FedEx')
    expect(mapCarrierToShopify('dhl')).toBe('DHL Express')
  })

  it('should map uppercase carriers', () => {
    expect(mapCarrierToShopify('UPS')).toBe('UPS')
    expect(mapCarrierToShopify('FEDEX')).toBe('FedEx')
  })

  it('should pass through unknown carriers', () => {
    expect(mapCarrierToShopify('Local Courier')).toBe('Local Courier')
    expect(mapCarrierToShopify('Custom')).toBe('Custom')
  })
})
