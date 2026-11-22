import { z } from 'zod';
import { INSPECTION_TYPE, STAGES } from '../constants';

const INVALID_ID = 'Format ID tidak valid.';

const required = 'Kolom ini wajib diisi.';

export const spkIdParams = z.object({ id: z.string().uuid(INVALID_ID) });

/**
 * stage_code menerima semua tahap supaya PACKING bisa ditolak dengan ERR-QC-02 (bukan ERR-VAL-01).
 * Angka negatif (ERR-VAL-09) dicek di service.
 */
export const createQcResultBody = z.object({
  stage_code: z.enum(STAGES, { required_error: required }),
  check_date: z
    .string({ required_error: required })
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD.'),
  qty_passed: z.number({ required_error: required }).int(),
  standard_id: z.string({ required_error: required }).uuid(INVALID_ID),
  sample_qty: z.number().int().nullish(),
  inspection_type: z
    .enum([INSPECTION_TYPE.INLINE, INSPECTION_TYPE.FINAL])
    .default(INSPECTION_TYPE.INLINE),
  defects: z
    .array(
      z.object({
        defect_type_id: z.string({ required_error: required }).uuid(INVALID_ID),
        qty: z.number({ required_error: required }).int(),
        action_taken: z.string().trim().max(200).nullish(),
      }),
    )
    .default([]),
});

export type CreateQcResultInput = z.infer<typeof createQcResultBody>;
