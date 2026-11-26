import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, Badge, Button, Input, Select, Table, type TableColumn } from '../../components/ui';
import { useAuth } from '../../contexts/AuthContext';
import { formatDate, formatNumber } from '../../lib/format';
import { parseApiError } from '../../lib/http';
import { orderApi, type Expedition, type ReadyToShip, type ShipmentRow } from '../../lib/api/order';
import { MSG_REQUIRED } from '../../lib/validation';
import { Card, PageHeader, today, useLoad } from './shared';

// SCR-16 Pengiriman (FSD 2.15). Catat hanya PPIC; PIMPINAN melihat daftar.

export default function ShipmentPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const canCreate = user?.role_code === 'PPIC';

  const list = useLoad(() => orderApi.shipments({}), []);
  const orders = useLoad(() => (canCreate ? orderApi.orders({ status: 'DALAM_PRODUKSI' }) : Promise.resolve({ rows: [] })), [canCreate]);

  const [orderId, setOrderId] = useState('');
  const [ready, setReady] = useState<ReadyToShip | null>(null);
  const [expeditions, setExpeditions] = useState<Expedition[]>([]);
  const [form, setForm] = useState({ ship_date: today(), expedition_id: '', destination_address: '', package_count: '' });
  const [qty, setQty] = useState<Record<string, string>>({}); // kunci: order_detail_id|ukuran
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Saat order dipilih: muat sisa siap kirim dan ekspedisi yang cakupannya sesuai level order
  useEffect(() => {
    setReady(null);
    setQty({});
    setFormError(null);
    if (!orderId) return;
    orderApi
      .readyToShip(orderId)
      .then(async (r) => {
        setReady(r);
        setForm((f) => ({ ...f, destination_address: `${r.buyer_address}, ${r.buyer_city}` }));
        setExpeditions(await orderApi.expeditions(r.level_code));
      })
      .catch((err) => setFormError(parseApiError(err).message));
  }, [orderId]);

  async function save() {
    const e: Record<string, string> = {};
    if (!form.expedition_id) e.expedition_id = MSG_REQUIRED;
    if (!form.destination_address.trim()) e.destination_address = MSG_REQUIRED;
    const items = Object.entries(qty)
      .filter(([, v]) => Number(v) > 0)
      .map(([key, v]) => {
        const [order_detail_id, size] = key.split('|');
        return { order_detail_id, size, qty: Number(v) };
      });
    // Batas per ukuran dari ready-to-ship; backend tetap memeriksa ulang (ERR-KRM-02)
    ready?.styles.forEach((s) =>
      s.sizes.forEach((z) => {
        const v = Number(qty[`${s.order_detail_id}|${z.size}`] ?? 0);
        if (v > z.ready_qty)
          e[`${s.order_detail_id}|${z.size}`] = `Jumlah kiriman style ${s.item_code} melebihi barang siap kirim (maksimum: ${z.ready_qty}).`;
      }),
    );
    if (items.length === 0) setFormError('Isi jumlah kiriman minimal satu ukuran. Nilai harus lebih dari 0.');
    setErrors(e);
    if (Object.keys(e).length > 0 || items.length === 0) return;

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

  const columns: TableColumn<ShipmentRow>[] = [
    { key: 'delivery_note_no', header: 'No. Surat Jalan' },
    { key: 'ship_date', header: 'Tanggal Kirim', render: (r) => formatDate(r.ship_date) },
    { key: 'order_code', header: 'Order' },
    { key: 'buyer_name', header: 'Buyer' },
    { key: 'expedition_name', header: 'Ekspedisi' },
    { key: 'total_qty', header: 'Jumlah', align: 'right', render: (r) => formatNumber(r.total_qty) },
    { key: 'status', header: 'Status', render: (r) => <Badge status={r.status} /> },
    ...(canCreate
      ? [{ key: 'sj', header: '', render: (r: ShipmentRow) => <Link className="text-brand hover:underline" to={`/pengiriman/${r.id}/surat-jalan`}>Surat jalan</Link> }]
      : []),
  ];

  return (
    <div className="space-y-5">
      <PageHeader code="SCR-16" title="Pengiriman" />

      {canCreate && (
        <Card title="Catat pengiriman">
          {formError && <Alert className="mb-4" variant="danger" message={formError} />}
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Order (Dalam Produksi)"
              required
              placeholder={orders.loading ? 'Memuat...' : 'Pilih order'}
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              options={(orders.data?.rows ?? []).map((o) => ({ value: o.order_id, label: `${o.order_code} — ${o.buyer_name}` }))}
              hint={!orders.loading && (orders.data?.rows.length ?? 0) === 0 ? 'Belum ada order berstatus Dalam Produksi.' : undefined}
            />
            <Input label="Tanggal kirim" type="date" required value={form.ship_date} onChange={(e) => setForm({ ...form, ship_date: e.target.value })} />
            <Select
              label="Ekspedisi"
              required
              placeholder="Pilih ekspedisi"
              value={form.expedition_id}
              onChange={(e) => setForm({ ...form, expedition_id: e.target.value })}
              options={expeditions.map((x) => ({ value: x.id, label: x.expedition_name }))}
              error={errors.expedition_id}
            />
            <Input label="Jumlah koli" type="number" value={form.package_count} onChange={(e) => setForm({ ...form, package_count: e.target.value })} />
            <Input
              label="Alamat tujuan"
              required
              containerClassName="sm:col-span-2"
              value={form.destination_address}
              onChange={(e) => setForm({ ...form, destination_address: e.target.value })}
              error={errors.destination_address}
            />
          </div>

          {ready && (
            <div className="mt-5 space-y-3">
              <p className="text-sm font-medium text-ink">Jumlah kiriman per style dan ukuran</p>
              {ready.styles.map((s) => (
                <div key={s.order_detail_id} className="rounded-lg border border-line p-3">
                  <p className="text-sm font-medium">
                    {s.item_code} — {s.item_name} ({s.color})
                  </p>
                  <div className="mt-2 flex flex-wrap gap-3">
                    {s.sizes.map((z) => {
                      const key = `${s.order_detail_id}|${z.size}`;
                      return (
                        <Input
                          key={key}
                          label={`${z.size} (maks ${z.ready_qty})`}
                          type="number"
                          min={0}
                          disabled={z.ready_qty === 0}
                          value={qty[key] ?? ''}
                          onChange={(e) => setQty({ ...qty, [key]: e.target.value })}
                          error={errors[key]}
                          containerClassName="w-36"
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
              <div className="flex justify-end">
                <Button loading={saving} onClick={save}>
                  Simpan dan Buat Surat Jalan
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      <Card title="Riwayat pengiriman">
        <Table
          columns={columns}
          data={list.data?.rows ?? []}
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
