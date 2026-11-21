import { AppError } from './errors';

interface SqlErrorLike {
  number?: number;
  message?: string;
  originalError?: { info?: { number?: number; message?: string } };
}

export function sqlErrorNumber(err: unknown): number | undefined {
  const e = err as SqlErrorLike;
  return e?.number ?? e?.originalError?.info?.number;
}

export function sqlErrorMessage(err: unknown): string {
  const e = err as SqlErrorLike;
  return e?.message ?? e?.originalError?.info?.message ?? '';
}

/**
 * Menerjemahkan error SQL Server yang sudah diketahui menjadi AppError berkode FSD.
 * - 51001 'ERR-BHN-01' dari trg_materials_lock
 * - 547   FK/CHECK gagal  -> 422 (data rujukan tidak valid)
 * - 2601/2627 UNIQUE      -> 409
 * Error lain dilempar ulang apa adanya (ditangani error-handler A sebagai ERR-SYS-0x).
 */
export function mapKnownSqlError(
  err: unknown,
  fieldHint?: string,
): never {
  const number = sqlErrorNumber(err);
  const message = sqlErrorMessage(err);

  if (number === 51001 && message.includes('ERR-BHN-01')) {
    throw new AppError(
      409,
      'ERR-BHN-01',
      'Data bahan tidak dapat diubah karena SPK style ini sudah diajukan.',
    );
  }
  if (number === 547) {
    throw new AppError(422, 'ERR-VAL-01', 'Data rujukan tidak valid.', [
      { field: fieldHint ?? 'input', message: 'Data yang dipilih tidak ditemukan atau tidak valid.' },
    ]);
  }
  if (number === 2601 || number === 2627) {
    throw new AppError(409, 'ERR-VAL-01', 'Data yang sama sudah ada.');
  }
  throw err;
}
