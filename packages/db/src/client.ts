import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { findUp } from 'find-up';
import { config } from 'dotenv';
import * as schema from './schema/index.js';

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

async function loadEnv() {
  const envPath = await findUp('.env');
  if (envPath) config({ path: envPath });
}

export async function getDb() {
  if (_db) return _db;

  await loadEnv();

  if (process.env['SKIP_DB_CHECK'] === 'true') {
    // Return a stub during CI builds that skip the DB
    return null as unknown as ReturnType<typeof drizzle<typeof schema>>;
  }

  const connectionString = process.env['DATABASE_URL'];
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is required. Copy .env.example to .env');
  }

  const sql = postgres(connectionString, { max: 10, idle_timeout: 30 });
  _db = drizzle(sql, { schema });
  return _db;
}

export type Db = Awaited<ReturnType<typeof getDb>>;
