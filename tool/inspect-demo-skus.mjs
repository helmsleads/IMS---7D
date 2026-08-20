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

const skus = [
  'WINE-CAB-2019-750',
  'BEER-IPA-473',
  'SPIRIT-SCOTCH-12YR-750',
  'WHISKY-SML-12YR',
]

const matching = await db.query(
  `SELECT p.sku, p.name, c.company_name, p.client_id
   FROM products p
   JOIN clients c ON c.id = p.client_id
   WHERE p.sku = ANY($1::text[])`,
  [skus]
)

const clients = ['17556ca6-058a-4cf8-9993-725834317e05', 'e37c2661-353f-4210-8e70-54e1547f4918']
for (const clientId of clients) {
  const r = await db.query(
    `SELECT c.company_name, COUNT(p.id)::int AS n
     FROM clients c
     LEFT JOIN products p ON p.client_id = c.id
     WHERE c.id = $1
     GROUP BY c.company_name`,
    [clientId]
  )
  console.log(r.rows[0])
}

console.log(JSON.stringify({ matchingSkusInIms: matching.rows }, null, 2))
await db.end()
