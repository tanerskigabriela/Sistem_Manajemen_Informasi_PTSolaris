import axios, { AxiosError } from 'axios';
import type { ApiErrorResponse, ApiFieldError } from '../types/api';

export interface NormalizedApiError {
  httpStatus: number;
  errorCode: string;
  message: string;
  errors: ApiFieldError[];
}

let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api/v1',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

http.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiErrorResponse>) => {
    const status = error.response?.status;
    const url = error.config?.url ?? '';

    // Jangan panggil redirect loop saat sedang cek /auth/me atau mencoba /auth/login
    const isAuthEndpoint =
      url.includes('/auth/login') || url.includes('/auth/me');

    if (status === 401 && !isAuthEndpoint && unauthorizedHandler) {
      unauthorizedHandler();
    }

    return Promise.reject(error);
  },
);

export function parseApiError(error: unknown): NormalizedApiError {
  if (axios.isAxiosError<ApiErrorResponse>(error)) {
    const data = error.response?.data;
    if (data && data.status === 'error') {
      return {
        httpStatus: error.response?.status ?? 500,
        errorCode: data.error_code ?? 'ERR-SYS-02',
        message: data.message ?? 'Terjadi kesalahan pada sistem.',
        errors: Array.isArray(data.errors) ? data.errors : [],
      };
    }

    if (!error.response) {
      return {
        httpStatus: 503,
        errorCode: 'ERR-SYS-01',
        message: 'Tidak dapat terhubung ke server. Periksa koneksi Anda.',
        errors: [],
      };
    }
  }

  return {
    httpStatus: 500,
    errorCode: 'ERR-SYS-02',
    message: 'Terjadi kesalahan pada sistem. Silakan coba lagi.',
    errors: [],
  };
}

/**
 * Mengubah array `errors` dari respons 422 backend menjadi map `{ [field]: message }`
 * agar mudah ditampilkan di bawah masing-masing Input form.
 */
export function toFieldErrorMap(
  errors: ApiFieldError[],
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const item of errors) {
    if (!map[item.field]) {
      map[item.field] = item.message;
    }
  }
  return map;
}