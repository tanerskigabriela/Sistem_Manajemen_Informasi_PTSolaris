import { Link, useParams } from 'react-router-dom';
import { Alert, Button } from '../../components/ui';
import { formatDate, formatNumber } from '../../lib/format';
import { orderApi, type DeliveryNote } from '../../lib/api/order';
import { sortSizes, useLoad } from './shared';

// SCR-17 Surat Jalan (FSD 2.15, mockup Gambar 3.17). Siap cetak, tanpa harga.
// Backend mengirim satu baris per ukuran; di sini digabung jadi satu baris per style dengan kolom ukuran.

interface Line {
  item_code: string;
  item_name: string;
  color: string;
  qty: Record<string, number>;
  total: number;
}

function toLines(items: DeliveryNote['items']): Line[] {
  const map = new Map<string, Line>();
  for (const it of items) {
    const key = `${it.item_code}|${it.color}`;
    const line = map.get(key) ?? { item_code: it.item_code, item_name: it.item_name, color: it.color, qty: {}, total: 0 };
    line.qty[it.size] = (line.qty[it.size] ?? 0) + it.qty;
    line.total += it.qty;
    map.set(key, line);
  }
  return [...map.values()];
}

export default function DeliveryNotePage() {
  const { id = '' } = useParams();
  const note = useLoad(() => orderApi.deliveryNote(id), [id]);
  const n = note.data;

  if (note.loading) return <p className="text-sm text-ink-muted">Memuat surat jalan...</p>;
  if (note.error || !n)
    return <Alert variant="danger" title="Gagal memuat data" message={note.error ?? 'Data tidak ditemukan.'} onRetry={note.reload} />;

  const lines = toLines(n.items);
  const sizes = sortSizes(n.items.map((it) => it.size));

  return (
    <div className="space-y-5">
      <Link to="/pengiriman" className="text-sm text-brand hover:underline print:hidden">
        ← Kembali ke Pengiriman
      </Link>

      <div className="mx-auto max-w-4xl rounded-xl border border-line bg-surface p-8 text-sm text-ink shadow-md print:border-0 print:p-0 print:shadow-none">
        {/* 1. Kop surat */}
        <div className="flex items-start justify-between border-b-2 border-ink pb-3">
          <div>
            <p className="text-2xl font-bold">{n.factory_name}</p>
            <p className="text-ink-muted">{n.factory_city}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">SURAT JALAN</p>
            <p className="font-semibold">No. {n.delivery_note_no}</p>
          </div>
        </div>

        {/* 2. Data pengiriman */}
        <div className="mt-4 grid gap-x-10 gap-y-2 sm:grid-cols-2">
          <Row label="Tanggal" value={formatDate(n.ship_date)} />
          <Row label="Kode order" value={n.order_code} />
          <Row label="Buyer" value={n.buyer_name} />
          <Row label="Ekspedisi" value={n.expedition_name} />
          <Row label="Alamat tujuan" value={n.destination_address} />
          <Row label="PO buyer" value={n.buyer_po_no ?? '-'} />
        </div>

        {/* 3. Daftar barang */}
        <table className="mt-6 w-full text-sm">
          <thead className="bg-brand-soft text-xs font-semibold">
            <tr>
              <th className="px-2 py-2.5 text-left">No</th>
              <th className="px-2 py-2.5 text-left">Kode barang</th>
              <th className="px-2 py-2.5 text-left">Nama style</th>
              <th className="px-2 py-2.5 text-left">Warna</th>
              {sizes.map((z) => (
                <th key={z} className="px-2 py-2.5 text-left">
                  {z}
                </th>
              ))}
              <th className="px-2 py-2.5 text-left">Jumlah</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={`${l.item_code}|${l.color}`} className="border-b border-line">
                <td className="px-2 py-2">{i + 1}</td>
                <td className="px-2 py-2">{l.item_code}</td>
                <td className="px-2 py-2">{l.item_name}</td>
                <td className="px-2 py-2">{l.color}</td>
                {sizes.map((z) => (
                  <td key={z} className="px-2 py-2">
                    {l.qty[z] ? formatNumber(l.qty[z]) : ''}
                  </td>
                ))}
                <td className="px-2 py-2">{formatNumber(l.total)}</td>
              </tr>
            ))}
            <tr className="font-semibold">
              <td colSpan={4 + sizes.length} className="px-2 py-2 text-right">
                Total
              </td>
              <td className="px-2 py-2">{formatNumber(n.total_qty)}</td>
            </tr>
          </tbody>
        </table>
        <p className="mt-2 text-xs text-ink-muted">
          Jumlah koli: {n.package_count ?? '-'} · Kendaraan: {n.plate_no ?? '-'} · Perkiraan tiba: {formatDate(n.estimated_arrival)}
        </p>

        {/* 4. Tanda tangan */}
        <div className="mt-14 grid grid-cols-3 gap-6">
          {['Dibuat oleh (PPIC)', 'Pengemudi / Ekspedisi', 'Penerima (Buyer)'].map((label, i) => (
            <div key={label}>
              <p className="font-semibold">{label}</p>
              <div className="h-16" />
              <div className="w-4/5 border-t border-ink" />
              <p className="mt-1 text-xs">({i === 0 ? n.recorded_by_name : '..............................'})</p>
            </div>
          ))}
        </div>
      </div>

      {/* 5. Cetak */}
      <div className="flex justify-center print:hidden">
        <Button size="lg" className="px-10" onClick={() => window.print()}>
          Cetak
        </Button>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[7rem_1fr]">
      <span className="text-ink-muted">{label}</span>
      <span className="font-semibold">: {value}</span>
    </div>
  );
}
