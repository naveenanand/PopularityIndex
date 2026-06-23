import { getDb } from '@pai/db';

type DbInstance = Awaited<ReturnType<typeof getDb>>;

let _db: DbInstance | null = null;

export async function db(): Promise<DbInstance> {
  if (!_db) _db = await getDb();
  return _db;
}
