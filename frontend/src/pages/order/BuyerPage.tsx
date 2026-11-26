import { useState } from 'react';
import { Alert, Button, Input, Select } from '../../components/ui';
import { useAuth } from '../../contexts/AuthContext';
import { parseApiError, toFieldErrorMap } from '../../lib/http';
import { orderApi, type Buyer, type BuyerInput } from '../../lib/api/order';
import { buyerCodeFormat, maxLength, required, validateForm } from '../../lib/validation';
import { Card, DataTable, PageHeader, useLoad, type Col } from './shared';

// SCR-04 Data Buyer (FSD 2.3, mockup Gambar 3.4).
// Kiri: Daftar Buyer. Kanan: form Tambah/Ubah Buyer (hanya MARKETING; PIMPINAN hanya melihat).

const emptyForm: BuyerInput = {
  buyer_code: '',
  buyer_name: '',
  buyer_type: 'LOKAL',
  country_code: 'ID',
  contact_name: '',
  phone: '',
  email: '',
  address: '',
  city: '',
  tax_id_no: '',
  default_currency: 'IDR',
  payment_term_days: 30,
};

export default function BuyerPage() {
  const { user } = useAuth();
  const canEdit = user?.role_code === 'MARKETING';
  const [q, setQ] = useState('');
  const [query, setQuery] = useState({ q: '', page: 1, per_page: 100 });
  const list = useLoad(() => orderApi.buyers(query), [query]);
  const countries = useLoad(() => orderApi.countries(), []);

  const [editing, setEditing] = useState<Buyer | null>(null);
  const [form, setForm] = useState<BuyerInput>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function startEdit(buyer: Buyer | null) {
    setEditing(buyer);
    setForm(buyer ? { ...buyer, email: buyer.email ?? '', tax_id_no: buyer.tax_id_no ?? '' } : emptyForm);
    setErrors({});
    setFormError(null);
  }

  function set<K extends keyof BuyerInput>(key: K, value: BuyerInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save() {
    const e = validateForm(form as unknown as Record<string, unknown>, {
      buyer_code: editing ? [] : [required(), buyerCodeFormat()],
      buyer_name: [required(), maxLength(100)],
      contact_name: [required(), maxLength(100)],
      phone: [required(), maxLength(20)],
      address: [required(), maxLength(200)],
      city: [required(), maxLength(50)],
      country_code: [required()],
    });
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    setSaving(true);
    setFormError(null);
    try {
      const body = { ...form, payment_term_days: Number(form.payment_term_days) };
      if (editing) {
        const { buyer_code: _code, ...changes } = body;
        await orderApi.updateBuyer(editing.id, changes);
        setFlash(`Buyer ${editing.buyer_code} berhasil diubah.`);
      } else {
        await orderApi.createBuyer(body);
        setFlash(`Buyer ${form.buyer_code} berhasil disimpan.`);
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

  const columns: Col<Buyer>[] = [
    { key: 'buyer_name', header: 'Nama Buyer', render: (b) => b.buyer_name },
    { key: 'buyer_code', header: 'Kode', render: (b) => <span className="font-bold">{b.buyer_code}</span> },
    { key: 'kontak', header: 'Kontak', render: (b) => `${b.contact_name} — ${b.phone}` },
    ...(canEdit
      ? [
          {
            key: 'aksi',
            header: 'Aksi',
            render: (b: Buyer) => (
              <button type="button" className="font-semibold text-ink underline hover:text-brand" onClick={() => startEdit(b)}>
                Ubah
              </button>
            ),
          },
        ]
      : []),
  ];

  return (
    <div>
      <PageHeader code="SCR-04" title="Data Buyer" subtitle="Kode buyer dipakai untuk membentuk kode barang (BBB-JJ-NNNN)" />

      {flash && <Alert className="mb-4" variant="success" message={flash} onClose={() => setFlash(null)} />}

      <div className={`grid gap-5 ${canEdit ? 'lg:grid-cols-[3fr_2fr]' : ''}`}>
        {/* 1. Daftar Buyer */}
        <Card title="Daftar Buyer" className="self-start">
          <div className="mb-4 flex gap-2">
            <Input
              placeholder="Cari kode atau nama buyer"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && setQuery({ ...query, q, page: 1 })}
              containerClassName="flex-1"
            />
            <Button variant="secondary" onClick={() => setQuery({ ...query, q, page: 1 })}>
              Cari
            </Button>
          </div>
          <DataTable
            columns={columns}
            rows={list.data?.rows ?? []}
            rowKey={(b) => b.id}
            selectedKey={editing?.id}
            loading={list.loading}
            error={list.error}
            onRetry={list.reload}
            emptyMessage="Belum ada buyer."
          />
        </Card>

        {/* 2-5. Form Tambah / Ubah Buyer */}
        {canEdit && (
          <Card title={editing ? `Ubah Buyer ${editing.buyer_code}` : 'Tambah Buyer'} className="self-start">
            {formError && <Alert className="mb-4" variant="danger" message={formError} />}
            <div className="space-y-3">
              <Input label="Nama buyer" required value={form.buyer_name} onChange={(e) => set('buyer_name', e.target.value)} error={errors.buyer_name} />
              <Input
                label="Kode buyer"
                required
                maxLength={3}
                disabled={Boolean(editing)}
                hint={editing ? 'Kode buyer tidak dapat diubah.' : '3 huruf kapital, unik'}
                value={form.buyer_code}
                onChange={(e) => set('buyer_code', e.target.value.toUpperCase())}
                error={errors.buyer_code}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <Input label="Kontak (nama)" required value={form.contact_name} onChange={(e) => set('contact_name', e.target.value)} error={errors.contact_name} />
                <Input label="Kontak (telepon)" required value={form.phone} onChange={(e) => set('phone', e.target.value)} error={errors.phone} />
              </div>

              <p className="pt-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Data lengkap buyer</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Select
                  label="Jenis buyer"
                  required
                  value={form.buyer_type}
                  onChange={(e) => set('buyer_type', e.target.value as Buyer['buyer_type'])}
                  options={[
                    { value: 'LOKAL', label: 'Lokal' },
                    { value: 'ASING', label: 'Asing' },
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
              <div className="grid gap-3 sm:grid-cols-3">
                <Input label="NPWP" value={form.tax_id_no ?? ''} onChange={(e) => set('tax_id_no', e.target.value)} />
                <Input label="Mata uang" value={form.default_currency} onChange={(e) => set('default_currency', e.target.value.toUpperCase())} error={errors.default_currency} />
                <Input
                  label="Termin (hari)"
                  type="number"
                  value={String(form.payment_term_days)}
                  onChange={(e) => set('payment_term_days', Number(e.target.value))}
                  error={errors.payment_term_days}
                />
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
