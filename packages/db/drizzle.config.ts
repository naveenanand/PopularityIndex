import type { Config } from 'drizzle-kit';
import { findUpSync } from 'find-up';
import { config } from 'dotenv';

const envPath = findUpSync('.env');
if (envPath) config({ path: envPath });

export default {
  schema: './src/schema/index.ts',
  out: './src/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env['DATABASE_URL'] ?? 'postgresql://pai_user:pai_password@localhost:5432/pai_db',
  },
} satisfies Config;
