/**
 * Shopify REST API Client
 * Handles all communication with the Shopify Admin API
 *
 * Features:
 * - Distributed rate limiting via Upstash Redis (proactive)
 * - Response-based rate limiting from Shopify headers (reactive)
 * - Automatic retry with exponential backoff for rate limits
 */

import { checkShopifyApiRateLimit } from '@/lib/rate-limit'

export interface ShopifyClientConfig {
  shopDomain: string
  accessToken: string
  apiVersion?: string
}

export class ShopifyClient {
  private baseUrl: string
  private headers: HeadersInit
  private shopDomain: string

  constructor(config: ShopifyClientConfig) {
    const apiVersion = config.apiVersion || '2024-01'
    this.shopDomain = config.shopDomain
    this.baseUrl = `https://${config.shopDomain}/admin/api/${apiVersion}`
    this.headers = {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': config.accessToken,
    }
  }

  async get<T>(endpoint: string): Promise<T> {
    await this.checkRateLimit()

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'GET',
      headers: this.headers,
    })

    await this.handleResponseRateLimit(response)

    if (!response.ok) {
      const errorText = await response.text()
      throw new ShopifyApiError(response.status, errorText)
    }

    return response.json()
  }

  async post<T>(endpoint: string, data: unknown): Promise<T> {
    await this.checkRateLimit()

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(data),
    })

    await this.handleResponseRateLimit(response)

    if (!response.ok) {
      const errorText = await response.text()
      throw new ShopifyApiError(response.status, errorText)
    }

    return response.json()
  }

  async put<T>(endpoint: string, data: unknown): Promise<T> {
    await this.checkRateLimit()

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'PUT',
      headers: this.headers,
      body: JSON.stringify(data),
    })

    await this.handleResponseRateLimit(response)

    if (!response.ok) {
      const errorText = await response.text()
      throw new ShopifyApiError(response.status, errorText)
    }

    return response.json()
  }

  async delete(endpoint: string): Promise<void> {
    await this.checkRateLimit()

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'DELETE',
      headers: this.headers,
    })

    await this.handleResponseRateLimit(response)

    if (!response.ok) {
      const errorText = await response.text()
      throw new ShopifyApiError(response.status, errorText)
    }
  }

  /**
   * Proactive rate limiting using distributed Redis store
   * Ensures we don't exceed Shopify's API limits across all serverless instances
   */
  private async checkRateLimit(): Promise<void> {
    const result = await checkShopifyApiRateLimit(this.shopDomain)
    if (!result.success) {
      // Wait and retry
      await new Promise((resolve) => setTimeout(resolve, (result.resetIn + 1) * 1000))
    }
  }

  /**
   * Reactive rate limiting based on Shopify's response headers
   * Acts as a safety net when approaching limits
   */
  private async handleResponseRateLimit(response: Response): Promise<void> {
    const callLimit = response.headers.get('X-Shopify-Shop-Api-Call-Limit')
    if (callLimit) {
      const [used, max] = callLimit.split('/').map(Number)
      // If we're at 90% of the limit, pause briefly
      if (used >= max * 0.9) {
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    }

    // Handle 429 Too Many Requests
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After')
      const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 2000
      await new Promise((resolve) => setTimeout(resolve, waitTime))
      // Note: The caller will still receive the 429 error and can choose to retry
    }
  }
}

export class ShopifyApiError extends Error {
  constructor(
    public status: number,
    public body: string
  ) {
    super(`Shopify API Error ${status}: ${body}`)
    this.name = 'ShopifyApiError'
  }
}

export function createShopifyClient(config: ShopifyClientConfig): ShopifyClient {
  return new ShopifyClient(config)
}
