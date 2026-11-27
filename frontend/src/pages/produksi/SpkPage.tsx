import { useEffect, useState } from 'react';
import { Alert, Badge, Button, Checkbox, Input, Select } from '../../components/ui';
import { useAuth } from '../../contexts/AuthContext';
import { orderApi } from '../../lib/api/order';
import { produksiApi, type SpkRow } from '../../lib/api/produksi';
import { formatDate, formatNumber, formatStatus } from '../../lib/format';
import { parseApiError, toFieldErrorMap } from '../../lib/http';
import { MSG_POSITIVE_NUMBER, MSG_REQUIRED, mustBeChecked, positiveNumber, required, validateForm } from '../../lib/validation';
import { Card, DataTable, PageHeader, sortSizes, useLoad, type Col } from '../order/shared';
import { integerNumber, orderLabel, toNumber, useProductionOrders } from './common';

// SCR-11 Surat Perintah Kerja (FSD-2.10, mockup Gambar 3.11).
// PPIC: form Ajukan SPK + daftar semua SPK.
// Pimpinan: daftar semua SPK (persetujuan di SCR-08). Supervisor dan QC: hanya SPK Disetujui (RB-35).

export default function SpkPage() {
  const { user } = useAuth();
  const isPpic = user?.role_code === 'PPIC';
  const onlyApproved = user?.role_code === 'SPV' || user?.role_code === 'QC';

  const list = useLoad(() => produksiApi.spkList(), []);
  const [flash, setFlash] = useState<string | null>(null);

  const columns: Col<SpkRow>[] = [
    { key: 'no', header: 'Nomor SPK', render: (s) => <span className="font-semibold">{s.spk_no}</span> },
    { key: 'order', header: 'Order', render: (s) => s.order_code },
    { key: 'style', header: 'Style', render: (s) => `${s.item_code} · ${s.color}` },
    { key: 'lini', header: 'Lini', render: (s) => s.line_name },
    { key: 'jumlah', header: 'Jumlah', align: 'right', render: (s) => formatNumber(s.total_qty) },
    { key: 'target', header: 'Target', render: (s) => formatDate(s.target_date) },
    { key: 'status', header: 'Status', render: (s) => <Badge status={s.status} /> },
  ];

  return (
    <div>
      <PageHeader
        code="SCR-11"
        title={onlyApproved ? 'SPK Disetujui' : 'Surat Perintah Kerja (SPK)'}
        subtitle="Satu SPK untuk satu style"
      />

      {flash && <Alert className="mb-4" variant="success" message={flash} onClose={() => setFlash(null)} />}

      {isPpic && (
        <SubmitSpkForm
          onDone={async (message) => {
            setFlash(message);
            await list.reload();
          }}
        />
      )}

      {/* 6. Daftar SPK */}
      <Card title="Daftar SPK">
        <DataTable
          columns={columns}
          rows={list.data?.rows ?? []}
          rowKey={(s) => s.spk_id}
          loading={list.loading}
          error={list.error}
          onRetry={list.reload}
          emptyMessage={onlyApproved ? 'Belum ada SPK yang disetujui.' : 'Belum ada SPK.'}
        />
      </Card>
    </div>
  );
}

