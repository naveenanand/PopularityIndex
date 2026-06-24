import { findUp } from 'find-up';
import { config } from 'dotenv';
import { getDb } from '@pai/db';
import { sql } from 'drizzle-orm';

const envPath = await findUp('.env');
if (envPath) config({ path: envPath });

const db = await getDb();

await db.execute(sql`
  CREATE TABLE IF NOT EXISTS "cache_entries" (
    "key" varchar(100) PRIMARY KEY NOT NULL,
    "data" jsonb NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
  )
`);

console.log('cache_entries table created (or already exists)');

const rows = await db.execute(sql`SELECT COUNT(*) as n FROM cache_entries`);
console.log('Rows in cache_entries:', rows.rows[0]);
process.exit(0);
