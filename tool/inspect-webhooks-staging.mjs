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

const counts = await db.query(
  `SELECT integration_id, COUNT(*)::int AS n
   FROM webhook_events
   GROUP BY integration_id
   ORDER BY n DESC
   LIMIT 10`
)
const recent = await db.query(
  `SELECT integration_id, event_type, status, received_at, error_message
   FROM webhook_events
   ORDER BY received_at DESC NULLS LAST
   LIMIT 10`
)

console.log(JSON.stringify({ byIntegration: counts.rows, recent: recent.rows }, null, 2))
await db.end()
