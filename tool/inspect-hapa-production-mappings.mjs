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

const hapaClientId = '8baf482a-8fec-4902-889b-d1a85c7a4e1c'

const allHapaMappings = await db.query(
  `SELECT pm.id, pm.created_at, p.sku, pm.external_title, pm.external_sku,
          pm.external_product_id, pm.external_variant_id, ci.shop_domain
   FROM product_mappings pm
   JOIN client_integrations ci ON ci.id = pm.integration_id
   JOIN products p ON p.id = pm.product_id
   WHERE ci.client_id = $1
   ORDER BY pm.created_at DESC`,
  [hapaClientId]
)

const recentOrdersWithItems = await db.query(
  `SELECT o.order_number, o.created_at, o.updated_at,
          oi.id AS item_id, oi.is_unmatched, p.sku, oi.qty_requested
   FROM outbound_orders o
   JOIN outbound_items oi ON oi.order_id = o.id
   LEFT JOIN products p ON p.id = oi.product_id
   WHERE o.client_id = $1
     AND (o.created_at >= '2026-08-19' OR o.updated_at >= '2026-08-19')
   ORDER BY o.updated_at DESC, o.order_number`,
  [hapaClientId]
)

console.log(
  JSON.stringify(
    { allHapaMappings: allHapaMappings.rows, recentOrdersWithItems: recentOrdersWithItems.rows },
    null,
    2
  )
)
await db.end()
