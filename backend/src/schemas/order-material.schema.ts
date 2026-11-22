import { z } from 'zod';
import { MATERIAL_SOURCE } from '../constants';

const INVALID_ID = 'Format ID tidak valid.';

const required = 'Kolom ini wajib diisi.';
const dateString = z
  .string({ required_error: required })
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD.');

export const orderDetailIdParams = z.object({ id: z.string().uuid(INVALID_ID) });
export const materialIdParams = z.object({ id: z.string().uuid(INVALID_ID) });

/**
 * Aturan bisnis yang punya kode error sendiri (ERR-VAL-02, ERR-VAL-08, ERR-VAL-13)
 * sengaja dicek di service, bukan di Zod, supaya kodenya sesuai FSD.
 */
export const createOrderMaterialBody = z.object({
  material_id: z.string({ required_error: required }).uuid(INVALID_ID),
  qty: z.number({ required_error: required }),
  unit: z.string().trim().min(1).max(20).optional(),
  source: z.enum(MATERIAL_SOURCE, { required_error: required }),
  supplier_id: z.string().uuid(INVALID_ID).nullish(),
  material_price: z.number().nullish(),
  received_date: dateString,
  eligibility_confirmed: z.boolean().optional(),
});

export const updateOrderMaterialBody = createOrderMaterialBody.partial();

export type CreateOrderMaterialInput = z.infer<typeof createOrderMaterialBody>;
export type UpdateOrderMaterialInput = z.infer<typeof updateOrderMaterialBody>;
