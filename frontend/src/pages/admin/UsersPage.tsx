import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  Alert,
  Badge,
  Button,
  Input,
  Modal,
  Select,
  Table,
  Toggle,
  type SelectOption,
  type TableColumn,
} from '../../components/ui';
import { useAuth } from '../../contexts/AuthContext';
import {
  createUser,
  fetchAvailableEmployees,
  fetchUsers,
  updateUser,
  type AssignableRoleCode,
  type AvailableEmployeeRecord,
  type UserRecord,
} from '../../lib/api/admin';
import { formatDateTime, formatRole } from '../../lib/format';
import { parseApiError, toFieldErrorMap } from '../../lib/http';
import {
  maxLength,
  passwordMinLength,
  required,
  usernameFormat,
  validateForm,
} from '../../lib/validation';
import type { PaginationMeta, RoleCode } from '../../types/api';

const ASSIGNABLE_ROLE_OPTIONS: SelectOption[] = [
  { value: 'ADMIN', label: 'Administrator Sistem' },
  { value: 'PIMPINAN', label: 'Pimpinan' },
  { value: 'MARKETING', label: 'Marketing' },
  { value: 'PPIC', label: 'PPIC' },
  { value: 'SPV', label: 'Supervisor' },
  { value: 'QC', label: 'Quality Control' },
];

const FILTER_ROLE_OPTIONS: SelectOption[] = [
  { value: '', label: 'Semua peran' },
  ...ASSIGNABLE_ROLE_OPTIONS,
  { value: 'SUPERADMIN', label: 'Super Admin' },
];

const FILTER_STATUS_OPTIONS: SelectOption[] = [
  { value: '', label: 'Semua status' },
  { value: 'true', label: 'Aktif' },
  { value: 'false', label: 'Nonaktif' },
];

function getAccountStatusCode(row: UserRecord): string {
  if (row.is_locked) return 'TERKUNCI';
  return row.is_active ? 'AKTIF' : 'NONAKTIF';
}

/**
 * SCR-03: Manajemen Pengguna (FSD-2.2, Gambar 3.3, KONTRAK v2 Bagian 15.1).
 */
