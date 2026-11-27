import { useState } from 'react';
import { Alert, Badge, Button, Checkbox, Input, RadioGroup, Select } from '../../components/ui';
import { orderApi } from '../../lib/api/order';
import { produksiApi, type MaterialInput, type OrderMaterial } from '../../lib/api/produksi';
import { formatDate, formatNumber } from '../../lib/format';
import { parseApiError, toFieldErrorMap } from '../../lib/http';
import { MSG_MUST_CHECK, MSG_POSITIVE_NUMBER, MSG_REQUIRED } from '../../lib/validation';
import { Card, DataTable, PageHeader, today, useLoad, type Col } from '../order/shared';
import { orderLabel, toNumber, useProductionOrders } from './common';

// SCR-10 Bahan Baku per Style (FSD-2.9, mockup Gambar 3.10). Hanya PPIC.
// Atas: form Catat / Ubah Bahan. Bawah: status kesiapan style + daftar bahan.
// Bahan dipilih dari master bahan baku (KONTRAK v2), bukan diketik bebas.

interface FormState {
  material_id: string;
  qty: string;
  unit: string;
  source: 'BUYER' | 'SUPPLIER';
  supplier_id: string;
  material_price: string;
  received_date: string;
  eligibility_confirmed: boolean;
}

const emptyForm = (): FormState => ({
  material_id: '',
  qty: '',
  unit: '',
  source: 'SUPPLIER',
  supplier_id: '',
  material_price: '',
  received_date: today(),
  eligibility_confirmed: false,
});

