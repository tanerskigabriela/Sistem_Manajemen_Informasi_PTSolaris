import { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Alert, Badge, Button, Select } from '../../components/ui';
import { useAuth } from '../../contexts/AuthContext';
import { formatDate, formatStatus } from '../../lib/format';
import { orderApi, type OrderSummary } from '../../lib/api/order';
import OrderDetailPanel from './OrderDetailPanel';
import { Card, DataTable, PageHeader, useLoad, type Col } from './shared';

// SCR-06 Daftar dan Detail Order (FSD 2.5, mockup Gambar 3.6).
// Kiri: filter + daftar order. Kanan: detail order yang dipilih (/order/:id).

const STATUSES = ['MENUNGGU_PERSETUJUAN', 'DISETUJUI', 'DALAM_PRODUKSI', 'SELESAI', 'DITOLAK', 'DITARIK', 'DIBATALKAN'];

export default function OrderListPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const role = user?.role_code;
  // GET /buyers hanya untuk MARKETING dan PIMPINAN, role lain tidak diberi filter buyer
  const canFilterBuyer = role === 'MARKETING' || role === 'PIMPINAN';

  const [filter, setFilter] = useState({ buyer_id: '', status: '', page: 1 });
  const list = useLoad(() => orderApi.orders(filter), [filter]);
  const buyers = useLoad(
    () => (canFilterBuyer ? orderApi.buyers({ per_page: 100 }) : Promise.resolve({ rows: [] })),
    [canFilterBuyer],
  );
  const flash = (location.state as { flash?: string } | null)?.flash ?? null;

  const columns: Col<OrderSummary>[] = [
    { key: 'order_code', header: 'Kode Order', render: (o) => o.order_code },
    { key: 'buyer', header: 'Buyer', render: (o) => <span title={o.buyer_name}>{o.buyer_code}</span> },
    { key: 'deadline', header: 'Deadline', render: (o) => formatDate(o.deadline) },
    { key: 'status', header: 'Status', render: (o) => <Badge status={o.status} /> },
  ];

  return (
    <div>
      <PageHeader
        code="SCR-06"
        title="Daftar dan Detail Order"
        subtitle="Status dan riwayat setiap order"
        actions={role === 'MARKETING' && <Button onClick={() => navigate('/order/baru')}>+ Order Baru</Button>}
      />

      {flash && <Alert className="mb-4" variant="success" message={flash} onClose={() => navigate(location.pathname, { replace: true })} />}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="self-start">
          {/* 1. Filter */}
          <div className="mb-5 grid gap-3 sm:grid-cols-2">
            {canFilterBuyer && (
              <Select
                label="Buyer"
                value={filter.buyer_id}
                onChange={(e) => setFilter({ ...filter, buyer_id: e.target.value, page: 1 })}
                options={[{ value: '', label: 'Semua' }, ...(buyers.data?.rows ?? []).map((b) => ({ value: b.id, label: `${b.buyer_name} (${b.buyer_code})` }))]}
              />
            )}
            <Select
              label="Status"
              value={filter.status}
              onChange={(e) => setFilter({ ...filter, status: e.target.value, page: 1 })}
              options={[{ value: '', label: 'Semua' }, ...STATUSES.map((s) => ({ value: s, label: formatStatus(s) }))]}
            />
          </div>

          {/* 2. Daftar order */}
          <DataTable
            columns={columns}
            rows={list.data?.rows ?? []}
            rowKey={(o) => o.order_id}
            selectedKey={id}
            onRowClick={(o) => navigate(`/order/${o.order_id}`)}
            loading={list.loading}
            error={list.error}
            onRetry={list.reload}
            emptyMessage="Belum ada order yang sesuai filter."
          />
          {list.data?.meta && list.data.meta.last_page > 1 && (
            <div className="mt-3 flex items-center justify-end gap-2 text-xs text-ink-muted">
              <Button size="sm" variant="secondary" disabled={filter.page <= 1} onClick={() => setFilter({ ...filter, page: filter.page - 1 })}>
                Sebelumnya
              </Button>
              Halaman {filter.page} dari {list.data.meta.last_page}
              <Button
                size="sm"
                variant="secondary"
                disabled={filter.page >= list.data.meta.last_page}
                onClick={() => setFilter({ ...filter, page: filter.page + 1 })}
              >
                Berikutnya
              </Button>
            </div>
          )}

          {/* 9. Catatan order final */}
          <div className="mt-5 rounded-lg border-l-4 border-warning bg-warning-soft px-4 py-3 text-xs text-ink">
            Order Ditolak dan Ditarik bersifat final: hanya dapat dilihat. Untuk mengajukan ulang, catat order baru.
          </div>
        </Card>

        {/* 3-8. Detail order terpilih */}
        <Card className="self-start">
          {id ? (
            <OrderDetailPanel key={id} id={id} onChanged={list.reload} />
          ) : (
            <p className="py-10 text-center text-sm text-ink-muted">Pilih salah satu order di daftar untuk melihat detailnya.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
