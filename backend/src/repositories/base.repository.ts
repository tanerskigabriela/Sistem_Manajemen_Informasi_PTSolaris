import sql from 'mssql';
import { getDb, type DbInstance } from '../db';
import { getPool, type PoolName } from '../db/pool';

export type SpSqlType = sql.ISqlType | (() => sql.ISqlType);

export interface SpInputParam {
  type?: SpSqlType;
  value: unknown;
}

export interface SpNamedInput extends SpInputParam {
  name: string;
}

export type SpInputs = Record<string, SpInputParam> | SpNamedInput[];

export interface FindAllOptions {
  page?: number;
  per_page?: number;
  search?: string;
  filters?: Record<string, unknown>;
}

/**
 * Kelas dasar abstrak untuk lapisan Repository (KONTRAK v2 Bagian 8).
 * Menerapkan enkapsulasi akses koneksi, inheritance, generics, method overloading,
 * dan polymorphism bagi seluruh repository modul A, B, dan C.
 */
export abstract class BaseRepository<T> {
  protected readonly tableName: string;
  protected readonly poolName: PoolName;

  constructor(tableName: string, poolName: PoolName = 'rsi') {
    this.tableName = tableName;
    this.poolName = poolName;
  }

  protected async getPool(poolName?: PoolName): Promise<sql.ConnectionPool> {
    return getPool(poolName ?? this.poolName);
  }

  protected async getDb(poolName?: PoolName): Promise<DbInstance> {
    return getDb(poolName ?? this.poolName);
  }

  /**
   * Menjalankan Stored Procedure di dalam transaksi aktif menggunakan `new sql.Request(tx)`.
   * Mendukung overloading parameter berbentuk objek (map) maupun array bernama.
   */
  protected async executeSp<TResult = Record<string, unknown>>(
    tx: sql.Transaction,
    spName: string,
    inputs?: Record<string, SpInputParam>,
  ): Promise<sql.IProcedureResult<TResult>>;
  protected async executeSp<TResult = Record<string, unknown>>(
    tx: sql.Transaction,
    spName: string,
    inputs?: SpNamedInput[],
  ): Promise<sql.IProcedureResult<TResult>>;
  protected async executeSp<TResult = Record<string, unknown>>(
    tx: sql.Transaction,
    spName: string,
    inputs?: SpInputs,
  ): Promise<sql.IProcedureResult<TResult>> {
    const request = new sql.Request(tx);

    if (Array.isArray(inputs)) {
      for (const param of inputs) {
        if (param.type) {
          request.input(param.name, param.type, param.value);
        } else {
          request.input(param.name, param.value);
        }
      }
    } else if (inputs) {
      for (const [name, param] of Object.entries(inputs)) {
        if (param.type) {
          request.input(name, param.type, param.value);
        } else {
          request.input(name, param.value);
        }
      }
    }

    return request.execute<TResult>(spName);
  }

  abstract findById(id: string): Promise<T | null>;

  abstract findAll(options?: FindAllOptions): Promise<T[]>;
}
