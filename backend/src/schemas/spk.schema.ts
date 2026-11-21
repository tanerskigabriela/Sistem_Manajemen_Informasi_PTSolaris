import { z } from 'zod';
import { SPK_STATUS } from '../constants';

const required = 'Kolom ini wajib diisi.';

export const spkIdParams = z.object({ id: z.string().uuid() });

/** ERR-VAL-02 (qty > 0) dan ERR-VAL-13 (centang bahan lengkap) dicek di service. */
export const submitSpkBody = z.object({
  order_detail_id: z.string({ required_error: required }).uuid(),
  line_id: z.string({ required_error: required }).uuid(),
  target_date: z
    .string({ required_error: required })
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD.'),
  sizes: z
    .array(
      z.object({
        size: z.string({ required_error: required }).trim().min(1, required).max(10),
        qty: z.number({ required_error: required }).int(),
      }),
      { required_error: required },
    )
    .min(1, required),
  materials_complete_confirmed: z.boolean().optional(),
});

export const rejectSpkBody = z.object({
  reason: z.string().max(500).optional(),
});

export const listSpkQuery = z.object({
  status: z
    .enum([SPK_STATUS.MENUNGGU_PERSETUJUAN, SPK_STATUS.DISETUJUI, SPK_STATUS.DITOLAK])
    .optional(),
  order_id: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(10),
});

export type SubmitSpkInput = z.infer<typeof submitSpkBody>;
export type RejectSpkInput = z.infer<typeof rejectSpkBody>;
export type ListSpkQuery = z.infer<typeof listSpkQuery>;
