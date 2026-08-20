import fs from 'fs'
import pg from 'pg'

const url = fs
  .readFileSync('.env.production', 'utf8')
  .split(/\r?\n/)
  .find((l) => l.startsWith('DATABASE_URL='))
  .replace(/^DATABASE_URL=/, '')
  .trim()

const db = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
await db.connect()

const product = await db.query(
  `SELECT id, sku, name, active, client_id FROM products WHERE sku = 'HAPA-CAN-12'`
)

const webhooksAug20 = await db.query(
  `SELECT event_type, status, received_at, processed_at, error_message,
          payload->>'name' AS order_name
   FROM webhook_events
   WHERE integration_id = 'ba77676c-2bf4-4c91-85ae-50d4d5479e5e'
     AND received_at >= '2026-08-20'
   ORDER BY received_at DESC
   LIMIT 30`
)

const hapaOrdersEmpty = await db.query(
  `SELECT o.order_number, o.created_at,
          (SELECT COUNT(*)::int FROM outbound_items oi WHERE oi.order_id = o.id) AS item_count
   FROM outbound_orders o
   WHERE o.client_id = '8baf482a-8fec-4902-889b-d1a85c7a4e1c'
     AND o.external_platform = 'shopify'
   ORDER BY o.created_at DESC
   LIMIT 10`
)

const integration = await db.query(
  `SELECT status, token_expires_at, refresh_token IS NOT NULL AS has_refresh,
          updated_at, status_message
   FROM client_integrations WHERE id = 'ba77676c-2bf4-4c91-85ae-50d4d5479e5e'`
)

console.log(
  JSON.stringify(
    { product: product.rows, webhooksAug20: webhooksAug20.rows, hapaOrdersEmpty: hapaOrdersEmpty.rows, integration: integration.rows[0] },
    null,
    2
  )
)
await db.end()
