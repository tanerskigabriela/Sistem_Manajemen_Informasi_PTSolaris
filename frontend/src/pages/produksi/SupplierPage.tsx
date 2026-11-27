import { useState } from 'react';
import { Alert, Button, Input, Select } from '../../components/ui';
import { useAuth } from '../../contexts/AuthContext';
import { orderApi } from '../../lib/api/order';
import { PAYMENT_TERMS, produksiApi, type Supplier, type SupplierInput, type SupplierMaterial } from '../../lib/api/produksi';
import { formatCurrency, formatDate, formatNumber, formatStatus } from '../../lib/format';
import { parseApiError, toFieldErrorMap } from '../../lib/http';
import { maxLength, required, validateForm } from '../../lib/validation';
import { Card, DataTable, PageHeader, useLoad, type Col } from '../order/shared';

// SCR-09 Supplier dan Bahan per Supplier (FSD-2.8, mockup Gambar 3.9).
// Kiri atas: Daftar Supplier. Kiri bawah: bahan yang pernah dipasok supplier terpilih.
// Kanan: form Tambah/Ubah Supplier (hanya PPIC; Pimpinan hanya melihat).
// Kolom tambahan di bawah "Data lengkap supplier" wajib menurut KONTRAK v2 (tabel garment.suppliers).

const emptyForm: SupplierInput = {
  supplier_name: '',
  supplier_type: 'LOKAL',
  country_code: 'ID',
  contact_name: '',
  phone: '',
  email: '',
  address: '',
  city: '',
  currency: 'IDR',
  tax_id_no: '',
  payment_term: 'LUNAS_AWAL',
  payment_term_days: 0,
};

