import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createServiceClient } from '@/lib/supabase-service'
import { encryptToken, isEncryptionConfigured } from '@/lib/encryption'
import { ensureShopifyLocation } from '@/lib/api/shopify/location-management'
import { SHOPIFY_ADMIN_API_VERSION } from '@/lib/api/shopify/constants'
import { normalizeShopifyShopDomain } from '@/lib/api/shopify/shop-domain'
import { ensureIntegrationWarehouseLocation } from '@/lib/api/shopify/shopify-order-payload'
import type { IntegrationSettings } from '@/types/database'

const SHOPIFY_CLIENT_ID = process.env.SHOPIFY_CLIENT_ID!
const SHOPIFY_CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET!
const APP_URL = process.env.NEXT_PUBLIC_APP_URL!

/**
 * Handles the OAuth callback from Shopify
 * GET /api/integrations/shopify/callback?code=xxx&shop=xxx&state=xxx&hmac=xxx
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const shop = searchParams.get('shop')
  const state = searchParams.get('state')
  const hmac = searchParams.get('hmac')

  // Validate required params
  if (!code || !shop || !state || !hmac) {
    console.error('Missing OAuth params:', { code: !!code, shop: !!shop, state: !!state, hmac: !!hmac })
    return NextResponse.redirect(`${APP_URL}/portal/integrations?error=missing_params`)
  }

  // Verify HMAC signature
  const params = new URLSearchParams(searchParams)
  params.delete('hmac')

  // Sort params alphabetically
  const sortedParams = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('&')

  const expectedHmac = crypto
    .createHmac('sha256', SHOPIFY_CLIENT_SECRET)
    .update(sortedParams)
    .digest('hex')

  if (hmac !== expectedHmac) {
    console.error('Invalid HMAC signature')
    return NextResponse.redirect(`${APP_URL}/portal/integrations?error=invalid_hmac`)
  }

  const shopDomain = normalizeShopifyShopDomain(shop)

  // Verify nonce from state
  const nonceCookie = request.cookies.get('shopify_oauth_nonce')?.value
  const [stateNonce, stateData] = state.split(':')

  if (!nonceCookie || nonceCookie !== stateNonce) {
    console.error('Invalid state/nonce')
    return NextResponse.redirect(`${APP_URL}/portal/integrations?error=invalid_state`)
  }

  // Parse client ID from state
  let clientId: string
  try {
    const decoded = JSON.parse(atob(stateData))
    clientId = decoded.clientId
    if (!clientId) throw new Error('No clientId in state')
  } catch (e) {
    console.error('Failed to parse state:', e)
    return NextResponse.redirect(`${APP_URL}/portal/integrations?error=invalid_state`)
  }

  // Exchange code for access token
  let tokenData: { access_token: string; scope: string }
  try {
    const tokenResponse = await fetch(`https://${shopDomain}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: SHOPIFY_CLIENT_ID,
        client_secret: SHOPIFY_CLIENT_SECRET,
        code,
      }),
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('Token exchange failed:', errorText)
      return NextResponse.redirect(`${APP_URL}/portal/integrations?error=token_exchange_failed`)
    }

    tokenData = await tokenResponse.json()
  } catch (e) {
    console.error('Token exchange error:', e)
    return NextResponse.redirect(`${APP_URL}/portal/integrations?error=token_exchange_failed`)
  }

  // Get shop info
  let shopName = shopDomain
  try {
    const shopResponse = await fetch(`https://${shopDomain}/admin/api/${SHOPIFY_ADMIN_API_VERSION}/shop.json`, {
      headers: { 'X-Shopify-Access-Token': tokenData.access_token },
    })
    if (shopResponse.ok) {
      const shopInfo = await shopResponse.json()
      shopName = shopInfo.shop?.name || shopDomain
    }
  } catch (e) {
    console.warn('Failed to fetch shop info:', e)
  }

  // Create or find our dedicated location for multi-location inventory support
  let locationId: string | null = null
  let locationName = '7 Degrees Co'
  let locationCreatedByUs = false

  try {
    const locationResult = await ensureShopifyLocation(
      shopDomain,
      tokenData.access_token,
      locationName
    )
    locationId = locationResult.locationId
    locationName = locationResult.locationName
    locationCreatedByUs = locationResult.createdByUs
    console.log(
      `Location ${locationCreatedByUs ? 'created' : 'found'}: "${locationName}" (ID: ${locationId})`
    )
  } catch (error) {
    console.error('Failed to create/find location:', error)
    // Continue without location - can be set up later via settings
    // This allows the integration to work even if location creation fails
  }

  // Generate webhook secret
  const webhookSecret = crypto.randomBytes(32).toString('hex')

  // Encrypt sensitive tokens before storage
  let encryptedAccessToken = tokenData.access_token
  let encryptedWebhookSecret = webhookSecret

  if (isEncryptionConfigured()) {
    encryptedAccessToken = encryptToken(tokenData.access_token)
    encryptedWebhookSecret = encryptToken(webhookSecret)
    console.log('Tokens encrypted before storage')
  } else {
    console.warn('TOKEN_ENCRYPTION_KEY not configured - storing tokens in plaintext')
  }

  // Save integration to database
  const supabase = createServiceClient()

  const { data: integration, error: dbError } = await supabase
    .from('client_integrations')
    .upsert(
      {
        client_id: clientId,
        platform: 'shopify',
        shop_domain: shop,
        shop_name: shopName,
        access_token: encryptedAccessToken,
        scope: tokenData.scope,
        webhook_secret: encryptedWebhookSecret,
        status: 'active',
        updated_at: new Date().toISOString(),
        // Multi-location support
        shopify_location_id: locationId,
        shopify_location_name: locationName,
        location_created_by_us: locationCreatedByUs,
      },
      {
        onConflict: 'client_id,platform,shop_domain',
      }
    )
    .select()
    .single()

  if (dbError) {
    console.error('Failed to save integration:', dbError)
    return NextResponse.redirect(`${APP_URL}/portal/integrations?error=save_failed`)
  }

  const imsWarehouseId = await ensureIntegrationWarehouseLocation(supabase, integration.id)
  const existingSettings = (integration.settings ?? {}) as IntegrationSettings

  await supabase
    .from('client_integrations')
    .update({
      settings: {
        auto_import_orders: existingSettings.auto_import_orders ?? true,
        auto_sync_inventory: existingSettings.auto_sync_inventory ?? false,
        auto_sync_prices: existingSettings.auto_sync_prices ?? false,
        sync_inventory_interval_minutes:
          existingSettings.sync_inventory_interval_minutes ?? 60,
        inventory_buffer: existingSettings.inventory_buffer ?? 0,
        default_location_id:
          imsWarehouseId ?? existingSettings.default_location_id ?? null,
        fulfillment_notify_customer:
          existingSettings.fulfillment_notify_customer ?? true,
      },
    })
    .eq('id', integration.id)

  // Register webhooks with Shopify
  await registerShopifyWebhooks(integration.id, shopDomain, tokenData.access_token)

  // Update webhooks_registered flag
  await supabase
    .from('client_integrations')
    .update({ webhooks_registered: true })
    .eq('id', integration.id)

  // Clear nonce cookie and redirect to success
  const response = NextResponse.redirect(
    `${APP_URL}/portal/integrations?success=shopify_connected`
  )
  response.cookies.delete('shopify_oauth_nonce')

  return response
}

async function registerShopifyWebhooks(
  integrationId: string,
  shop: string,
  accessToken: string
): Promise<void> {
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL!
  const webhookUrl = `${APP_URL}/api/webhooks/shopify/${integrationId}`

  const webhookTopics = [
    'orders/create',
    'orders/updated',
    'orders/fulfilled',
    'orders/cancelled',
    'inventory_levels/update',
  ]

  for (const topic of webhookTopics) {
    try {
      const response = await fetch(`https://${shop}/admin/api/${SHOPIFY_ADMIN_API_VERSION}/webhooks.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': accessToken,
        },
        body: JSON.stringify({
          webhook: {
            topic,
            address: webhookUrl,
            format: 'json',
          },
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`Failed to register webhook ${topic}:`, errorText)
      } else {
        console.log(`Registered webhook: ${topic}`)
      }
    } catch (error) {
      console.error(`Error registering webhook ${topic}:`, error)
    }
  }
}
