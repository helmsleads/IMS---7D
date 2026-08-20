import fs from 'fs'
import pg from 'pg'

const orderId = process.argv[2]
if (!orderId) {
  console.error('Usage: node tool/inspect-order.mjs <orderId> [staging|production]')
  process.exit(1)
}

const envFile =
  process.argv[3] === 'production' ? '.env.production' : '.env.staging'
const url = fs
  .readFileSync(envFile, 'utf8')
  .split(/\r?\n/)
  .find((l) => l.startsWith('DATABASE_URL='))
  .replace(/^DATABASE_URL=/, '')
  .trim()

const client = new pg.Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
})
await client.connect()

const order = await client.query(
  `SELECT id, order_number, client_id, status, integration_id, external_platform,
          external_order_number, notes
   FROM outbound_orders WHERE id = $1`,
  [orderId]
)
const items = await client.query(
  `SELECT id, product_id, is_unmatched, virtual_qty, qty_requested, qty_shipped,
          external_sku, external_title
   FROM outbound_items WHERE order_id = $1`,
  [orderId]
)
const mappings = order.rows[0]?.integration_id
  ? await client.query(
      `SELECT product_id, external_sku, external_variant_id
       FROM product_mappings
       WHERE integration_id = $1
         AND (external_sku ILIKE $2 OR external_sku ILIKE $3)`,
      [
        order.rows[0].integration_id,
        'SPIRIT-SCOTCH-12YR-750',
        '%SCOTCH%',
      ]
    )
  : { rows: [] }

const allProducts = order.rows[0]?.client_id
  ? await client.query(
      `SELECT id, sku, name, active FROM products WHERE client_id = $1 ORDER BY sku LIMIT 20`,
      [order.rows[0].client_id]
    )
  : { rows: [] }

const integration = order.rows[0]?.integration_id
  ? (
      await client.query(
        `SELECT id, shop_domain, shop_name, status, status_message,
                access_token IS NOT NULL AS has_token,
                updated_at, client_id
         FROM client_integrations WHERE id = $1`,
        [order.rows[0].integration_id]
      )
    ).rows[0]
  : null

const clientRow = order.rows[0]?.client_id
  ? (
      await client.query(
        `SELECT id, company_name FROM clients WHERE id = $1`,
        [order.rows[0].client_id]
      )
    ).rows[0]
  : null

console.log(
  JSON.stringify(
    {
      order: order.rows[0],
      items: items.rows,
      mappings: mappings.rows,
      integration,
      client: clientRow,
      allProducts: allProducts.rows,
    },
    null,
    2
  )
)
await client.end()
