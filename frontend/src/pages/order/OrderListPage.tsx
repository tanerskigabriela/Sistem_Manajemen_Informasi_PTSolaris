import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Badge, Button, Input, Select, Table, type TableColumn } from '../../components/ui';
import { useAuth } from '../../contexts/AuthContext';
import { formatCurrency, formatDate, formatNumber, formatStatus } from '../../lib/format';
import { orderApi, type OrderSummary } from '../../lib/api/order';
import { validateDateRange } from '../../lib/validation';
import { PageHeader, useLoad } from './shared';

// SCR-06 Daftar Order (FSD 2.5)

const STATUSES = ['MENUNGGU_PERSETUJUAN', 'DISETUJUI', 'DALAM_PRODUKSI', 'SELESAI', 'DITOLAK', 'DITARIK', 'DIBATALKAN'];

export default function OrderListPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [filter, setFilter] = useState({ q: '', status: '', date_from: '', date_to: '' });
  const [applied, setApplied] = useState({ ...filter, page: 1 });
  const [dateError, setDateError] = useState<string | null>(null);

  const list = useLoad(() => orderApi.orders(applied), [applied]);

  function applyFilter() {
    const err = validateDateRange(filter.date_from, filter.date_to);
    setDateError(err);
    if (!err) setApplied({ ...filter, page: 1 });
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
    { key: 'buyer_name', header: 'Buyer', render: (o) => `${o.buyer_code} — ${o.buyer_name}` },
    { key: 'order_date', header: 'Tanggal', render: (o) => formatDate(o.order_date) },
    { key: 'deadline', header: 'Deadline', render: (o) => formatDate(o.deadline) },
    { key: 'level_code', header: 'Level', render: (o) => formatStatus(o.level_code) },
    { key: 'total_qty', header: 'Jumlah', align: 'right', render: (o) => formatNumber(o.total_qty) },
    // total_value tidak dikirim backend untuk role selain MARKETING dan PIMPINAN
    ...(user?.role_code === 'MARKETING' || user?.role_code === 'PIMPINAN'
      ? [{ key: 'total_value', header: 'Nilai', align: 'right' as const, render: (o: OrderSummary) => formatCurrency(o.total_value, o.currency) }]
      : []),
    { key: 'status', header: 'Status', render: (o) => <Badge status={o.status} /> },
  ];

  return (
    <div>
      <PageHeader
        code="SCR-06"
        title="Daftar Order"
        actions={user?.role_code === 'MARKETING' && <Button onClick={() => navigate('/order/baru')}>+ Order Baru</Button>}
      />

      <div className="mb-4 grid gap-3 rounded-xl border border-line bg-surface p-4 sm:grid-cols-5">
        <Input placeholder="Cari kode order / buyer" value={filter.q} onChange={(e) => setFilter({ ...filter, q: e.target.value })} />
        <Select
          placeholder="Semua status"
          value={filter.status}
          onChange={(e) => setFilter({ ...filter, status: e.target.value })}
          options={STATUSES.map((s) => ({ value: s, label: formatStatus(s) }))}
        />
        <Input type="date" value={filter.date_from} onChange={(e) => setFilter({ ...filter, date_from: e.target.value })} error={dateError ?? undefined} />
        <Input type="date" value={filter.date_to} onChange={(e) => setFilter({ ...filter, date_to: e.target.value })} />
        <Button onClick={applyFilter}>Terapkan</Button>
      </div>

      <Table
        columns={columns}
        data={list.data?.rows ?? []}
        rowKey={(o) => o.order_id}
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        emptyMessage="Belum ada order yang sesuai filter."
        meta={list.data?.meta}
        onPageChange={(page) => setApplied({ ...applied, page })}
      />
    </div>
  );
}
