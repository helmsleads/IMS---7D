import fs from 'fs'
import pg from 'pg'

const orderNum = process.argv[2] || 'SH-rpujsi-ji-1631'
const url = fs
  .readFileSync('.env.production', 'utf8')
  .split(/\r?\n/)
  .find((l) => l.startsWith('DATABASE_URL='))
  .replace(/^DATABASE_URL=/, '')
  .trim()

const db = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
await db.connect()

const order = await db.query(
  `SELECT o.*, c.company_name
   FROM outbound_orders o
   LEFT JOIN clients c ON c.id = o.client_id
   WHERE o.order_number = $1`,
  [orderNum]
)
const orderId = order.rows[0]?.id

const items = orderId
  ? (
      await db.query(`SELECT * FROM outbound_items WHERE order_id = $1 ORDER BY id`, [orderId])
    ).rows
  : []

const integration = order.rows[0]?.integration_id
  ? (
      await db.query(`SELECT * FROM client_integrations WHERE id = $1`, [
        order.rows[0].integration_id,
      ])
    ).rows[0]
  : null

const mapping = order.rows[0]?.integration_id
  ? (
      await db.query(
        `SELECT pm.*, p.sku FROM product_mappings pm
         LEFT JOIN products p ON p.id = pm.product_id
         WHERE pm.integration_id = $1`,
        [order.rows[0].integration_id]
      )
    ).rows
  : []

const webhooks = order.rows[0]?.integration_id
  ? (
      await db.query(
        `SELECT event_type, status, received_at, processed_at, error_message, payload->>'id' AS shopify_order_id
         FROM webhook_events
         WHERE integration_id = $1
           AND (payload->>'id' = $2 OR payload->>'name' ILIKE $3 OR payload->>'order_number' = $4)
         ORDER BY received_at DESC NULLS LAST
         LIMIT 20`,
        [
          order.rows[0].integration_id,
          order.rows[0].external_order_id || '',
          `%${order.rows[0].external_order_number?.replace('#', '') || ''}%`,
          order.rows[0].external_order_number?.replace('#', '') || '',
        ]
      )
    ).rows
  : []

const syncLogs = []

console.log(
  JSON.stringify(
    {
      order: order.rows[0],
      items,
      integration: integration
        ? {
            id: integration.id,
            shop_domain: integration.shop_domain,
            status: integration.status,
            status_message: integration.status_message,
            webhooks_registered: integration.webhooks_registered,
            has_token: Boolean(integration.access_token),
            token_expires_at: integration.token_expires_at,
            settings: integration.settings,
            updated_at: integration.updated_at,
          }
        : null,
      mapping,
      webhooks,
      syncLogs,
    },
    null,
    2
  )
)
await db.end()
