import { useMemo, useState } from 'react';
import { Badge, Select } from '../../components/ui';
import { formatDate, formatNumber, formatPercent, formatStatus } from '../../lib/format';
import { orderApi, type DashboardData } from '../../lib/api/order';
import { validateDateRange } from '../../lib/validation';
import { DataTable, PageHeader, useLoad, type Col } from './shared';

// SCR-14 Dashboard Pimpinan (FSD 2.14, mockup Gambar 3.14).
// Filter dan kartu dihitung dari baris yang sama dengan tabel, supaya angkanya selalu cocok.

type Row = DashboardData['orders'][number];

const FINAL = ['SELESAI', 'DITOLAK', 'DITARIK', 'DIBATALKAN'];
const ACTIVE = ['MENUNGGU_PERSETUJUAN', 'DISETUJUI', 'DALAM_PRODUKSI'];

function Flags({ r }: { r: Pick<Row, 'is_at_risk' | 'is_over_reject'> }) {
  if (!r.is_at_risk && !r.is_over_reject) return <span className="text-ink-subtle">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {r.is_at_risk && <Badge tone="danger">Berisiko Terlambat</Badge>}
      {r.is_over_reject && <Badge tone="warning">Melebihi Reject</Badge>}
    </div>
  );
}

export default function DashboardPage() {
  const dash = useLoad(() => orderApi.dashboard(), []);
  const [filter, setFilter] = useState({ buyer: '', status: 'AKTIF', from: '', to: '' });
  const [selected, setSelected] = useState<Row | null>(null);
  const dateError = validateDateRange(filter.from, filter.to);

  const all = useMemo(() => dash.data?.orders ?? [], [dash.data]);
  const buyers = useMemo(() => [...new Set(all.map((r) => r.buyer_name))].sort(), [all]);

  // 1-3. Filter buyer, status, periode deadline
  const rows = useMemo(
    () =>
      all.filter((r) => {
        if (filter.buyer && r.buyer_name !== filter.buyer) return false;
        if (filter.status === 'AKTIF' && FINAL.includes(r.status)) return false;
        if (filter.status && filter.status !== 'AKTIF' && r.status !== filter.status) return false;
        if (!dateError && filter.from && r.deadline < filter.from) return false;
        if (!dateError && filter.to && r.deadline > filter.to) return false;
        return true;
      }),
    [all, filter, dateError],
  );

  // 4. Kartu ringkasan
  const cards = [
    { label: 'Order aktif', value: rows.filter((r) => ACTIVE.includes(r.status)).length, color: 'border-l-info text-info' },
    { label: 'Berisiko terlambat', value: rows.filter((r) => r.is_at_risk).length, color: 'border-l-danger text-danger' },
    { label: 'Melebihi batas reject', value: rows.filter((r) => r.is_over_reject).length, color: 'border-l-warning text-warning' },
    { label: 'Sisa kiriman (pcs)', value: rows.reduce((a, r) => a + r.remaining_shipment, 0), color: 'border-l-ink text-ink' },
  ];

  const columns: Col<Row>[] = [
    { key: 'kode', header: 'Kode Order', render: (r) => r.order_code },
    { key: 'buyer', header: 'Buyer', render: (r) => r.buyer_name },
    { key: 'deadline', header: 'Deadline', render: (r) => formatDate(r.deadline) },
    { key: 'status', header: 'Status', render: (r) => <Badge status={r.status} /> },
    { key: 'selesai', header: '% selesai', align: 'right', render: (r) => formatPercent(r.completion_pct) },
    { key: 'waktu', header: '% waktu', align: 'right', render: (r) => formatPercent(r.time_pct) },
    { key: 'sisa', header: 'Sisa kiriman', align: 'right', render: (r) => formatNumber(r.remaining_shipment) },
    { key: 'tanda', header: 'Tanda', render: (r) => <Flags r={r} /> },
  ];

  const current = selected && rows.some((r) => r.order_id === selected.order_id) ? selected : null;

  return (
    <div>
      <PageHeader code="SCR-14" title="Dashboard" subtitle="Data diperbarui ≤ 1 menit setelah progres/QC disimpan" />

      <div className="mb-5 grid gap-4 md:grid-cols-[1fr_1fr_1.1fr]">
        <Select
          label="Buyer"
          value={filter.buyer}
          onChange={(e) => setFilter({ ...filter, buyer: e.target.value })}
          options={[{ value: '', label: 'Semua buyer' }, ...buyers.map((b) => ({ value: b, label: b }))]}
        />
        <Select
          label="Status"
          value={filter.status}
          onChange={(e) => setFilter({ ...filter, status: e.target.value })}
          options={[
            { value: 'AKTIF', label: 'Semua status aktif' },
            { value: '', label: 'Semua status' },
            ...[...ACTIVE, ...FINAL].map((s) => ({ value: s, label: formatStatus(s) })),
          ]}
        />
        <div>
          <p className="mb-1.5 text-sm font-medium text-ink">Periode deadline</p>
          <div className="flex items-center gap-2">
            <input
              type="date"
              className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm"
              value={filter.from}
              onChange={(e) => setFilter({ ...filter, from: e.target.value })}
            />
            <span className="text-ink-muted">–</span>
            <input
              type="date"
              className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm"
              value={filter.to}
              onChange={(e) => setFilter({ ...filter, to: e.target.value })}
            />
          </div>
          {dateError && <p className="mt-1 text-xs text-danger">{dateError}</p>}
        </div>
      </div>

      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className={`rounded-2xl border border-line border-l-4 bg-surface p-5 ${c.color.split(' ')[0]}`}>
            <p className="text-sm font-medium text-ink-muted">{c.label}</p>
            <p className={`mt-1 text-4xl font-bold ${c.color.split(' ')[1]}`}>{dash.loading ? '–' : formatNumber(c.value)}</p>
          </div>
        ))}
      </div>

      {/* 5. Tabel order */}
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.order_id}
        selectedKey={current?.order_id}
        onRowClick={setSelected}
        loading={dash.loading}
        error={dash.error}
        onRetry={dash.reload}
        emptyMessage="Tidak ada order yang sesuai filter."
      />

      {/* 6. Style dari order terpilih */}
      {current ? (
        <StyleSection key={current.order_id} row={current} />
      ) : (
        !dash.loading && rows.length > 0 && <p className="mt-4 text-xs text-ink-muted">Klik salah satu order untuk melihat progres per style.</p>
      )}
    </div>
  );
}

