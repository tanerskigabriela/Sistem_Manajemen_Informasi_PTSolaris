import { z } from "zod";
import { ORDER_STATUS } from "../constants";
import { MSG } from "../errors/order.errors";
import { pageQuery } from "./buyers.schema";

const isoDate = z
  .string({ required_error: MSG.REQUIRED })
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal YYYY-MM-DD.");

const positive = z.coerce
  .number({ required_error: MSG.REQUIRED, invalid_type_error: MSG.REQUIRED })
  .positive(MSG.POSITIVE);

const sizeSchema = z.object({
  size: z
    .string({ required_error: MSG.REQUIRED })
    .trim()
    .min(1, MSG.REQUIRED)
    .max(10),
  qty: z.coerce
    .number({ required_error: MSG.REQUIRED })
    .int("Jumlah harus bilangan bulat.")
    .positive(MSG.POSITIVE),
});

// Satu style = satu barang + satu warna. Barang lama: isi item_id.
// Barang baru: item_id null, isi type_code dan item_name/buyer_style_name (kode dibuat sp_create_order).
const styleSchema = z
  .object({
    item_id: z
      .string()
      .uuid()
      .nullish()
      .transform((v) => v ?? null),
    type_code: z.enum(["CL", "KM", "KS", "PL", "DR", "JK", "SR"]).nullish(),
    item_name: z.string().trim().max(100).nullish(),
    buyer_style_name: z.string().trim().max(100).nullish(),
    buyer_style_code: z.string().trim().max(30).nullish(),
    color: z
      .string({ required_error: MSG.REQUIRED })
      .trim()
      .min(1, MSG.REQUIRED)
      .max(50),
    unit_price: positive,
    discount_pct: z.coerce
      .number()
      .min(0)
      .max(100, "Diskon antara 0 dan 100%.")
      .default(0),
    sizes: z
      .array(sizeSchema, { required_error: MSG.REQUIRED })
      .min(1, MSG.REQUIRED),
  })
  .superRefine((s, ctx) => {
    if (!s.item_id) {
      if (!s.type_code)
        ctx.addIssue({
          code: "custom",
          path: ["type_code"],
          message: MSG.REQUIRED,
        });
      if (!s.item_name && !s.buyer_style_name)
        ctx.addIssue({
          code: "custom",
          path: ["item_name"],
          message: MSG.REQUIRED,
        });
    }
    const seen = new Set<string>();
    s.sizes.forEach((z, i) => {
      const key = z.size.toUpperCase();
      if (seen.has(key))
        ctx.addIssue({
          code: "custom",
          path: ["sizes", i, "size"],
          message: "Ukuran ganda dalam satu style.",
        });
      seen.add(key);
    });
  });

export const createOrderSchema = z
  .object({
    buyer_id: z.string({ required_error: MSG.REQUIRED }).uuid(MSG.REQUIRED),
    level_code: z.enum(["DOMESTIK", "INTERNASIONAL"]).default("DOMESTIK"),
    deadline: isoDate,
    scheme: z.enum(["CMT", "FOB"], { required_error: MSG.REQUIRED }),
    reject_limit_pct: z.coerce
      .number({
        required_error: MSG.REQUIRED,
        invalid_type_error: MSG.REQUIRED,
      })
      .min(0, MSG.REJECT_RANGE)
      .max(100, MSG.REJECT_RANGE),
    late_penalty: z
      .string({ required_error: MSG.REQUIRED })
      .trim()
      .min(1, MSG.REQUIRED)
      .max(500),
    buyer_po_no: z.string().trim().max(30).nullish(),
    notes: z.string().trim().max(500).nullish(),
    currency: z.string().trim().toUpperCase().length(3).nullish(),
    exchange_rate: z.coerce.number().positive(MSG.POSITIVE).nullish(),
    incoterm: z
      .enum(["EXW", "FCA", "FOB", "CFR", "CIF", "DAP", "DDP"])
      .nullish(),
    destination_country: z.string().trim().toUpperCase().length(2).nullish(),
    destination_port: z.string().trim().max(60).nullish(),
    // style kosong dicek di service supaya keluar ERR-ORD-01
    styles: z.array(styleSchema).default([]),
    confirmed: z.literal(true, { errorMap: () => ({ message: MSG.CONFIRM }) }),
  })
  .superRefine((o, ctx) => {
    if (o.level_code !== "INTERNASIONAL") return;
    for (const f of [
      "currency",
      "exchange_rate",
      "incoterm",
      "destination_country",
      "destination_port",
    ] as const) {
      if (o[f] === undefined || o[f] === null || o[f] === "")
        ctx.addIssue({ code: "custom", path: [f], message: MSG.REQUIRED });
    }
  });

export const listOrdersQuery = z
  .object({
    ...pageQuery,
    status: z.nativeEnum(ORDER_STATUS).optional(),
    buyer_id: z.string().uuid().optional(),
    level_code: z.enum(["DOMESTIK", "INTERNASIONAL"]).optional(),
    date_from: isoDate.optional(),
    date_to: isoDate.optional(),
  })
  .refine((q) => !q.date_from || !q.date_to || q.date_from <= q.date_to, {
    path: ["date_from"],
    message: MSG.DATE_RANGE,
  });

export const listItemsQuery = z.object({
  buyer_id: z.string().uuid().optional(),
  type_code: z.enum(["CL", "KM", "KS", "PL", "DR", "JK", "SR"]).optional(),
  q: z.string().trim().max(100).optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type ListOrdersQuery = z.infer<typeof listOrdersQuery>;
export type ListItemsQuery = z.infer<typeof listItemsQuery>;

// ---------------------------------------------------------------------------
// tolak, tarik, batal. Alasan kosong dicek di service supaya keluar ERR-VAL-06.
// ---------------------------------------------------------------------------
const reasonField = z
  .string()
  .trim()
  .max(500, "Maksimal 500 karakter.")
  .optional()
  .default("");

export const reasonSchema = z.object({ reason: reasonField });

export const cancelOrderSchema = z.object({
  reason: reasonField,
  requested_by_party: z.enum(["BUYER", "PERUSAHAAN"], {
    errorMap: () => ({ message: "Pilih BUYER atau PERUSAHAAN." }),
  }),
});

export type ReasonInput = z.infer<typeof reasonSchema>;
export type CancelOrderInput = z.infer<typeof cancelOrderSchema>;
