import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  Alert,
  Badge,
  Button,
  Input,
  Modal,
  Select,
  Table,
  type SelectOption,
  type TableColumn,
} from '../../components/ui';
import {
  fetchActivityLogs,
  type ActivityLogRecord,
} from '../../lib/api/admin';
import { formatDateTime, formatStatus } from '../../lib/format';
import { parseApiError } from '../../lib/http';
import { validateDateRange } from '../../lib/validation';
import type { PaginationMeta } from '../../types/api';

const ACTION_TYPE_OPTIONS: SelectOption[] = [
  { value: '', label: 'Semua aksi' },
  { value: 'LOGIN_BERHASIL', label: 'Login berhasil' },
  { value: 'LOGIN_GAGAL', label: 'Login gagal' },
  { value: 'LOGOUT', label: 'Logout' },
  { value: 'SESI_BERAKHIR', label: 'Sesi berakhir' },
  { value: 'SESI_DIAKHIRI', label: 'Sesi diakhiri' },
  { value: 'AKUN_TERKUNCI', label: 'Akun terkunci' },
  { value: 'BUKA_KUNCI', label: 'Buka kunci' },
  { value: 'RESET_PASSWORD', label: 'Reset password' },
  { value: 'GANTI_PASSWORD', label: 'Ganti password' },
  { value: 'AKSES_DITOLAK', label: 'Akses ditolak' },
  { value: 'TAMBAH', label: 'Tambah' },
  { value: 'UBAH', label: 'Ubah' },
  { value: 'SETUJU', label: 'Setuju' },
  { value: 'TOLAK', label: 'Tolak' },
  { value: 'TARIK', label: 'Tarik' },
  { value: 'BATAL', label: 'Batal' },
];

function toInputDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDefaultDateRange(): { from: string; to: string } {
  const today = new Date();
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 6);
  return {
    from: toInputDate(sevenDaysAgo),
    to: toInputDate(today),
  };
}

function summarizeValues(
  value: Record<string, unknown> | unknown[] | null,
): string {
  if (!value) return '—';
  if (Array.isArray(value)) {
    return value.length === 0 ? '[]' : `[${value.length} item]`;
  }
  const entries = Object.entries(value);
  if (entries.length === 0) return '—';
  return entries
    .slice(0, 3)
    .map(([k, v]) => `${k}: ${String(v)}`)
    .join(', ');
}

function shortId(id: string | null): string {
  if (!id) return '';
  return id.length > 8 ? `${id.slice(0, 8)}…` : id;
}

/**
 * SCR-23: Log Aktivitas — Hanya baca, tanpa tombol ubah/hapus (FSD-2.23, Gambar 3.23, RB-72).
 */
