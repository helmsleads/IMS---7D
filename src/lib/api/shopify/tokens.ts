/**
 * Shopify OAuth token management — expiring offline tokens with refresh.
 *
 * @see https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/offline-access-tokens
 */

import { createServiceClient } from '@/lib/supabase-service'
import { decryptToken, encryptToken, isEncryptionConfigured } from '@/lib/encryption'
import { createShopifyClient, type ShopifyClient } from './client'
import { normalizeShopifyShopDomain } from './shop-domain'
import type { ClientIntegration } from '@/types/database'

export type ShopifyIntegrationRecord = Pick<
  ClientIntegration,
  'id' | 'shop_domain' | 'access_token' | 'refresh_token' | 'token_expires_at'
>

export interface ShopifyOAuthTokenData {
  access_token: string
  scope: string
  expires_in?: number
  refresh_token?: string
  refresh_token_expires_in?: number
}

const TOKEN_REFRESH_BUFFER_MS = 60_000

function getShopifyCredentials() {
  const clientId = process.env.SHOPIFY_CLIENT_ID
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET must be configured')
  }
  return { clientId, clientSecret }
}

function maybeEncrypt(value: string): string {
  return isEncryptionConfigured() ? encryptToken(value) : value
}

export function computeTokenExpiresAt(expiresInSeconds?: number): string | null {
  if (!expiresInSeconds) {
    return null
  }
  return new Date(Date.now() + expiresInSeconds * 1000).toISOString()
}

export function buildStoredTokenFields(tokenData: ShopifyOAuthTokenData): {
  access_token: string
  refresh_token: string | null
  token_expires_at: string | null
} {
  return {
    access_token: maybeEncrypt(tokenData.access_token),
    refresh_token: tokenData.refresh_token ? maybeEncrypt(tokenData.refresh_token) : null,
    token_expires_at: computeTokenExpiresAt(tokenData.expires_in),
  }
}

async function requestAccessToken(
  shopDomain: string,
  body: Record<string, string>
): Promise<ShopifyOAuthTokenData> {
  const { clientId, clientSecret } = getShopifyCredentials()
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    ...body,
  })

  const response = await fetch(
    `https://${normalizeShopifyShopDomain(shopDomain)}/admin/oauth/access_token`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: params.toString(),
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Shopify token request failed (${response.status}): ${errorText}`)
  }

  return response.json()
}

/** Exchange OAuth authorization code for expiring offline tokens. */
export async function exchangeAuthorizationCode(
  shopDomain: string,
  code: string
): Promise<ShopifyOAuthTokenData> {
  return requestAccessToken(shopDomain, {
    code,
    expiring: '1',
  })
}

async function refreshExpiringToken(
  shopDomain: string,
  refreshToken: string
): Promise<ShopifyOAuthTokenData> {
  return requestAccessToken(shopDomain, {
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  })
}

/** One-time migration from legacy non-expiring offline token to expiring tokens. */
async function migrateNonExpiringToken(
  shopDomain: string,
  accessToken: string
): Promise<ShopifyOAuthTokenData> {
  return requestAccessToken(shopDomain, {
    grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
    subject_token: accessToken,
    subject_token_type: 'urn:shopify:params:oauth:token-type:offline-access-token',
    requested_token_type: 'urn:shopify:params:oauth:token-type:offline-access-token',
    expiring: '1',
  })
}

async function persistTokenFields(
  integrationId: string,
  tokenData: ShopifyOAuthTokenData
): Promise<void> {
  const supabase = createServiceClient()
  const fields = buildStoredTokenFields(tokenData)

  const { error } = await supabase
    .from('client_integrations')
    .update({
      ...fields,
      scope: tokenData.scope,
      updated_at: new Date().toISOString(),
    })
    .eq('id', integrationId)

  if (error) {
    throw new Error(`Failed to persist Shopify tokens: ${error.message}`)
  }
}

function isAccessTokenValid(tokenExpiresAt: string | null): boolean {
  if (!tokenExpiresAt) {
    return false
  }
  return new Date(tokenExpiresAt).getTime() > Date.now() + TOKEN_REFRESH_BUFFER_MS
}

/**
 * Returns a valid Shopify Admin API access token, refreshing or migrating when needed.
 */
export async function getShopifyAccessToken(
  integration: ShopifyIntegrationRecord
): Promise<string> {
  if (!integration.access_token || !integration.shop_domain) {
    throw new Error('Shopify integration is missing access token or shop domain')
  }

  const shopDomain = integration.shop_domain
  const decryptedAccess = decryptToken(integration.access_token)
  const decryptedRefresh = integration.refresh_token
    ? decryptToken(integration.refresh_token)
    : null

  if (decryptedRefresh) {
    if (isAccessTokenValid(integration.token_expires_at)) {
      return decryptedAccess
    }

    const tokenData = await refreshExpiringToken(shopDomain, decryptedRefresh)
    await persistTokenFields(integration.id, tokenData)
    return tokenData.access_token
  }

  // Legacy non-expiring token — migrate once to expiring offline tokens.
  const tokenData = await migrateNonExpiringToken(shopDomain, decryptedAccess)
  await persistTokenFields(integration.id, tokenData)
  return tokenData.access_token
}

export async function createShopifyClientForIntegration(
  integration: ShopifyIntegrationRecord
): Promise<ShopifyClient> {
  const accessToken = await getShopifyAccessToken(integration)
  return createShopifyClient({
    shopDomain: integration.shop_domain!,
    accessToken,
  })
}
