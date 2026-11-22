import { z } from 'zod';
import { STAGES } from '../constants';

const INVALID_ID = 'Format ID tidak valid.';

const required = 'Kolom ini wajib diisi.';
const dateString = z
  .string({ required_error: required })
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD.');

export const spkIdParams = z.object({ id: z.string().uuid(INVALID_ID) });
export const progressIdParams = z.object({ id: z.string().uuid(INVALID_ID) });

/** qty_done negatif (ERR-VAL-09) dan aturan bisnis lain dicek di service supaya kodenya sesuai FSD. */
export const createProgressBody = z.object({
  stage_code: z.enum(STAGES, { required_error: required }),
  work_date: dateString,
  qty_done: z.number({ required_error: required }).int(),
  variance_note: z.string().trim().max(300).nullish(),
});

export const updateProgressBody = z.object({
  qty_done: z.number({ required_error: required }).int(),
  variance_note: z.string().trim().max(300).nullish(),
});

export type CreateProgressInput = z.infer<typeof createProgressBody>;
export type UpdateProgressInput = z.infer<typeof updateProgressBody>;
