import { Link, useParams } from 'react-router-dom';
import { Alert, Button } from '../../components/ui';
import { formatDate, formatNumber } from '../../lib/format';
import { orderApi } from '../../lib/api/order';
import { useLoad } from './shared';

// SCR-17 Surat Jalan (FSD 2.15). Halaman siap cetak, tanpa harga.

export default function DeliveryNotePage() {
  const { id = '' } = useParams();
  const note = useLoad(() => orderApi.deliveryNote(id), [id]);
  const n = note.data;

  if (note.loading) return <p className="text-sm text-ink-muted">Memuat surat jalan...</p>;
  if (note.error || !n)
    return <Alert variant="danger" title="Gagal memuat data" message={note.error ?? 'Data tidak ditemukan.'} onRetry={note.reload} />;

  return (
    <div className="space-y-4">
      <div className="flex justify-between print:hidden">
        <Link to="/pengiriman" className="text-sm text-brand hover:underline">
          ← Kembali ke Pengiriman
        </Link>
        <Button onClick={() => window.print()}>Cetak</Button>
      </div>

      <div className="mx-auto max-w-3xl rounded-xl border border-line bg-surface p-8 text-sm text-ink print:border-0 print:p-0">
        <div className="flex justify-between border-b border-line-strong pb-4">
          <div>
            <p className="text-lg font-bold">{n.factory_name}</p>
            <p className="text-ink-muted">{n.factory_address}, {n.factory_city}</p>
            <p className="text-ink-muted">Telp. {n.factory_phone}</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold">SURAT JALAN</p>
            <p className="font-mono">{n.delivery_note_no}</p>
            <p>Tanggal: {formatDate(n.ship_date)}</p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-ink-muted">Kepada</p>
            <p className="font-medium">{n.buyer_name}</p>
            <p>{n.destination_address}</p>
            <p>Telp. {n.buyer_phone}</p>
          </div>
          <div>
            <p className="text-xs text-ink-muted">Referensi</p>
            <p>Order: {n.order_code}</p>
            <p>PO buyer: {n.buyer_po_no ?? '-'}</p>
            <p>Ekspedisi: {n.expedition_name} ({n.expedition_contact}, {n.expedition_phone})</p>
            <p>Kendaraan: {n.plate_no ?? '-'} · Dari gudang: {n.warehouse_name}</p>
          </div>
        </div>

        <table className="mt-6 w-full border-collapse text-sm">
          <thead>
            <tr className="border-y border-line-strong text-left">
              <th className="py-2">No</th>
              <th>Kode Barang</th>
              <th>Nama Barang</th>
              <th>Warna</th>
              <th>Ukuran</th>
              <th className="text-right">Jumlah</th>
            </tr>
          </thead>
          <tbody>
            {n.items.map((it) => (
              <tr key={it.line_no} className="border-b border-line">
                <td className="py-1.5">{it.line_no}</td>
                <td>{it.item_code}</td>
                <td>{it.item_name}</td>
                <td>{it.color}</td>
                <td>{it.size}</td>
                <td className="text-right">{formatNumber(it.qty)}</td>
              </tr>
            ))}
            <tr className="font-semibold">
              <td colSpan={5} className="py-2 text-right">Total</td>
              <td className="text-right">{formatNumber(n.total_qty)} pcs</td>
            </tr>
          </tbody>
        </table>

        <p className="mt-2 text-xs text-ink-muted">
          Jumlah koli: {n.package_count ?? '-'} · Berat: {n.total_weight_kg ?? '-'} kg · Perkiraan tiba: {formatDate(n.estimated_arrival)}
        </p>

        <div className="mt-12 grid grid-cols-3 gap-4 text-center">
          {['Dibuat oleh', 'Pengirim (ekspedisi)', 'Penerima'].map((label, i) => (
            <div key={label}>
              <p>{label}</p>
              <div className="h-16" />
              <p className="border-t border-line-strong pt-1">{i === 0 ? n.recorded_by_name : '(............................)'}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
