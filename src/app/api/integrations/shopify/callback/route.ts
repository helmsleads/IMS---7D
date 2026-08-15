import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createServiceClient } from '@/lib/supabase-service'
import { encryptToken, isEncryptionConfigured } from '@/lib/encryption'
import {
  buildStoredTokenFields,
  exchangeAuthorizationCode,
} from '@/lib/api/shopify/tokens'
import { ensureShopifyLocation } from '@/lib/api/shopify/location-management'
import { SHOPIFY_ADMIN_API_VERSION } from '@/lib/api/shopify/constants'
import { normalizeShopifyShopDomain } from '@/lib/api/shopify/shop-domain'
import { ensureIntegrationWarehouseLocation } from '@/lib/api/shopify/shopify-order-payload'
import {
  connectionModeForApp,
  getShopifyAppCredentials,
  listShopifyWebhookSecrets,
  parseShopifyAppMode,
  type ShopifyAppMode,
} from '@/lib/api/shopify/app-credentials'
import { DEFAULT_SHOPIFY_INTEGRATION_SETTINGS } from '@/lib/api/dtc/shopify-defaults'
import { registerShopifyWebhooks } from '@/lib/api/shopify/register-webhooks'
import type { IntegrationSettings } from '@/types/database'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL!

function redirectOAuthError(
  reason: string,
  dtcReturnUrl: string | null,
  oauthSource: string | null,
) {
  if (oauthSource === 'dtc' && dtcReturnUrl) {
    const sep = dtcReturnUrl.includes('?') ? '&' : '?'
    return NextResponse.redirect(
      `${dtcReturnUrl}${sep}shopify=error&reason=${encodeURIComponent(reason)}`,
    )
  }
  return NextResponse.redirect(`${APP_URL}/portal/integrations?error=${encodeURIComponent(reason)}`)
}

function verifyOAuthHmac(
  sortedParams: string,
  hmac: string,
  preferredMode: ShopifyAppMode,
): { ok: boolean; appMode: ShopifyAppMode } {
  const secretsToTry: Array<{ mode: ShopifyAppMode; secret: string }> = []

  try {
    const preferred = getShopifyAppCredentials(preferredMode)
    secretsToTry.push({ mode: preferred.mode, secret: preferred.clientSecret })
  } catch {
    /* fall through */
  }

  const otherMode: ShopifyAppMode = preferredMode === 'test' ? 'live' : 'test'
  try {
    const other = getShopifyAppCredentials(otherMode)
    if (!secretsToTry.some((s) => s.secret === other.clientSecret)) {
      secretsToTry.push({ mode: other.mode, secret: other.clientSecret })
    }
  } catch {
    /* optional */
  }

  // Last resort: any configured secret
  for (const secret of listShopifyWebhookSecrets()) {
    if (!secretsToTry.some((s) => s.secret === secret)) {
      secretsToTry.push({
        mode: secretsToTry[0]?.mode ?? preferredMode,
        secret,
      })
    }
  }

  for (const entry of secretsToTry) {
    const expectedHmac = crypto
      .createHmac('sha256', entry.secret)
      .update(sortedParams)
      .digest('hex')
    try {
      const a = Buffer.from(hmac, 'utf8')
      const b = Buffer.from(expectedHmac, 'utf8')
      if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
        return { ok: true, appMode: entry.mode }
      }
    } catch {
      if (hmac === expectedHmac) {
        return { ok: true, appMode: entry.mode }
      }
    }
  }

  return { ok: false, appMode: preferredMode }
}

