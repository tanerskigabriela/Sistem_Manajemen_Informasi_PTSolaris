import type { ReactNode } from 'react';
import type { PaginationMeta } from '../../types/api';
import { Alert } from './Alert';
import { Button } from './Button';

export interface TableColumn<T> {
  key: string;
  header: string;
  align?: 'left' | 'center' | 'right';
  className?: string;
  render?: (row: T, index: number) => ReactNode;
}

export interface TableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  rowKey: (row: T, index: number) => string | number;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  emptyMessage?: string;
  meta?: PaginationMeta;
  onPageChange?: (page: number) => void;
}

const ALIGN_CLASSES = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
};

export function Table<T>({
  columns,
  data,
  rowKey,
  loading = false,
  error = null,
  onRetry,
  emptyMessage = 'Belum ada data untuk ditampilkan.',
  meta,
  onPageChange,
}: TableProps<T>) {
  // Kondisi 1: Error + tombol Coba lagi (R-11)
  if (error) {
    return (
      <Alert
        variant="danger"
        title="Gagal memuat data"
        message={error}
        onRetry={onRetry}
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-xs">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-line text-sm">
          <thead className="bg-surface-muted/70">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={[
                    'px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink-muted whitespace-nowrap',
                    ALIGN_CLASSES[col.align ?? 'left'],
                    col.className ?? '',
                  ].join(' ')}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-line bg-surface">
            {/* Kondisi 2: Memuat */}
            {loading ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-10 text-center text-sm text-ink-muted"
                >
                  Memuat data...
                </td>
              </tr>
            ) : data.length === 0 ? (
              /* Kondisi 3: Kosong */
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-10 text-center text-sm text-ink-muted"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              /* Kondisi 4: Ada data */
              data.map((row, index) => (
                <tr
                  key={rowKey(row, index)}
                  className="transition-colors hover:bg-canvas/70"
                >
                  {columns.map((col) => {
                    const cellContent = col.render
                      ? col.render(row, index)
                      : String(
                          (row as Record<string, unknown>)[col.key] ?? '-',
                        );

                    return (
                      <td
                        key={col.key}
                        className={[
                          'px-4 py-3 text-ink align-top',
                          ALIGN_CLASSES[col.align ?? 'left'],
                          col.className ?? '',
                        ].join(' ')}
                      >
                        {cellContent}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination dari meta API */}
      {meta && onPageChange && (
        <div className="flex flex-col items-center justify-between gap-2 border-t border-line bg-canvas/50 px-4 py-3 text-xs text-ink-muted sm:flex-row">
          <p>
            Halaman <span className="font-semibold text-ink">{meta.current_page}</span>{' '}
            dari <span className="font-semibold text-ink">{meta.last_page}</span>{' '}
            (Total <span className="font-semibold text-ink">{meta.total}</span> data)
          </p>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={loading || meta.current_page <= 1}
              onClick={() => onPageChange(meta.current_page - 1)}
            >
              Sebelumnya
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={loading || meta.current_page >= meta.last_page}
              onClick={() => onPageChange(meta.current_page + 1)}
            >
              Berikutnya
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}