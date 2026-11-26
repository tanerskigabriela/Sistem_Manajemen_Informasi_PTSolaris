import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Badge, Button } from '../../components/ui';
import { useAuth } from '../../contexts/AuthContext';
import { formatRole } from '../../lib/format';
import type { RoleCode } from '../../types/api';

const ROLE_DESCRIPTIONS: Record<RoleCode, string> = {
  SUPERADMIN:
    'Akses penuh modul data master dan operasional internal sistem.',
  ADMIN:
    'Kelola akun pengguna internal dan pantau log aktivitas sistem secara menyeluruh.',
  PIMPINAN:
    'Berikut ringkasan navigasi pemantauan order, persetujuan kontrak/SPK, dan dashboard.',
  MARKETING:
    'Kelola data buyer, catat order baru, dan pantau status persetujuan order.',
  PPIC: 'Kelola supplier, bahan baku per style, pengajuan SPK, serta pengiriman dan surat jalan.',
  SPV: 'Pantau SPK yang disetujui dan catat progres produksi harian setiap tahap.',
  QC: 'Periksa hasil produksi dan catat jumlah barang lolos Quality Control per tahap.',
};

/**
 * SCR-02: Beranda — Menu dan ringkasan sesuai peran (FSD-2.1, Gambar 3.2).
 */
export default function BerandaPage() {
  const { user, loading, refreshMe } = useAuth();
  const navigate = useNavigate();
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRefresh() {
    setRefreshing(true);
    setError(null);
    try {
      const latest = await refreshMe();
      if (!latest) {
        setError('Gagal memuat ulang informasi akun. Silakan coba lagi.');
      }
    } catch {
      setError('Gagal memuat ulang informasi akun. Silakan coba lagi.');
    } finally {
      setRefreshing(false);
    }
  }

  // Kondisi 1: Memuat
  if (loading) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-8 text-center text-sm text-ink-muted">
        Memuat ringkasan beranda...
      </div>
    );
  }

  // Kondisi 2: Error / data user tidak tersedia
  if (error || !user) {
    return (
      <Alert
        variant="danger"
        title="Gagal memuat beranda"
        message={error ?? 'Data sesi pengguna tidak tersedia.'}
        onRetry={() => void handleRefresh()}
      />
    );
  }

  const quickActions = (user.menus ?? []).filter(
    (item) => item.path !== '/beranda',
  );
  const roleLabel = formatRole(user.role_code);

  return (
    <div className="space-y-6">
      {/* Header Layar */}
      <div>
        <h1 className="font-display text-[28px] font-semibold leading-tight text-ink sm:text-[32px]">
          Beranda
        </h1>
        <p className="mt-1 text-[13px] font-medium text-ink-muted">
          SCR-02 · Menu dan ringkasan sesuai peran
        </p>
      </div>

      {/* Banner Sambutan Amber Tint — FSD Gambar 3.2 */}
      <section className="relative overflow-hidden rounded-2xl border border-line bg-amber-tint p-6 sm:p-7">
        <div className="relative z-10 max-w-2xl">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge tone="brand">{roleLabel}</Badge>
            <span className="text-xs font-medium text-ink-muted">
              @{user.username}
            </span>
          </div>
          <h2 className="font-display text-2xl font-semibold text-ink sm:text-[26px]">
            Selamat datang, {user.full_name}
          </h2>
          <p className="mt-1.5 text-sm text-ink-muted">
            {ROLE_DESCRIPTIONS[user.role_code]}
          </p>
        </div>

        {/* Aksen Matahari di sisi kanan banner */}
        <svg
          width="120"
          height="120"
          viewBox="0 0 64 64"
          fill="none"
          aria-hidden="true"
          className="pointer-events-none absolute -right-4 -bottom-6 hidden opacity-85 sm:block"
        >
          <defs>
            <linearGradient
              id="solarisBannerSun"
              x1="8"
              y1="8"
              x2="56"
              y2="56"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor="#F5A623" />
              <stop offset="60%" stopColor="#E66A14" />
              <stop offset="100%" stopColor="#C4410C" />
            </linearGradient>
          </defs>
          {Array.from({ length: 12 }).map((_, i) => (
            <path
              key={i}
              d="M32 3 C34.5 10, 31 14, 32 19 C29.5 14, 28 10, 32 3 Z"
              fill="url(#solarisBannerSun)"
              transform={`rotate(${i * 30} 32 32)`}
            />
          ))}
          <circle
            cx="32"
            cy="32"
            r="13"
            stroke="url(#solarisBannerSun)"
            strokeWidth="2.4"
            fill="#FBF4E5"
          />
        </svg>
      </section>

      {/* Kartu Ringkasan Sesuai Peran */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-line bg-surface p-5">
          <p className="text-[13px] font-bold text-ink-muted">Peran Aktif</p>
          <p className="mt-2 font-display text-2xl font-semibold text-ink">
            {roleLabel}
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            Hak akses diterapkan di sisi server (RB-03)
          </p>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-5">
          <p className="text-[13px] font-bold text-ink-muted">Menu Tersedia</p>
          <p className="mt-2 font-display text-3xl font-semibold text-ink">
            {quickActions.length}
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            Modul aktif untuk peran {roleLabel}
          </p>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-5">
          <p className="text-[13px] font-bold text-ink-muted">
            Notifikasi Belum Dibaca
          </p>
          <p
            className={[
              'mt-2 font-display text-3xl font-semibold',
              user.unread_notifications > 0 ? 'text-danger' : 'text-ink',
            ].join(' ')}
          >
            {user.unread_notifications}
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            Pembaruan status akun &amp; operasional
          </p>
        </div>
      </div>

      {/* Tindakan Cepat — FSD Gambar 3.2 */}
      <section className="rounded-2xl border border-line bg-surface p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-[21px] font-semibold text-ink">
            Tindakan cepat
          </h2>
          <Button
            size="sm"
            variant="soft"
            loading={refreshing}
            onClick={() => void handleRefresh()}
          >
            Muat ulang
          </Button>
        </div>

        {/* Kondisi 3 & 4: Kosong vs Ada data */}
        {quickActions.length === 0 ? (
          <p className="mt-4 text-sm text-ink-muted">
            Belum ada menu modul tambahan untuk peran Anda.
          </p>
        ) : (
          <div className="mt-4 flex flex-wrap gap-2.5">
            {quickActions.map((menu, index) => (
              <Button
                key={menu.path}
                variant={index === 0 ? 'primary' : 'secondary'}
                onClick={() => navigate(menu.path)}
              >
                {menu.label}
              </Button>
            ))}
          </div>
        )}

        <p className="mt-4 text-xs text-ink-muted">
          Menu hanya menampilkan fungsi yang diizinkan untuk peran {roleLabel}.
        </p>
      </section>
    </div>
  );
}