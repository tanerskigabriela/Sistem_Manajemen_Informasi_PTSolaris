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
  selectedRowKey?: string | number | null;
  onRowClick?: (row: T, index: number) => void;
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
  selectedRowKey,
  onRowClick,
  loading = false,
  error = null,
  onRetry,
  emptyMessage = 'Belum ada data untuk ditampilkan.',
  meta,
  onPageChange,
}: TableProps<T>) {
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
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-line text-sm">
          <thead className="bg-pale-gold">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={[
                    'px-4 py-3 text-[13px] font-bold text-ink whitespace-nowrap',
                    ALIGN_CLASSES[col.align ?? 'left'],
                    col.className ?? '',
                  ].join(' ')}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-line">
            {loading ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="bg-surface px-4 py-10 text-center text-sm text-ink-muted"
                >
                  Memuat data...
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="bg-surface px-4 py-10 text-center text-sm text-ink-muted"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row, index) => {
                const key = rowKey(row, index);
                const isSelected =
                  selectedRowKey !== undefined &&
                  selectedRowKey !== null &&
                  selectedRowKey === key;

                return (
                  <tr
                    key={key}
                    onClick={onRowClick ? () => onRowClick(row, index) : undefined}
                    className={[
                      'transition-colors',
                      onRowClick ? 'cursor-pointer' : '',
                      isSelected
                        ? 'bg-pale-gold/80 font-semibold shadow-[inset_4px_0_0_0_var(--color-brand)]'
                        : index % 2 === 1
                          ? 'bg-zebra hover:bg-pale-gold/40'
                          : 'bg-surface hover:bg-pale-gold/40',
                    ].join(' ')}
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
                            'px-4 py-3 text-ink align-middle',
                            ALIGN_CLASSES[col.align ?? 'left'],
                            col.className ?? '',
                          ].join(' ')}
                        >
                          {cellContent}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {meta && onPageChange && (
        <div className="flex flex-col items-center justify-between gap-2 border-t border-line bg-amber-tint/50 px-4 py-3 text-xs text-ink-muted sm:flex-row">
          <p>
            Halaman{' '}
            <span className="font-semibold text-ink">{meta.current_page}</span>{' '}
            dari{' '}
            <span className="font-semibold text-ink">{meta.last_page}</span>{' '}
            (Total <span className="font-semibold text-ink">{meta.total}</span>{' '}
            data)
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
