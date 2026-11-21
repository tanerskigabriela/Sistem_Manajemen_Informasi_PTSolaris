import type sql from 'mssql';
import { drizzle } from 'drizzle-orm/node-mssql';
import { getPool, type PoolName } from './pool';
import * as schema from './schema';

function createDrizzle(pool: sql.ConnectionPool) {
  return drizzle({ client: pool });
}

export type DbInstance = ReturnType<typeof createDrizzle>;

const dbCache: Partial<Record<PoolName, DbInstance>> = {};

/**
 * Menginisialisasi dan mengembalikan instance Drizzle ORM di atas connection pool SQL Server.
 * Digunakan untuk query baca (daftar, detail, dashboard) sesuai KONTRAK v1 Bagian 10.1.
 */
export async function getDb(poolName: PoolName = 'rsi'): Promise<DbInstance> {
  const effectivePool: PoolName =
    poolName === 'smbd' && process.env.DB_SMBD_USER ? 'smbd' : 'rsi';

  const pool = await getPool(effectivePool);

  if (!dbCache[effectivePool]) {
    dbCache[effectivePool] = createDrizzle(pool);
  }

  return dbCache[effectivePool] as DbInstance;
}

export { schema };