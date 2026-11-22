import { z } from 'zod';
import { ACTION_TYPE } from '../constants';

const ACTION_TYPE_VALUES = [
  ACTION_TYPE.LOGIN_BERHASIL,
  ACTION_TYPE.LOGIN_GAGAL,
  ACTION_TYPE.LOGOUT,
  ACTION_TYPE.SESI_BERAKHIR,
  ACTION_TYPE.SESI_DIAKHIRI,
  ACTION_TYPE.AKUN_TERKUNCI,
  ACTION_TYPE.BUKA_KUNCI,
  ACTION_TYPE.RESET_PASSWORD,
  ACTION_TYPE.GANTI_PASSWORD,
  ACTION_TYPE.AKSES_DITOLAK,
  ACTION_TYPE.TAMBAH,
  ACTION_TYPE.UBAH,
  ACTION_TYPE.SETUJU,
  ACTION_TYPE.TOLAK,
  ACTION_TYPE.TARIK,
  ACTION_TYPE.BATAL,
] as const;

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function isValidCalendarDate(value: string): boolean {
  if (!DATE_REGEX.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export const listActivityLogsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    per_page: z.coerce.number().int().min(1).max(100).default(20),
    action_type: z.enum(ACTION_TYPE_VALUES).optional(),
    username: z.string().trim().max(50).optional(),
    resource_type: z.string().trim().max(40).optional(),
    date_from: z
      .string()
      .refine(
        isValidCalendarDate,
        'Tanggal awal tidak valid (gunakan format YYYY-MM-DD).',
      )
      .optional(),
    date_to: z
      .string()
      .refine(
        isValidCalendarDate,
        'Tanggal akhir tidak valid (gunakan format YYYY-MM-DD).',
      )
      .optional(),
  })
  .refine(
    (data) =>
      !data.date_from || !data.date_to || data.date_from <= data.date_to,
    {
      message: 'Tanggal awal tidak boleh melebihi tanggal akhir.',
      path: ['date_from'],
    },
  );

export type ListActivityLogsQuery = z.infer<typeof listActivityLogsQuerySchema>;