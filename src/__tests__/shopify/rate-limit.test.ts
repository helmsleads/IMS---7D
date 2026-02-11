import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('Rate Limiting (In-Memory Fallback)', () => {
  beforeEach(() => {
    // Ensure no Redis is configured so we use in-memory
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '')
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '')
    vi.resetModules()
  })

  it('should allow requests under the limit', async () => {
    const { checkRateLimit, RATE_LIMITS } = await import('@/lib/rate-limit')

    const result = await checkRateLimit('test-user-1', RATE_LIMITS.api)

    expect(result.success).toBe(true)
    expect(result.remaining).toBe(RATE_LIMITS.api.limit - 1)
  })

  it('should track remaining requests correctly', async () => {
    const { checkRateLimit } = await import('@/lib/rate-limit')
    const config = { limit: 5, windowSeconds: 60 }

    const result1 = await checkRateLimit('test-user-2', config)
    const result2 = await checkRateLimit('test-user-2', config)
    const result3 = await checkRateLimit('test-user-2', config)

    expect(result1.remaining).toBe(4)
    expect(result2.remaining).toBe(3)
    expect(result3.remaining).toBe(2)
  })

  it('should block requests over the limit', async () => {
    const { checkRateLimit } = await import('@/lib/rate-limit')
    const config = { limit: 3, windowSeconds: 60 }
    const identifier = 'test-user-3'

    // Use up the limit
    await checkRateLimit(identifier, config)
    await checkRateLimit(identifier, config)
    await checkRateLimit(identifier, config)

    // This should be blocked
    const result = await checkRateLimit(identifier, config)

    expect(result.success).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it('should track different identifiers separately', async () => {
    const { checkRateLimit } = await import('@/lib/rate-limit')
    const config = { limit: 2, windowSeconds: 60 }

    // Use up limit for user A
    await checkRateLimit('user-a', config)
    await checkRateLimit('user-a', config)
    const userAResult = await checkRateLimit('user-a', config)

    // User B should still have full limit
    const userBResult = await checkRateLimit('user-b', config)

    expect(userAResult.success).toBe(false)
    expect(userBResult.success).toBe(true)
    expect(userBResult.remaining).toBe(1)
  })

  it('should provide resetIn time', async () => {
    const { checkRateLimit } = await import('@/lib/rate-limit')
    const config = { limit: 5, windowSeconds: 60 }

    const result = await checkRateLimit('test-reset', config)

    expect(result.resetIn).toBeGreaterThan(0)
    expect(result.resetIn).toBeLessThanOrEqual(60)
  })
})

describe('Rate Limit Presets', () => {
  it('should have correct webhook limits', async () => {
    const { RATE_LIMITS } = await import('@/lib/rate-limit')

    expect(RATE_LIMITS.webhook.limit).toBe(100)
    expect(RATE_LIMITS.webhook.windowSeconds).toBe(60)
  })

  it('should have correct OAuth limits', async () => {
    const { RATE_LIMITS } = await import('@/lib/rate-limit')

    expect(RATE_LIMITS.oauth.limit).toBe(10)
    expect(RATE_LIMITS.oauth.windowSeconds).toBe(60)
  })

  it('should have correct API limits', async () => {
    const { RATE_LIMITS } = await import('@/lib/rate-limit')

    expect(RATE_LIMITS.api.limit).toBe(30)
    expect(RATE_LIMITS.api.windowSeconds).toBe(60)
  })

  it('should have Shopify API limits', async () => {
    const { RATE_LIMITS } = await import('@/lib/rate-limit')

    expect(RATE_LIMITS.shopifyApi).toBeDefined()
    expect(RATE_LIMITS.shopifyApi.limit).toBe(35) // Conservative under Shopify's 40/sec
    expect(RATE_LIMITS.shopifyApi.windowSeconds).toBe(1)
  })
})

describe('Helper Functions', () => {
  it('should extract client IP from x-forwarded-for', async () => {
    const { getClientIp } = await import('@/lib/rate-limit')

    const request = new Request('https://example.com', {
      headers: {
        'x-forwarded-for': '1.2.3.4, 5.6.7.8',
      },
    })

    expect(getClientIp(request)).toBe('1.2.3.4')
  })

  it('should extract client IP from x-real-ip', async () => {
    const { getClientIp } = await import('@/lib/rate-limit')

    const request = new Request('https://example.com', {
      headers: {
        'x-real-ip': '9.10.11.12',
      },
    })

    expect(getClientIp(request)).toBe('9.10.11.12')
  })

  it('should return unknown when no IP headers', async () => {
    const { getClientIp } = await import('@/lib/rate-limit')

    const request = new Request('https://example.com')

    expect(getClientIp(request)).toBe('unknown')
  })

  it('should report distributed rate limit status', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '')
    vi.resetModules()

    const { isDistributedRateLimitEnabled } = await import('@/lib/rate-limit')

    expect(isDistributedRateLimitEnabled()).toBeFalsy()
  })
})

describe('Specialized Rate Limiters', () => {
  beforeEach(() => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '')
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '')
    vi.resetModules()
  })

  it('should have webhook rate limiter', async () => {
    const { checkWebhookRateLimit } = await import('@/lib/rate-limit')

    const result = await checkWebhookRateLimit('integration-123')

    expect(result.success).toBe(true)
  })

  it('should have OAuth rate limiter', async () => {
    const { checkOAuthRateLimit } = await import('@/lib/rate-limit')

    const result = await checkOAuthRateLimit('1.2.3.4')

    expect(result.success).toBe(true)
  })

  it('should have API rate limiter', async () => {
    const { checkApiRateLimit } = await import('@/lib/rate-limit')

    const result = await checkApiRateLimit('user-123')

    expect(result.success).toBe(true)
  })

  it('should have Shopify API rate limiter', async () => {
    const { checkShopifyApiRateLimit } = await import('@/lib/rate-limit')

    const result = await checkShopifyApiRateLimit('mystore.myshopify.com')

    expect(result.success).toBe(true)
  })
})
