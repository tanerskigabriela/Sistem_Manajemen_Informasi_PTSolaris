"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NOTIF = exports.ACTION_TYPE = exports.ERROR_MESSAGE = exports.ERROR_CODE = exports.HIDDEN_PRICE_FIELDS = exports.PRICE_VISIBLE_ROLES = exports.CANCELLATION_STATUS = exports.PAYMENT_METHOD = exports.INSPECTION_TYPE = exports.ORDER_LEVEL = exports.MATERIAL_SOURCE = exports.PAYMENT_TERM = exports.SCHEME = exports.SESSION_END_REASON = exports.SESSION_STATUS = exports.QC_STAGES = exports.STAGES = exports.SPK_STATUS = exports.ORDER_STATUS = exports.ROLE = void 0;
exports.ROLE = {
    SUPERADMIN: 'SUPERADMIN',
    ADMIN: 'ADMIN',
    PIMPINAN: 'PIMPINAN',
    MARKETING: 'MARKETING',
    PPIC: 'PPIC',
    SPV: 'SPV',
    QC: 'QC',
};
exports.ORDER_STATUS = {
    MENUNGGU_PERSETUJUAN: 'MENUNGGU_PERSETUJUAN',
    DISETUJUI: 'DISETUJUI',
    DITOLAK: 'DITOLAK',
    DITARIK: 'DITARIK',
    DALAM_PRODUKSI: 'DALAM_PRODUKSI',
    SELESAI: 'SELESAI',
    DIBATALKAN: 'DIBATALKAN',
};
exports.SPK_STATUS = {
    MENUNGGU_PERSETUJUAN: 'MENUNGGU_PERSETUJUAN',
    DISETUJUI: 'DISETUJUI',
    DITOLAK: 'DITOLAK',
};
exports.STAGES = [
    'CUTTING',
    'SEWING',
    'TRIMMING',
    'FINISHING',
    'IRONING',
    'PACKING',
];
exports.QC_STAGES = [
    'CUTTING',
    'SEWING',
    'TRIMMING',
    'FINISHING',
    'IRONING',
];
exports.SESSION_STATUS = {
    AKTIF: 'AKTIF',
    BERAKHIR: 'BERAKHIR',
};
exports.SESSION_END_REASON = {
    LOGOUT: 'LOGOUT',
    TIDAK_AKTIF: 'TIDAK_AKTIF',
    DIAKHIRI_ADMIN: 'DIAKHIRI_ADMIN',
    RESET_PASSWORD: 'RESET_PASSWORD',
    AKUN_NONAKTIF: 'AKUN_NONAKTIF',
};
exports.SCHEME = ['CMT', 'FOB'];
exports.PAYMENT_TERM = ['LUNAS_AWAL', 'DP', 'KREDIT'];
exports.MATERIAL_SOURCE = ['BUYER', 'SUPPLIER'];
// Konstanta baru KONTRAK v2
exports.ORDER_LEVEL = {
    DOMESTIK: 'DOMESTIK',
    INTERNASIONAL: 'INTERNASIONAL',
};
exports.INSPECTION_TYPE = {
    INCOMING: 'INCOMING',
    INLINE: 'INLINE',
    FINAL: 'FINAL',
};
exports.PAYMENT_METHOD = [
    'TRANSFER',
    'TT',
    'LC',
    'GIRO',
    'TUNAI',
];
exports.CANCELLATION_STATUS = {
    MENUNGGU: 'MENUNGGU',
    DISETUJUI: 'DISETUJUI',
    DITOLAK: 'DITOLAK',
};
// Peran yang boleh melihat informasi harga (TSD AC-08 & KONTRAK v2 Bagian 9)
exports.PRICE_VISIBLE_ROLES = [
    exports.ROLE.MARKETING,
    exports.ROLE.PIMPINAN,
];
// Kolom harga yang wajib disembunyikan dari role selain MARKETING dan PIMPINAN
// Mencakup 6 kolom inti KONTRAK v2 Bagian 9 + hasil audit tabel 03-order.sql & 04-produksi.sql
exports.HIDDEN_PRICE_FIELDS = [
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
];
// Kode dan pesan error resmi sesuai FSD Bagian 6 & KONTRAK Bagian 8
exports.ERROR_CODE = {
    VALIDATION_REQUIRED: 'ERR-VAL-01',
    SYS_UNAVAILABLE: 'ERR-SYS-01',
    SYS_INTERNAL: 'ERR-SYS-02',
};
exports.ERROR_MESSAGE = {
    [exports.ERROR_CODE.VALIDATION_REQUIRED]: 'Kolom ini wajib diisi.',
    [exports.ERROR_CODE.SYS_UNAVAILABLE]: 'Layanan sedang tidak tersedia. Silakan coba lagi.',
    [exports.ERROR_CODE.SYS_INTERNAL]: 'Terjadi kesalahan pada sistem. Silakan coba lagi.',
};
// 16 nilai persis sesuai CHECK constraint ck_activity_logs_action di app.activity_logs (KONTRAK v2 Bagian 4.2)
exports.ACTION_TYPE = {
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
};
// Kode notifikasi N-01 sampai N-11 sesuai CHECK constraint ck_notifications_event di app.notifications
exports.NOTIF = {
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
};
//# sourceMappingURL=constants.js.map