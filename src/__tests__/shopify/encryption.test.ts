import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

// Mock the environment variable before importing
const TEST_KEY = 'a'.repeat(64) // 64 hex chars = 32 bytes

describe('Token Encryption', () => {
  beforeAll(() => {
    vi.stubEnv('TOKEN_ENCRYPTION_KEY', TEST_KEY)
  })

  afterAll(() => {
    vi.unstubAllEnvs()
  })

  it('should encrypt and decrypt a token correctly', async () => {
    // Dynamic import to get fresh module with mocked env
    const { encryptToken, decryptToken } = await import('@/lib/encryption')

    const originalToken = 'shpat_abc123xyz789'
    const encrypted = encryptToken(originalToken)
    const decrypted = decryptToken(encrypted)

    expect(decrypted).toBe(originalToken)
  })

  it('should produce different ciphertext for same plaintext (random IV)', async () => {
    const { encryptToken } = await import('@/lib/encryption')

    const token = 'shpat_test_token'
    const encrypted1 = encryptToken(token)
    const encrypted2 = encryptToken(token)

    expect(encrypted1).not.toBe(encrypted2)
  })

  it('should have correct encrypted format (iv:data)', async () => {
    const { encryptToken } = await import('@/lib/encryption')

    const encrypted = encryptToken('test_token')

    expect(encrypted).toContain(':')
    const [iv, data] = encrypted.split(':')
    expect(iv).toHaveLength(32) // 16 bytes = 32 hex chars
    expect(data.length).toBeGreaterThan(0)
  })

  it('should handle unencrypted tokens gracefully (backwards compat)', async () => {
    const { decryptToken } = await import('@/lib/encryption')

    const plainToken = 'shpat_not_encrypted'
    const result = decryptToken(plainToken)

    expect(result).toBe(plainToken)
  })

  it('should correctly identify encrypted vs unencrypted tokens', async () => {
    const { encryptToken, isTokenEncrypted } = await import('@/lib/encryption')

    const plainToken = 'shpat_plain_token'
    const encryptedToken = encryptToken(plainToken)

    expect(isTokenEncrypted(plainToken)).toBe(false)
    expect(isTokenEncrypted(encryptedToken)).toBe(true)
  })

  it('should throw on invalid encrypted format', async () => {
    const { decryptToken } = await import('@/lib/encryption')

    // Valid format but wrong data
    const invalidEncrypted = 'a'.repeat(32) + ':invalidhexdata'

    expect(() => decryptToken(invalidEncrypted)).toThrow()
  })
})

describe('Encryption Configuration', () => {
  it('should report encryption as configured when key is set', async () => {
    vi.stubEnv('TOKEN_ENCRYPTION_KEY', TEST_KEY)

    // Clear module cache to re-evaluate
    vi.resetModules()
    const { isEncryptionConfigured } = await import('@/lib/encryption')

    expect(isEncryptionConfigured()).toBe(true)
  })

  it('should report encryption as not configured when key is missing', async () => {
    vi.stubEnv('TOKEN_ENCRYPTION_KEY', '')

    vi.resetModules()
    const { isEncryptionConfigured } = await import('@/lib/encryption')

    expect(isEncryptionConfigured()).toBe(false)
  })

  it('should report encryption as not configured when key is wrong length', async () => {
    vi.stubEnv('TOKEN_ENCRYPTION_KEY', 'tooshort')

    vi.resetModules()
    const { isEncryptionConfigured } = await import('@/lib/encryption')

    expect(isEncryptionConfigured()).toBe(false)
  })
})