export default function SupplierPage() {
  const { user } = useAuth();
  const canEdit = user?.role_code === 'PPIC';

  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const list = useLoad(() => produksiApi.suppliers({ search: query }), [query]);
  const countries = useLoad(() => (canEdit ? orderApi.countries() : Promise.resolve([])), [canEdit]);

  const [viewing, setViewing] = useState<Supplier | null>(null);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState<SupplierInput>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function startEdit(s: Supplier | null) {
    setEditing(s);
    setForm(
      s
        ? {
            supplier_name: s.supplier_name,
            supplier_type: s.supplier_type,
            country_code: s.country_code,
            contact_name: s.contact_name,
            phone: s.phone,
            email: s.email ?? '',
            address: s.address,
            city: s.city,
            currency: s.currency,
            tax_id_no: s.tax_id_no ?? '',
            payment_term: s.payment_term,
            payment_term_days: s.payment_term_days,
          }
        : emptyForm,
    );
    setErrors({});
    setFormError(null);
  }

  function set<K extends keyof SupplierInput>(key: K, value: SupplierInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save() {
    const e = validateForm(form as unknown as Record<string, unknown>, {
      supplier_name: [required(), maxLength(100)],
      contact_name: [required(), maxLength(100)],
      phone: [required(), maxLength(20)],
      payment_term: [required()],
      address: [required(), maxLength(200)],
      city: [required(), maxLength(50)],
      country_code: [required()],
    });
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    setSaving(true);
    setFormError(null);
    try {
      const body: SupplierInput = {
        ...form,
        email: form.email?.trim() ? form.email.trim() : null,
        tax_id_no: form.tax_id_no?.trim() ? form.tax_id_no.trim() : null,
        payment_term_days: form.payment_term === 'KREDIT' ? Number(form.payment_term_days) || 0 : 0,
      };
      if (editing) {
        await produksiApi.updateSupplier(editing.id, body);
        setFlash(`Supplier ${form.supplier_name} berhasil diubah.`);
      } else {
        await produksiApi.createSupplier(body);
        setFlash(`Supplier ${form.supplier_name} berhasil disimpan.`);
      }
      startEdit(null);
      await list.reload();
    } catch (err) {
      const api = parseApiError(err);
      setFormError(api.message);
      setErrors(toFieldErrorMap(api.errors));
    } finally {
      setSaving(false);
    }
  }

  const columns: Col<Supplier>[] = [
    { key: 'nama', header: 'Nama', render: (s) => s.supplier_name },
    { key: 'kontak', header: 'Kontak', render: (s) => `${s.contact_name} — ${s.phone}` },
    {
      key: 'bayar',
      header: 'Pembayaran',
      render: (s) => (s.payment_term === 'KREDIT' ? `Kredit (${s.payment_term_days} hari)` : formatStatus(s.payment_term)),
    },
    {
      key: 'aksi',
      header: 'Aksi',
      render: (s) => (
        <div className="flex gap-3">
          {canEdit && (
            <button type="button" className="font-semibold text-ink underline hover:text-brand" onClick={() => startEdit(s)}>
              Ubah
            </button>
          )}
          <button type="button" className="font-semibold text-ink underline hover:text-brand" onClick={() => setViewing(s)}>
            Lihat Bahan
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader code="SCR-09" title="Supplier" subtitle="Data supplier dan bahan yang dipasok" />

      {flash && <Alert className="mb-4" variant="success" message={flash} onClose={() => setFlash(null)} />}

      <div className={`grid gap-5 ${canEdit ? 'lg:grid-cols-[3fr_2fr]' : ''}`}>
        <div className="space-y-5">
          {/* 1. Daftar Supplier */}
          <Card title="Daftar Supplier">
            <div className="mb-4 flex gap-2">
              <Input
                placeholder="Cari nama atau kota supplier"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && setQuery(search)}
                containerClassName="flex-1"
              />
              <Button variant="secondary" onClick={() => setQuery(search)}>
                Cari
              </Button>
            </div>
            <DataTable
              columns={columns}
              rows={list.data ?? []}
              rowKey={(s) => s.id}
              selectedKey={viewing?.id ?? editing?.id}
              loading={list.loading}
              error={list.error}
              onRetry={list.reload}
              emptyMessage="Belum ada supplier."
            />
          </Card>

          {/* 6. Bahan dari supplier terpilih */}
          <Card title={viewing ? `Bahan dari ${viewing.supplier_name}` : 'Bahan per Supplier'}>
            {viewing ? (
              <SupplierMaterials key={viewing.id} supplierId={viewing.id} />
            ) : (
              <p className="py-6 text-center text-sm text-ink-muted">Klik "Lihat Bahan" pada daftar supplier.</p>
            )}
          </Card>
        </div>

        {/* 2-5. Form Tambah / Ubah Supplier */}
        {canEdit && (
          <Card title={editing ? 'Ubah Supplier' : 'Tambah Supplier'} className="self-start">
            {formError && <Alert className="mb-4" variant="danger" message={formError} />}
            <div className="space-y-3">
              <Input label="Nama supplier" required value={form.supplier_name} onChange={(e) => set('supplier_name', e.target.value)} error={errors.supplier_name} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Input label="Kontak (nama)" required value={form.contact_name} onChange={(e) => set('contact_name', e.target.value)} error={errors.contact_name} />
                <Input label="Kontak (telepon)" required value={form.phone} onChange={(e) => set('phone', e.target.value)} error={errors.phone} />
              </div>
              <div className={`grid gap-3 ${form.payment_term === 'KREDIT' ? 'sm:grid-cols-2' : ''}`}>
                <Select
                  label="Ketentuan pembayaran"
                  required
                  value={form.payment_term}
                  onChange={(e) => set('payment_term', e.target.value as SupplierInput['payment_term'])}
                  options={PAYMENT_TERMS.map((p) => ({ value: p.value, label: p.label }))}
                  error={errors.payment_term}
                />
                {form.payment_term === 'KREDIT' && (
                  <Input
                    label="Tempo (hari)"
                    type="number"
                    min={0}
                    value={String(form.payment_term_days)}
                    onChange={(e) => set('payment_term_days', Number(e.target.value))}
                    error={errors.payment_term_days}
                  />
                )}
              </div>

              <p className="pt-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Data lengkap supplier</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Select
                  label="Jenis supplier"
                  required
                  value={form.supplier_type}
                  onChange={(e) => set('supplier_type', e.target.value as SupplierInput['supplier_type'])}
                  options={[
                    { value: 'LOKAL', label: 'Lokal' },
                    { value: 'IMPOR', label: 'Impor' },
                  ]}
                />
                <Select
                  label="Negara"
                  required
                  value={form.country_code}
                  onChange={(e) => set('country_code', e.target.value)}
                  options={(countries.data ?? []).map((c) => ({ value: c.country_code, label: c.country_name }))}
                  error={errors.country_code}
                />
                <Input label="Kota" required value={form.city} onChange={(e) => set('city', e.target.value)} error={errors.city} />
                <Input label="Email" type="email" value={form.email ?? ''} onChange={(e) => set('email', e.target.value)} error={errors.email} />
              </div>
              <Input label="Alamat" required value={form.address} onChange={(e) => set('address', e.target.value)} error={errors.address} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Input label="NPWP" value={form.tax_id_no ?? ''} onChange={(e) => set('tax_id_no', e.target.value)} error={errors.tax_id_no} />
                <Input label="Mata uang" maxLength={3} value={form.currency} onChange={(e) => set('currency', e.target.value.toUpperCase())} error={errors.currency} />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                {editing && (
                  <Button variant="secondary" onClick={() => startEdit(null)}>
                    Batal
                  </Button>
                )}
                <Button loading={saving} onClick={save} className="px-8">
                  Simpan
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function SupplierMaterials({ supplierId }: { supplierId: string }) {
  const data = useLoad(() => produksiApi.supplierMaterials(supplierId), [supplierId]);
  const columns: Col<SupplierMaterial>[] = [
    { key: 'order', header: 'Order', render: (m) => m.order_code },
    { key: 'style', header: 'Style', render: (m) => m.item_code },
    { key: 'bahan', header: 'Bahan', render: (m) => m.material_name },
    { key: 'jumlah', header: 'Jumlah', align: 'right', render: (m) => `${formatNumber(m.qty)} ${m.unit}` },
    {
      key: 'harga',
      header: 'Harga',
      align: 'right',
      // Harga bahan hanya terlihat untuk Pimpinan (KONTRAK v2: material_price disembunyikan dari PPIC).
      render: (m) => (m.material_price == null ? '—' : `${formatCurrency(m.material_price)}/${m.unit}`),
    },
    { key: 'tgl', header: 'Diterima', render: (m) => formatDate(m.received_date) },
  ];
  return (
    <DataTable
      columns={columns}
      rows={data.data ?? []}
      rowKey={(m) => `${m.order_code}-${m.item_code}-${m.material_code}-${m.color ?? ''}-${m.received_date}`}
      loading={data.loading}
      error={data.error}
      onRetry={data.reload}
      emptyMessage="Supplier ini belum pernah memasok bahan untuk order."
    />
  );
}
