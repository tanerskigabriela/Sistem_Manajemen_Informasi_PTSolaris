import { useState, type ReactNode } from 'react';
import { Alert, Button, Textarea } from '../../components/ui';
import { formatCurrency, formatDate, formatNumber, formatPercent } from '../../lib/format';
import { parseApiError } from '../../lib/http';
import { orderApi, type OrderSummary } from '../../lib/api/order';
import { Card, DataTable, PageHeader, PillTabs, SuccessButton, useLoad } from './shared';

// SCR-08 Persetujuan (FSD 2.6, mockup Gambar 3.8). Hanya Pimpinan.
// Tab "Order" milik B; tab "SPK" diisi C lewat prop spkTab (dan spkCount untuk angka di tab).

export default function ApprovalPage({ spkTab, spkCount }: { spkTab?: ReactNode; spkCount?: number }) {
  const [tab, setTab] = useState<'order' | 'spk'>('order');
  const list = useLoad(() => orderApi.orders({ status: 'MENUNGGU_PERSETUJUAN', per_page: 100 }), []);
  const [selected, setSelected] = useState<OrderSummary | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const rows = list.data?.rows ?? [];
  const current = selected && rows.some((r) => r.order_id === selected.order_id) ? selected : null;

  return (
    <div>
      <PageHeader code="SCR-08" title="Persetujuan" subtitle="Hanya Pimpinan yang dapat menyetujui atau menolak" />

      {/* 1. Tab */}
      <PillTabs
        tabs={[
          { key: 'order', label: `Order (${list.loading ? '…' : rows.length})` },
          { key: 'spk', label: spkCount === undefined ? 'SPK' : `SPK (${spkCount})` },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'spk' ? (
        spkTab ?? <Alert variant="info" message="Bagian persetujuan SPK sedang disiapkan oleh modul Produksi." />
      ) : (
        <>
          {flash && <Alert className="mb-4" variant="success" message={flash} onClose={() => setFlash(null)} />}
          <div className="grid gap-5 lg:grid-cols-2">
            {/* 2. Daftar order menunggu persetujuan */}
            <Card className="self-start">
              <DataTable
                columns={[
                  { key: 'kode', header: 'Kode Order', render: (o: OrderSummary) => o.order_code },
                  { key: 'buyer', header: 'Buyer', render: (o: OrderSummary) => <span title={o.buyer_name}>{o.buyer_code}</span> },
                  { key: 'deadline', header: 'Deadline', render: (o: OrderSummary) => formatDate(o.deadline) },
                  { key: 'style', header: 'Jumlah style', render: (o: OrderSummary) => o.style_count },
                ]}
                rows={rows}
                rowKey={(o) => o.order_id}
                selectedKey={current?.order_id}
                onRowClick={setSelected}
                loading={list.loading}
                error={list.error}
                onRetry={list.reload}
                emptyMessage="Tidak ada order yang menunggu persetujuan."
              />
            </Card>

            {/* 3-6. Detail + keputusan */}
            <Card className="self-start">
              {current ? (
                <DecisionPanel
                  key={current.order_id}
                  summary={current}
                  onDone={async (message) => {
                    setFlash(message);
                    setSelected(null);
                    await list.reload();
                  }}
                />
              ) : (
                <p className="py-10 text-center text-sm text-ink-muted">Pilih order di daftar untuk melihat detail dan memberi keputusan.</p>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function DecisionPanel({ summary, onDone }: { summary: OrderSummary; onDone: (message: string) => Promise<void> }) {
  const order = useLoad(() => orderApi.order(summary.order_id), [summary.order_id]);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);
  const o = order.data;

  async function approve() {
    setBusy('approve');
    setError(null);
    try {
      await orderApi.approve(summary.order_id);
      await onDone(`Order ${summary.order_code} disetujui.`);
    } catch (err) {
      setError(parseApiError(err).message);
    } finally {
      setBusy(null);
    }
  }

  async function reject() {
    if (!reason.trim()) {
      setError('Alasan wajib diisi.');
      return;
    }
    setBusy('reject');
    setError(null);
    try {
      await orderApi.reject(summary.order_id, reason);
      await onDone(`Order ${summary.order_code} ditolak.`);
    } catch (err) {
      setError(parseApiError(err).message);
    } finally {
      setBusy(null);
    }
  }

  if (order.loading) return <p className="text-sm text-ink-muted">Memuat detail order...</p>;
  if (order.error || !o)
    return <Alert variant="danger" title="Gagal memuat data" message={order.error ?? 'Data tidak ditemukan.'} onRetry={order.reload} />;

  type D = (typeof o.details)[number];
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-ink">
          {o.order_code} · {o.buyer_name} · {o.scheme}
        </h2>
        <p className="mt-1 text-xs text-ink-muted">
          Deadline {formatDate(o.deadline)} · batas reject {formatPercent(o.reject_limit_pct)} · sanksi: {o.late_penalty}
        </p>
      </div>

      <DataTable
        columns={[
          { key: 'kode', header: 'Kode barang', render: (d: D) => d.item_code },
          { key: 'style', header: 'Style', render: (d: D) => d.buyer_style_name ?? d.item_name },
          { key: 'warna', header: 'Warna', render: (d: D) => d.color },
          { key: 'qty', header: 'Jumlah', align: 'right', render: (d: D) => formatNumber(d.sizes.reduce((a, z) => a + z.qty - z.cancelled_qty, 0)) },
          { key: 'harga', header: 'Harga/pcs', align: 'right', render: (d: D) => formatCurrency(d.unit_price, o.currency) },
        ]}
        rows={o.details}
        rowKey={(d) => d.id}
      />
      <p className="text-xs text-ink-muted">
        Total {formatNumber(o.total_qty)} pcs · nilai {formatCurrency(o.total_value, o.currency)} · diajukan oleh {o.handled_by_name}
      </p>

      {error && <Alert variant="danger" message={error} />}

      {/* 4. Alasan */}
      <Textarea label="Alasan (wajib bila menolak)" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />

      {/* 5-6. Setujui / Tolak */}
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