function SubmitSpkForm({ onDone }: { onDone: (message: string) => Promise<void> }) {
  const orders = useProductionOrders();
  const [orderId, setOrderId] = useState('');
  const [styleId, setStyleId] = useState('');
  const [lineId, setLineId] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [sizes, setSizes] = useState<{ size: string; qty: string }[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const order = useLoad(() => (orderId ? orderApi.order(orderId) : Promise.resolve(null)), [orderId]);
  // Status kesiapan bahan setiap style di order terpilih (ditampilkan di dropdown Style)
  const readiness = useLoad(async () => {
    const details = order.data?.details ?? [];
    const headers = await Promise.all(details.map((d) => produksiApi.styleMaterials(d.id)));
    return Object.fromEntries(headers.map((h) => [h.order_detail_id.toUpperCase(), h.readiness]));
  }, [order.data]);
  const lines = useLoad(() => (styleId ? produksiApi.productionLines(styleId) : Promise.resolve([])), [styleId]);

  const details = order.data?.details ?? [];
  const style = details.find((d) => d.id === styleId);

  // Jumlah per ukuran terisi awal dari jumlah style di order (FSD-2.10 Step 1)
  useEffect(() => {
    if (!style) {
      setSizes([]);
      return;
    }
    const bySize = new Map(style.sizes.map((z) => [z.size, z.qty - z.cancelled_qty]));
    setSizes(sortSizes([...bySize.keys()]).map((size) => ({ size, qty: String(bySize.get(size) ?? 0) })));
  }, [style]);

  useEffect(() => {
    const first = lines.data?.[0];
    setLineId(first ? first.id : '');
  }, [lines.data]);

  function reset() {
    setStyleId('');
    setTargetDate('');
    setConfirmed(false);
    setErrors({});
    setFormError(null);
  }

  async function submit() {
    const e = validateForm(
      { order: orderId, order_detail_id: styleId, line_id: lineId, target_date: targetDate, materials_complete_confirmed: confirmed },
      {
        order: [required()],
        order_detail_id: [required()],
        line_id: [required()],
        target_date: [required()],
        materials_complete_confirmed: [mustBeChecked()],
      },
    );
    // Jumlah per ukuran: setiap baris wajib diisi, bilangan bulat, dan lebih dari 0.
    const sizeRule = [required(), positiveNumber(), integerNumber(MSG_POSITIVE_NUMBER)];
    if (sizes.length === 0) e.sizes = MSG_REQUIRED;
    else {
      const bad = sizes.map((s) => validateForm({ qty: s.qty }, { qty: sizeRule }).qty).find(Boolean);
      if (bad) e.sizes = bad;
    }
    const parsed = sizes.map((s) => ({ size: s.size, qty: toNumber(s.qty) }));
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    setSaving(true);
    setFormError(null);
    try {
      const res = await produksiApi.submitSpk({
        order_detail_id: styleId,
        line_id: lineId,
        target_date: targetDate,
        sizes: parsed,
        materials_complete_confirmed: confirmed,
      });
      reset();
      await onDone(`SPK ${res.data.spk_no} berhasil diajukan dan menunggu persetujuan Pimpinan.`);
    } catch (err) {
      const api = parseApiError(err);
      setFormError(api.message);
      const fe = toFieldErrorMap(api.errors);
      // field "sizes.0.qty" dari backend ditampilkan di bawah kolom jumlah per ukuran
      if (Object.keys(fe).some((k) => k.startsWith('sizes'))) fe.sizes = MSG_POSITIVE_NUMBER;
      setErrors(fe);
    } finally {
      setSaving(false);
    }
  }

  const total = sizes.reduce((a, s) => a + (Number(s.qty) || 0), 0);

  return (
    <Card title="Ajukan SPK" className="mb-5">
      {formError && <Alert className="mb-4" variant="danger" message={formError} />}
      {orders.error && <Alert className="mb-4" variant="danger" title="Gagal memuat order" message={orders.error} onRetry={orders.reload} />}

      <div className="grid gap-4 md:grid-cols-[1fr_1.3fr_0.9fr]">
        {/* 1. Order */}
        <Select
          label="Order"
          required
          placeholder={orders.loading ? 'Memuat...' : 'Pilih order'}
          value={orderId}
          onChange={(e) => {
            setOrderId(e.target.value);
            reset();
          }}
          options={(orders.data ?? []).map((o) => ({ value: o.order_id, label: orderLabel(o) }))}
          error={errors.order}
          hint="Hanya order berstatus Disetujui atau Dalam Produksi."
        />
        {/* 2. Style + status bahan */}
        <Select
          label="Style"
          required
          placeholder={orderId ? 'Pilih style' : 'Pilih order dulu'}
          disabled={!orderId || order.loading}
          value={styleId}
          onChange={(e) => setStyleId(e.target.value)}
          options={details.map((d) => {
            const r = readiness.data?.[d.id.toUpperCase()];
            return {
              value: d.id,
              label: `${d.item_code} · ${d.buyer_style_name ?? d.item_name} · ${d.color}${r ? ` (bahan: ${formatStatus(r)})` : ''}`,
            };
          })}
          error={errors.order_detail_id}
        />
        {/* 4. Target selesai */}
        <Input label="Target selesai" required type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} error={errors.target_date} />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-[2.3fr_0.9fr]">
        {/* 3. Jumlah per ukuran */}
        <div className="space-y-1.5">
          <p className="text-[13px] font-bold text-ink">
            Jumlah per ukuran<span className="ml-0.5 text-danger">*</span>
          </p>
          {sizes.length === 0 ? (
            <p className="rounded-lg border border-line bg-zebra px-3 py-2 text-sm text-ink-muted">Pilih style untuk mengisi jumlah per ukuran.</p>
          ) : (
            <div className="flex flex-wrap items-end gap-3">
              {sizes.map((s, i) => (
                <Input
                  key={s.size}
                  label={s.size}
                  type="number"
                  min={1}
                  containerClassName="w-24"
                  value={s.qty}
                  onChange={(e) => setSizes((all) => all.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))}
                />
              ))}
              <p className="pb-2 text-sm text-ink-muted">Total {formatNumber(total)} pcs</p>
            </div>
          )}
          {errors.sizes && <p className="text-xs font-medium text-danger">{errors.sizes}</p>}
        </div>
        {/* Lini produksi (KONTRAK v2: spk.line_id) */}
        <Select
          label="Lini produksi"
          required
          placeholder={styleId ? (lines.loading ? 'Memuat...' : 'Pilih lini') : 'Pilih style dulu'}
          disabled={!styleId}
          value={lineId}
          onChange={(e) => setLineId(e.target.value)}
          options={(lines.data ?? []).map((l) => ({ value: l.id, label: `${l.line_name} · ${l.supervisor_name}` }))}
          error={errors.line_id}
        />
      </div>

      <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* 7. Pernyataan bahan lengkap */}
        <Checkbox
          label="Bahan baku style ini sudah lengkap. Setelah SPK diajukan, data bahan style tidak dapat ditambah atau diubah."
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          error={errors.materials_complete_confirmed}
        />
        {/* 5. Ajukan SPK */}
        <Button className="shrink-0 px-8" loading={saving} onClick={submit}>
          Ajukan SPK
        </Button>
      </div>
    </Card>
  );
}
