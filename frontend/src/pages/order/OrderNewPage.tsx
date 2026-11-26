import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, Input, Modal, Select, Textarea } from '../../components/ui';
import { formatCurrency, formatDate, formatNumber } from '../../lib/format';
import { parseApiError, toFieldErrorMap } from '../../lib/http';
import { orderApi, type Item, type NewOrderStyle } from '../../lib/api/order';
import { MSG_REQUIRED } from '../../lib/validation';
import { Card, PageHeader, useLoad } from './shared';

// SCR-05 Order Baru (FSD 2.4, mockup Gambar 3.5) + SCR-05b dialog Konfirmasi Order (Gambar 3.5b).
// Validasi akhir tetap di sp_create_order.

interface StyleRow {
  item_id: string; // '' = barang baru, kode dibuat otomatis
  type_code: string;
  item_name: string;
  color: string;
  unit_price: string;
  discount_pct: string;
  qty: Record<string, string>; // ukuran -> jumlah
}

const emptyStyle = (): StyleRow => ({
  item_id: '',
  type_code: '',
  item_name: '',
  color: '',
  unit_price: '',
  discount_pct: '0',
  qty: {},
});

const INCOTERMS = ['EXW', 'FCA', 'FOB', 'CFR', 'CIF', 'DAP', 'DDP'];