function StyleSection({ row }: { row: Row }) {
  const order = useLoad(() => orderApi.order(row.order_id), [row.order_id]);
  type D = NonNullable<typeof order.data>['details'][number];

  return (
    <div className="mt-6">
      <h2 className="mb-3 text-xl font-semibold text-ink">Style ({row.order_code})</h2>
      <DataTable
        columns={[
          { key: 'style', header: 'Style', render: (d: D) => d.item_code },
          { key: 'nama', header: 'Nama', render: (d: D) => `${d.buyer_style_name ?? d.item_name} (${d.color})` },
          { key: 'selesai', header: '% selesai', align: 'right', render: (d: D) => formatPercent(d.completion_pct) },
          { key: 'waktu', header: '% waktu', align: 'right', render: () => formatPercent(row.time_pct) },
          {
            key: 'tanda',
            header: 'Tanda',
            // Style tertinggal bila progresnya lebih kecil dari waktu yang sudah terpakai
            render: (d: D) => (d.completion_pct < row.time_pct && row.status === 'DALAM_PRODUKSI' ? <Badge tone="danger">Berisiko</Badge> : <span className="text-ink-subtle">—</span>),
          },
        ]}
        rows={order.data?.details ?? []}
        rowKey={(d) => d.id}
        loading={order.loading}
        error={order.error}
        onRetry={order.reload}
        emptyMessage="Order ini belum memiliki style."
      />
    </div>
  );
}
