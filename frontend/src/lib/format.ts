export type BadgeTone =
  | 'neutral'
  | 'brand'
  | 'info'
  | 'success'
  | 'warning'
  | 'danger';

const STATUS_LABELS: Record<string, string> = {
  // Status order & SPK
  MENUNGGU_PERSETUJUAN: 'Menunggu Persetujuan',
  DISETUJUI: 'Disetujui',
  DITOLAK: 'Ditolak',
  DITARIK: 'Ditarik',
  DALAM_PRODUKSI: 'Dalam Produksi',
  SELESAI: 'Selesai',
  DIBATALKAN: 'Dibatalkan',

  // Status pengiriman
  DIKIRIM: 'Dikirim',
  DALAM_PERJALANAN: 'Dalam Perjalanan',
  TIBA: 'Tiba',

  // Status bahan, QC, cacat, sesi, akun
  SIAP: 'Siap',
  BELUM_SIAP: 'Belum Siap',
  LOLOS: 'Lolos',
  TIDAK_LOLOS: 'Tidak Lolos',
  MINOR: 'Minor',
  MAYOR: 'Mayor',
  KRITIS: 'Kritis',
  AKTIF: 'Aktif',
  NONAKTIF: 'Nonaktif',
  TERKUNCI: 'Terkunci',
  BERAKHIR: 'Berakhir',
  MENUNGGU: 'Menunggu',

  // Level order & skema
  DOMESTIK: 'Domestik',
  INTERNASIONAL: 'Internasional',
  CMT: 'CMT',
  FOB: 'FOB',
  LOKAL: 'Lokal',
  ASING: 'Asing',
  IMPOR: 'Impor',
  LUNAS_AWAL: 'Lunas Awal',
  DP: 'DP',
  KREDIT: 'Kredit',

  // Tahap produksi
  CUTTING: 'Cutting',
  SEWING: 'Sewing',
  TRIMMING: 'Trimming',
  FINISHING: 'Finishing',
  IRONING: 'Ironing',
  PACKING: 'Packing',

  // Action type log aktivitas
  LOGIN_BERHASIL: 'Login Berhasil',
  LOGIN_GAGAL: 'Login Gagal',
  LOGOUT: 'Logout',
  SESI_BERAKHIR: 'Sesi Berakhir',
  SESI_DIAKHIRI: 'Sesi Diakhiri',
  AKUN_TERKUNCI: 'Akun Terkunci',
  BUKA_KUNCI: 'Buka Kunci',
  RESET_PASSWORD: 'Reset Password',
  GANTI_PASSWORD: 'Ganti Password',
  AKSES_DITOLAK: 'Akses Ditolak',
  TAMBAH: 'Tambah',
  UBAH: 'Ubah',
  SETUJU: 'Setuju',
  TOLAK: 'Tolak',
  TARIK: 'Tarik',
  BATAL: 'Batal',
};

const STATUS_TONES: Record<string, BadgeTone> = {
  // Hijau (sukses / aktif / selesai)
  DISETUJUI: 'success',
  SELESAI: 'success',
  SIAP: 'success',
  LOLOS: 'success',
  TIBA: 'success',
  AKTIF: 'success',
  LOGIN_BERHASIL: 'success',
  SETUJU: 'success',
  BUKA_KUNCI: 'success',

  // Kuning (menunggu / peringatan)
  MENUNGGU_PERSETUJUAN: 'warning',
  MENUNGGU: 'warning',
  BELUM_SIAP: 'warning',
  MAYOR: 'warning',
  SESI_BERAKHIR: 'warning',
  RESET_PASSWORD: 'warning',
  GANTI_PASSWORD: 'warning',

  // Biru (berjalan / info)
  DALAM_PRODUKSI: 'info',
  DIKIRIM: 'info',
  DALAM_PERJALANAN: 'info',
  TAMBAH: 'info',
  UBAH: 'brand',

  // Merah (ditolak / batal / gagal / terkunci / kritis)
  DITOLAK: 'danger',
  DIBATALKAN: 'danger',
  TIDAK_LOLOS: 'danger',
  KRITIS: 'danger',
  TERKUNCI: 'danger',
  LOGIN_GAGAL: 'danger',
  AKUN_TERKUNCI: 'danger',
  AKSES_DITOLAK: 'danger',
  TOLAK: 'danger',
  BATAL: 'danger',

  // Netral
  DITARIK: 'neutral',
  TARIK: 'neutral',
  NONAKTIF: 'neutral',
  BERAKHIR: 'neutral',
  LOGOUT: 'neutral',
  SESI_DIAKHIRI: 'neutral',
  MINOR: 'neutral',
};

const ROLE_LABELS: Record<string, string> = {
  SUPERADMIN: 'Super Admin',
  ADMIN: 'Administrator Sistem',
  PIMPINAN: 'Pimpinan',
  MARKETING: 'Marketing',
  PPIC: 'PPIC',
  SPV: 'Supervisor',
  QC: 'Quality Control',
};

export function formatStatus(value: string | null | undefined): string {
  if (!value) return '-';
  if (STATUS_LABELS[value]) return STATUS_LABELS[value];
  return value
    .toLowerCase()
    .split('_')
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : ''))
    .join(' ');
}

export function getStatusTone(value: string | null | undefined): BadgeTone {
  if (!value) return 'neutral';
  return STATUS_TONES[value] ?? 'neutral';
}

export function formatRole(roleCode: string | null | undefined): string {
  if (!roleCode) return '-';
  return ROLE_LABELS[roleCode] ?? roleCode;
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '-';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function formatDateTime(
  value: string | Date | null | undefined,
): string {
  if (!value) return '-';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

export function formatCurrency(
  amount: number | string | null | undefined,
  currency = 'IDR',
): string {
  if (amount === null || amount === undefined || amount === '') return '-';
  const numeric = typeof amount === 'number' ? amount : Number(amount);
  if (Number.isNaN(numeric)) return '-';

  const locale = currency === 'IDR' ? 'id-ID' : 'en-US';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: currency === 'IDR' ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(numeric);
}

export function formatNumber(
  value: number | string | null | undefined,
): string {
  if (value === null || value === undefined || value === '') return '-';
  const numeric = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(numeric)) return '-';
  return new Intl.NumberFormat('id-ID').format(numeric);
}

export function formatPercent(
  value: number | string | null | undefined,
): string {
  if (value === null || value === undefined || value === '') return '-';
  const numeric = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(numeric)) return '-';
  return `${numeric.toFixed(1)}%`;
}