export default function BahanBakuPage() {
  const orders = useProductionOrders();
  const rawMaterials = useLoad(() => produksiApi.rawMaterials(), []);
  const suppliers = useLoad(() => produksiApi.suppliers(), []);

  const [orderId, setOrderId] = useState('');
  const [styleId, setStyleId] = useState('');
  const order = useLoad(() => (orderId ? orderApi.order(orderId) : Promise.resolve(null)), [orderId]);
  const style = useLoad(() => (styleId ? produksiApi.styleMaterials(styleId) : Promise.resolve(null)), [styleId]);

  const [editing, setEditing] = useState<OrderMaterial | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const header = style.data;
  const locked = Boolean(header?.locked);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function startEdit(m: OrderMaterial | null) {
    setEditing(m);
    setErrors({});
    setFormError(null);
    setForm(
      m
        ? {
            material_id: m.material_id,
            qty: String(m.qty),
            unit: m.unit,
            source: m.source,
            supplier_id: m.supplier_id ?? '',
            material_price: m.material_price == null ? '' : String(m.material_price),
            received_date: m.received_date,
            eligibility_confirmed: false,
          }
        : emptyForm(),
    );
  }

  function pickMaterial(id: string) {
    const rm = (rawMaterials.data ?? []).find((r) => r.id === id);
    setForm((f) => ({ ...f, material_id: id, unit: rm?.unit ?? f.unit }));
  }

  function validate(): Record<string, string> {
    const e: Record<string, string> = {};
    if (!orderId) e.order = MSG_REQUIRED;
    if (!styleId) e.style = MSG_REQUIRED;
    if (!form.material_id) e.material_id = MSG_REQUIRED;
    const qty = toNumber(form.qty);
    if (Number.isNaN(qty)) e.qty = MSG_REQUIRED;
    else if (qty <= 0) e.qty = MSG_POSITIVE_NUMBER;
    if (!form.unit.trim()) e.unit = MSG_REQUIRED;
    if (!form.received_date) e.received_date = MSG_REQUIRED;
    if (form.source === 'SUPPLIER') {
      if (!form.supplier_id) e.supplier_id = 'Supplier dan harga bahan wajib diisi untuk bahan dari supplier.';
      // Saat mengubah, harga lama tidak ditampilkan ke PPIC; kosong berarti harga tidak diubah.
      const price = toNumber(form.material_price);
      if (!editing && Number.isNaN(price)) e.material_price = 'Supplier dan harga bahan wajib diisi untuk bahan dari supplier.';
      else if (!Number.isNaN(price) && price <= 0) e.material_price = MSG_POSITIVE_NUMBER;
    }
    if (!form.eligibility_confirmed) e.eligibility_confirmed = MSG_MUST_CHECK;
    return e;
  }

  async function save() {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    const price = toNumber(form.material_price);
    const body: MaterialInput = {
      material_id: form.material_id,
      qty: toNumber(form.qty),
      unit: form.unit.trim(),
      source: form.source,
      supplier_id: form.source === 'SUPPLIER' ? form.supplier_id : null,
      material_price: form.source === 'SUPPLIER' && !Number.isNaN(price) ? price : undefined,
      received_date: form.received_date,
      eligibility_confirmed: form.eligibility_confirmed,
    };
    if (form.source === 'BUYER') body.material_price = null;

    setSaving(true);
    setFormError(null);
    try {
      if (editing) {
        await produksiApi.updateMaterial(editing.id, body);
        setFlash('Bahan berhasil diubah.');
      } else {
        await produksiApi.addMaterial(styleId, body);
        setFlash('Bahan berhasil disimpan.');
      }
      startEdit(null);
      await style.reload();
    } catch (err) {
      const api = parseApiError(err);
      setFormError(api.message);
      setErrors(toFieldErrorMap(api.errors));
      if (api.errorCode === 'ERR-BHN-01') await style.reload();
    } finally {
      setSaving(false);
    }
  }

  const styles = order.data?.details ?? [];
  const materialOptions = (rawMaterials.data ?? []).map((r) => ({
    value: r.id,
    label: `${r.material_name}${r.color ? ` (${r.color})` : ''} · ${r.category_name}`,
  }));

  const columns: Col<OrderMaterial>[] = [
    { key: 'bahan', header: 'Bahan', render: (m) => m.material_name },
    { key: 'jumlah', header: 'Jumlah', align: 'right', render: (m) => `${formatNumber(m.qty)} ${m.unit}` },
    { key: 'asal', header: 'Asal', render: (m) => (m.source === 'BUYER' ? 'Buyer' : m.supplier_name ?? 'Supplier') },
    { key: 'cek', header: 'Diperiksa oleh', render: (m) => `${m.checked_by_name} · ${formatDate(m.received_date)}` },
    {
      key: 'aksi',
      header: 'Aksi',
      render: (m) =>
        locked ? (
          <span className="text-ink-subtle">—</span>
        ) : (
          <button type="button" className="font-semibold text-ink underline hover:text-brand" onClick={() => startEdit(m)}>
            Ubah
          </button>
        ),
    },
  ];

  return (
    <div>
      <PageHeader code="SCR-10" title="Bahan Baku" subtitle="Bahan yang dicatat sudah diperiksa dan dinyatakan layak" />

      {flash && <Alert className="mb-4" variant="success" message={flash} onClose={() => setFlash(null)} />}
      {orders.error && <Alert className="mb-4" variant="danger" title="Gagal memuat order" message={orders.error} onRetry={orders.reload} />}

      <Card title={editing ? `Ubah Bahan · ${editing.material_name}` : 'Catat / Ubah Bahan'} className="mb-5">
        {formError && <Alert className="mb-4" variant="danger" message={formError} />}
        <div className="grid gap-4 md:grid-cols-3">
          {/* 1-3 */}
          <Select
            label="Order"
            required
            placeholder={orders.loading ? 'Memuat...' : 'Pilih order'}
            value={orderId}
            onChange={(e) => {
              setOrderId(e.target.value);
              setStyleId('');
              startEdit(null);
            }}
            options={(orders.data ?? []).map((o) => ({ value: o.order_id, label: orderLabel(o) }))}
            error={errors.order}
          />
          <Select
            label="Style"
            required
            placeholder={orderId ? 'Pilih style' : 'Pilih order dulu'}
            disabled={!orderId || order.loading}
            value={styleId}
            onChange={(e) => {
              setStyleId(e.target.value);
              startEdit(null);
            }}
            options={styles.map((d) => ({ value: d.id, label: `${d.item_code} · ${d.buyer_style_name ?? d.item_name} · ${d.color}` }))}
            error={errors.style}
          />
          <Select
            label="Bahan"
            required
            placeholder={rawMaterials.loading ? 'Memuat...' : 'Pilih bahan'}
            disabled={locked}
            value={form.material_id}
            onChange={(e) => pickMaterial(e.target.value)}
            options={materialOptions}
            error={errors.material_id}
          />

          {/* 4-7 */}
          <div className="grid grid-cols-2 gap-3">
            <Input label="Jumlah" required type="number" min={0} step="any" disabled={locked} value={form.qty} onChange={(e) => set('qty', e.target.value)} error={errors.qty} />
            <Input label="Satuan" required disabled={locked} value={form.unit} onChange={(e) => set('unit', e.target.value)} error={errors.unit} />
          </div>
          <RadioGroup
            name="asal-bahan"
            label="Asal bahan"
            required
            inline
            disabled={locked}
            value={form.source}
            onChange={(v) => set('source', v as FormState['source'])}
            options={[
              { value: 'BUYER', label: 'Buyer' },
              { value: 'SUPPLIER', label: 'Supplier' },
            ]}
          />
          {form.source === 'SUPPLIER' ? (
            <Select
              label="Supplier"
              required
              placeholder="Pilih supplier"
              disabled={locked}
              value={form.supplier_id}
              onChange={(e) => set('supplier_id', e.target.value)}
              options={(suppliers.data ?? []).filter((s) => s.is_active).map((s) => ({ value: s.id, label: s.supplier_name }))}
              error={errors.supplier_id}
              hint="Supplier belum ada? Tambahkan dulu di menu Supplier."
            />
          ) : (
            <div />
          )}

          {/* 8-11 */}
          {form.source === 'SUPPLIER' ? (
            <Input
              label="Harga bahan (Rp)"
              required={!editing}
              type="number"
              min={0}
              step="any"
              disabled={locked}
              value={form.material_price}
              onChange={(e) => set('material_price', e.target.value)}
              error={errors.material_price}
              hint={editing ? 'Kosongkan bila harga tidak berubah.' : `per ${form.unit || 'satuan'}`}
            />
          ) : (
            <div />
          )}
          <Input
            label="Tanggal diterima"
            required
            type="date"
            disabled={locked}
            value={form.received_date}
            onChange={(e) => set('received_date', e.target.value)}
            error={errors.received_date}
          />
          <div className="flex flex-col justify-end gap-3">
            <Checkbox
              label="Bahan ini telah diperiksa dan dinyatakan layak (jumlah sesuai dan tidak cacat)."
              checked={form.eligibility_confirmed}
              disabled={locked}
              onChange={(e) => set('eligibility_confirmed', e.target.checked)}
              error={errors.eligibility_confirmed}
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          {editing && (
            <Button variant="secondary" onClick={() => startEdit(null)}>
              Batal
            </Button>
          )}
          <Button className="px-8" loading={saving} disabled={locked || !styleId} onClick={save}>
            Simpan
          </Button>
        </div>
      </Card>

      {/* 12-13. Status kesiapan style */}
      <Card
        title={
          header ? (
            <span className="flex items-center gap-2">
              Status kesiapan {header.item_code}: <Badge status={header.readiness} />
            </span>
          ) : (
            'Status kesiapan style'
          )
        }
      >
        {!styleId ? (
          <p className="py-6 text-center text-sm text-ink-muted">Pilih order dan style untuk melihat bahan yang sudah dicatat.</p>
        ) : (
          <>
            <DataTable
              columns={columns}
              rows={header?.materials ?? []}
              rowKey={(m) => m.id}
              selectedKey={editing?.id}
              loading={style.loading}
              error={style.error}
              onRetry={style.reload}
              emptyMessage="Belum ada bahan yang dicatat untuk style ini (status: Belum Siap)."
            />
            {locked && (
              <Alert
                className="mt-4"
                variant="warning"
                message={`Data bahan ${header?.item_code} tidak dapat diubah karena SPK sudah diajukan/disetujui.`}
              />
            )}
          </>
        )}
      </Card>
    </div>
  );
}
