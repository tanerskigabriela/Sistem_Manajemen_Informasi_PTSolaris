export const ROLE = {
  SUPERADMIN: 'SUPERADMIN',
  ADMIN: 'ADMIN',
  PIMPINAN: 'PIMPINAN',
  MARKETING: 'MARKETING',
  PPIC: 'PPIC',
  SPV: 'SPV',
  QC: 'QC',
} as const;

export type RoleCode = (typeof ROLE)[keyof typeof ROLE];

export const ORDER_STATUS = {
  MENUNGGU_PERSETUJUAN: 'MENUNGGU_PERSETUJUAN',
  DISETUJUI: 'DISETUJUI',
  DITOLAK: 'DITOLAK',
  DITARIK: 'DITARIK',
  DALAM_PRODUKSI: 'DALAM_PRODUKSI',
  SELESAI: 'SELESAI',
  DIBATALKAN: 'DIBATALKAN',
} as const;

export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];

export const SPK_STATUS = {
  MENUNGGU_PERSETUJUAN: 'MENUNGGU_PERSETUJUAN',
  DISETUJUI: 'DISETUJUI',
  DITOLAK: 'DITOLAK',
} as const;

export type SpkStatus = (typeof SPK_STATUS)[keyof typeof SPK_STATUS];

export const STAGES = [
  'CUTTING',
  'SEWING',
  'TRIMMING',
  'FINISHING',
  'IRONING',
  'PACKING',
] as const;

export type StageCode = (typeof STAGES)[number];

export const QC_STAGES = [
  'CUTTING',
  'SEWING',
  'TRIMMING',
  'FINISHING',
  'IRONING',
] as const;

export type QcStageCode = (typeof QC_STAGES)[number];

export const SESSION_STATUS = {
  AKTIF: 'AKTIF',
  BERAKHIR: 'BERAKHIR',
} as const;

export type SessionStatus =
  (typeof SESSION_STATUS)[keyof typeof SESSION_STATUS];

export const SESSION_END_REASON = {
  LOGOUT: 'LOGOUT',
  TIDAK_AKTIF: 'TIDAK_AKTIF',
  DIAKHIRI_ADMIN: 'DIAKHIRI_ADMIN',
  RESET_PASSWORD: 'RESET_PASSWORD',
  AKUN_NONAKTIF: 'AKUN_NONAKTIF',
} as const;

export type SessionEndReason =
  (typeof SESSION_END_REASON)[keyof typeof SESSION_END_REASON];

export const SCHEME = ['CMT', 'FOB'] as const;
export type Scheme = (typeof SCHEME)[number];

export const PAYMENT_TERM = ['LUNAS_AWAL', 'DP', 'KREDIT'] as const;
export type PaymentTerm = (typeof PAYMENT_TERM)[number];

export const MATERIAL_SOURCE = ['BUYER', 'SUPPLIER'] as const;
export type MaterialSource = (typeof MATERIAL_SOURCE)[number];

// Konstanta baru KONTRAK v2
export const ORDER_LEVEL = {
  DOMESTIK: 'DOMESTIK',
  INTERNASIONAL: 'INTERNASIONAL',
} as const;

export type OrderLevel = (typeof ORDER_LEVEL)[keyof typeof ORDER_LEVEL];

export const INSPECTION_TYPE = {
  INCOMING: 'INCOMING',
  INLINE: 'INLINE',
  FINAL: 'FINAL',
} as const;

export type InspectionType =
  (typeof INSPECTION_TYPE)[keyof typeof INSPECTION_TYPE];

export const PAYMENT_METHOD = [
  'TRANSFER',
  'TT',
  'LC',
  'GIRO',
  'TUNAI',
] as const;

export type PaymentMethod = (typeof PAYMENT_METHOD)[number];

export const CANCELLATION_STATUS = {
  MENUNGGU: 'MENUNGGU',
  DISETUJUI: 'DISETUJUI',
  DITOLAK: 'DITOLAK',
} as const;

export type CancellationStatus =
  (typeof CANCELLATION_STATUS)[keyof typeof CANCELLATION_STATUS];

