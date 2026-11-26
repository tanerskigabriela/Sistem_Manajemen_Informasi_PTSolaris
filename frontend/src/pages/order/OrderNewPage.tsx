import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, Input, Select, Textarea } from '../../components/ui';
import { parseApiError, toFieldErrorMap } from '../../lib/http';
import { orderApi, type Item, type NewOrderStyle } from '../../lib/api/order';
import { MSG_REQUIRED } from '../../lib/validation';
import { Card, PageHeader, useLoad } from './shared';

// SCR-05 Formulir Order Baru (FSD 2.4). Validasi akhir tetap di sp_create_order.

interface StyleForm {
  item_id: string; // '' = barang baru
  type_code: string;
  item_name: string;
  buyer_style_name: string;
  color: string;
  unit_price: string;
  discount_pct: string;
  sizes: { size: string; qty: string }[];
}

const emptyStyle = (): StyleForm => ({
  item_id: '',
  type_code: '',
  item_name: '',
  buyer_style_name: '',
  color: '',
  unit_price: '',
  discount_pct: '0',
  sizes: [{ size: '', qty: '' }],
});

const INCOTERMS = ['EXW', 'FCA', 'FOB', 'CFR', 'CIF', 'DAP', 'DDP'];

export default function OrderNewPage() {
  const navigate = useNavigate();
  const master = useLoad(async () => {
    const [buyers, levels, types, countries] = await Promise.all([
      orderApi.buyers({ per_page: 100 }),
      orderApi.orderLevels(),
      orderApi.productTypes(),
      orderApi.countries(),
    ]);
    return { buyers: buyers.rows, levels, types, countries };
  });

  const [header, setHeader] = useState({
    buyer_id: '',
    level_code: 'DOMESTIK',
    deadline: '',
    scheme: 'FOB',
    reject_limit_pct: '3',
    late_penalty: '',
    buyer_po_no: '',
    notes: '',
    currency: 'USD',
    exchange_rate: '',
    incoterm: 'FOB',
    destination_country: '',
    destination_port: '',
  });
  const [styles, setStyles] = useState<StyleForm[]>([emptyStyle()]);
  const [items, setItems] = useState<Item[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isIntl = header.level_code === 'INTERNASIONAL';

  // Barang yang bisa dipilih = barang milik buyer terpilih + barang umum
  useEffect(() => {
    if (!header.buyer_id) {
      setItems([]);
      return;
    }
    orderApi.items(header.buyer_id).then(setItems).catch(() => setItems([]));
  }, [header.buyer_id]);

  const totalQty = useMemo(
    () => styles.reduce((sum, s) => sum + s.sizes.reduce((a, z) => a + (Number(z.qty) || 0), 0), 0),
    [styles],
  );

  function setH(field: keyof typeof header, value: string) {
    setHeader((h) => ({ ...h, [field]: value }));
  }
  function setS(index: number, patch: Partial<StyleForm>) {
    setStyles((list) => list.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }
  function setSize(si: number, zi: number, patch: Partial<{ size: string; qty: string }>) {
    setStyles((list) =>
      list.map((s, i) =>
        i === si ? { ...s, sizes: s.sizes.map((z, j) => (j === zi ? { ...z, ...patch } : z)) } : s,
      ),
    );
  }

  // Validasi di sisi klien (pesan sama dengan FSD Bagian 6); sisanya dicek backend
  function validate(): Record<string, string> {
    const e: Record<string, string> = {};
    if (!header.buyer_id) e.buyer_id = MSG_REQUIRED;
    if (!header.deadline) e.deadline = MSG_REQUIRED;
    if (!header.late_penalty.trim()) e.late_penalty = MSG_REQUIRED;
    const reject = Number(header.reject_limit_pct);
    if (header.reject_limit_pct === '' || Number.isNaN(reject) || reject < 0 || reject > 100)
      e.reject_limit_pct = 'Batas reject harus antara 0 dan 100%.';
    if (isIntl) {
      for (const f of ['currency', 'exchange_rate', 'incoterm', 'destination_country', 'destination_port'] as const)
        if (!header[f].trim()) e[f] = MSG_REQUIRED;
    }
    styles.forEach((s, i) => {
      if (!s.item_id && !s.type_code) e[`styles.${i}.type_code`] = MSG_REQUIRED;
      if (!s.item_id && !s.item_name.trim()) e[`styles.${i}.item_name`] = MSG_REQUIRED;
      if (!s.color.trim()) e[`styles.${i}.color`] = MSG_REQUIRED;
      if (!(Number(s.unit_price) > 0)) e[`styles.${i}.unit_price`] = 'Nilai harus lebih dari 0.';
      s.sizes.forEach((z, j) => {
        if (!z.size.trim()) e[`styles.${i}.sizes.${j}.size`] = MSG_REQUIRED;
        if (!(Number(z.qty) > 0)) e[`styles.${i}.sizes.${j}.qty`] = 'Nilai harus lebih dari 0.';
      });
    });
    return e;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (styles.length === 0) {
      setFormError('Order harus memiliki minimal satu style.');
      return;
    }
    if (!confirmed) {
      setFormError('Centang pernyataan terlebih dahulu.');
      return;
    }
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    const payloadStyles: NewOrderStyle[] = styles.map((s) => ({
      item_id: s.item_id || null,
      ...(s.item_id ? {} : { type_code: s.type_code, item_name: s.item_name, buyer_style_name: s.buyer_style_name || s.item_name }),
      color: s.color,
      unit_price: Number(s.unit_price),
      discount_pct: Number(s.discount_pct) || 0,
      sizes: s.sizes.map((z) => ({ size: z.size.trim().toUpperCase(), qty: Number(z.qty) })),
    }));

    setSaving(true);
    try {
      const { data } = await orderApi.createOrder({
        buyer_id: header.buyer_id,
        level_code: header.level_code,
        deadline: header.deadline,
        scheme: header.scheme,
        reject_limit_pct: Number(header.reject_limit_pct),
        late_penalty: header.late_penalty,
        buyer_po_no: header.buyer_po_no || undefined,
        notes: header.notes || undefined,
        ...(isIntl
          ? {
              currency: header.currency,
              exchange_rate: Number(header.exchange_rate),
              incoterm: header.incoterm,
              destination_country: header.destination_country,
              destination_port: header.destination_port,
            }
          : {}),
        styles: payloadStyles,
        confirmed: true,
      });
      navigate(`/order/${data.id}`, { state: { flash: `Order ${data.order_code} berhasil disimpan dan menunggu persetujuan.` } });
    } catch (err) {
      const api = parseApiError(err);
      setFormError(api.message);
      setErrors(toFieldErrorMap(api.errors));
    } finally {
      setSaving(false);
    }
  }

  if (master.loading) return <p className="text-sm text-ink-muted">Memuat formulir...</p>;
  if (master.error || !master.data)
    return <Alert variant="danger" title="Gagal memuat data" message={master.error ?? ''} onRetry={master.reload} />;

  const { buyers, levels, types, countries } = master.data;
  const itemOptions = [
    { value: '', label: '+ Barang baru (kode dibuat otomatis)' },
    ...items.map((it) => ({ value: it.id, label: `${it.item_code} — ${it.buyer_style_name ?? it.item_name}` })),
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <PageHeader code="SCR-05" title="Formulir Order Baru" />

      {formError && <Alert variant="danger" message={formError} onClose={() => setFormError(null)} />}

      <Card title="Data order">
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Buyer"
            required
            placeholder="Pilih buyer"
            value={header.buyer_id}
            onChange={(e) => setH('buyer_id', e.target.value)}
            options={buyers.map((b) => ({ value: b.id, label: `${b.buyer_code} — ${b.buyer_name}` }))}
            error={errors.buyer_id}
          />
          <Select
            label="Level order"
            required
            value={header.level_code}
            onChange={(e) => setH('level_code', e.target.value)}
            options={levels.map((l) => ({ value: l.level_code, label: l.level_name }))}
            error={errors.level_code}
          />
          <Input label="Deadline" type="date" required value={header.deadline} onChange={(e) => setH('deadline', e.target.value)} error={errors.deadline} />
          <Select
            label="Skema"
            required
            value={header.scheme}
            onChange={(e) => setH('scheme', e.target.value)}
            options={[
              { value: 'FOB', label: 'FOB (bahan dari pabrik)' },
              { value: 'CMT', label: 'CMT (bahan dari buyer)' },
            ]}
          />
          <Input
            label="Batas reject (%)"
            type="number"
            step="0.01"
            required
            value={header.reject_limit_pct}
            onChange={(e) => setH('reject_limit_pct', e.target.value)}
            error={errors.reject_limit_pct}
          />
          <Input label="Nomor PO buyer" value={header.buyer_po_no} onChange={(e) => setH('buyer_po_no', e.target.value)} />
          <Textarea
            label="Sanksi keterlambatan"
            required
            containerClassName="sm:col-span-2"
            value={header.late_penalty}
            onChange={(e) => setH('late_penalty', e.target.value)}
            error={errors.late_penalty}
          />
        </div>
      </Card>

      {isIntl && (
        <Card title="Data ekspor (order internasional)">
          <div className="grid gap-4 sm:grid-cols-3">
            <Input label="Mata uang" required value={header.currency} onChange={(e) => setH('currency', e.target.value.toUpperCase())} error={errors.currency} />
            <Input label="Kurs ke Rupiah" type="number" required value={header.exchange_rate} onChange={(e) => setH('exchange_rate', e.target.value)} error={errors.exchange_rate} />
            <Select label="Incoterm" required value={header.incoterm} onChange={(e) => setH('incoterm', e.target.value)} options={INCOTERMS.map((v) => ({ value: v, label: v }))} error={errors.incoterm} />
            <Select
              label="Negara tujuan"
              required
              placeholder="Pilih negara"
              value={header.destination_country}
              onChange={(e) => setH('destination_country', e.target.value)}
              options={countries.map((c) => ({ value: c.country_code, label: c.country_name }))}
              error={errors.destination_country}
            />
            <Input label="Pelabuhan tujuan" required value={header.destination_port} onChange={(e) => setH('destination_port', e.target.value)} error={errors.destination_port} />
          </div>
        </Card>
      )}

      {styles.map((s, i) => (
        <Card key={i} title={`Style ${i + 1}`}>
          <div className="grid gap-4 sm:grid-cols-3">
            <Select
              label="Barang"
              containerClassName="sm:col-span-3"
              value={s.item_id}
              onChange={(e) => setS(i, { item_id: e.target.value })}
              options={itemOptions}
              hint={header.buyer_id ? undefined : 'Pilih buyer dulu untuk melihat barang miliknya.'}
            />
            {!s.item_id && (
              <>
                <Select
                  label="Jenis produk"
                  required
                  placeholder="Pilih jenis"
                  value={s.type_code}
                  onChange={(e) => setS(i, { type_code: e.target.value })}
                  options={types.map((t) => ({ value: t.type_code, label: `${t.type_code} — ${t.type_name}` }))}
                  error={errors[`styles.${i}.type_code`]}
                />
                <Input label="Nama barang" required value={s.item_name} onChange={(e) => setS(i, { item_name: e.target.value })} error={errors[`styles.${i}.item_name`]} />
                <Input label="Nama style dari buyer" value={s.buyer_style_name} onChange={(e) => setS(i, { buyer_style_name: e.target.value })} />
              </>
            )}
            <Input label="Warna" required value={s.color} onChange={(e) => setS(i, { color: e.target.value })} error={errors[`styles.${i}.color`]} />
            <Input label="Harga per pcs" type="number" step="0.01" required value={s.unit_price} onChange={(e) => setS(i, { unit_price: e.target.value })} error={errors[`styles.${i}.unit_price`]} />
            <Input label="Diskon (%)" type="number" step="0.01" value={s.discount_pct} onChange={(e) => setS(i, { discount_pct: e.target.value })} />
          </div>

          <p className="mt-4 mb-2 text-sm font-medium text-ink">Jumlah per ukuran</p>
          <div className="space-y-2">
            {s.sizes.map((z, j) => (
              <div key={j} className="flex items-start gap-2">
                <Input placeholder="Ukuran (S, M, 32...)" value={z.size} onChange={(e) => setSize(i, j, { size: e.target.value })} error={errors[`styles.${i}.sizes.${j}.size`]} containerClassName="w-40" />
                <Input placeholder="Jumlah" type="number" value={z.qty} onChange={(e) => setSize(i, j, { qty: e.target.value })} error={errors[`styles.${i}.sizes.${j}.qty`]} containerClassName="w-32" />
                {s.sizes.length > 1 && (
                  <Button variant="ghost" size="sm" onClick={() => setS(i, { sizes: s.sizes.filter((_, k) => k !== j) })}>
                    Hapus
                  </Button>
                )}
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setS(i, { sizes: [...s.sizes, { size: '', qty: '' }] })}>
              + Ukuran
            </Button>
            {styles.length > 1 && (
              <Button variant="danger" size="sm" onClick={() => setStyles((list) => list.filter((_, k) => k !== i))}>
                Hapus style
              </Button>
            )}
          </div>
        </Card>
      ))}

      <Button variant="secondary" onClick={() => setStyles((list) => [...list, emptyStyle()])}>
        + Tambah style
      </Button>

      <Card>
        <p className="text-sm text-ink-muted">
          Total jumlah: <span className="font-semibold text-ink">{totalQty} pcs</span> dari {styles.length} style.
        </p>
        <label className="mt-3 flex items-start gap-2 text-sm text-ink">
          <input type="checkbox" className="mt-0.5" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
          Saya menyatakan data order ini sudah sesuai dengan pesanan buyer.
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => navigate('/order')}>
            Batal
          </Button>
          <Button type="submit" loading={saving}>
            Simpan dan Ajukan
          </Button>
        </div>
      </Card>
    </form>
  );
}
