/**
 * Distributed rate limiter using Upstash Redis
 *
 * For Vercel serverless deployments, this uses Upstash Redis for cross-instance
 * rate limiting. Falls back to in-memory for local development if Redis is not configured.
 *
 * Environment variables:
 * - UPSTASH_REDIS_REST_URL: Upstash Redis REST URL
 * - UPSTASH_REDIS_REST_TOKEN: Upstash Redis REST Token
 */

import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

export interface RateLimitConfig {
  /** Maximum requests allowed in the window */
  limit: number
  /** Time window in seconds */
  windowSeconds: number
}

export interface RateLimitResult {
  success: boolean
  remaining: number
  resetIn: number
}

// Pre-configured rate limiters for different use cases
export const RATE_LIMITS = {
  // OAuth endpoints - generous but protected
  oauth: { limit: 10, windowSeconds: 60 },

  // Webhook endpoints - higher limit (Shopify may send bursts)
  webhook: { limit: 100, windowSeconds: 60 },

  // User-triggered API calls
  api: { limit: 30, windowSeconds: 60 },

  // Strict limit for sensitive operations
  sensitive: { limit: 5, windowSeconds: 60 },

  // Shopify API calls per store (40/second with leaky bucket)
  shopifyApi: { limit: 35, windowSeconds: 1 },
} as const

// Check if Upstash is configured
const isUpstashConfigured =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN

// Create Redis client if configured
let redis: Redis | null = null
if (isUpstashConfigured) {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  })
}

// Cache of Ratelimit instances by config
const rateLimiters = new Map<string, Ratelimit>()

/**
 * Get or create a Ratelimit instance for the given config
 */
function getUpstashRateLimiter(config: RateLimitConfig): Ratelimit | null {
  if (!redis) return null

  const key = `${config.limit}:${config.windowSeconds}`

  if (!rateLimiters.has(key)) {
    rateLimiters.set(
      key,
      new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(config.limit, `${config.windowSeconds} s`),
        analytics: true,
        prefix: 'ims_ratelimit',
      })
    )
  }

  return rateLimiters.get(key)!
}

// ============================================================================
// In-Memory Fallback (for local dev or when Redis is unavailable)
// ============================================================================

interface RateLimitEntry {
  count: number
  resetTime: number
}

const rateLimitStore = new Map<string, RateLimitEntry>()

// Clean up old entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(
    () => {
      const now = Date.now()
      for (const [key, entry] of rateLimitStore.entries()) {
        if (entry.resetTime < now) {
          rateLimitStore.delete(key)
        }
      }
    },
    5 * 60 * 1000
  )
}

function checkRateLimitInMemory(identifier: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now()
  const windowMs = config.windowSeconds * 1000
  const key = identifier

  const entry = rateLimitStore.get(key)

  if (!entry || entry.resetTime < now) {
    // Start new window
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + windowMs,
    })
    return {
      success: true,
      remaining: config.limit - 1,
      resetIn: config.windowSeconds,
    }
  }

  if (entry.count >= config.limit) {
    // Rate limited
    return {
      success: false,
      remaining: 0,
      resetIn: Math.ceil((entry.resetTime - now) / 1000),
    }
  }

  // Increment counter
  entry.count++
  return {
    success: true,
    remaining: config.limit - entry.count,
    resetIn: Math.ceil((entry.resetTime - now) / 1000),
  }
}

// ============================================================================
// Main API
// ============================================================================

/**
 * Check if a request should be rate limited
 * Uses Upstash Redis if configured, falls back to in-memory
 *
 * @param identifier - Unique identifier (IP, user ID, integration ID, etc.)
 * @param config - Rate limit configuration
 */
export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const rateLimiter = getUpstashRateLimiter(config)

  if (rateLimiter) {
    try {
      const result = await rateLimiter.limit(identifier)
      return {
        success: result.success,
        remaining: result.remaining,
        resetIn: Math.ceil((result.reset - Date.now()) / 1000),
      }
    } catch (error) {
      console.warn('Redis rate limit check failed, falling back to in-memory:', error)
      // Fall through to in-memory
    }
  }

  // Use in-memory fallback
  return checkRateLimitInMemory(identifier, config)
}

/**
 * Synchronous rate limit check (in-memory only)
 * Use this only when async is not possible
 * @deprecated Prefer async checkRateLimit for production
 */
export function checkRateLimitSync(identifier: string, config: RateLimitConfig): RateLimitResult {
  return checkRateLimitInMemory(identifier, config)
}

/**
 * Get client IP from request headers
 */
export function getClientIp(request: Request): string {
  // Check common proxy headers
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    // x-forwarded-for can contain multiple IPs; first is client
    return forwarded.split(',')[0].trim()
  }

  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp
  }

  // Vercel provides this header
  const vercelIp = request.headers.get('x-vercel-forwarded-for')
  if (vercelIp) {
    return vercelIp.split(',')[0].trim()
  }

  // Fallback - won't work in all environments
  return 'unknown'
}

// ============================================================================
// Specialized Rate Limiters
// ============================================================================

/**
 * Rate limit webhooks by integration ID
 * Allows bursts from Shopify but prevents abuse
 */
export async function checkWebhookRateLimit(integrationId: string): Promise<RateLimitResult> {
  return checkRateLimit(`webhook:${integrationId}`, RATE_LIMITS.webhook)
}

/**
 * Rate limit OAuth attempts by IP
 */
export async function checkOAuthRateLimit(ip: string): Promise<RateLimitResult> {
  return checkRateLimit(`oauth:${ip}`, RATE_LIMITS.oauth)
}

/**
 * Rate limit API calls by user/client
 */
export async function checkApiRateLimit(identifier: string): Promise<RateLimitResult> {
  return checkRateLimit(`api:${identifier}`, RATE_LIMITS.api)
}

/**
 * Rate limit Shopify API calls per store
 * Shopify allows 40 requests/second with leaky bucket
 * We're conservative at 35/second to leave headroom
 */
export async function checkShopifyApiRateLimit(shopDomain: string): Promise<RateLimitResult> {
  return checkRateLimit(`shopify:${shopDomain}`, RATE_LIMITS.shopifyApi)
}

/**
 * Check if Upstash Redis is configured and working
 */
export function isDistributedRateLimitEnabled(): boolean {
  return isUpstashConfigured && redis !== null
}
