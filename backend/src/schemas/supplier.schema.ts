import { z } from 'zod';
import { PAYMENT_TERM } from '../constants';

const INVALID_ID = 'Format ID tidak valid.';

const required = 'Kolom ini wajib diisi.';

export const supplierIdParams = z.object({
  id: z.string().uuid(INVALID_ID),
});

export const listSuppliersQuery = z.object({
  search: z.string().trim().max(100).optional(),
  is_active: z.enum(['true', 'false']).optional(),
});

export const createSupplierBody = z.object({
  supplier_name: z.string({ required_error: required }).trim().min(1, required).max(100),
  supplier_type: z.enum(['LOKAL', 'IMPOR'], { required_error: required }),
  country_code: z
    .string({ required_error: required })
    .trim()
    .length(2)
    .transform((v) => v.toUpperCase()),
  contact_name: z.string({ required_error: required }).trim().min(1, required).max(100),
  phone: z.string({ required_error: required }).trim().min(1, required).max(20),
  email: z.string().trim().email().max(100).nullish(),
  address: z.string({ required_error: required }).trim().min(1, required).max(200),
  city: z.string({ required_error: required }).trim().min(1, required).max(50),
  currency: z
    .string()
    .trim()
    .length(3)
    .transform((v) => v.toUpperCase())
    .default('IDR'),
  tax_id_no: z.string().trim().max(30).nullish(),
  rating: z.number().min(1).max(5).nullish(),
  payment_term: z.enum(PAYMENT_TERM, { required_error: required }),
  payment_term_days: z.number().int().min(0).default(0),
});

export const updateSupplierBody = createSupplierBody
  .partial()
  .extend({ is_active: z.boolean().optional() })
  .refine((v) => Object.keys(v).length > 0, {
    message: 'Tidak ada data yang diubah.',
  });

export type CreateSupplierInput = z.infer<typeof createSupplierBody>;
export type UpdateSupplierInput = z.infer<typeof updateSupplierBody>;
export type ListSuppliersQuery = z.infer<typeof listSuppliersQuery>;
