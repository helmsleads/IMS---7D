import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const migrationsDir = path.join(root, 'supabase/migrations')

function loadDbUrl(envFile) {
  const content = fs.readFileSync(path.join(root, envFile), 'utf8')
  const line = content.split(/\r?\n/).find((l) => l.startsWith('DATABASE_URL='))
  if (!line) throw new Error(`DATABASE_URL not found in ${envFile}`)
  return line.replace(/^DATABASE_URL=/, '').trim()
}

async function getAppliedVersions(client) {
  const res = await client.query(
    `SELECT version FROM supabase_migrations.schema_migrations`
  )
  return new Set(res.rows.map((r) => r.version))
}

const target = process.argv[2]
const mode = process.argv[3] || 'apply'

const RECENT_MIGRATIONS = [
  '20260729_dtc_cross_login.sql',
  '20260730_password_set_at.sql',
  '20260806_product_cases_per_pallet.sql',
  '20260807_alcohol_restricted_utah_only.sql',
  '20260815_outbound_items_unmatched_shopify.sql',
]

async function inspectFeatures(label, envFile) {
  const url = loadDbUrl(envFile)
  const client = new pg.Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  })
  await client.connect()
  try {
    const cols = await client.query(
      `SELECT table_name, column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND (
           (table_name = 'clients' AND column_name = 'dtc_enabled')
           OR (table_name = 'user_profiles' AND column_name IN ('dtc_user_id', 'password_set_at'))
           OR (table_name = 'products' AND column_name = 'cases_per_pallet')
           OR (table_name = 'outbound_items' AND column_name IN ('is_unmatched', 'virtual_qty'))
         )
       ORDER BY 1, 2`
    )
    const setting = await client.query(
      `SELECT setting_value
       FROM system_settings
       WHERE category = 'dtc' AND setting_key = 'alcohol_restricted_states'`
    )
    const applied = await getAppliedVersions(client)
    const pendingRecent = RECENT_MIGRATIONS.filter(
      (f) => !applied.has(f.replace(/\.sql$/, ''))
    )
    console.log(`\n=== ${label} features ===`)
    console.log(
      'columns:',
      cols.rows.map((r) => `${r.table_name}.${r.column_name}`).join(', ') ||
        '(none)'
    )
    console.log(
      'alcohol_restricted_states:',
      setting.rows[0]?.setting_value ?? '(missing)'
    )
    console.log('pending recent migrations:', pendingRecent.join(', ') || '(none)')
    return pendingRecent
  } finally {
    await client.end()
  }
}

async function applyFiles(label, envFile, files) {
  if (files.length === 0) {
    console.log(`${label}: no migrations to apply`)
    return
  }
  const url = loadDbUrl(envFile)
  const client = new pg.Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  })
  await client.connect()
  try {
    for (const file of files) {
      const version = file.replace(/\.sql$/, '')
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8')
      console.log(`${label}: applying ${version}...`)
      await client.query('BEGIN')
      try {
        await client.query(sql)
        await client.query(
          `INSERT INTO supabase_migrations.schema_migrations (version)
           VALUES ($1)
           ON CONFLICT (version) DO NOTHING`,
          [version]
        )
        await client.query('COMMIT')
        console.log(`${label}: OK ${version}`)
      } catch (err) {
        await client.query('ROLLBACK')
        console.error(`${label}: FAILED ${version}:`, err.message)
        throw err
      }
    }
  } finally {
    await client.end()
  }
}

if (mode === 'inspect') {
  await inspectFeatures('staging', '.env.staging')
  await inspectFeatures('production', '.env.production')
  process.exit(0)
}

const targets =
  target === 'all'
    ? [
        ['staging', '.env.staging'],
        ['production', '.env.production'],
      ]
    : target === 'staging'
      ? [['staging', '.env.staging']]
      : target === 'production'
        ? [['production', '.env.production']]
        : null

if (!targets) {
  console.error(
    'Usage: node tool/apply-pending-migrations.mjs <staging|production|all> [inspect|apply]'
  )
  process.exit(1)
}

for (const [label, envFile] of targets) {
  const pending = await inspectFeatures(label, envFile)
  await applyFiles(label, envFile, pending)
  await inspectFeatures(label, envFile)
}