export const SHIPMENT_STATUS = {
  DIKIRIM: 'DIKIRIM',
  DALAM_PERJALANAN: 'DALAM_PERJALANAN',
  TIBA: 'TIBA',
} as const;

export type ShipmentStatus =
  (typeof SHIPMENT_STATUS)[keyof typeof SHIPMENT_STATUS];

export const INVOICE_STATUS = {
  BELUM_LUNAS: 'BELUM_LUNAS',
  LUNAS: 'LUNAS',
  BATAL: 'BATAL',
} as const;

export type InvoiceStatus =
  (typeof INVOICE_STATUS)[keyof typeof INVOICE_STATUS];

export const PAYMENT_STATUS = {
  BERHASIL: 'BERHASIL',
  GAGAL: 'GAGAL',
  PENDING: 'PENDING',
} as const;

export type PaymentStatus =
  (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS];

export const PASSWORD_RESET_STATUS = {
  MENUNGGU: 'MENUNGGU',
  SELESAI: 'SELESAI',
} as const;

export type PasswordResetStatus =
  (typeof PASSWORD_RESET_STATUS)[keyof typeof PASSWORD_RESET_STATUS];

// Peran yang boleh melihat informasi harga (TSD AC-08 & KONTRAK v2 Bagian 9)
export const PRICE_VISIBLE_ROLES: readonly RoleCode[] = [
  ROLE.MARKETING,
  ROLE.PIMPINAN,
];

// Kolom harga yang wajib disembunyikan dari role selain MARKETING dan PIMPINAN
// Mencakup 6 kolom inti KONTRAK v2 Bagian 9 + hasil audit tabel 03-order.sql & 04-produksi.sql
export const HIDDEN_PRICE_FIELDS = [
  'unit_price',
  'discount_pct',
  'material_price',
  'total_value',
  'penalty_amount',
  'refund_amount',
  'offer_price',
  'base_price',
  'shipping_cost',
  'purchase_price',
  'repair_cost',
] as const;

export type HiddenPriceField = (typeof HIDDEN_PRICE_FIELDS)[number];

// Kode dan pesan error resmi sesuai FSD Bagian 6 & KONTRAK Bagian 8
export const ERROR_CODE = {
  AUTH_UNAUTHENTICATED: 'ERR-AUTH-01',
  AUTH_INVALID_CREDENTIALS: 'ERR-AUTH-02',
  AUTH_FORBIDDEN: 'ERR-AUTH-03',
  AUTH_SESSION_INVALID: 'ERR-AUTH-04',
  AUTH_SESSION_TIMEOUT: 'ERR-AUTH-05',
  AUTH_ACCOUNT_LOCKED: 'ERR-AUTH-06',
  AUTH_MUST_CHANGE_PASSWORD: 'ERR-AUTH-07',
  USER_NOT_LOCKED: 'ERR-USR-01',
  USER_SELF_DEACTIVATE: 'ERR-USR-02',
  SESSION_NOT_FOUND: 'ERR-SES-01',
  VALIDATION_REQUIRED: 'ERR-VAL-01',
  VALIDATION_USERNAME_TAKEN: 'ERR-VAL-04',
  SYS_UNAVAILABLE: 'ERR-SYS-01',
  SYS_INTERNAL: 'ERR-SYS-02',
} as const;

export type SystemErrorCode = (typeof ERROR_CODE)[keyof typeof ERROR_CODE];

