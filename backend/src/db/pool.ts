import sql from 'mssql';

export type PoolName = 'rsi' | 'smbd';

const pools: Partial<Record<PoolName, sql.ConnectionPool>> = {};
const connecting: Partial<Record<PoolName, Promise<sql.ConnectionPool>>> = {};

function buildConfig(poolName: PoolName): sql.config {
  const isSmbdConfigured =
    poolName === 'smbd' && Boolean(process.env.DB_SMBD_USER);

  const user = isSmbdConfigured
    ? (process.env.DB_SMBD_USER as string)
    : (process.env.DB_USER ?? 'app_rsi');

  const password = isSmbdConfigured
    ? (process.env.DB_SMBD_PASSWORD ?? '')
    : (process.env.DB_PASSWORD ?? '');

  return {
    server: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 1433),
    database: process.env.DB_NAME ?? 'solaris_db',
    user,
    password,
    options: {
      encrypt: false,
      trustServerCertificate: true,
    },
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000,
    },
  };
}

/**
 * Mengambil connection pool SQL Server.
 * Tahap awal menggunakan satu login default (`app_rsi`) sesuai RENCANA-TAHAP-2 Bagian 4.
 * Parameter `'smbd'` sudah disiapkan untuk tahap SMBD (fallback ke `'rsi'` bila DB_SMBD_USER belum diset).
 */
export async function getPool(
  poolName: PoolName = 'rsi',
): Promise<sql.ConnectionPool> {
  const effectivePool: PoolName =
    poolName === 'smbd' && process.env.DB_SMBD_USER ? 'smbd' : 'rsi';

  const existing = pools[effectivePool];
  if (existing && existing.connected) {
    return existing;
  }

  const pending = connecting[effectivePool];
  if (pending) {
    return pending;
  }

  const connectPromise = new sql.ConnectionPool(buildConfig(effectivePool))
    .connect()
    .then((pool) => {
      pools[effectivePool] = pool;
      delete connecting[effectivePool];
      return pool;
    })
    .catch((err) => {
      delete connecting[effectivePool];
      throw err;
    });

  connecting[effectivePool] = connectPromise;
  return connectPromise;
}

export async function closeAllPools(): Promise<void> {
  const entries = Object.entries(pools) as Array<[PoolName, sql.ConnectionPool | undefined]>;
  await Promise.all(
    entries.map(async ([name, pool]) => {
      if (pool && pool.connected) {
        await pool.close();
      }
      delete pools[name];
    }),
  );
}
