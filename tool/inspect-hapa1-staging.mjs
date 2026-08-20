import fs from 'fs'
import pg from 'pg'

const url = fs
  .readFileSync('.env.staging', 'utf8')
  .split(/\r?\n/)
  .find((l) => l.startsWith('DATABASE_URL='))
  .replace(/^DATABASE_URL=/, '')
  .trim()

const db = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
await db.connect()

const hap = await db.query(
  `SELECT id, company_name FROM clients WHERE company_name ILIKE '%HAPA1%'`
)
const clientId = hap.rows[0]?.id

const integrations = clientId
  ? (
      await db.query(
        `SELECT id, shop_domain, status, status_message,
                access_token IS NOT NULL AS has_token,
                token_expires_at, refresh_token IS NOT NULL AS has_refresh,
                webhooks_registered, settings,
                updated_at
         FROM client_integrations
         WHERE client_id = $1 AND platform = 'shopify'
         ORDER BY updated_at DESC`,
        [clientId]
      )
    ).rows
  : []

const recentOrders = clientId
  ? (
      await db.query(
        `SELECT id, order_number, external_order_number, status, integration_id, created_at, notes
         FROM outbound_orders
         WHERE client_id = $1
         ORDER BY created_at DESC
         LIMIT 10`,
        [clientId]
      )
    ).rows
  : []

const allShopifyOrders = (
  await db.query(
    `SELECT o.id, o.order_number, o.client_id, c.company_name, o.external_order_number, o.created_at
     FROM outbound_orders o
     LEFT JOIN clients c ON c.id = o.client_id
     WHERE o.external_platform = 'shopify'
       AND o.integration_id = '92b9c8bd-5ef8-4397-8149-630cefb83dd7'
     ORDER BY o.created_at DESC
     LIMIT 10`
  )
).rows

let webhookEvents = []
try {
  webhookEvents = (
    await db.query(
      `SELECT event_type, status, event_id, received_at, processed_at, error_message
       FROM webhook_events
       WHERE integration_id = '92b9c8bd-5ef8-4397-8149-630cefb83dd7'
       ORDER BY received_at DESC NULLS LAST
       LIMIT 15`
    )
  ).rows
} catch (e) {
  webhookEvents = [{ error: String(e.message || e) }]
}

console.log(
  JSON.stringify(
    { client: hap.rows[0], integrations, recentOrders, allShopifyOrders, webhookEvents },
    null,
    2
  )
)
await db.end()
