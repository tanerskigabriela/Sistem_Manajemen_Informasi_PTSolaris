import type sql from 'mssql';
import {
  HIDDEN_PRICE_FIELDS,
  PRICE_VISIBLE_ROLES,
  type RoleCode,
} from '../constants';
import type { PoolName } from '../db/pool';
import {
  logActivity,
  type ActivityLogPayload,
} from '../utils/activity-log';
import { withTransaction } from '../utils/transaction';

const HIDDEN_PRICE_FIELD_SET: ReadonlySet<string> = new Set(HIDDEN_PRICE_FIELDS);

function stripPriceFieldsRecursive(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (value instanceof Date) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => stripPriceFieldsRecursive(item));
  }

  if (typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const sanitized: Record<string, unknown> = {};

    for (const [key, entry] of Object.entries(source)) {
      if (HIDDEN_PRICE_FIELD_SET.has(key)) {
        continue;
      }
      sanitized[key] = stripPriceFieldsRecursive(entry);
    }

    return sanitized;
  }

  return value;
}

/**
 * Kelas dasar abstrak untuk lapisan Service (KONTRAK v2 Bagian 8 & 9).
 * Menyediakan penyembunyian kolom harga untuk role non-komersial dan wrapper transaksi SQL.
 */
export abstract class BaseService {
  protected readonly poolName: PoolName;

  constructor(poolName: PoolName = 'rsi') {
    this.poolName = poolName;
  }

  /**
   * Menghapus seluruh field harga (`HIDDEN_PRICE_FIELDS`) secara rekursif dari data response
   * apabila `roleCode` bukan termasuk `PRICE_VISIBLE_ROLES` (MARKETING dan PIMPINAN).
   */
  protected maskPriceFields<T>(data: T, roleCode: string): T {
    if (PRICE_VISIBLE_ROLES.includes(roleCode as RoleCode)) {
      return data;
    }

    return stripPriceFieldsRecursive(data) as T;
  }

  /**
   * Menjalankan operasi bisnis tulis di dalam satu transaksi atomik SQL Server.
   */
  protected async runInTransaction<T>(
    work: (tx: sql.Transaction) => Promise<T>,
    poolName?: PoolName,
  ): Promise<T> {
    return withTransaction(work, poolName ?? this.poolName);
  }

  /**
   * Helper pencatatan log aktivitas di dalam transaksi aktif.
   */
  protected async recordActivity(
    tx: sql.Transaction,
    payload: ActivityLogPayload,
  ): Promise<void> {
    await logActivity(tx, payload);
  }
}
