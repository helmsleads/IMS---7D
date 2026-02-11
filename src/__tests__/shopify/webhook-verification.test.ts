import { describe, it, expect } from 'vitest'
import crypto from 'crypto'

/**
 * Tests for Shopify webhook HMAC verification logic
 * This tests the verification algorithm used in the webhook handler
 */
describe('Webhook HMAC Verification', () => {
  const webhookSecret = 'test_webhook_secret_12345'

  function generateHmac(body: string, secret: string): string {
    return crypto
      .createHmac('sha256', secret)
      .update(body, 'utf8')
      .digest('base64')
  }

  it('should generate valid HMAC for webhook body', () => {
    const body = JSON.stringify({ id: 123, name: '#1001' })
    const hmac = generateHmac(body, webhookSecret)

    // Verify it's a valid base64 string
    expect(hmac).toMatch(/^[A-Za-z0-9+/]+=*$/)
  })

  it('should produce same HMAC for same body and secret', () => {
    const body = JSON.stringify({ order_id: 456 })

    const hmac1 = generateHmac(body, webhookSecret)
    const hmac2 = generateHmac(body, webhookSecret)

    expect(hmac1).toBe(hmac2)
  })

  it('should produce different HMAC for different bodies', () => {
    const body1 = JSON.stringify({ id: 1 })
    const body2 = JSON.stringify({ id: 2 })

    const hmac1 = generateHmac(body1, webhookSecret)
    const hmac2 = generateHmac(body2, webhookSecret)

    expect(hmac1).not.toBe(hmac2)
  })

  it('should produce different HMAC for different secrets', () => {
    const body = JSON.stringify({ id: 123 })

    const hmac1 = generateHmac(body, 'secret1')
    const hmac2 = generateHmac(body, 'secret2')

    expect(hmac1).not.toBe(hmac2)
  })

  it('should handle empty body', () => {
    const hmac = generateHmac('', webhookSecret)

    expect(hmac).toBeTruthy()
  })

  it('should handle special characters in body', () => {
    const body = JSON.stringify({
      note: 'Special chars: éàü 中文 🎉',
      address: "123 O'Brien St",
    })

    const hmac = generateHmac(body, webhookSecret)

    expect(hmac).toBeTruthy()
    expect(hmac).toMatch(/^[A-Za-z0-9+/]+=*$/)
  })

  it('should match Shopify webhook format', () => {
    // Simulate a Shopify webhook payload
    const shopifyPayload = JSON.stringify({
      id: 820982911946154508,
      email: 'jon@doe.ca',
      created_at: '2024-01-01T12:00:00-05:00',
      updated_at: '2024-01-01T12:00:00-05:00',
      name: '#1001',
      total_price: '199.00',
      currency: 'USD',
      financial_status: 'paid',
      fulfillment_status: null,
      line_items: [
        {
          id: 866550311766439020,
          variant_id: 808950810,
          title: 'Test Product',
          quantity: 1,
          price: '199.00',
        },
      ],
    })

    const hmac = generateHmac(shopifyPayload, webhookSecret)

    // Should be a valid HMAC
    expect(hmac).toBeTruthy()
    expect(hmac.length).toBeGreaterThan(20) // Base64 encoded SHA256 is ~44 chars
  })
})

describe('Webhook Signature Validation', () => {
  function validateSignature(body: string, receivedHmac: string, secret: string): boolean {
    const expectedHmac = crypto
      .createHmac('sha256', secret)
      .update(body, 'utf8')
      .digest('base64')

    return receivedHmac === expectedHmac
  }

  it('should validate correct signature', () => {
    const body = JSON.stringify({ test: 'data' })
    const secret = 'my_secret'
    const validHmac = crypto.createHmac('sha256', secret).update(body, 'utf8').digest('base64')

    expect(validateSignature(body, validHmac, secret)).toBe(true)
  })

  it('should reject incorrect signature', () => {
    const body = JSON.stringify({ test: 'data' })
    const secret = 'my_secret'
    const invalidHmac = 'invalid_hmac_signature'

    expect(validateSignature(body, invalidHmac, secret)).toBe(false)
  })

  it('should reject tampered body', () => {
    const originalBody = JSON.stringify({ amount: 100 })
    const tamperedBody = JSON.stringify({ amount: 1000 })
    const secret = 'my_secret'
    const hmac = crypto.createHmac('sha256', secret).update(originalBody, 'utf8').digest('base64')

    expect(validateSignature(tamperedBody, hmac, secret)).toBe(false)
  })

  it('should reject wrong secret', () => {
    const body = JSON.stringify({ test: 'data' })
    const correctSecret = 'correct_secret'
    const wrongSecret = 'wrong_secret'
    const hmac = crypto.createHmac('sha256', correctSecret).update(body, 'utf8').digest('base64')

    expect(validateSignature(body, hmac, wrongSecret)).toBe(false)
  })
})

describe('OAuth HMAC Verification', () => {
  // Shopify OAuth uses hex-encoded HMAC, not base64
  function verifyOAuthHmac(params: URLSearchParams, secret: string, receivedHmac: string): boolean {
    const sortedParams = Array.from(params.entries())
      .filter(([key]) => key !== 'hmac')
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('&')

    const expectedHmac = crypto.createHmac('sha256', secret).update(sortedParams).digest('hex')

    return receivedHmac === expectedHmac
  }

  it('should verify OAuth callback HMAC', () => {
    const secret = 'test_client_secret'
    const params = new URLSearchParams({
      code: 'abc123',
      shop: 'mystore.myshopify.com',
      state: 'nonce123:data',
      timestamp: '1234567890',
    })

    // Generate expected HMAC
    const sortedString = 'code=abc123&shop=mystore.myshopify.com&state=nonce123:data&timestamp=1234567890'
    const hmac = crypto.createHmac('sha256', secret).update(sortedString).digest('hex')

    params.set('hmac', hmac)

    expect(verifyOAuthHmac(params, secret, hmac)).toBe(true)
  })

  it('should reject invalid OAuth HMAC', () => {
    const params = new URLSearchParams({
      code: 'abc123',
      shop: 'mystore.myshopify.com',
    })

    expect(verifyOAuthHmac(params, 'secret', 'invalid_hmac')).toBe(false)
  })
})
