export type FieldValidator = (value: unknown) => string | null;

// Pesan error standar sesuai FSD Bagian 6 (ERR-VAL-01 s.d. ERR-VAL-14)
export const MSG_REQUIRED = 'Kolom ini wajib diisi.';
export const MSG_REASON_REQUIRED = 'Alasan wajib diisi.';
export const MSG_POSITIVE_NUMBER = 'Nilai harus lebih dari 0.';
export const MSG_NON_NEGATIVE = 'Nilai tidak boleh negatif.';
export const MSG_PASSWORD_MIN = 'Password minimal 8 karakter.';
export const MSG_PASSWORD_MISMATCH = 'Kedua password tidak sama.';
export const MSG_MUST_CHECK = 'Centang pernyataan terlebih dahulu.';
export const MSG_REJECT_LIMIT = 'Batas reject harus antara 0 dan 100%.';

export function required(message = MSG_REQUIRED): FieldValidator {
  return (value) => {
    if (value === null || value === undefined) return message;
    if (typeof value === 'string' && value.trim().length === 0) return message;
    return null;
  };
}

export function reasonRequired(): FieldValidator {
  return required(MSG_REASON_REQUIRED);
}

export function mustBeChecked(message = MSG_MUST_CHECK): FieldValidator {
  return (value) => {
    if (value !== true) return message;
    return null;
  };
}

export function minLength(min: number, message?: string): FieldValidator {
  return (value) => {
    const text = String(value ?? '').trim();
    if (text.length > 0 && text.length < min) {
      return message ?? `Minimal ${min} karakter.`;
    }
    return null;
  };
}

export function passwordMinLength(): FieldValidator {
  return minLength(8, MSG_PASSWORD_MIN);
}

export function matchField(
  getTarget: () => unknown,
  message = MSG_PASSWORD_MISMATCH,
): FieldValidator {
  return (value) => {
    if (String(value ?? '') !== String(getTarget() ?? '')) {
      return message;
    }
    return null;
  };
}

export function maxLength(max: number, message?: string): FieldValidator {
  return (value) => {
    const text = String(value ?? '').trim();
    if (text.length > max) {
      return message ?? `Maksimal ${max} karakter.`;
    }
    return null;
  };
}

export function usernameFormat(): FieldValidator {
  return (value) => {
    const text = String(value ?? '').trim();
    if (!text) return null;
    if (text.length < 4 || text.length > 50) {
      return 'Username harus antara 4 hingga 50 karakter.';
    }
    if (!/^[a-zA-Z0-9._-]+$/.test(text)) {
      return 'Username hanya boleh berisi huruf, angka, titik, garis bawah, atau strip.';
    }
    return null;
  };
}

export function buyerCodeFormat(): FieldValidator {
  return (value) => {
    const text = String(value ?? '').trim();
    if (!text) return null;
    if (!/^[A-Z]{3}$/.test(text)) {
      return 'Kode buyer harus 3 huruf kapital (contoh: BRT).';
    }
    return null;
  };
}

export function positiveNumber(
  message = MSG_POSITIVE_NUMBER,
): FieldValidator {
  return (value) => {
    if (value === '' || value === null || value === undefined) return null;
    const num = Number(value);
    if (Number.isNaN(num) || num <= 0) return message;
    return null;
  };
}

export function nonNegativeNumber(
  message = MSG_NON_NEGATIVE,
): FieldValidator {
  return (value) => {
    if (value === '' || value === null || value === undefined) return null;
    const num = Number(value);
    if (Number.isNaN(num) || num < 0) return message;
    return null;
  };
}

export function rangeNumber(
  min: number,
  max: number,
  message?: string,
): FieldValidator {
  return (value) => {
    if (value === '' || value === null || value === undefined) return null;
    const num = Number(value);
    if (Number.isNaN(num) || num < min || num > max) {
      return message ?? `Nilai harus antara ${min} dan ${max}.`;
    }
    return null;
  };
}

export function rejectLimitRange(): FieldValidator {
  return rangeNumber(0, 100, MSG_REJECT_LIMIT);
}

export function validateDateRange(
  dateFrom?: string,
  dateTo?: string,
): string | null {
  if (dateFrom && dateTo && dateFrom > dateTo) {
    return 'Tanggal awal tidak boleh melebihi tanggal akhir.';
  }
  return null;
}

/**
 * Menjalankan daftar validator untuk setiap field dalam form.
 * Mengembalikan map `{ [field]: pesanError }` (kosong jika semua valid).
 */
export function validateForm<T extends Record<string, unknown>>(
  values: T,
  rules: Partial<Record<keyof T, FieldValidator[]>>,
): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const key of Object.keys(rules) as Array<keyof T>) {
    const validators = rules[key];
    if (!validators) continue;

    for (const validator of validators) {
      const errorMessage = validator(values[key]);
      if (errorMessage) {
        errors[String(key)] = errorMessage;
        break;
      }
    }
  }

  return errors;
}
