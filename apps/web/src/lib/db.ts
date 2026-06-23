import { getDb } from '@pai/db';

// Cached db connection for Next.js server components
let _db: Awaited<ReturnType<typeof getDb>> | null = null;

export async function db() {
  if (!_db) _db = await getDb();
  return _db;
}
