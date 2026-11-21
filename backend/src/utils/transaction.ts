import sql from 'mssql';
import { getPool, type PoolName } from '../db/pool';

/**
 * Menjalankan sekumpulan operasi tulis SQL Server di dalam satu transaksi atomik.
 * Seluruh query tulis (termasuk SP dan logActivity) wajib memakai `new sql.Request(transaction)`.
 * Sesuai KONTRAK v1 Bagian 10.1.
 */
export async function withTransaction<T>(
  work: (transaction: sql.Transaction) => Promise<T>,
  poolName: PoolName = 'rsi',
): Promise<T> {
  const transaction = new sql.Transaction(await getPool(poolName));
  await transaction.begin();
  try {
    const result = await work(transaction);
    await transaction.commit();
    return result;
  } catch (error) {
    try {
      await transaction.rollback();
    } catch {
      /* sudah di-rollback SQL Server */
    }
    throw error;
  }
}