export default function ActivityLogsPage() {
  const defaultRange = getDefaultDateRange();

  // State input filter
  const [usernameInput, setUsernameInput] = useState('');
  const [actionTypeInput, setActionTypeInput] = useState('');
  const [dateFromInput, setDateFromInput] = useState(defaultRange.from);
  const [dateToInput, setDateToInput] = useState(defaultRange.to);
  const [filterError, setFilterError] = useState<string | null>(null);

  // State filter yang sedang aktif
  const [appliedFilter, setAppliedFilter] = useState({
    username: '',
    actionType: '',
    dateFrom: defaultRange.from,
    dateTo: defaultRange.to,
  });

  // State tabel & pagination
  const [logs, setLogs] = useState<ActivityLogRecord[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State modal detail nilai lama/baru (read-only)
  const [selectedLog, setSelectedLog] = useState<ActivityLogRecord | null>(
    null,
  );

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchActivityLogs({
        page,
        per_page: 20,
        username: appliedFilter.username || undefined,
        action_type: appliedFilter.actionType || undefined,
        date_from: appliedFilter.dateFrom || undefined,
        date_to: appliedFilter.dateTo || undefined,
      });
      setLogs(res.items);
      setMeta(res.meta);
    } catch (err) {
      setError(parseApiError(err).message);
    } finally {
      setLoading(false);
    }
  }, [page, appliedFilter]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  function handleApplyFilter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const rangeErr = validateDateRange(dateFromInput, dateToInput);
    if (rangeErr) {
      setFilterError(rangeErr);
      return;
    }

    setFilterError(null);
    setPage(1);
    setAppliedFilter({
      username: usernameInput.trim(),
      actionType: actionTypeInput,
      dateFrom: dateFromInput,
      dateTo: dateToInput,
    });
  }

  function handleResetFilter() {
    const fresh = getDefaultDateRange();
    setUsernameInput('');
    setActionTypeInput('');
    setDateFromInput(fresh.from);
    setDateToInput(fresh.to);
    setFilterError(null);
    setPage(1);
    setAppliedFilter({
      username: '',
      actionType: '',
      dateFrom: fresh.from,
      dateTo: fresh.to,
    });
  }

  const columns: TableColumn<ActivityLogRecord>[] = [
    {
      key: 'created_at',
      header: 'Waktu',
      render: (row) => (
        <span className="text-xs font-medium text-ink whitespace-nowrap">
          {formatDateTime(row.created_at)}
        </span>
      ),
    },
    {
      key: 'username',
      header: 'Pengguna',
      render: (row) => (
        <div>
          <p className="font-mono text-[13px] font-semibold text-ink">
            {row.username}
          </p>
          {row.full_name && (
            <p className="text-xs text-ink-muted">{row.full_name}</p>
          )}
        </div>
      ),
    },
    {
      key: 'action_type',
      header: 'Aksi',
      render: (row) => <Badge status={row.action_type} />,
    },
    {
      key: 'resource_type',
      header: 'Objek',
      render: (row) =>
        row.resource_type ? (
          <div className="text-xs">
            <p className="font-semibold text-ink">{row.resource_type}</p>
            {row.resource_id && (
              <p className="font-mono text-ink-muted">
                {shortId(row.resource_id)}
              </p>
            )}
          </div>
        ) : (
          <span className="text-xs text-ink-muted">—</span>
        ),
    },
    {
      key: 'changes',
      header: 'Nilai lama → baru',
      render: (row) => {
        const hasValues = Boolean(row.old_values || row.new_values);
        if (!hasValues) {
          return (
            <span className="text-xs text-ink-muted">
              {row.device ? `${row.device} · ${row.ip_address}` : row.ip_address}
            </span>
          );
        }
        return (
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="max-w-xs truncate text-ink">
              {summarizeValues(row.old_values)} →{' '}
              {summarizeValues(row.new_values)}
            </span>
            <button
              type="button"
              onClick={() => setSelectedLog(row)}
              className="shrink-0 cursor-pointer font-bold text-ink underline decoration-brand underline-offset-2 hover:text-brand"
            >
              Detail
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-5">
      {/* Header Layar */}
      <div>
        <h1 className="font-display text-[28px] font-semibold leading-tight text-ink sm:text-[32px]">
          Log Aktivitas
        </h1>
        <p className="mt-1 text-[13px] font-medium text-ink-muted">
          SCR-23 · Hanya dapat dibaca; log tidak dapat diubah atau dihapus
        </p>
      </div>

      {/* Kartu Filter + Tabel Log (FSD Gambar 3.23) */}
      <section className="space-y-4 rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <form
          onSubmit={handleApplyFilter}
          noValidate
          className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-12"
        >
          <Input
            label="Pengguna (username)"
            placeholder="Semua pengguna"
            maxLength={50}
            value={usernameInput}
            onChange={(e) => setUsernameInput(e.target.value)}
            containerClassName="lg:col-span-3"
          />

          <Select
            label="Jenis aksi"
            options={ACTION_TYPE_OPTIONS}
            value={actionTypeInput}
            onChange={(e) => setActionTypeInput(e.target.value)}
            containerClassName="lg:col-span-3"
          />

          <Input
            label="Tanggal awal"
            type="date"
            value={dateFromInput}
            onChange={(e) => setDateFromInput(e.target.value)}
            containerClassName="lg:col-span-2"
          />

          <Input
            label="Tanggal akhir"
            type="date"
            value={dateToInput}
            onChange={(e) => setDateToInput(e.target.value)}
            containerClassName="lg:col-span-2"
          />

          <div className="flex items-center gap-2 lg:col-span-2">
            <Button type="submit" className="flex-1">
              Terapkan
            </Button>
            <Button type="button" variant="soft" onClick={handleResetFilter}>
              Reset
            </Button>
          </div>
        </form>

        {filterError && <Alert variant="danger" message={filterError} />}

        <Table
          columns={columns}
          data={logs}
          rowKey={(row) => row.id}
          loading={loading}
          error={error}
          onRetry={() => void loadLogs()}
          emptyMessage="Tidak ada aktivitas sesuai filter."
          meta={meta}
          onPageChange={setPage}
        />
      </section>

      {/* Modal Detail Log (Read-Only) */}
      <Modal
        open={Boolean(selectedLog)}
        onClose={() => setSelectedLog(null)}
        title="Detail Log Aktivitas"
        description={
          selectedLog
            ? `${formatDateTime(selectedLog.created_at)} · ${selectedLog.username} · ${formatStatus(selectedLog.action_type)}`
            : undefined
        }
        size="lg"
        footer={
          <Button variant="secondary" onClick={() => setSelectedLog(null)}>
            Tutup
          </Button>
        }
      >
        {selectedLog && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-1 gap-3 rounded-xl border border-line bg-amber-tint/40 p-3.5 sm:grid-cols-2">
              <div>
                <p className="text-xs font-bold text-ink-muted">Objek</p>
                <p className="font-mono text-xs text-ink">
                  {selectedLog.resource_type ?? '—'}{' '}
                  {selectedLog.resource_id ? `(${selectedLog.resource_id})` : ''}
                </p>
              </div>
              <div>
                <p className="text-xs font-bold text-ink-muted">
                  Perangkat &amp; IP
                </p>
                <p className="text-xs text-ink">
                  {selectedLog.device ?? '—'} · {selectedLog.ip_address}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-1.5 text-xs font-bold text-ink-muted">
                  Nilai Lama
                </p>
                <pre className="max-h-60 overflow-auto rounded-xl border border-line bg-zebra p-3 font-mono text-xs text-ink">
                  {selectedLog.old_values
                    ? JSON.stringify(selectedLog.old_values, null, 2)
                    : '—'}
                </pre>
              </div>
              <div>
                <p className="mb-1.5 text-xs font-bold text-ink-muted">
                  Nilai Baru
                </p>
                <pre className="max-h-60 overflow-auto rounded-xl border border-line bg-zebra p-3 font-mono text-xs text-ink">
                  {selectedLog.new_values
                    ? JSON.stringify(selectedLog.new_values, null, 2)
                    : '—'}
                </pre>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}