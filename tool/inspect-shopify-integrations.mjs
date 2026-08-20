import fs from 'fs'
import pg from 'pg'

const envFile = process.argv[2] === 'production' ? '.env.production' : '.env.staging'
const orderId = process.argv[3] || 'add2b7dc-1c7f-4f12-9f11-e25ec1b8e847'
const shopHint = process.argv[4] || 'xc1uiz-gy'

const url = fs
  .readFileSync(envFile, 'utf8')
  .split(/\r?\n/)
  .find((l) => l.startsWith('DATABASE_URL='))
  .replace(/^DATABASE_URL=/, '')
  .trim()

const db = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
await db.connect()

const order = (
  await db.query(
    `SELECT id, order_number, client_id, integration_id, external_order_number, notes
     FROM outbound_orders WHERE id = $1`,
    [orderId]
  )
).rows[0]

const clientIntegrations = order?.client_id
  ? (
      await db.query(
        `SELECT id, shop_domain, shop_name, status, status_message,
                access_token IS NOT NULL AS has_token,
                token_expires_at, scope,
                settings->>'connection_mode' AS connection_mode,
                settings->>'shopify_app' AS shopify_app,
                updated_at, created_at
         FROM client_integrations
         WHERE client_id = $1 AND platform = 'shopify'
         ORDER BY updated_at DESC`,
        [order.client_id]
      )
    ).rows
  : []

const shopIntegrations = (
  await db.query(
    `SELECT id, client_id, shop_domain, shop_name, status, status_message,
            access_token IS NOT NULL AS has_token,
            token_expires_at, scope,
            settings->>'connection_mode' AS connection_mode,
            settings->>'shopify_app' AS shopify_app,
            updated_at
     FROM client_integrations
     WHERE platform = 'shopify' AND shop_domain ILIKE $1
     ORDER BY updated_at DESC`,
    [`%${shopHint}%`]
  )
).rows

const orderIntegration = order?.integration_id
  ? (
      await db.query(
        `SELECT id, client_id, shop_domain, shop_name, status, status_message,
                access_token IS NOT NULL AS has_token,
                token_expires_at, scope,
                settings->>'connection_mode' AS connection_mode,
                settings->>'shopify_app' AS shopify_app,
                updated_at
         FROM client_integrations WHERE id = $1`,
        [order.integration_id]
      )
    ).rows[0]
  : null

const active = shopIntegrations.find((i) => i.status === 'active')
const activeDetail = active
  ? (
      await db.query(
        `SELECT id, client_id, status, shopify_app, connection_mode,
                token_expires_at, refresh_token IS NOT NULL AS has_refresh,
                access_token IS NOT NULL AS has_token
         FROM client_integrations WHERE id = $1`,
        [active.id]
      )
    ).rows[0]
  : null

const clientIds = [
  ...new Set([
    order?.client_id,
    ...clientIntegrations.map((i) => i.client_id),
    ...shopIntegrations.map((i) => i.client_id),
  ].filter(Boolean)),
]

const clients = clientIds.length
  ? (
      await db.query(
        `SELECT id, company_name FROM clients WHERE id = ANY($1::uuid[])`,
        [clientIds]
      )
    ).rows
  : []

console.log(
  JSON.stringify(
    {
      env: envFile,
      order,
      orderIntegration,
      clientShopifyIntegrations: clientIntegrations,
      shopDomainMatches: shopIntegrations,
      activeIntegrationDetail: activeDetail,
      clients,
      now: new Date().toISOString(),
    },
    null,
    2
  )
)

await db.end()
