import { useState } from 'react';
import { Alert, Button, Textarea } from '../../components/ui';
import { produksiApi, type SpkRow } from '../../lib/api/produksi';
import { formatDate, formatNumber } from '../../lib/format';
import { parseApiError } from '../../lib/http';
import { MSG_REASON_REQUIRED } from '../../lib/validation';
import ApprovalPage from '../order/ApprovalPage';
import { Card, DataTable, SuccessButton, sortSizes, useLoad } from '../order/shared';

// SCR-08 Persetujuan, tab "SPK" (FSD-2.11, mockup Gambar 3.8). Hanya Pimpinan.
// Halaman dan tab "Order" milik B; komponen ini mengisi tab SPK lewat prop spkTab.

/** Dipakai di App.tsx untuk route /persetujuan: halaman B + tab SPK milik C. */
export function PersetujuanPage() {
  const pending = useLoad(() => produksiApi.spkList({ status: 'MENUNGGU_PERSETUJUAN' }), []);
  return (
    <ApprovalPage
      spkCount={pending.loading ? undefined : (pending.data?.rows.length ?? 0)}
      spkTab={<SpkApprovalTab list={pending} />}
    />
  );
}

type PendingList = ReturnType<typeof useLoad<{ rows: SpkRow[] }>>;

export default function SpkApprovalTab({ list }: { list: PendingList }) {
  const [selected, setSelected] = useState<SpkRow | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const rows = list.data?.rows ?? [];
  const current = selected && rows.some((r) => r.spk_id === selected.spk_id) ? selected : null;

  return (
    <>
      {flash && <Alert className="mb-4" variant="success" message={flash} onClose={() => setFlash(null)} />}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Daftar SPK menunggu persetujuan */}
        <Card className="self-start">
          <DataTable
            columns={[
              { key: 'no', header: 'Nomor SPK', render: (s: SpkRow) => s.spk_no },
              { key: 'style', header: 'Style', render: (s: SpkRow) => s.item_code },
              { key: 'target', header: 'Target', render: (s: SpkRow) => formatDate(s.target_date) },
            ]}
            rows={rows}
            rowKey={(s) => s.spk_id}
            selectedKey={current?.spk_id}
            onRowClick={setSelected}
            loading={list.loading}
            error={list.error}
            onRetry={list.reload}
            emptyMessage="Tidak ada SPK yang menunggu persetujuan."
          />
        </Card>

        {/* Detail + keputusan */}
        <Card className="self-start">
          {current ? (
            <SpkDecisionPanel
              key={current.spk_id}
              row={current}
              onDone={async (message) => {
                setFlash(message);
                setSelected(null);
                await list.reload();
              }}
            />
          ) : (
            <p className="py-10 text-center text-sm text-ink-muted">Pilih SPK di daftar untuk melihat detail dan memberi keputusan.</p>
          )}
        </Card>
      </div>
    </>
  );
}

function SpkDecisionPanel({ row, onDone }: { row: SpkRow; onDone: (message: string) => Promise<void> }) {
  const detail = useLoad(() => produksiApi.spk(row.spk_id), [row.spk_id]);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);
  const d = detail.data;

  async function approve() {
    setBusy('approve');
    setError(null);
    try {
      const res = await produksiApi.approveSpk(row.spk_id);
      const note = res.data.order_status === 'DALAM_PRODUKSI' ? ' Order kini berstatus Dalam Produksi.' : '';
      await onDone(`SPK ${row.spk_no} disetujui.${note}`);
    } catch (err) {
      setError(parseApiError(err).message);
    } finally {
      setBusy(null);
    }
  }

  async function reject() {
    if (!reason.trim()) {
      setError(MSG_REASON_REQUIRED);
      return;
    }
    setBusy('reject');
    setError(null);
    try {
      await produksiApi.rejectSpk(row.spk_id, reason.trim());
      await onDone(`SPK ${row.spk_no} ditolak. Data bahan style dibuka kembali untuk PPIC.`);
    } catch (err) {
      setError(parseApiError(err).message);
    } finally {
      setBusy(null);
    }
  }

  if (detail.loading) return <p className="text-sm text-ink-muted">Memuat detail SPK...</p>;
  if (detail.error || !d)
    return <Alert variant="danger" title="Gagal memuat data" message={detail.error ?? 'Data tidak ditemukan.'} onRetry={detail.reload} />;

  const sizeOrder = sortSizes(d.sizes.map((z) => z.size));
  const sizes = sizeOrder.map((s) => d.sizes.find((z) => z.size === s)!);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-ink">
          {d.spk_no} · {d.order_code} · {d.item_code}
        </h2>
        <p className="mt-1 text-xs text-ink-muted">
          {d.item_name} · {d.color} · {d.line_name} · target {formatDate(d.target_date)} · diajukan oleh {d.created_by_name}
        </p>
      </div>

      <DataTable
        columns={[
          { key: 'size', header: 'Ukuran', render: (z: { size: string; qty: number }) => z.size },
          { key: 'qty', header: 'Jumlah', align: 'right', render: (z: { size: string; qty: number }) => formatNumber(z.qty) },
        ]}
        rows={sizes}
        rowKey={(z) => z.size}
      />
      <p className="text-xs text-ink-muted">Total {formatNumber(d.total_qty)} pcs</p>

      {error && <Alert variant="danger" message={error} />}

      <Textarea label="Alasan (wajib bila menolak)" rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />

      <div className="flex gap-3">
        <SuccessButton disabled={busy !== null} onClick={approve}>
          {busy === 'approve' ? 'Menyimpan...' : 'Setujui'}
        </SuccessButton>
        <Button variant="danger" className="px-8" loading={busy === 'reject'} disabled={busy !== null} onClick={reject}>
          Tolak
        </Button>
      </div>
    </div>
  );
}