// Input kecil di dalam tabel style
const cell = 'rounded-md border border-line-strong bg-surface px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40';
const cellError = 'border-danger';

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
    reject_limit_pct: '',
    late_penalty: '',
    buyer_po_no: '',
    currency: 'USD',
    exchange_rate: '',
    incoterm: 'FOB',
    destination_country: '',
    destination_port: '',
  });
  const [sizes, setSizes] = useState<string[]>(['S', 'M', 'L', 'XL']);
  const [newSize, setNewSize] = useState('');
  const [styles, setStyles] = useState<StyleRow[]>([emptyStyle()]);
  const [items, setItems] = useState<Item[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);

  const isIntl = header.level_code === 'INTERNASIONAL';
  const currency = isIntl ? header.currency || 'USD' : 'IDR';

  // Kode barang yang bisa dipilih = barang milik buyer terpilih + barang umum
  useEffect(() => {
    if (!header.buyer_id) {
      setItems([]);
      return;
    }
    orderApi.items(header.buyer_id).then(setItems).catch(() => setItems([]));
  }, [header.buyer_id]);

  const rowQty = (s: StyleRow) => sizes.reduce((a, z) => a + (Number(s.qty[z]) || 0), 0);
  const rowValue = (s: StyleRow) => rowQty(s) * (Number(s.unit_price) || 0) * (1 - (Number(s.discount_pct) || 0) / 100);
  const totalQty = useMemo(() => styles.reduce((a, s) => a + rowQty(s), 0), [styles, sizes]); // eslint-disable-line react-hooks/exhaustive-deps
  const totalValue = useMemo(() => styles.reduce((a, s) => a + rowValue(s), 0), [styles, sizes]); // eslint-disable-line react-hooks/exhaustive-deps

  function setH(field: keyof typeof header, value: string) {
    setHeader((h) => ({ ...h, [field]: value }));
  }
  function setS(index: number, patch: Partial<StyleRow>) {
    setStyles((list) => list.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }
  function pickItem(index: number, itemId: string) {
    const it = items.find((x) => x.id === itemId);
    setS(index, it ? { item_id: it.id, type_code: it.type_code, item_name: it.buyer_style_name ?? it.item_name } : { item_id: '' });
  }
  function addSize() {
    const z = newSize.trim().toUpperCase();
    if (z && !sizes.includes(z)) setSizes([...sizes, z]);
    setNewSize('');
  }
  function removeSize(z: string) {
    setSizes(sizes.filter((x) => x !== z));
    setStyles((list) => list.map((s) => {
      const { [z]: _removed, ...rest } = s.qty;
      return { ...s, qty: rest };
    }));
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
      if (rowQty(s) <= 0) e[`styles.${i}.qty`] = 'Isi jumlah minimal satu ukuran. Nilai harus lebih dari 0.';
    });
    return e;
  }

  // Tombol "Simpan Order": cek isian dulu, lalu buka dialog konfirmasi (SCR-05b)
  function openConfirm() {
    setFormError(null);
    if (styles.length === 0) {
      setFormError('Order harus memiliki minimal satu style.');
      return;
    }
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length > 0) {
      setFormError('Periksa kembali isian yang ditandai merah.');
      return;
    }
    setConfirmed(false);
    setConfirmOpen(true);
  }

  async function submit() {
    if (!confirmed) return;
    const payloadStyles: NewOrderStyle[] = styles.map((s) => ({
      item_id: s.item_id || null,
      ...(s.item_id ? {} : { type_code: s.type_code, item_name: s.item_name, buyer_style_name: s.item_name }),
      color: s.color,
      unit_price: Number(s.unit_price),
      discount_pct: Number(s.discount_pct) || 0,
      sizes: sizes.filter((z) => Number(s.qty[z]) > 0).map((z) => ({ size: z, qty: Number(s.qty[z]) })),
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
      setConfirmOpen(false);
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
  const buyer = buyers.find((b) => b.id === header.buyer_id);

  return (
    <div>
      <PageHeader code="SCR-05" title="Order Baru" subtitle="Satu order berisi satu atau lebih style" />

      {formError && <Alert className="mb-4" variant="danger" message={formError} onClose={() => setFormError(null)} />}

      <Card>
        {/* 1-5. Data utama order */}
        <div className="grid gap-4 md:grid-cols-[2fr_1.4fr_1.2fr_1fr_2fr]">
          <Select
            label="Buyer"
            required
            placeholder="Pilih buyer"
            value={header.buyer_id}
            onChange={(e) => setH('buyer_id', e.target.value)}
            options={buyers.map((b) => ({ value: b.id, label: `${b.buyer_name} (${b.buyer_code})` }))}
            error={errors.buyer_id}
          />
          <Input label="Deadline" type="date" required value={header.deadline} onChange={(e) => setH('deadline', e.target.value)} error={errors.deadline} />
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-ink">
              Skema <span className="text-danger">*</span>
            </legend>
            <div className="flex h-10 items-center gap-4 text-sm">
              {['CMT', 'FOB'].map((v) => (
                <label key={v} className="flex items-center gap-1.5">
                  <input type="radio" name="scheme" className="accent-brand" checked={header.scheme === v} onChange={() => setH('scheme', v)} />
                  {v}
                </label>
              ))}
            </div>
          </fieldset>
          <Input
            label="Batas reject (%)"
            type="number"
            step="0.01"
            required
            value={header.reject_limit_pct}
            onChange={(e) => setH('reject_limit_pct', e.target.value)}
            error={errors.reject_limit_pct}
          />
          <Textarea
            label="Sanksi keterlambatan"
            required
            rows={2}
            value={header.late_penalty}
            onChange={(e) => setH('late_penalty', e.target.value)}
            error={errors.late_penalty}
          />
        </div>

        {/* Level order dan nomor PO (dibutuhkan sp_create_order) */}
        <div className="mt-4 grid gap-4 md:grid-cols-[2fr_1.4fr_4.2fr]">
          <Select
            label="Level order"
            required
            value={header.level_code}
            onChange={(e) => setH('level_code', e.target.value)}
            options={levels.map((l) => ({ value: l.level_code, label: l.level_name }))}
            error={errors.level_code}
          />
          <Input label="Nomor PO buyer" value={header.buyer_po_no} onChange={(e) => setH('buyer_po_no', e.target.value)} />
        </div>

        {isIntl && (
          <div className="mt-4 grid gap-4 rounded-xl bg-surface-muted p-4 md:grid-cols-5">
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
        )}

        {/* 6-11. Tabel style: jenis, nama style, kode barang, warna, jumlah per ukuran, harga/pcs */}
        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-brand-soft text-xs font-semibold text-ink">
              <tr>
                <th className="px-2 py-2.5 text-left">Jenis</th>
                <th className="px-2 py-2.5 text-left">Nama style</th>
                <th className="px-2 py-2.5 text-left">Kode barang</th>
                <th className="px-2 py-2.5 text-left">Warna</th>
                {sizes.map((z) => (
                  <th key={z} className="px-2 py-2.5 text-center">
                    {z}
                    <button type="button" title={`Hapus kolom ${z}`} className="ml-1 text-ink-subtle hover:text-danger" onClick={() => removeSize(z)}>
                      ×
                    </button>
                  </th>
                ))}
                <th className="px-2 py-2.5 text-right">Jumlah</th>
                <th className="px-2 py-2.5 text-left">Harga/pcs</th>
                <th className="px-2 py-2.5 text-left">Diskon %</th>
                <th className="px-2 py-2.5 text-left">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {styles.map((s, i) => {
                const typeItems = items.filter((it) => !s.type_code || it.type_code === s.type_code);
                return (
                  <tr key={i} className="border-b border-line align-top">
                    <td className="px-2 py-2">
                      <select
                        className={`${cell} w-20 ${errors[`styles.${i}.type_code`] ? cellError : ''}`}
                        value={s.type_code}
                        disabled={Boolean(s.item_id)}
                        onChange={(e) => setS(i, { type_code: e.target.value })}
                      >
                        <option value="">-</option>
                        {types.map((t) => (
                          <option key={t.type_code} value={t.type_code} title={t.type_name}>
                            {t.type_code}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <input
                        className={`${cell} w-full min-w-36 ${errors[`styles.${i}.item_name`] ? cellError : ''}`}
                        placeholder="Midi Dress MD-7"
                        value={s.item_name}
                        disabled={Boolean(s.item_id)}
                        onChange={(e) => setS(i, { item_name: e.target.value })}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <select className={`${cell} w-full min-w-36`} value={s.item_id} onChange={(e) => pickItem(i, e.target.value)}>
                        <option value="">Baru (otomatis)</option>
                        {typeItems.map((it) => (
                          <option key={it.id} value={it.id}>
                            {it.item_code}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <input
                        className={`${cell} w-full min-w-24 ${errors[`styles.${i}.color`] ? cellError : ''}`}
                        placeholder="Maroon"
                        value={s.color}
                        onChange={(e) => setS(i, { color: e.target.value })}
                      />
                    </td>
                    {sizes.map((z) => (
                      <td key={z} className="px-1 py-2">
                        <input
                          type="number"
                          min={0}
                          className={`${cell} w-16 text-center ${errors[`styles.${i}.qty`] ? cellError : ''}`}
                          value={s.qty[z] ?? ''}
                          onChange={(e) => setS(i, { qty: { ...s.qty, [z]: e.target.value } })}
                        />
                      </td>
                    ))}
                    <td className="px-2 py-3.5 text-right font-medium">{formatNumber(rowQty(s))}</td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        min={0}
                        className={`${cell} w-28 ${errors[`styles.${i}.unit_price`] ? cellError : ''}`}
                        placeholder="115000"
                        value={s.unit_price}
                        onChange={(e) => setS(i, { unit_price: e.target.value })}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input type="number" min={0} max={100} className={`${cell} w-16`} value={s.discount_pct} onChange={(e) => setS(i, { discount_pct: e.target.value })} />
                    </td>
                    <td className="px-2 py-3.5">
                      <button
                        type="button"
                        className="font-semibold text-ink underline hover:text-danger disabled:opacity-40"
                        disabled={styles.length === 1}
                        onClick={() => setStyles((list) => list.filter((_, k) => k !== i))}
                      >
                        Hapus
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {Object.keys(errors).some((k) => k.startsWith('styles')) && (
          <p className="mt-2 text-xs text-danger">
            {errors.styles ?? 'Lengkapi isian style yang ditandai merah. Jumlah dan harga harus lebih dari 0.'}
          </p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
          <span>
            Jenis produk: {types.map((t) => t.type_code).join(', ')} · Kode barang dibuat otomatis (BBB-JJ-NNNN) atau dipilih dari kode lama buyer yang sama.
          </span>
          <span className="ml-auto flex items-center gap-1">
            <input
              className={`${cell} w-20`}
              placeholder="XXL / 32"
              value={newSize}
              onChange={(e) => setNewSize(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addSize()}
            />
            <Button size="sm" variant="ghost" className="whitespace-nowrap" onClick={addSize}>
              + Kolom ukuran
            </Button>
          </span>
        </div>

        {/* 12-14. Tombol */}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button variant="secondary" onClick={() => setStyles((list) => [...list, emptyStyle()])}>
            + Tambah Style
          </Button>
          <Button variant="secondary" disabled title="SCR-07 Riwayat Harga belum tersedia">
            Lihat Riwayat Harga
          </Button>
          <Button className="ml-auto px-6" onClick={openConfirm}>
            Simpan Order
          </Button>
        </div>

        <p className="mt-6 text-sm font-semibold text-ink">
          Total: {styles.length} style · {formatNumber(totalQty)} pcs · {formatCurrency(totalValue, currency)}
        </p>
        <p className="mt-1 text-xs text-ink-muted">Harga per pcs hanya terlihat oleh Marketing dan Pimpinan.</p>
      </Card>

      {/* 15-18. SCR-05b Konfirmasi Order */}
      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Konfirmasi Order"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
              Periksa Kembali
            </Button>
            <Button loading={saving} disabled={!confirmed} onClick={submit}>
              Ya, Simpan Order
            </Button>
          </>
        }
      >
        <dl className="divide-y divide-line text-sm">
          {[
            ['Buyer', buyer ? `${buyer.buyer_name} (${buyer.buyer_code})` : '-'],
            ['Deadline · Skema', `${formatDate(header.deadline)} · ${header.scheme}`],
            ['Jumlah style', `${styles.length} style · ${formatNumber(totalQty)} pcs`],
            ['Total nilai order', formatCurrency(totalValue, currency)],
          ].map(([label, value]) => (
            <div key={label} className="grid grid-cols-[1fr_1.5fr] py-2.5">
              <dt className="text-ink-muted">{label}</dt>
              <dd className="font-semibold text-ink">{value}</dd>
            </div>
          ))}
        </dl>
        <label className="mt-4 flex items-start gap-2 text-sm text-ink">
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-brand" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
          Saya menyatakan bahwa data order telah diperiksa dan sesuai dengan kontrak yang disepakati. Order yang sudah disimpan tidak dapat diubah;
          perbaikan dilakukan dengan mencatat order baru.
        </label>
      </Modal>
    </div>
  );
}
