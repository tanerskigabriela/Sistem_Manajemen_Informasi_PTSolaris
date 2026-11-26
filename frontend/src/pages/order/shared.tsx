import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { parseApiError } from '../../lib/http';

// Bantuan kecil yang dipakai semua halaman modul B.

export function PageHeader({ code, title, actions }: { code: string; title: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-brand">{code}</p>
        <h1 className="mt-1 text-xl font-semibold text-ink">{title}</h1>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, children, className = '' }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-line bg-surface p-5 shadow-xs ${className}`}>
      {title && <h2 className="mb-4 text-sm font-semibold text-ink">{title}</h2>}
      {children}
    </section>
  );
}

// Memuat data sekali dan menyediakan 4 kondisi halaman: memuat, ada data, kosong, error (+ muat ulang)
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
