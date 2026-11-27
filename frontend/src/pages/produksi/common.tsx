import type { FieldValidator } from '../../lib/validation';
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

/** Validator tambahan untuk validateForm: angka harus bilangan bulat (jumlah pcs). */
export function integerNumber(message: string): FieldValidator {
  return (value) => {
    if (value === '' || value === null || value === undefined) return null;
    return Number.isInteger(Number(value)) ? null : message;
  };
}
