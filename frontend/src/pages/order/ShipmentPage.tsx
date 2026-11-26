import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, Badge, Button, Input, Select } from '../../components/ui';
import { useAuth } from '../../contexts/AuthContext';
import { formatDate, formatNumber } from '../../lib/format';
import { parseApiError } from '../../lib/http';
import { orderApi, type Expedition, type ReadyToShip, type ShipmentRow } from '../../lib/api/order';
import { MSG_REQUIRED } from '../../lib/validation';
import { Card, DataTable, PageHeader, sortSizes, today, useLoad } from './shared';

// SCR-16 Pengiriman (FSD 2.15, mockup Gambar 3.16). Catat hanya PPIC; Pimpinan melihat riwayat.
// Satu surat jalan dapat memuat beberapa style dari order yang sama.

type Style = ReadyToShip['styles'][number];

const cell = 'w-16 rounded-md border border-line-strong bg-surface px-2 py-1 text-center text-sm disabled:bg-surface-muted';

export default function ShipmentPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const canCreate = user?.role_code === 'PPIC';

  const list = useLoad(() => orderApi.shipments({}), []);
  const orders = useLoad(
    () => (canCreate ? orderApi.orders({ status: 'DALAM_PRODUKSI', per_page: 100 }) : Promise.resolve({ rows: [] })),
    [canCreate],
  );

  const [orderId, setOrderId] = useState('');
  const [ready, setReady] = useState<ReadyToShip | null>(null);
  const [expeditions, setExpeditions] = useState<Expedition[]>([]);
  const [form, setForm] = useState({ ship_date: today(), expedition_id: '', destination_address: '', package_count: '' });
  const [checked, setChecked] = useState<Record<string, boolean>>({}); // kunci: order_detail_id
  const [qty, setQty] = useState<Record<string, string>>({}); // kunci: order_detail_id|ukuran
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // 1. Saat order dipilih: muat barang siap kirim dan ekspedisi sesuai level order
  useEffect(() => {
    setReady(null);
    setChecked({});
    setQty({});
    setErrors({});
    setFormError(null);
    if (!orderId) return;
    orderApi
      .readyToShip(orderId)
      .then(async (r) => {
        setReady(r);
        setForm((f) => ({ ...f, expedition_id: '', destination_address: `${r.buyer_address}, ${r.buyer_city}` }));
        setExpeditions(await orderApi.expeditions(r.level_code));
      })
      .catch((err) => setFormError(parseApiError(err).message));
  }, [orderId]);

  const sizes = useMemo(() => sortSizes(ready?.styles.flatMap((s) => s.sizes.map((z) => z.size)) ?? []), [ready]);

  // 4. Centang "Kirim": isi otomatis jumlah = siap kirim per ukuran (masih bisa diubah)
  function toggle(s: Style, on: boolean) {
    setChecked((c) => ({ ...c, [s.order_detail_id]: on }));
    setQty((q) => {
      const next = { ...q };
      s.sizes.forEach((z) => {
        const key = `${s.order_detail_id}|${z.size}`;
        if (on && z.ready_qty > 0) next[key] = String(z.ready_qty);
        else delete next[key];
      });
      return next;
    });
  }

  // 5. Simpan & buat surat jalan
  async function save() {
    const e: Record<string, string> = {};
    if (!orderId) e.order_id = MSG_REQUIRED;
    if (!form.ship_date) e.ship_date = MSG_REQUIRED;
    if (!form.expedition_id) e.expedition_id = MSG_REQUIRED;
    if (!form.destination_address.trim()) e.destination_address = MSG_REQUIRED;

    const items: { order_detail_id: string; size: string; qty: number }[] = [];
    ready?.styles.forEach((s) => {
      if (!checked[s.order_detail_id]) return;
      s.sizes.forEach((z) => {
        const key = `${s.order_detail_id}|${z.size}`;
        const v = Number(qty[key] ?? 0);
        // Batas per ukuran dari ready-to-ship; backend tetap memeriksa ulang (ERR-KRM-02)
        if (v > z.ready_qty) e[key] = `Jumlah kiriman style ${s.item_code} melebihi barang siap kirim (maksimum: ${z.ready_qty}).`;
        if (v > 0) items.push({ order_detail_id: s.order_detail_id, size: z.size, qty: v });
      });
    });
    setErrors(e);
    if (Object.keys(e).length > 0) {
      setFormError(Object.entries(e).find(([k]) => k.includes('|'))?.[1] ?? 'Periksa kembali isian yang ditandai merah.');
      return;
    }
    if (items.length === 0) {
      setFormError('Centang minimal satu style dan isi jumlah kiriman. Nilai harus lebih dari 0.');
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const { data } = await orderApi.createShipment({
        order_id: orderId,
        ship_date: form.ship_date,
        expedition_id: form.expedition_id,
        destination_address: form.destination_address,
        package_count: form.package_count ? Number(form.package_count) : undefined,
        items,
      });
      navigate(`/pengiriman/${data.id}/surat-jalan`);
    } catch (err) {
      setFormError(parseApiError(err).message);
    } finally {
      setSaving(false);
    }
  }

  // 6. Ringkasan per style: jumlah order, terkirim, sisa
  const summary = (ready?.styles ?? []).map((s) => {
    const ordered = s.sizes.reduce((a, z) => a + z.ordered_qty, 0);
    const shipped = s.sizes.reduce((a, z) => a + z.shipped_qty, 0);
    return { id: s.order_detail_id, item_code: s.item_code, ordered, shipped, rest: ordered - shipped };
  });
  const total = summary.reduce((a, r) => ({ ordered: a.ordered + r.ordered, shipped: a.shipped + r.shipped, rest: a.rest + r.rest }), {
    ordered: 0,
    shipped: 0,
    rest: 0,
  });

  return (
    <div className="space-y-5">
      <PageHeader code="SCR-16" title="Pengiriman" subtitle="Satu surat jalan dapat memuat beberapa style dari order yang sama" />

      {canCreate && (
        <Card>
          {formError && <Alert className="mb-4" variant="danger" message={formError} onClose={() => setFormError(null)} />}

          {/* 1-3. Order, tanggal kirim, ekspedisi */}
          <div className="grid gap-4 md:grid-cols-[2fr_1.2fr_2fr]">
            <Select
              label="Order"
              required
              placeholder={orders.loading ? 'Memuat...' : 'Pilih order'}
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              options={(orders.data?.rows ?? []).map((o) => ({ value: o.order_id, label: `${o.order_code} · ${o.buyer_name}` }))}
              hint={!orders.loading && (orders.data?.rows.length ?? 0) === 0 ? 'Belum ada order berstatus Dalam Produksi.' : undefined}
              error={errors.order_id}
            />
            <Input label="Tanggal kirim" type="date" required value={form.ship_date} onChange={(e) => setForm({ ...form, ship_date: e.target.value })} error={errors.ship_date} />
            <Select
              label="Nama ekspedisi"
              required
              placeholder={orderId ? 'Pilih ekspedisi' : 'Pilih order dulu'}
              value={form.expedition_id}
              onChange={(e) => setForm({ ...form, expedition_id: e.target.value })}
              options={expeditions.map((x) => ({ value: x.id, label: x.expedition_name }))}
              error={errors.expedition_id}
            />
          </div>
          {ready && (
            <div className="mt-4 grid gap-4 md:grid-cols-[5.2fr_1fr]">
              <Input
                label="Alamat tujuan"
                required
                value={form.destination_address}
                onChange={(e) => setForm({ ...form, destination_address: e.target.value })}
                error={errors.destination_address}
              />
              <Input label="Jumlah koli" type="number" value={form.package_count} onChange={(e) => setForm({ ...form, package_count: e.target.value })} />
            </div>
          )}

          {/* 4. Pilih style dan jumlah per ukuran */}
          {ready && (
            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-brand-soft text-xs font-semibold text-ink">
                  <tr>
                    <th className="px-3 py-2.5 text-left">Kirim</th>
                    <th className="px-3 py-2.5 text-left">Kode barang</th>
                    <th className="px-3 py-2.5 text-left">Style</th>
                    <th className="px-3 py-2.5 text-left">Warna</th>
                    <th className="px-3 py-2.5 text-left">Siap kirim</th>
                    {sizes.map((z) => (
                      <th key={z} className="px-2 py-2.5 text-center">
                        {z}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ready.styles.map((s, i) => {
                    const on = Boolean(checked[s.order_detail_id]);
                    return (
                      <tr key={s.order_detail_id} className={`border-b border-line ${i % 2 === 1 ? 'bg-surface-muted' : ''}`}>
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            className="h-5 w-5 accent-brand"
                            disabled={s.style_ready_qty === 0}
                            checked={on}
                            onChange={(e) => toggle(s, e.target.checked)}
                          />
                        </td>
                        <td className="px-3 py-2">{s.item_code}</td>
                        <td className="px-3 py-2">{s.item_name}</td>
                        <td className="px-3 py-2">{s.color}</td>
                        <td className="px-3 py-2">{formatNumber(s.style_ready_qty)}</td>
                        {sizes.map((size) => {
                          const z = s.sizes.find((x) => x.size === size);
                          const key = `${s.order_detail_id}|${size}`;
                          return (
                            <td key={size} className="px-2 py-2 text-center">
                              {z && on ? (
                                <input
                                  type="number"
                                  min={0}
                                  max={z.ready_qty}
                                  title={`Maksimum ${z.ready_qty}`}
                                  className={`${cell} ${errors[key] ? 'border-danger' : ''}`}
                                  disabled={z.ready_qty === 0}
                                  value={qty[key] ?? ''}
                                  onChange={(e) => setQty({ ...qty, [key]: e.target.value })}
                                />
                              ) : null}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-5 flex justify-end">
            <Button loading={saving} disabled={!ready} onClick={save} className="px-8">
              Simpan &amp; Buat Surat Jalan
            </Button>
          </div>
        </Card>
      )}

      {/* 6. Ringkasan kiriman order terpilih */}
      {ready && (
        <Card>
          <DataTable
            columns={[
              { key: 'kode', header: 'Kode barang', render: (r: (typeof summary)[number]) => r.item_code },
              { key: 'order', header: 'Jumlah order', render: (r: (typeof summary)[number]) => formatNumber(r.ordered) },
              { key: 'kirim', header: 'Terkirim', render: (r: (typeof summary)[number]) => formatNumber(r.shipped) },
              { key: 'sisa', header: 'Sisa', render: (r: (typeof summary)[number]) => formatNumber(r.rest) },
            ]}
            rows={summary}
            rowKey={(r) => r.id}
            footer={
              <tr className="border-b border-line font-semibold">
                <td className="px-3 py-2.5">Total order</td>
                <td className="px-3 py-2.5">{formatNumber(total.ordered)}</td>
                <td className="px-3 py-2.5">{formatNumber(total.shipped)}</td>
                <td className="px-3 py-2.5">{formatNumber(total.rest)}</td>
              </tr>
            }
          />
        </Card>
      )}

      {/* Riwayat pengiriman (dilihat PPIC dan Pimpinan) */}
      <Card title="Riwayat Pengiriman">
        <DataTable
          columns={[
            { key: 'sj', header: 'No. Surat Jalan', render: (r: ShipmentRow) => r.delivery_note_no },
            { key: 'tgl', header: 'Tanggal kirim', render: (r: ShipmentRow) => formatDate(r.ship_date) },
            { key: 'order', header: 'Order', render: (r: ShipmentRow) => r.order_code },
            { key: 'buyer', header: 'Buyer', render: (r: ShipmentRow) => r.buyer_name },
            { key: 'eksp', header: 'Ekspedisi', render: (r: ShipmentRow) => r.expedition_name },
            { key: 'qty', header: 'Jumlah', align: 'right', render: (r: ShipmentRow) => formatNumber(r.total_qty) },
            { key: 'status', header: 'Status', render: (r: ShipmentRow) => <Badge status={r.status} /> },
            ...(canCreate
              ? [
                  {
                    key: 'aksi',
                    header: 'Aksi',
                    render: (r: ShipmentRow) => (
                      <Link className="font-semibold underline hover:text-brand" to={`/pengiriman/${r.id}/surat-jalan`}>
                        Surat jalan
                      </Link>
                    ),
                  },
                ]
              : []),
          ]}
          rows={list.data?.rows ?? []}
          rowKey={(r) => r.id}
          loading={list.loading}
          error={list.error}
          onRetry={list.reload}
          emptyMessage="Belum ada pengiriman."
        />
      </Card>
    </div>
  );
}
