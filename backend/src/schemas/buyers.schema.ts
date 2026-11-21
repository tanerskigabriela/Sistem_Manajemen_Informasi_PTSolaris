import { z } from "zod";
import { MSG } from "../errors/order.errors";

const text = (max: number) =>
  z
    .string({ required_error: MSG.REQUIRED })
    .trim()
    .min(1, MSG.REQUIRED)
    .max(max, `Maksimal ${max} karakter.`);

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Maksimal ${max} karakter.`)
    .nullish()
    .transform((v) => (v ? v : null));

export const pageQuery = {
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(100).optional(),
};

export const idParams = z.object({ id: z.string().uuid(MSG.NOT_FOUND) });

const buyerFields = {
  buyer_name: text(100),
  buyer_type: z.enum(["LOKAL", "ASING"], { required_error: MSG.REQUIRED }),
  country_code: z
    .string({ required_error: MSG.REQUIRED })
    .trim()
    .toUpperCase()
    .length(2, MSG.REQUIRED),
  contact_name: text(100),
  phone: text(20),
  email: z
    .string()
    .trim()
    .email("Format email tidak valid.")
    .max(100)
    .nullish()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
  address: text(200),
  city: text(50),
  tax_id_no: optionalText(30),
  default_currency: z
    .string()
    .trim()
    .toUpperCase()
    .length(3, "Kode mata uang 3 huruf.")
    .default("IDR"),
  payment_term_days: z.coerce
    .number()
    .int()
    .min(0, "Nilai tidak boleh negatif.")
    .default(30),
  credit_limit: z.coerce
    .number()
    .min(0, "Nilai tidak boleh negatif.")
    .nullish()
    .transform((v) => v ?? null),
};

export const createBuyerSchema = z.object({
  buyer_code: z
    .string({ required_error: MSG.REQUIRED })
    .trim()
    .regex(/^[A-Z]{3}$/, MSG.BUYER_CODE_FORMAT),
  ...buyerFields,
});

// Kode buyer tidak bisa diubah karena dipakai sebagai awalan kode barang (BBB-JJ-NNNN).
export const updateBuyerSchema = z
  .object(buyerFields)
  .partial()
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: "Tidak ada data yang diubah.",
  });

export const listBuyersQuery = z.object({
  ...pageQuery,
  buyer_type: z.enum(["LOKAL", "ASING"]).optional(),
});

export type CreateBuyerInput = z.infer<typeof createBuyerSchema>;
export type UpdateBuyerInput = z.infer<typeof updateBuyerSchema>;
export type ListBuyersQuery = z.infer<typeof listBuyersQuery>;
