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

const integrations = await db.query(
  `SELECT ci.id, ci.shop_domain, ci.status, ci.client_id, c.company_name
   FROM client_integrations ci
   JOIN clients c ON c.id = ci.client_id
   WHERE ci.platform = 'shopify' AND ci.status = 'active'
   ORDER BY c.company_name`
)

const productCounts = await db.query(
  `SELECT c.company_name, c.id AS client_id, COUNT(p.id)::int AS product_count
   FROM clients c
   LEFT JOIN products p ON p.client_id = c.id AND p.active = true
   GROUP BY c.id, c.company_name
   HAVING COUNT(p.id) > 0 OR c.id IN (
     SELECT client_id FROM client_integrations WHERE platform = 'shopify' AND status = 'active'
   )
   ORDER BY c.company_name`
)

const paladarProducts = await db.query(
  `SELECT sku, name, active FROM products
   WHERE client_id IN (SELECT client_id FROM client_integrations WHERE shop_domain ILIKE '%rpujsi%' LIMIT 1)
   ORDER BY sku LIMIT 20`
)

const rls = await db.query(
  `SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('products', 'product_mappings')`
)

const policies = await db.query(
  `SELECT tablename, policyname, cmd, qual FROM pg_policies WHERE tablename IN ('products', 'product_mappings')`
)

console.log(
  JSON.stringify(
    {
      integrations: integrations.rows,
      productCounts: productCounts.rows,
      paladarProducts: paladarProducts.rows,
      rls: rls.rows,
      policies: policies.rows,
    },
    null,
    2
  )
)
await db.end()
