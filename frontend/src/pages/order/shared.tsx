import { useCallback, useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Alert } from '../../components/ui';
import { parseApiError } from '../../lib/http';

// Bantuan kecil yang dipakai semua halaman modul B.
// Warna memakai token tema milik A (brand, surface, line, ...), jadi ikut berubah
// otomatis saat A menyesuaikan tema dengan design system FSD Gambar 3.0.

// Judul layar + subjudul "SCR-xx · keterangan" seperti mockup FSD
export function PageHeader({
  code,
  title,
  subtitle,
  actions,
}: {
  code: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-3xl font-bold text-ink">{title}</h1>
        <p className="mt-1 text-xs text-ink-muted">
          {code}
          {subtitle ? ` · ${subtitle}` : ''}
        </p>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, children, className = '' }: { title?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-line bg-surface p-5 ${className}`}>
      {title && <h2 className="mb-4 text-xl font-semibold text-ink">{title}</h2>}
      {children}
    </section>
  );
}

// Tabel sederhana gaya mockup: header berwarna lembut, baris zebra,
// baris bisa diklik dan baris terpilih diberi garis di kiri.
export interface Col<T> {
  key: string;
  header: ReactNode;
  align?: 'left' | 'right' | 'center';
  render: (row: T, index: number) => ReactNode;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  selectedKey,
  loading,
  error,
  onRetry,
  emptyMessage = 'Belum ada data untuk ditampilkan.',
  footer,
}: {
  columns: Col<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  selectedKey?: string | null;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  emptyMessage?: string;
  footer?: ReactNode;
}) {
  if (error) return <Alert variant="danger" title="Gagal memuat data" message={error} onRetry={onRetry} />;

  const align = (a?: string) => (a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left');

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-brand-soft">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={`whitespace-nowrap px-3 py-2.5 text-xs font-semibold text-ink ${align(c.align)}`}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={columns.length} className="px-3 py-6 text-center text-ink-muted">
                Memuat data...
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-3 py-6 text-center text-ink-muted">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => {
              const key = rowKey(row);
              const selected = selectedKey === key;
              return (
                <tr
                  key={key}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={[
                    'border-b border-line',
                    selected ? 'bg-brand-soft font-semibold' : i % 2 === 1 ? 'bg-surface-muted' : '',
                    onRowClick ? 'cursor-pointer hover:bg-brand-soft/60' : '',
                  ].join(' ')}
                >
                  {columns.map((c, ci) => (
                    <td
                      key={c.key}
                      className={`whitespace-nowrap px-3 py-2.5 ${align(c.align)} ${ci === 0 && selected ? 'border-l-4 border-brand' : ''}`}
                    >
                      {c.render(row, i)}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
        {footer && <tfoot>{footer}</tfoot>}
      </table>
    </div>
  );
}

// Tombol tab berbentuk pil (SCR-08)
export function PillTabs<K extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { key: K; label: string }[];
  value: K;
  onChange: (key: K) => void;
}) {
  return (
    <div className="mb-4 flex gap-2">
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => onChange(t.key)}
          className={`rounded-lg border px-8 py-2 text-sm font-semibold ${
            value === t.key ? 'border-transparent bg-brand-soft text-ink' : 'border-line-strong bg-surface text-ink'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// Tombol hijau "Setujui" (komponen Button milik A belum punya varian success)
export function SuccessButton({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className="inline-flex items-center justify-center rounded-lg bg-success px-8 py-2 text-sm font-semibold text-surface hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {children}
    </button>
  );
}

// Memuat data dan menyediakan 4 kondisi halaman: memuat, ada data, kosong, error (+ muat ulang)
export function useLoad<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(loader, deps);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await run());
    } catch (err) {
      setError(parseApiError(err).message);
    } finally {
      setLoading(false);
    }
  }, [run]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, loading, error, reload, setData };
}

export const today = () => new Date().toISOString().slice(0, 10);

// Urutan ukuran yang umum supaya kolom ukuran tampil S, M, L, XL, ...
const SIZE_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
export function sortSizes(sizes: string[]): string[] {
  return [...new Set(sizes)].sort((a, b) => {
    const ia = SIZE_ORDER.indexOf(a);
    const ib = SIZE_ORDER.indexOf(b);
    if (ia >= 0 && ib >= 0) return ia - ib;
    if (ia >= 0) return -1;
    if (ib >= 0) return 1;
    return a.localeCompare(b, 'id', { numeric: true });
  });
}
