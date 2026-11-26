import { Link } from 'react-router-dom';
import { Alert, Badge, Table, type TableColumn } from '../../components/ui';
import { formatDate, formatNumber, formatPercent } from '../../lib/format';
import { orderApi, type DashboardData } from '../../lib/api/order';
import { PageHeader, useLoad } from './shared';

// SCR-14 Dashboard Pimpinan (FSD 2.14). Angka kartu dihitung backend dari baris yang sama dengan tabel.

type Row = DashboardData['orders'][number];

function Bar({ value, tone }: { value: number; tone: string }) {
  const width = Math.max(0, Math.min(100, value));
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 overflow-hidden rounded-full bg-surface-muted">
        <div className={`h-full ${tone}`} style={{ width: `${width}%` }} />
      </div>
      <span className="text-xs text-ink-muted">{formatPercent(value)}</span>
    </div>
  );
}

export default function DashboardPage() {
  const dash = useLoad(() => orderApi.dashboard(), []);
  const s = dash.data?.summary;

  const cards = s
    ? [
        { label: 'Menunggu persetujuan', value: s.waiting_approval, tone: 'text-warning' },
        { label: 'Disetujui', value: s.approved, tone: 'text-success' },
        { label: 'Dalam produksi', value: s.in_production, tone: 'text-info' },
        { label: 'Selesai', value: s.finished, tone: 'text-success' },
        { label: 'Berisiko terlambat', value: s.at_risk, tone: 'text-danger' },
        { label: 'Melebihi batas reject', value: s.over_reject, tone: 'text-danger' },
      ]
    : [];

  const columns: TableColumn<Row>[] = [
    {
      key: 'order_code',
      header: 'Order',
      render: (r) => (
        <Link to={`/order/${r.order_id}`} className="font-medium text-brand hover:underline">
          {r.order_code}
        </Link>
      ),
    },
    { key: 'buyer_name', header: 'Buyer' },
    { key: 'deadline', header: 'Deadline', render: (r) => formatDate(r.deadline) },
    { key: 'status', header: 'Status', render: (r) => <Badge status={r.status} /> },
    { key: 'completion_pct', header: 'Progres produksi', render: (r) => <Bar value={r.completion_pct} tone="bg-brand" /> },
    { key: 'time_pct', header: 'Waktu terpakai', render: (r) => <Bar value={r.time_pct} tone="bg-warning" /> },
    { key: 'reject_pct', header: 'Reject', align: 'right', render: (r) => formatPercent(r.reject_pct) },
    {
      key: 'flags',
      header: 'Tanda',
      render: (r) => (
        <div className="flex flex-wrap gap-1">
          {r.is_at_risk && <Badge tone="danger">Berisiko</Badge>}
          {r.is_over_reject && <Badge tone="warning">Reject tinggi</Badge>}
          {!r.is_at_risk && !r.is_over_reject && <span className="text-xs text-ink-subtle">-</span>}
        </div>
      ),
    },
    { key: 'remaining_shipment', header: 'Sisa kirim', align: 'right', render: (r) => formatNumber(r.remaining_shipment) },
  ];

  return (
    <div className="space-y-5">
      <PageHeader code="SCR-14" title="Dashboard Pimpinan" />

      {dash.error ? (
        <Alert variant="danger" title="Gagal memuat data" message={dash.error} onRetry={dash.reload} />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {(dash.loading ? Array.from({ length: 6 }, (_, i) => ({ label: '...', value: 0, tone: '', key: i })) : cards).map((c, i) => (
              <div key={i} className="rounded-xl border border-line bg-surface p-4 shadow-xs">
                <p className="text-xs text-ink-muted">{c.label}</p>
                <p className={`mt-1 text-2xl font-semibold ${c.tone}`}>{dash.loading ? '–' : c.value}</p>
              </div>
            ))}
          </div>

          <Table
            columns={columns}
            data={dash.data?.orders ?? []}
            rowKey={(r) => r.order_id}
            loading={dash.loading}
            emptyMessage="Belum ada order aktif."
          />
        </>
      )}
    </div>
  );
}
