import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

const TEST_KEY = 'a'.repeat(64)

describe('Shopify token helpers', () => {
  beforeAll(() => {
    vi.stubEnv('TOKEN_ENCRYPTION_KEY', TEST_KEY)
    vi.stubEnv('SHOPIFY_CLIENT_ID', 'test-client-id')
    vi.stubEnv('SHOPIFY_CLIENT_SECRET', 'test-client-secret')
  })

  afterAll(() => {
    vi.unstubAllEnvs()
  })

  it('computes token expiry from expires_in seconds', async () => {
    const { computeTokenExpiresAt } = await import('@/lib/api/shopify/tokens')
    const now = Date.now()
    const expiresAt = computeTokenExpiresAt(3600)

    expect(expiresAt).not.toBeNull()
    const delta = new Date(expiresAt!).getTime() - now
    expect(delta).toBeGreaterThan(3590 * 1000)
    expect(delta).toBeLessThanOrEqual(3600 * 1000)
  })

  it('buildStoredTokenFields encrypts access and refresh tokens', async () => {
    const { buildStoredTokenFields } = await import('@/lib/api/shopify/tokens')
    const { decryptToken } = await import('@/lib/encryption')

    const fields = buildStoredTokenFields({
      access_token: 'shpat_test_access',
      refresh_token: 'shprt_test_refresh',
      scope: 'read_orders',
      expires_in: 3600,
    })

    expect(fields.token_expires_at).not.toBeNull()
    expect(decryptToken(fields.access_token)).toBe('shpat_test_access')
    expect(fields.refresh_token).not.toBeNull()
    expect(decryptToken(fields.refresh_token!)).toBe('shprt_test_refresh')
  })
})
