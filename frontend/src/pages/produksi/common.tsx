import { orderApi, type OrderSummary } from '../../lib/api/order';
import { produksiApi, type SpkRow } from '../../lib/api/produksi';
import { useLoad } from '../order/shared';

// Bantuan bersama halaman modul C (Produksi).
// Tampilan memakai komponen A (components/ui) dan pola halaman B (Card, DataTable, PageHeader, useLoad)
// supaya semua layar terlihat seragam sesuai design system FSD Gambar 3.0.

/** Order yang boleh diproses produksi: Disetujui atau Dalam Produksi (ERR-SPK-01). */
export function useProductionOrders() {
  return useLoad(async () => {
    const [approved, inProduction] = await Promise.all([
      orderApi.orders({ status: 'DISETUJUI', per_page: 100 }),
      orderApi.orders({ status: 'DALAM_PRODUKSI', per_page: 100 }),
    ]);
    return [...approved.rows, ...inProduction.rows].sort((a, b) => a.order_code.localeCompare(b.order_code));
  }, []);
}

export const orderLabel = (o: OrderSummary) => `${o.order_code} · ${o.buyer_code}`;

/** SPK yang sudah disetujui, untuk dropdown SCR-12 dan SCR-13. */
export function useApprovedSpk() {
  return useLoad(() => produksiApi.spkList({ status: 'DISETUJUI' }), []);
}

export const spkLabel = (s: SpkRow) => `${s.spk_no} · ${s.order_code} · ${s.item_code}`;

/** Mengubah angka dari input (string) menjadi number; kosong = NaN. */
export function toNumber(value: string): number {
  return value.trim() === '' ? Number.NaN : Number(value);
}

/** Pesan di bawah form: kosong, info, atau error. */
export function Hint({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-ink-muted">{children}</p>;
}