export const ERROR_MESSAGE: Record<SystemErrorCode, string> = {
  [ERROR_CODE.AUTH_UNAUTHENTICATED]: 'Silakan login terlebih dahulu.',
  [ERROR_CODE.AUTH_INVALID_CREDENTIALS]: 'Username atau password salah.',
  [ERROR_CODE.AUTH_FORBIDDEN]: 'Anda tidak memiliki akses ke halaman ini.',
  [ERROR_CODE.AUTH_SESSION_INVALID]:
    'Sesi Anda tidak valid atau telah berakhir. Silakan login kembali.',
  [ERROR_CODE.AUTH_SESSION_TIMEOUT]:
    'Sesi Anda berakhir karena tidak aktif selama 30 menit. Silakan login kembali.',
  [ERROR_CODE.AUTH_ACCOUNT_LOCKED]:
    'Akun Anda terkunci setelah 5 kali gagal login. Hubungi Administrator.',
  [ERROR_CODE.AUTH_MUST_CHANGE_PASSWORD]:
    'Anda wajib mengganti password sementara sebelum melanjutkan.',
  [ERROR_CODE.USER_NOT_LOCKED]: 'Akun ini tidak dalam status terkunci.',
  [ERROR_CODE.USER_SELF_DEACTIVATE]:
    'Anda tidak dapat menonaktifkan akun sendiri.',
  [ERROR_CODE.SESSION_NOT_FOUND]: 'Sesi tidak ditemukan atau sudah berakhir.',
  [ERROR_CODE.VALIDATION_REQUIRED]: 'Kolom ini wajib diisi.',
  [ERROR_CODE.VALIDATION_USERNAME_TAKEN]: 'Username sudah dipakai.',
  [ERROR_CODE.SYS_UNAVAILABLE]:
    'Layanan sedang tidak tersedia. Silakan coba lagi.',
  [ERROR_CODE.SYS_INTERNAL]:
    'Terjadi kesalahan pada sistem. Silakan coba lagi.',
};

// 16 nilai persis sesuai CHECK constraint ck_activity_logs_action di app.activity_logs (KONTRAK v2 Bagian 4.2)
export const ACTION_TYPE = {
  LOGIN_BERHASIL: 'LOGIN_BERHASIL',
  LOGIN_GAGAL: 'LOGIN_GAGAL',
  LOGOUT: 'LOGOUT',
  SESI_BERAKHIR: 'SESI_BERAKHIR',
  SESI_DIAKHIRI: 'SESI_DIAKHIRI',
  AKUN_TERKUNCI: 'AKUN_TERKUNCI',
  BUKA_KUNCI: 'BUKA_KUNCI',
  RESET_PASSWORD: 'RESET_PASSWORD',
  GANTI_PASSWORD: 'GANTI_PASSWORD',
  AKSES_DITOLAK: 'AKSES_DITOLAK',
  TAMBAH: 'TAMBAH',
  UBAH: 'UBAH',
  SETUJU: 'SETUJU',
  TOLAK: 'TOLAK',
  TARIK: 'TARIK',
  BATAL: 'BATAL',
} as const;

export type ActionType = (typeof ACTION_TYPE)[keyof typeof ACTION_TYPE];

// Kode notifikasi N-01 sampai N-11 sesuai CHECK constraint ck_notifications_event di app.notifications
export const NOTIF = {
  /** Order baru disimpan (Penerima: PIMPINAN) */
  N01: 'N-01',
  /** SPK diajukan (Penerima: PIMPINAN) */
  N02: 'N-02',
  /** Order disetujui atau ditolak (Penerima: MARKETING, PPIC) */
  N03: 'N-03',
  /** Pengajuan order ditarik (Penerima: PIMPINAN) */
  N04: 'N-04',
  /** SPK disetujui atau ditolak (Penerima: PPIC; SPV bila disetujui) */
  N05: 'N-05',
  /** Order dibatalkan (Penerima: MARKETING, PPIC, SPV, QC) */
  N06: 'N-06',
  /** Style atau order pertama kali berisiko terlambat (Penerima: PIMPINAN, PPIC) */
  N07: 'N-07',
  /** Persen tidak lolos pertama kali melebihi batas reject (Penerima: PIMPINAN, PPIC) */
  N08: 'N-08',
  /** Pengiriman dicatat, order selesai (Penerima: PIMPINAN, MARKETING) */
  N09: 'N-09',
  /** Ada permintaan reset password (Penerima: ADMIN) */
  N10: 'N-10',
  /** Akun terkunci (Penerima: ADMIN) */
  N11: 'N-11',
} as const;

export type NotifCode = (typeof NOTIF)[keyof typeof NOTIF];