/**
 * Handles the OAuth callback from Shopify
 * GET /api/integrations/shopify/callback?code=xxx&shop=xxx&state=xxx&hmac=xxx
 *
 * Supports live (SHOPIFY_CLIENT_*) and test (SHOPIFY_TEST_CLIENT_*) apps.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const shop = searchParams.get('shop')
  const state = searchParams.get('state')
  const hmac = searchParams.get('hmac')

  // Peek DTC return URL / app mode early so pre-parse failures can still send the user back.
  let earlyDtcReturnUrl: string | null = null
  let earlyOAuthSource: string | null = null
  let earlyAppMode: ShopifyAppMode = 'live'
  if (state?.includes(':')) {
    try {
      const stateData = state.split(':')[1]
      const decoded = JSON.parse(atob(stateData))
      earlyOAuthSource = decoded.source ?? null
      earlyAppMode = parseShopifyAppMode(decoded.app)
      if (typeof decoded.returnUrl === 'string' && decoded.returnUrl.startsWith('http')) {
        earlyDtcReturnUrl = decoded.returnUrl
      }
    } catch {
      /* ignore — fall through to portal redirect */
    }
  }

  // Validate required params
  if (!code || !shop || !state || !hmac) {
    console.error('Missing OAuth params:', { code: !!code, shop: !!shop, state: !!state, hmac: !!hmac })
    return redirectOAuthError('missing_params', earlyDtcReturnUrl, earlyOAuthSource)
  }

  // Verify HMAC — try preferred app secret, then the other (live vs test)
  const params = new URLSearchParams(searchParams)
  params.delete('hmac')

  const sortedParams = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('&')

  const hmacResult = verifyOAuthHmac(sortedParams, hmac, earlyAppMode)
  if (!hmacResult.ok) {
    console.error('Invalid HMAC signature (checked live + test app secrets)')
    return redirectOAuthError('invalid_hmac', earlyDtcReturnUrl, earlyOAuthSource)
  }

  let appMode = hmacResult.appMode
  const shopDomain = normalizeShopifyShopDomain(shop)

  // Verify nonce from state (portal cookie OR DTC-initiated DB state)
  const nonceCookie = request.cookies.get('shopify_oauth_nonce')?.value
  const [stateNonce, stateData] = state.split(':')

  // Parse client ID / return URL / app from state
  let clientId: string | null = null
  let oauthSource: string | null = earlyOAuthSource
  let dtcReturnUrl: string | null = earlyDtcReturnUrl
  try {
    const decoded = JSON.parse(atob(stateData))
    clientId = decoded.clientId ?? null
    oauthSource = decoded.source ?? null
    if (decoded.app) {
      appMode = parseShopifyAppMode(decoded.app)
    }
    dtcReturnUrl =
      typeof decoded.returnUrl === 'string' && decoded.returnUrl.startsWith('http')
        ? decoded.returnUrl
        : null
    if (oauthSource !== 'begin_install' && !clientId) {
      throw new Error('No clientId in state')
    }
  } catch (e) {
    console.error('Failed to parse state:', e)
    return redirectOAuthError('invalid_state', earlyDtcReturnUrl, earlyOAuthSource)
  }

  // Prefer the secret that actually verified the HMAC
  if (hmacResult.appMode) {
    appMode = hmacResult.appMode
  }

  if (oauthSource === 'dtc') {
    if (!clientId) {
      return redirectOAuthError('invalid_state', dtcReturnUrl, oauthSource)
    }
    const supabaseForState = createServiceClient()
    const { data: oauthState, error: oauthStateError } = await supabaseForState
      .from('dtc_shopify_oauth_states')
      .select('id, client_id, return_url, expires_at')
      .eq('nonce', stateNonce)
      .maybeSingle()

    if (
      oauthStateError ||
      !oauthState ||
      oauthState.client_id !== clientId ||
      new Date(oauthState.expires_at).getTime() < Date.now()
    ) {
      console.error('Invalid DTC Shopify OAuth state/nonce')
      return redirectOAuthError('invalid_state', dtcReturnUrl, oauthSource)
    }

    if (!dtcReturnUrl && oauthState.return_url) {
      dtcReturnUrl = oauthState.return_url
    }

    await supabaseForState.from('dtc_shopify_oauth_states').delete().eq('id', oauthState.id)
  } else if (!nonceCookie || nonceCookie !== stateNonce) {
    console.error('Invalid state/nonce')
    return redirectOAuthError('invalid_state', dtcReturnUrl, oauthSource)
  }

  // Exchange code using the same app (live or test) that signed the callback
  let tokenData: Awaited<ReturnType<typeof exchangeAuthorizationCode>>
  try {
    tokenData = await exchangeAuthorizationCode(shopDomain, code, appMode)
  } catch (e) {
    console.error('Token exchange error:', e)
    return redirectOAuthError('token_exchange_failed', dtcReturnUrl, oauthSource)
  }

  // Shopify App URL / distribution install: approve happened; stash tokens until portal login claims them.
  if (oauthSource === 'begin_install') {
    const pending = {
      shop: shopDomain,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token ?? null,
      scope: tokenData.scope,
      expires_in: tokenData.expires_in ?? null,
      app: appMode,
      created_at: Date.now(),
    }
    const payload = isEncryptionConfigured()
      ? encryptToken(JSON.stringify(pending))
      : JSON.stringify(pending)

    const claimRedirect = `${APP_URL}/client-login?redirect=${encodeURIComponent('/portal/integrations?shopify_claim=1')}`
    const response = NextResponse.redirect(claimRedirect)
    response.cookies.set('shopify_pending_install', payload, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600,
      path: '/',
    })
    response.cookies.delete('shopify_oauth_nonce')
    return response
  }

  if (!clientId) {
    return redirectOAuthError('invalid_state', dtcReturnUrl, oauthSource)
  }

  // Get shop info
  let shopName = shopDomain
  try {
    const shopResponse = await fetch(
      `https://${shopDomain}/admin/api/${SHOPIFY_ADMIN_API_VERSION}/shop.json`,
      {
        headers: { 'X-Shopify-Access-Token': tokenData.access_token },
      },
    )
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
      locationName,
    )
    locationId = locationResult.locationId
    locationName = locationResult.locationName
    locationCreatedByUs = locationResult.createdByUs
    console.log(
      `Location ${locationCreatedByUs ? 'created' : 'found'}: "${locationName}" (ID: ${locationId})`,
    )
  } catch (error) {
    console.error('Failed to create/find location:', error)
  }

  const webhookSecret = crypto.randomBytes(32).toString('hex')
  const storedTokens = buildStoredTokenFields(tokenData)
  let encryptedWebhookSecret = webhookSecret

  if (isEncryptionConfigured()) {
    encryptedWebhookSecret = encryptToken(webhookSecret)
  } else {
    console.warn('TOKEN_ENCRYPTION_KEY not configured - storing tokens in plaintext')
  }

  const supabase = createServiceClient()

  const { data: integration, error: dbError } = await supabase
    .from('client_integrations')
    .upsert(
      {
        client_id: clientId,
        platform: 'shopify',
        shop_domain: shop,
        shop_name: shopName,
        access_token: storedTokens.access_token,
        refresh_token: storedTokens.refresh_token,
        token_expires_at: storedTokens.token_expires_at,
        scope: tokenData.scope,
        webhook_secret: encryptedWebhookSecret,
        status: 'active',
        updated_at: new Date().toISOString(),
        shopify_location_id: locationId,
        shopify_location_name: locationName,
        location_created_by_us: locationCreatedByUs,
      },
      {
        onConflict: 'client_id,platform,shop_domain',
      },
    )
    .select()
    .single()

  if (dbError) {
    console.error('Failed to save integration:', dbError)
    return redirectOAuthError('save_failed', dtcReturnUrl, oauthSource)
  }

  const imsWarehouseId = await ensureIntegrationWarehouseLocation(supabase, integration.id)
  const existingSettings = (integration.settings ?? {}) as IntegrationSettings
  const isDtcFlow = oauthSource === 'dtc'
  // Portal and DTC OAuth: auto-import into 7D. Shopify store apps own age/ID;
  // DTC ID verify is only for DTC checkout/embed (not Shopify webhooks).
  const dtcDefaults = isDtcFlow ? DEFAULT_SHOPIFY_INTEGRATION_SETTINGS : null

  await supabase
    .from('client_integrations')
    .update({
      settings: {
        // Always clear verify-first on reconnect (Shopify apps own age/ID).
        auto_import_orders: true,
        dtc_verify_before_fulfill: false,
        auto_sync_inventory:
          dtcDefaults?.auto_sync_inventory ?? existingSettings.auto_sync_inventory ?? false,
        auto_sync_prices:
          dtcDefaults?.auto_sync_prices ?? existingSettings.auto_sync_prices ?? false,
        sync_inventory_interval_minutes:
          dtcDefaults?.sync_inventory_interval_minutes ??
          existingSettings.sync_inventory_interval_minutes ??
          60,
        inventory_buffer:
          dtcDefaults?.inventory_buffer ?? existingSettings.inventory_buffer ?? 0,
        default_location_id:
          imsWarehouseId ??
          dtcDefaults?.default_location_id ??
          existingSettings.default_location_id ??
          null,
        fulfillment_notify_customer:
          dtcDefaults?.fulfillment_notify_customer ??
          existingSettings.fulfillment_notify_customer ??
          true,
        shopify_app: appMode,
        connection_mode: connectionModeForApp(appMode),
      },
    })
    .eq('id', integration.id)

  await registerShopifyWebhooks(integration.id, shopDomain, tokenData.access_token)

  await supabase
    .from('client_integrations')
    .update({ webhooks_registered: true })
    .eq('id', integration.id)

  const successRedirect =
    oauthSource === 'dtc' && dtcReturnUrl
      ? `${dtcReturnUrl}${dtcReturnUrl.includes('?') ? '&' : '?'}shopify=connected`
      : `${APP_URL}/portal/integrations?success=shopify_connected`
  const response = NextResponse.redirect(successRedirect)
  response.cookies.delete('shopify_oauth_nonce')

  return response
}
