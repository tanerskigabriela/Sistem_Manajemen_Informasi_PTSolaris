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

  // Penanda risiko & reject (SCR-13, SCR-14)
  BERISIKO_TERLAMBAT: 'Berisiko Terlambat',
  MELEBIHI_REJECT: 'Melebihi Batas Reject',

  // Status notifikasi (SCR-24)
  BARU: 'Baru',
  DIBACA: 'Dibaca',

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

  // Level order, skema, ketentuan pembayaran (RB-24)
  DOMESTIK: 'Domestik',
  INTERNASIONAL: 'Internasional',
  CMT: 'CMT',
  FOB: 'FOB',
  LOKAL: 'Lokal',
  ASING: 'Asing',
  IMPOR: 'Impor',
  LUNAS_AWAL: 'Lunas di awal',
  DP: 'DP',
  KREDIT: 'Kredit (Tempo)',

  // Tahap produksi
  CUTTING: 'Cutting',
  SEWING: 'Sewing',
  TRIMMING: 'Trimming',
  FINISHING: 'Finishing',
  IRONING: 'Ironing',
  PACKING: 'Packing',

  // Action type log aktivitas & riwayat login (SCR-21, SCR-23)
  LOGIN_BERHASIL: 'Login berhasil',
  LOGIN_GAGAL: 'Login gagal',
  LOGOUT: 'Logout',
  SESI_BERAKHIR: 'Sesi berakhir (30 menit tidak aktif)',
  SESI_DIAKHIRI: 'Sesi diakhiri Administrator',
  AKUN_TERKUNCI: 'Akun terkunci',
  BUKA_KUNCI: 'Buka kunci',
  RESET_PASSWORD: 'Reset password',
  GANTI_PASSWORD: 'Ganti password',
  AKSES_DITOLAK: 'Akses ditolak',
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

  // Kuning / Amber (menunggu / peringatan)
  MENUNGGU_PERSETUJUAN: 'warning',
  MENUNGGU: 'warning',
  BELUM_SIAP: 'warning',
  MELEBIHI_REJECT: 'warning',
  MAYOR: 'warning',
  SESI_BERAKHIR: 'warning',
  RESET_PASSWORD: 'warning',
  GANTI_PASSWORD: 'warning',

  // Biru (berjalan / info / baru)
  DALAM_PRODUKSI: 'info',
  BARU: 'info',
  DIKIRIM: 'info',
  DALAM_PERJALANAN: 'info',
  TAMBAH: 'info',
  UBAH: 'brand',

  // Merah (ditolak / batal / gagal / terkunci / berisiko)
  DITOLAK: 'danger',
  DIBATALKAN: 'danger',
  BERISIKO_TERLAMBAT: 'danger',
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
  DIBACA: 'neutral',
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

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Format DD/MM/YYYY sesuai FSD Bagian 3.2 & 4.2.
 */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '-';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`;
}

/**
 * Format DD/MM/YYYY HH.mm sesuai mockup FSD (SCR-06, SCR-21, SCR-22, SCR-23, SCR-24).
 */
export function formatDateTime(
  value: string | Date | null | undefined,
): string {
  if (!value) return '-';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return `${formatDate(date)} ${pad2(date.getHours())}.${pad2(date.getMinutes())}`;
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
  return `${numeric.toFixed(1).replace('.', ',')}%`;
}
