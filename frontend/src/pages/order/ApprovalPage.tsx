import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Button, Modal, Table, Textarea, type TableColumn } from '../../components/ui';
import { formatCurrency, formatDate, formatNumber } from '../../lib/format';
import { parseApiError } from '../../lib/http';
import { orderApi, type OrderSummary } from '../../lib/api/order';
import { PageHeader, useLoad } from './shared';

// SCR-08 Persetujuan (FSD 2.6). Tab "Order" milik B; tab "SPK" diisi C lewat prop spkTab.

export default function ApprovalPage({ spkTab }: { spkTab?: ReactNode }) {
  const [tab, setTab] = useState<'order' | 'spk'>('order');
  const list = useLoad(() => orderApi.orders({ status: 'MENUNGGU_PERSETUJUAN' }), []);
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<OrderSummary | null>(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);

  async function approve(o: OrderSummary) {
    setBusyId(o.order_id);
    try {
      await orderApi.approve(o.order_id);
      setFlash({ ok: true, text: `Order ${o.order_code} disetujui.` });
    } catch (err) {
      setFlash({ ok: false, text: parseApiError(err).message });
    } finally {
      setBusyId(null);
      await list.reload();
    }
  }

  async function reject() {
    if (!rejecting) return;
    if (!reason.trim()) {
      setReasonError('Alasan wajib diisi.');
      return;
    }
    setBusyId(rejecting.order_id);
    try {
      await orderApi.reject(rejecting.order_id, reason);
      setFlash({ ok: true, text: `Order ${rejecting.order_code} ditolak.` });
      setRejecting(null);
    } catch (err) {
      setReasonError(parseApiError(err).message);
    } finally {
      setBusyId(null);
      await list.reload();
    }
  }

  const columns: TableColumn<OrderSummary>[] = [
    {
      key: 'order_code',
      header: 'Kode Order',
      render: (o) => (
        <Link to={`/order/${o.order_id}`} className="font-medium text-brand hover:underline">
          {o.order_code}
        </Link>
      ),
    },
    { key: 'buyer_name', header: 'Buyer' },
    { key: 'order_date', header: 'Diajukan', render: (o) => formatDate(o.order_date) },
    { key: 'deadline', header: 'Deadline', render: (o) => formatDate(o.deadline) },
    { key: 'total_qty', header: 'Jumlah', align: 'right', render: (o) => formatNumber(o.total_qty) },
    { key: 'total_value', header: 'Nilai', align: 'right', render: (o) => formatCurrency(o.total_value, o.currency) },
    { key: 'handled_by_name', header: 'Marketing' },
    {
      key: 'aksi',
      header: 'Aksi',
      render: (o) => (
        <div className="flex gap-2">
          <Button size="sm" loading={busyId === o.order_id} onClick={() => approve(o)}>
            Setujui
          </Button>
          <Button size="sm" variant="danger" disabled={busyId === o.order_id} onClick={() => { setRejecting(o); setReason(''); setReasonError(null); }}>
            Tolak
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader code="SCR-08" title="Persetujuan" />

      <div className="mb-4 flex gap-2 border-b border-line">
        {(['order', 'spk'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tab === t ? 'border-brand text-brand' : 'border-transparent text-ink-muted hover:text-ink'}`}
          >
            {t === 'order' ? 'Order' : 'SPK'}
          </button>
        ))}
      </div>

      {tab === 'spk' ? (
        spkTab ?? <Alert variant="info" message="Bagian persetujuan SPK sedang disiapkan oleh modul Produksi." />
      ) : (
        <div className="space-y-4">
          {flash && <Alert variant={flash.ok ? 'success' : 'danger'} message={flash.text} onClose={() => setFlash(null)} />}
          <Table
            columns={columns}
            data={list.data?.rows ?? []}
            rowKey={(o) => o.order_id}
            loading={list.loading}
            error={list.error}
            onRetry={list.reload}
            emptyMessage="Tidak ada order yang menunggu persetujuan."
          />
        </div>
      )}

      <Modal
        open={rejecting !== null}
        onClose={() => setRejecting(null)}
        title={`Tolak order ${rejecting?.order_code ?? ''}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRejecting(null)}>
              Kembali
            </Button>
            <Button variant="danger" loading={busyId === rejecting?.order_id} onClick={reject}>
              Tolak
            </Button>
          </>
        }
      >
        <Textarea label="Alasan penolakan" required value={reason} onChange={(e) => setReason(e.target.value)} error={reasonError ?? undefined} />
      </Modal>
    </div>
  );
}
