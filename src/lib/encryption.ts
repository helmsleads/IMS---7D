/**
 * Token Encryption Utility
 *
 * Provides AES-256-CBC encryption for sensitive data like API tokens.
 * Tokens are encrypted before storage and decrypted when needed.
 *
 * Environment variables:
 * - TOKEN_ENCRYPTION_KEY: 32-byte hex-encoded key (64 characters)
 *
 * Generate a key with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */

import crypto from 'crypto'

const ALGORITHM = 'aes-256-cbc'
const IV_LENGTH = 16

/**
 * Get the encryption key from environment
 * Throws if not configured
 */
function getEncryptionKey(): Buffer {
  const keyHex = process.env.TOKEN_ENCRYPTION_KEY
  if (!keyHex) {
    throw new Error('TOKEN_ENCRYPTION_KEY environment variable not set')
  }

  if (keyHex.length !== 64) {
    throw new Error('TOKEN_ENCRYPTION_KEY must be 64 hex characters (32 bytes)')
  }

  return Buffer.from(keyHex, 'hex')
}

/**
 * Check if encryption is configured
 */
export function isEncryptionConfigured(): boolean {
  const keyHex = process.env.TOKEN_ENCRYPTION_KEY
  return Boolean(keyHex && keyHex.length === 64)
}

/**
 * Encrypt a plaintext token
 * Returns format: "iv:encryptedData" (both hex encoded)
 */
export function encryptToken(plaintext: string): string {
  const key = getEncryptionKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  return `${iv.toString('hex')}:${encrypted}`
}

/**
 * Decrypt an encrypted token
 * Expects format: "iv:encryptedData" (both hex encoded)
 */
export function decryptToken(ciphertext: string): string {
  // Handle unencrypted tokens (backwards compatibility during migration)
  if (!ciphertext.includes(':')) {
    console.warn('Token appears to be unencrypted (legacy format)')
    return ciphertext
  }

  const key = getEncryptionKey()
  const [ivHex, encrypted] = ciphertext.split(':')

  if (!ivHex || !encrypted) {
    throw new Error('Invalid encrypted token format')
  }

  const iv = Buffer.from(ivHex, 'hex')
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)

  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}

/**
 * Check if a token is encrypted
 * Encrypted tokens have format "iv:data" where iv is 32 hex chars
 */
export function isTokenEncrypted(token: string): boolean {
  if (!token.includes(':')) {
    return false
  }
  const [ivHex] = token.split(':')
  // IV should be 16 bytes = 32 hex characters
  return ivHex.length === 32 && /^[0-9a-f]+$/i.test(ivHex)
}

/**
 * Migrate an unencrypted token to encrypted format
 * Returns null if already encrypted or encryption not configured
 */
export function migrateToken(token: string): string | null {
  if (!isEncryptionConfigured()) {
    return null
  }

  if (isTokenEncrypted(token)) {
    return null // Already encrypted
  }

  return encryptToken(token)
}
