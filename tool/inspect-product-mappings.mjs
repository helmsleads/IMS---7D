import fs from 'fs'
import pg from 'pg'

const envFile = process.argv[2] === 'production' ? '.env.production' : '.env.staging'
const sku = process.argv[3] || 'HAPA-CAN-12'
const orderNum = process.argv[4] || 'SH-rpujsi-ji-1631'

const url = fs
  .readFileSync(envFile, 'utf8')
  .split(/\r?\n/)
  .find((l) => l.startsWith('DATABASE_URL='))
  .replace(/^DATABASE_URL=/, '')
  .trim()

const db = new pg.Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
})
await db.connect()

const order = await db.query(
  `SELECT o.id, o.order_number, o.external_order_number, o.client_id, o.integration_id,
          o.status, o.notes, c.company_name
   FROM outbound_orders o
   LEFT JOIN clients c ON c.id = o.client_id
   WHERE o.order_number = $1 OR o.external_order_number ILIKE $1`,
  [orderNum]
)

const products = await db.query(
  `SELECT id, sku, name, client_id FROM products WHERE sku ILIKE $1`,
  [`%${sku}%`]
)
const productIds = products.rows.map((r) => r.id)

const mappingsForSku = productIds.length
  ? await db.query(
      `SELECT pm.id, pm.product_id, pm.integration_id, pm.external_sku, pm.external_title,
              pm.external_product_id, pm.external_variant_id, pm.external_inventory_item_id,
              pm.created_at, pm.last_synced_at,
              p.sku AS ims_sku, p.name AS ims_name,
              ci.shop_domain, c.company_name
       FROM product_mappings pm
       JOIN client_integrations ci ON ci.id = pm.integration_id
       LEFT JOIN clients c ON c.id = ci.client_id
       LEFT JOIN products p ON p.id = pm.product_id
       WHERE pm.product_id = ANY($1::uuid[])
       ORDER BY pm.created_at DESC`,
      [productIds]
    )
  : { rows: [] }

const todayMappings = await db.query(
  `SELECT pm.id, pm.product_id, pm.external_sku, pm.external_title,
          pm.external_variant_id, pm.created_at, pm.last_synced_at,
          p.sku AS ims_sku, ci.shop_domain, c.company_name
   FROM product_mappings pm
   JOIN client_integrations ci ON ci.id = pm.integration_id
   LEFT JOIN clients c ON c.id = ci.client_id
   LEFT JOIN products p ON p.id = pm.product_id
   WHERE pm.created_at >= CURRENT_DATE
   ORDER BY pm.created_at DESC
   LIMIT 100`
)

const orderItems = order.rows[0]?.id
  ? (
      await db.query(
        `SELECT oi.id, oi.product_id, oi.is_unmatched, oi.external_sku, oi.external_title,
                oi.qty_requested, oi.qty_shipped, p.sku, p.name
         FROM outbound_items oi
         LEFT JOIN products p ON p.id = oi.product_id
         WHERE oi.order_id = $1`,
        [order.rows[0].id]
      )
    ).rows
  : []

const recentMappings = await db.query(
  `SELECT pm.id, pm.created_at, p.sku AS ims_sku, pm.external_title, pm.external_sku,
          pm.external_variant_id, ci.shop_domain, c.company_name
   FROM product_mappings pm
   JOIN client_integrations ci ON ci.id = pm.integration_id
   LEFT JOIN clients c ON c.id = ci.client_id
   LEFT JOIN products p ON p.id = pm.product_id
   WHERE pm.created_at >= NOW() - INTERVAL '7 days'
   ORDER BY pm.created_at DESC
   LIMIT 50`
)

if (order.rows[0]?.id) {
  const orderMeta = await db.query(
    `SELECT created_at, updated_at FROM outbound_orders WHERE id = $1`,
    [order.rows[0].id]
  )
  order.rows[0].order_created_at = orderMeta.rows[0]?.created_at
  order.rows[0].order_updated_at = orderMeta.rows[0]?.updated_at
}

console.log(
  JSON.stringify(
    {
      env: envFile,
      order: order.rows[0] ?? null,
      orderItems,
      products: products.rows,
      mappingsForSku: mappingsForSku.rows,
      todayMappings: todayMappings.rows,
      recentMappings: recentMappings.rows,
    },
    null,
    2
  )
)

await db.end()
