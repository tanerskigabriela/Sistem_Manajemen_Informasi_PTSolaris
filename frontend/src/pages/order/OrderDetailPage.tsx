import { useState, type ReactNode } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { Alert, Badge, Button, Modal, Select, Textarea } from '../../components/ui';
import { useAuth } from '../../contexts/AuthContext';
import { formatCurrency, formatDate, formatDateTime, formatNumber, formatPercent, formatStatus } from '../../lib/format';
import { parseApiError } from '../../lib/http';
import { orderApi, type CancellationPreview } from '../../lib/api/order';
import { Card, PageHeader, useLoad } from './shared';

// SCR-06 Detail Order (FSD 2.5) + Tarik pengajuan (FSD 2.25, Marketing) + Batalkan order (FSD 2.7, Pimpinan)

export default function OrderDetailPage() {
  const { id = '' } = useParams();
  const location = useLocation();
  const { user } = useAuth();
  const order = useLoad(() => orderApi.order(id), [id]);
  const [flash, setFlash] = useState<string | null>((location.state as { flash?: string } | null)?.flash ?? null);

  const [dialog, setDialog] = useState<'withdraw' | 'cancel' | null>(null);
  const [reason, setReason] = useState('');
  const [party, setParty] = useState('');
  const [preview, setPreview] = useState<CancellationPreview | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const showPrice = user?.role_code === 'MARKETING' || user?.role_code === 'PIMPINAN';
  const o = order.data;

  async function openCancel() {
    setDialog('cancel');
    setReason('');
    setParty('');
    setDialogError(null);
    setPreview(null);
    try {
      setPreview(await orderApi.cancellationPreview(id));
    } catch (err) {
      setDialogError(parseApiError(err).message);
    }
  }

  async function submitDialog() {
    if (!reason.trim()) {
      setDialogError('Alasan wajib diisi.');
      return;
    }
    if (dialog === 'cancel' && !party) {
      setDialogError('Pilih BUYER atau PERUSAHAAN.');
      return;
    }
    setSaving(true);
    setDialogError(null);
    try {
      const res = dialog === 'withdraw' ? await orderApi.withdraw(id, reason) : await orderApi.cancel(id, reason, party);
      setFlash(res.message ?? 'Status order berhasil diubah.');
      setDialog(null);
      await order.reload();
    } catch (err) {
      setDialogError(parseApiError(err).message);
    } finally {
      setSaving(false);
    }
  }

  if (order.loading) return <p className="text-sm text-ink-muted">Memuat detail order...</p>;
  if (order.error || !o)
    return <Alert variant="danger" title="Gagal memuat data" message={order.error ?? 'Data tidak ditemukan.'} onRetry={order.reload} />;

  const canWithdraw = user?.role_code === 'MARKETING' && o.status === 'MENUNGGU_PERSETUJUAN';
  const canCancel = user?.role_code === 'PIMPINAN' && (o.status === 'DISETUJUI' || o.status === 'DALAM_PRODUKSI');

  return (
    <div className="space-y-5">
      <PageHeader
        code="SCR-06"
        title={`Detail Order ${o.order_code}`}
        actions={
          <>
            <Link to="/order" className="text-sm text-brand hover:underline self-center">
              ← Kembali ke daftar
            </Link>
            {canWithdraw && (
              <Button variant="secondary" onClick={() => { setDialog('withdraw'); setReason(''); setDialogError(null); }}>
                Tarik Pengajuan
              </Button>
            )}
            {canCancel && (
              <Button variant="danger" onClick={openCancel}>
                Batalkan Order
              </Button>
            )}
          </>
        }
      />

      {flash && <Alert variant="success" message={flash} onClose={() => setFlash(null)} />}
      {(o.status === 'DITOLAK' || o.status === 'DITARIK') && (
        <Alert variant="warning" message="Order ini bersifat final dan hanya dapat dilihat." />
      )}

      <Card title="Ringkasan">
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
          <Info label="Status" value={<Badge status={o.status} />} />
          <Info label="Buyer" value={`${o.buyer_code} — ${o.buyer_name}`} />
          <Info label="Nomor PO buyer" value={o.buyer_po_no ?? '-'} />
          <Info label="Tanggal order" value={formatDate(o.order_date)} />
          <Info label="Deadline" value={formatDate(o.deadline)} />
          <Info label="Level / skema" value={`${formatStatus(o.level_code)} / ${o.scheme}`} />
          <Info label="Batas reject" value={formatPercent(o.reject_limit_pct)} />
          <Info label="Total jumlah" value={`${formatNumber(o.total_qty)} pcs`} />
          {showPrice && <Info label="Nilai order" value={formatCurrency(o.total_value, o.currency)} />}
          <Info label="Sudah dikirim" value={`${formatNumber(o.shipped_qty)} pcs`} />
          <Info label="Ditangani oleh" value={o.handled_by_name} />
          <Info label="Sanksi keterlambatan" value={o.late_penalty} />
          {o.level_code === 'INTERNASIONAL' && (
            <Info label="Ekspor" value={`${o.incoterm ?? '-'} ke ${o.destination_port ?? '-'} (${o.destination_country ?? '-'})`} />
          )}
        </dl>
      </Card>

      <Card title="Style dan ukuran">
        <div className="space-y-4">
          {o.details.map((d) => (
            <div key={d.id} className="rounded-lg border border-line p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium text-ink">
                  {d.item_code} — {d.buyer_style_name ?? d.item_name} ({d.color})
                </p>
                <p className="text-xs text-ink-muted">
                  Progres {formatPercent(d.completion_pct)}
                  {showPrice && ` · ${formatCurrency(d.unit_price, o.currency)}/pcs, diskon ${formatPercent(d.discount_pct)}`}
                </p>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                {d.sizes.map((z) => (
                  <span key={z.size} className="rounded-md bg-surface-muted px-2 py-1">
                    {z.size}: {formatNumber(z.qty - z.cancelled_qty)}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Riwayat status">
        <ol className="space-y-2 text-sm">
          {o.status_history.map((h, i) => (
            <li key={i} className="flex flex-wrap items-center gap-2">
              <span className="w-40 text-ink-muted">{formatDateTime(h.changed_at)}</span>
              <Badge status={h.status} />
              <span>oleh {h.changed_by_name}</span>
              {h.reason && <span className="text-ink-muted">— {h.reason}</span>}
            </li>
          ))}
        </ol>
      </Card>

      <Modal
        open={dialog !== null}
        onClose={() => setDialog(null)}
        title={dialog === 'withdraw' ? 'Tarik pengajuan order' : 'Batalkan order'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialog(null)}>
              Kembali
            </Button>
            <Button variant="danger" loading={saving} onClick={submitDialog}>
              {dialog === 'withdraw' ? 'Tarik' : 'Batalkan'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {dialogError && <Alert variant="danger" message={dialogError} />}
          {dialog === 'cancel' && preview && (
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
          {dialog === 'cancel' && (
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
          )}
          <Textarea label="Alasan" required value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
      </Modal>
    </div>
  );
}

function Info({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="mt-0.5 text-ink">{value}</dd>
    </div>
  );
}
