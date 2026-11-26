import { useState } from 'react';
import { Alert, Badge, Button, Modal, Select, Textarea } from '../../components/ui';
import { useAuth } from '../../contexts/AuthContext';
import { formatCurrency, formatDate, formatDateTime, formatNumber, formatPercent, formatStatus } from '../../lib/format';
import { parseApiError } from '../../lib/http';
import { orderApi, type CancellationPreview } from '../../lib/api/order';
import { DataTable, useLoad } from './shared';

// Panel kanan SCR-06 (mockup Gambar 3.6):
// 3 detail order, 4 riwayat status, 5 progres per style (PPIC/Pimpinan),
// 6 Batalkan Order (Pimpinan, FSD 2.7), 7-8 Tarik Pengajuan + alasan (Marketing, FSD 2.25).

type Detail = NonNullable<Awaited<ReturnType<typeof orderApi.order>>>['details'][number];

export default function OrderDetailPanel({ id, onChanged }: { id: string; onChanged: () => void }) {
  const { user } = useAuth();
  const role = user?.role_code;
  const order = useLoad(() => orderApi.order(id), [id]);

  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [party, setParty] = useState('');
  const [preview, setPreview] = useState<CancellationPreview | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const showPrice = role === 'MARKETING' || role === 'PIMPINAN';
  const showProgress = role === 'PPIC' || role === 'PIMPINAN';
  const o = order.data;

  if (order.loading) return <p className="text-sm text-ink-muted">Memuat detail order...</p>;
  if (order.error || !o)
    return <Alert variant="danger" title="Gagal memuat data" message={order.error ?? 'Data tidak ditemukan.'} onRetry={order.reload} />;

  const canWithdraw = role === 'MARKETING' && o.status === 'MENUNGGU_PERSETUJUAN';
  const canCancel = role === 'PIMPINAN' && (o.status === 'DISETUJUI' || o.status === 'DALAM_PRODUKSI');

  async function withdraw() {
    if (!reason.trim()) {
      setReasonError('Alasan wajib diisi.');
      return;
    }
    setSaving(true);
    setReasonError(null);
    try {
      const res = await orderApi.withdraw(id, reason);
      setFlash(res.message ?? 'Pengajuan order berhasil ditarik.');
      setReason('');
      await order.reload();
      onChanged();
    } catch (err) {
      setReasonError(parseApiError(err).message);
    } finally {
      setSaving(false);
    }
  }

  async function openCancel() {
    setCancelOpen(true);
    setCancelReason('');
    setParty('');
    setCancelError(null);
    setPreview(null);
    try {
      setPreview(await orderApi.cancellationPreview(id));
    } catch (err) {
      setCancelError(parseApiError(err).message);
    }
  }

  async function cancel() {
    if (!cancelReason.trim()) {
      setCancelError('Alasan wajib diisi.');
      return;
    }
    if (!party) {
      setCancelError('Pilih BUYER atau PERUSAHAAN.');
      return;
    }
    setSaving(true);
    setCancelError(null);
    try {
      const res = await orderApi.cancel(id, cancelReason, party);
      setFlash(res.message ?? 'Order berhasil dibatalkan.');
      setCancelOpen(false);
      await order.reload();
      onChanged();
    } catch (err) {
      setCancelError(parseApiError(err).message);
    } finally {
      setSaving(false);
    }
  }

  const sumQty = (d: Detail) => d.sizes.reduce((a, z) => a + z.qty - z.cancelled_qty, 0);
  const last = o.status_history[o.status_history.length - 1];

  return (
    <div className="space-y-4">
      {/* 3. Judul detail */}
      <div>
        <h2 className="text-xl font-semibold text-ink">
          {o.order_code} · {o.buyer_name} · {o.scheme}
        </h2>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
          <Badge status={o.status} />
          Deadline {formatDate(o.deadline)} · {formatStatus(o.level_code)} · batas reject {formatPercent(o.reject_limit_pct)} · sanksi: {o.late_penalty}
        </p>
      </div>

      {flash && <Alert variant="success" message={flash} onClose={() => setFlash(null)} />}

      <DataTable
        columns={[
          { key: 'kode', header: 'Kode barang', render: (d: Detail) => d.item_code },
          { key: 'style', header: 'Style', render: (d: Detail) => `${d.buyer_style_name ?? d.item_name} (${d.color})` },
          { key: 'qty', header: 'Jumlah', align: 'right', render: (d: Detail) => formatNumber(sumQty(d)) },
          ...(showPrice
            ? [{ key: 'harga', header: 'Harga/pcs', align: 'right' as const, render: (d: Detail) => formatCurrency(d.unit_price, o.currency) }]
            : []),
          // 5. Progres per style hanya untuk PPIC dan Pimpinan
          ...(showProgress
            ? [{ key: 'progres', header: 'Progres', align: 'right' as const, render: (d: Detail) => formatPercent(d.completion_pct) }]
            : []),
        ]}
        rows={o.details}
        rowKey={(d) => d.id}
        emptyMessage="Order belum memiliki style."
      />
      <p className="text-xs text-ink-muted">
        Total {formatNumber(o.total_qty)} pcs · sudah dikirim {formatNumber(o.shipped_qty)} pcs
        {showPrice && ` · nilai ${formatCurrency(o.total_value, o.currency)}`}
      </p>

      {/* 4. Riwayat status */}
      <div className="text-xs text-ink-muted">
        {last && (
          <p>
            Riwayat status: {formatDateTime(last.changed_at)} · {formatStatus(last.status)} · {last.changed_by_name}
            {last.reason && ` — ${last.reason}`}
          </p>
        )}
        {o.status_history.length > 1 && (
          <details className="mt-1">
            <summary className="cursor-pointer">Lihat semua riwayat ({o.status_history.length})</summary>
            <ol className="mt-1 space-y-0.5">
              {o.status_history.map((h, i) => (
                <li key={i}>
                  {formatDateTime(h.changed_at)} · {formatStatus(h.status)} · {h.changed_by_name}
                  {h.reason && ` — ${h.reason}`}
                </li>
              ))}
            </ol>
          </details>
        )}
      </div>

      {(o.status === 'DITOLAK' || o.status === 'DITARIK') && (
        <Alert variant="warning" message="Order ini bersifat final dan hanya dapat dilihat." />
      )}

      {/* 6. Batalkan Order (Pimpinan) */}
      {canCancel && (
        <div className="flex justify-end border-t border-line pt-4">
          <Button variant="danger" onClick={openCancel} className="px-6">
            Batalkan Order
          </Button>
        </div>
      )}

      {/* 7-8. Tarik Pengajuan (Marketing, order Menunggu Persetujuan) */}
      {canWithdraw && (
        <div className="space-y-3 border-t border-line pt-4">
          <Textarea
            label="Alasan penarikan"
            required
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            error={reasonError ?? undefined}
          />
          <div className="flex justify-end">
            <Button variant="danger" loading={saving} onClick={withdraw} className="px-6">
              Tarik Pengajuan
            </Button>
          </div>
        </div>
      )}

      <Modal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title={`Batalkan order ${o.order_code}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCancelOpen(false)}>
              Kembali
            </Button>
            <Button variant="danger" loading={saving} onClick={cancel}>
              Batalkan
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {cancelError && <Alert variant="danger" message={cancelError} />}
          {preview && (
            <div className="rounded-lg bg-surface-muted p-3 text-sm">
              <p>Perkiraan berdasarkan kebijakan pembatalan:</p>
              <p className="mt-1">
                Denda {formatPercent(preview.penalty_pct)} × nilai {formatCurrency(preview.total_value, preview.currency)} ={' '}
                <span className="font-semibold">{formatCurrency(preview.penalty_amount, preview.currency)}</span>
              </p>
              <p>
                Refund DP {formatPercent(preview.down_payment_refund_pct)} × DP {formatCurrency(preview.dp_paid, preview.currency)} ={' '}
                <span className="font-semibold">{formatCurrency(preview.refund_amount, preview.currency)}</span>
              </p>
            </div>
          )}
          <Select
            label="Diminta oleh"
            required
            placeholder="Pilih pihak"
            value={party}
            onChange={(e) => setParty(e.target.value)}
            options={[
              { value: 'BUYER', label: 'Buyer' },
              { value: 'PERUSAHAAN', label: 'Perusahaan' },
            ]}
          />
          <Textarea label="Alasan pembatalan" required value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
        </div>
      </Modal>
    </div>
  );
}
