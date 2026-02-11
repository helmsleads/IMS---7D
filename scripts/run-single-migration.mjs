import pg from 'pg';
import fs from 'fs';

const databaseUrl = 'postgresql://postgres.qqxbhgwhrgdacekrlxzq:kIcDo0vnpLFzyZx4@aws-1-us-east-1.pooler.supabase.com:5432/postgres';
const client = new pg.Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });

const migrationFile = process.argv[2];
if (!migrationFile) {
  console.error('Usage: node run-single-migration.mjs <migration-file>');
  process.exit(1);
}

async function run() {
  const sql = fs.readFileSync(migrationFile, 'utf8');
  console.log('Connecting...');
  await client.connect();
  console.log('Running migration:', migrationFile);
  await client.query(sql);
  console.log('Done!');
  await client.end();
}

run().catch(e => { console.error(e.message); process.exit(1); });
