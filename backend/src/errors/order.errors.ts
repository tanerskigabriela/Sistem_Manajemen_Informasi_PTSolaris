import { AppError, type FieldError } from "../utils/errors";

// Kode dan pesan error, disalin dari FSD Bagian 6.
export const MSG = {
  REQUIRED: "Kolom ini wajib diisi.",
  POSITIVE: "Nilai harus lebih dari 0.",
  BUYER_CODE_FORMAT: "Kode buyer harus 3 huruf kapital (contoh: BRT).",
  BUYER_CODE_TAKEN: "Kode buyer sudah dipakai.",
  REJECT_RANGE: "Batas reject harus antara 0 dan 100%.",
  DATE_RANGE: "Tanggal awal tidak boleh melebihi tanggal akhir.",
  CONFIRM: "Centang pernyataan terlebih dahulu.",
  NO_STYLE: "Order harus memiliki minimal satu style.",
  NO_ACCESS: "Anda tidak memiliki akses ke halaman ini.",
  NOT_FOUND: "Data tidak ditemukan.",
} as const;

export const notFound = () => new AppError(404, "ERR-SYS-02", MSG.NOT_FOUND);

export const fieldError = (errors: FieldError[]) =>
  new AppError(422, "ERR-VAL-01", MSG.REQUIRED, errors);

// Nilai @result sp_create_order selain SUCCESS -> AppError
export function createOrderError(result: string): AppError {
  switch (result) {
    case "NO_STYLE":
      return new AppError(422, "ERR-ORD-01", MSG.NO_STYLE);
    case "INVALID_EMPLOYEE":
      return new AppError(403, "ERR-AUTH-03", MSG.NO_ACCESS);
    case "INVALID_BUYER":
      return fieldError([
        { field: "buyer_id", message: "Buyer tidak ditemukan." },
      ]);
    case "INVALID_LEVEL":
      return fieldError([
        { field: "level_code", message: "Level order tidak ditemukan." },
      ]);
    case "INVALID_HEADER":
      return fieldError([
        {
          field: "deadline",
          message: "Deadline tidak boleh sebelum hari ini.",
        },
      ]);
    case "INTL_FIELDS_REQUIRED":
      return fieldError([
        {
          field: "destination_country",
          message: "Negara tujuan wajib diisi dan harus terdaftar.",
        },
      ]);
    case "INVALID_STYLE":
      return fieldError([
        {
          field: "styles",
          message:
            "Barang tidak sesuai buyer, data style tidak lengkap, atau ada style ganda (barang dan warna sama).",
        },
      ]);
    case "INVALID_SIZES":
      return fieldError([
        {
          field: "styles",
          message:
            "Ukuran dan jumlah setiap style wajib diisi, jumlah harus lebih dari 0.",
        },
      ]);
    default:
      return new AppError(
        500,
        "ERR-SYS-02",
        "Terjadi kesalahan pada sistem. Silakan coba lagi.",
      );
  }
}

// ---------------------------------------------------------------------------
// persetujuan, penolakan, penarikan, dan pembatalan order
// ---------------------------------------------------------------------------
export const STATUS_MSG = {
  REASON_REQUIRED: "Alasan wajib diisi.",
  ORDER_DECIDED: "Order ini sudah diputuskan sebelumnya.",
  NOT_CANCELLABLE:
    "Order hanya dapat dibatalkan bila berstatus Disetujui atau Dalam Produksi.",
  NOT_WITHDRAWABLE:
    "Pengajuan tidak dapat ditarik karena order sudah diputuskan.",
  ORDER_FINAL: "Order ini bersifat final dan hanya dapat dilihat.",
  NO_POLICY: "Kebijakan pembatalan untuk order ini belum tersedia.",
} as const;

export const reasonRequired = () =>
  new AppError(422, "ERR-VAL-06", STATUS_MSG.REASON_REQUIRED, [
    { field: "reason", message: STATUS_MSG.REASON_REQUIRED },
  ]);

// Order DITOLAK/DITARIK bersifat final (ERR-ORD-05), selain itu pakai kode khusus aksinya
const isFinal = (status: string | null) =>
  status === "DITOLAK" || status === "DITARIK";
const finalError = () =>
  new AppError(409, "ERR-ORD-05", STATUS_MSG.ORDER_FINAL);

// Nilai @result sp_change_order_status selain SUCCESS -> AppError
export function changeStatusError(
  result: string,
  currentStatus: string | null,
): AppError {
  switch (result) {
    case "REASON_REQUIRED":
      return reasonRequired();
    case "NOT_FOUND":
      return notFound();
    case "ALREADY_DECIDED":
      return isFinal(currentStatus)
        ? finalError()
        : new AppError(409, "ERR-ORD-02", STATUS_MSG.ORDER_DECIDED);
    case "NOT_WITHDRAWABLE":
      return isFinal(currentStatus)
        ? finalError()
        : new AppError(409, "ERR-ORD-04", STATUS_MSG.NOT_WITHDRAWABLE);
    default:
      return new AppError(
        500,
        "ERR-SYS-02",
        "Terjadi kesalahan pada sistem. Silakan coba lagi.",
      );
  }
}

// Nilai @result sp_cancel_order selain SUCCESS -> AppError
export function cancelOrderError(
  result: string,
  currentStatus: string | null,
): AppError {
  switch (result) {
    case "REASON_REQUIRED":
      return reasonRequired();
    case "INVALID":
      return fieldError([
        {
          field: "requested_by_party",
          message: "Pilih BUYER atau PERUSAHAAN.",
        },
      ]);
    case "NOT_FOUND":
      return notFound();
    case "NOT_CANCELLABLE":
      return isFinal(currentStatus)
        ? finalError()
        : new AppError(409, "ERR-ORD-03", STATUS_MSG.NOT_CANCELLABLE);
    case "NO_POLICY":
      return new AppError(409, "ERR-BTL-01", STATUS_MSG.NO_POLICY);
    default:
      return new AppError(
        500,
        "ERR-SYS-02",
        "Terjadi kesalahan pada sistem. Silakan coba lagi.",
      );
  }
}