export default function UsersPage() {
  const { user: currentUser } = useAuth();

  // State daftar akun
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  // State daftar karyawan yang belum punya akun (KONTRAK v2)
  const [employees, setEmployees] = useState<AvailableEmployeeRecord[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [employeesError, setEmployeesError] = useState<string | null>(null);

  // State form Tambah Akun
  const [employeeId, setEmployeeId] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [roleCode, setRoleCode] = useState<AssignableRoleCode | ''>('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [formApiError, setFormApiError] = useState<string | null>(null);
  const [submittingCreate, setSubmittingCreate] = useState(false);

  // State notifikasi sukses global halaman
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // State Modal Ubah Akun
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [editRole, setEditRole] = useState<AssignableRoleCode>('MARKETING');
  const [editActive, setEditActive] = useState(true);
  const [editError, setEditError] = useState<string | null>(null);
  const [submittingEdit, setSubmittingEdit] = useState(false);

  // State Modal Konfirmasi Nonaktifkan / Aktifkan
  const [toggleTarget, setToggleTarget] = useState<UserRecord | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [submittingToggle, setSubmittingToggle] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoadingList(true);
    setListError(null);
    try {
      const res = await fetchUsers({
        page,
        per_page: 15,
        q: appliedSearch || undefined,
        role_code: (filterRole || undefined) as RoleCode | undefined,
        is_active:
          filterStatus === '' ? undefined : filterStatus === 'true',
      });
      setUsers(res.items);
      setMeta(res.meta);
    } catch (error) {
      setListError(parseApiError(error).message);
    } finally {
      setLoadingList(false);
    }
  }, [page, appliedSearch, filterRole, filterStatus]);

  const loadAvailableEmployees = useCallback(async () => {
    setLoadingEmployees(true);
    setEmployeesError(null);
    try {
      const list = await fetchAvailableEmployees();
      setEmployees(list);
    } catch (error) {
      setEmployeesError(parseApiError(error).message);
    } finally {
      setLoadingEmployees(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    void loadAvailableEmployees();
  }, [loadAvailableEmployees]);

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setAppliedSearch(search.trim());
  }

  async function handleCreateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormApiError(null);
    setSuccessMessage(null);

    const errors = validateForm(
      { employee_id: employeeId, username, password, role_code: roleCode },
      {
        employee_id: [required()],
        username: [required(), usernameFormat()],
        password: [required(), passwordMinLength(), maxLength(72)],
        role_code: [required()],
      },
    );
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmittingCreate(true);
    try {
      const created = await createUser({
        employee_id: employeeId,
        username: username.trim(),
        password,
        role_code: roleCode as AssignableRoleCode,
      });

      setEmployeeId('');
      setUsername('');
      setPassword('');
      setRoleCode('');
      setFormErrors({});
      setSuccessMessage(
        `Akun "${created.username}" untuk ${created.full_name} berhasil dibuat.`,
      );
      setPage(1);
      await Promise.all([loadUsers(), loadAvailableEmployees()]);
    } catch (error) {
      const parsed = parseApiError(error);
      if (parsed.errors.length > 0) {
        setFormErrors(toFieldErrorMap(parsed.errors));
      }
      setFormApiError(parsed.message);
    } finally {
      setSubmittingCreate(false);
    }
  }

  function openEditModal(row: UserRecord) {
    if (row.role_code === 'SUPERADMIN') return;
    setEditingUser(row);
    setEditRole(row.role_code);
    setEditActive(row.is_active);
    setEditError(null);
  }

  async function handleEditSave() {
    if (!editingUser) return;
    setEditError(null);
    setSubmittingEdit(true);
    try {
      const updated = await updateUser(editingUser.id, {
        role_code: editRole,
        is_active: editActive,
      });
      setEditingUser(null);
      setSuccessMessage(`Akun "${updated.username}" berhasil diperbarui.`);
      await loadUsers();
    } catch (error) {
      setEditError(parseApiError(error).message);
    } finally {
      setSubmittingEdit(false);
    }
  }

  function openToggleModal(row: UserRecord) {
    setToggleTarget(row);
    setToggleError(null);
  }

  async function handleConfirmToggle() {
    if (!toggleTarget) return;
    setToggleError(null);
    setSubmittingToggle(true);
    const nextActive = !toggleTarget.is_active;
    try {
      const updated = await updateUser(toggleTarget.id, {
        is_active: nextActive,
      });
      setToggleTarget(null);
      setSuccessMessage(
        nextActive
          ? `Akun "${updated.username}" berhasil diaktifkan kembali.`
          : `Akun "${updated.username}" berhasil dinonaktifkan dan sesi aktifnya diakhiri.`,
      );
      await loadUsers();
    } catch (error) {
      setToggleError(parseApiError(error).message);
    } finally {
      setSubmittingToggle(false);
    }
  }

  const isSelf = (row: UserRecord) =>
    currentUser?.id.toLowerCase() === row.id.toLowerCase();

  const employeeOptions: SelectOption[] = employees.map((emp) => ({
    value: emp.id,
    label: `${emp.full_name} — ${emp.division_name} (${emp.position_name})`,
  }));

  const columns: TableColumn<UserRecord>[] = [
    {
      key: 'full_name',
      header: 'Nama',
      render: (row) => (
        <div>
          <p className="font-semibold text-ink">{row.full_name}</p>
          <p className="text-xs text-ink-muted">
            {row.division_name} · {row.position_name}
          </p>
        </div>
      ),
    },
    {
      key: 'username',
      header: 'Username',
      render: (row) => (
        <span className="font-mono text-[13px] text-ink">{row.username}</span>
      ),
    },
    {
      key: 'role_code',
      header: 'Peran',
      render: (row) => <span>{formatRole(row.role_code)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <Badge status={getAccountStatusCode(row)} />,
    },
    {
      key: 'last_login_at',
      header: 'Login Terakhir',
      render: (row) => (
        <span className="text-xs text-ink-muted whitespace-nowrap">
          {formatDateTime(row.last_login_at)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Aksi',
      render: (row) => {
        if (row.role_code === 'SUPERADMIN') {
          return <span className="text-xs text-ink-muted">Terkunci sistem</span>;
        }
        const selfAccount = isSelf(row);
        return (
          <div className="flex flex-wrap items-center gap-3 text-xs font-bold">
            <button
              type="button"
              onClick={() => openEditModal(row)}
              className="cursor-pointer text-ink underline decoration-brand underline-offset-2 hover:text-brand"
            >
              Ubah
            </button>
            <button
              type="button"
              disabled={selfAccount && row.is_active}
              title={
                selfAccount && row.is_active
                  ? 'Tidak dapat menonaktifkan akun sendiri'
                  : undefined
              }
              onClick={() => openToggleModal(row)}
              className={[
                'underline underline-offset-2',
                selfAccount && row.is_active
                  ? 'cursor-not-allowed text-ink-subtle no-underline'
                  : row.is_active
                    ? 'cursor-pointer text-danger decoration-danger hover:text-danger-hover'
                    : 'cursor-pointer text-success decoration-success hover:text-success-hover',
              ].join(' ')}
            >
              {row.is_active ? 'Nonaktifkan' : 'Aktifkan'}
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
          Manajemen Pengguna
        </h1>
        <p className="mt-1 text-[13px] font-medium text-ink-muted">
          SCR-03 · Kelola akun pengguna internal, peran, dan status aktif
        </p>
      </div>

      {successMessage && (
        <Alert
          variant="success"
          message={successMessage}
          onClose={() => setSuccessMessage(null)}
        />
      )}

      {/* Layout 2 Kolom sesuai mockup FSD Gambar 3.3 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Kolom Kiri: Daftar Akun */}
        <section className="space-y-4 rounded-2xl border border-line bg-surface p-5 sm:p-6 lg:col-span-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="font-display text-[21px] font-semibold text-ink">
              Daftar Akun
            </h2>

            <form
              onSubmit={handleSearchSubmit}
              className="flex flex-wrap items-end gap-2.5"
            >
              <Input
                label="Cari"
                placeholder="Nama / username..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                containerClassName="w-44"
              />
              <Select
                label="Peran"
                options={FILTER_ROLE_OPTIONS}
                value={filterRole}
                onChange={(e) => {
                  setFilterRole(e.target.value);
                  setPage(1);
                }}
                containerClassName="w-40"
              />
              <Select
                label="Status"
                options={FILTER_STATUS_OPTIONS}
                value={filterStatus}
                onChange={(e) => {
                  setFilterStatus(e.target.value);
                  setPage(1);
                }}
                containerClassName="w-36"
              />
              <Button type="submit" size="md" variant="secondary">
                Terapkan
              </Button>
            </form>
          </div>

          <Table
            columns={columns}
            data={users}
            rowKey={(row) => row.id}
            loading={loadingList}
            error={listError}
            onRetry={() => void loadUsers()}
            emptyMessage="Tidak ada akun pengguna yang sesuai filter."
            meta={meta}
            onPageChange={setPage}
          />
        </section>

        {/* Kolom Kanan: Tambah Akun (KONTRAK v2 — pilih karyawan) */}
        <section className="h-fit rounded-2xl border border-line bg-surface p-5 sm:p-6 lg:col-span-4">
          <h2 className="font-display text-[21px] font-semibold text-ink">
            Tambah Akun
          </h2>
          <p className="mt-1 text-xs text-ink-muted">
            Pilih karyawan aktif yang belum memiliki akun, lalu tentukan
            username, password, dan peran.
          </p>

          <form
            onSubmit={(e) => void handleCreateSubmit(e)}
            noValidate
            className="mt-4 space-y-4"
          >
            {formApiError && <Alert variant="danger" message={formApiError} />}

            {employeesError ? (
              <Alert
                variant="danger"
                message={employeesError}
                onRetry={() => void loadAvailableEmployees()}
              />
            ) : (
              <Select
                label="Karyawan"
                required
                disabled={loadingEmployees || employees.length === 0}
                placeholder={
                  loadingEmployees
                    ? 'Memuat daftar karyawan...'
                    : employees.length === 0
                      ? 'Semua karyawan aktif sudah memiliki akun'
                      : 'Pilih karyawan...'
                }
                options={employeeOptions}
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                error={formErrors.employee_id}
              />
            )}

            <Input
              label="Username"
              required
              maxLength={50}
              placeholder="Contoh: dewi.qc"
              hint="4–50 karakter tanpa spasi (huruf, angka, ., _, -)"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              error={formErrors.username}
            />

            <Input
              label="Password"
              type="password"
              required
              maxLength={72}
              placeholder="Minimal 8 karakter"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={formErrors.password}
            />

            <Select
              label="Peran"
              required
              placeholder="Pilih peran..."
              options={ASSIGNABLE_ROLE_OPTIONS}
              value={roleCode}
              onChange={(e) =>
                setRoleCode(e.target.value as AssignableRoleCode | '')
              }
              error={formErrors.role_code}
            />

            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                loading={submittingCreate}
                disabled={loadingEmployees || employees.length === 0}
              >
                Simpan
              </Button>
            </div>
          </form>
        </section>
      </div>

      {/* Modal Ubah Akun */}
      <Modal
        open={Boolean(editingUser)}
        onClose={() => setEditingUser(null)}
        title="Ubah Akun Pengguna"
        description={
          editingUser
            ? `${editingUser.full_name} (@${editingUser.username})`
            : undefined
        }
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setEditingUser(null)}
              disabled={submittingEdit}
            >
              Batal
            </Button>
            <Button
              loading={submittingEdit}
              onClick={() => void handleEditSave()}
            >
              Simpan Perubahan
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {editError && <Alert variant="danger" message={editError} />}

          <Select
            label="Peran"
            required
            options={ASSIGNABLE_ROLE_OPTIONS}
            value={editRole}
            onChange={(e) => setEditRole(e.target.value as AssignableRoleCode)}
          />

          <Toggle
            label="Status akun"
            checked={editActive}
            onChange={setEditActive}
            disabled={editingUser ? isSelf(editingUser) : false}
          />
          {editingUser && isSelf(editingUser) && (
            <p className="text-xs text-ink-muted">
              Status aktif akun Anda sendiri tidak dapat dinonaktifkan.
            </p>
          )}
        </div>
      </Modal>

      {/* Modal Konfirmasi Nonaktifkan / Aktifkan (FSD-2.2 AF-2 & AF-3) */}
      <Modal
        open={Boolean(toggleTarget)}
        onClose={() => setToggleTarget(null)}
        title={
          toggleTarget?.is_active ? 'Nonaktifkan Akun?' : 'Aktifkan Akun?'
        }
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setToggleTarget(null)}
              disabled={submittingToggle}
            >
              Batal
            </Button>
            <Button
              variant={toggleTarget?.is_active ? 'danger' : 'success'}
              loading={submittingToggle}
              onClick={() => void handleConfirmToggle()}
            >
              {toggleTarget?.is_active ? 'Ya, Nonaktifkan' : 'Ya, Aktifkan'}
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-sm text-ink">
          {toggleError && <Alert variant="danger" message={toggleError} />}
          {toggleTarget?.is_active ? (
            <p>
              Akun{' '}
              <span className="font-semibold">
                {toggleTarget.full_name} ({toggleTarget.username})
              </span>{' '}
              akan dinonaktifkan. Pengguna tidak dapat login dan seluruh sesi
              aktifnya akan segera diakhiri.
            </p>
          ) : (
            <p>
              Akun{' '}
              <span className="font-semibold">
                {toggleTarget?.full_name} ({toggleTarget?.username})
              </span>{' '}
              akan diaktifkan kembali agar dapat login ke sistem.
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
}