import { sql } from "drizzle-orm";
import {
  bigint,
  bit,
  char,
  date,
  datetime2,
  decimal,
  int,
  nvarchar,
  primaryKey,
  smallint,
  varchar,
} from "drizzle-orm/mssql-core";
import { employees, factories, garmentSchema, uniqueidentifier } from "./org";

// Skema Drizzle modul B (03-order.sql). Hanya dipakai untuk query baca.

export const buyers = garmentSchema.table("buyers", {
  id: uniqueidentifier("id")
    .primaryKey()
    .notNull()
    .default(sql`NEWSEQUENTIALID()`),
  buyer_code: char("buyer_code", { length: 3 }).notNull().unique(),
  buyer_name: nvarchar("buyer_name", { length: 100 }).notNull(),
  buyer_type: varchar("buyer_type", { length: 5 }).notNull(),
  country_code: char("country_code", { length: 2 }).notNull(),
  contact_name: nvarchar("contact_name", { length: 100 }).notNull(),
  phone: varchar("phone", { length: 20 }).notNull(),
  email: varchar("email", { length: 100 }),
  address: nvarchar("address", { length: 200 }).notNull(),
  city: nvarchar("city", { length: 50 }).notNull(),
  tax_id_no: varchar("tax_id_no", { length: 30 }),
  default_currency: char("default_currency", { length: 3 })
    .notNull()
    .default("IDR"),
  payment_term_days: smallint("payment_term_days").notNull().default(30),
  credit_limit: decimal("credit_limit", {
    precision: 16,
    scale: 2,
    mode: "number",
  }),
  created_at: datetime2("created_at", { precision: 0 })
    .notNull()
    .default(sql`SYSDATETIME()`),
  updated_at: datetime2("updated_at", { precision: 0 })
    .notNull()
    .default(sql`SYSDATETIME()`),
});

export const order_levels = garmentSchema.table("order_levels", {
  level_code: varchar("level_code", { length: 13 }).primaryKey().notNull(),
  level_name: nvarchar("level_name", { length: 30 }).notNull(),
  standard_lead_time_days: smallint("standard_lead_time_days").notNull(),
  minimum_order_qty: int("minimum_order_qty").notNull(),
  vat_treatment: varchar("vat_treatment", { length: 5 }).notNull(),
  min_down_payment_pct: decimal("min_down_payment_pct", {
    precision: 5,
    scale: 2,
    mode: "number",
  }).notNull(),
  requires_export_document: bit("requires_export_document").notNull(),
});

export const order_level_payment_methods = garmentSchema.table(
  "order_level_payment_methods",
  {
    level_code: varchar("level_code", { length: 13 })
      .notNull()
      .references(() => order_levels.level_code),
    payment_method: varchar("payment_method", { length: 8 }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.level_code, t.payment_method] })],
);

export const product_types = garmentSchema.table("product_types", {
  type_code: char("type_code", { length: 2 }).primaryKey().notNull(),
  type_name: nvarchar("type_name", { length: 30 }).notNull(),
});

export const items = garmentSchema.table("items", {
  id: uniqueidentifier("id")
    .primaryKey()
    .notNull()
    .default(sql`NEWSEQUENTIALID()`),
  item_code: varchar("item_code", { length: 12 }).notNull().unique(),
  buyer_id: uniqueidentifier("buyer_id").references(() => buyers.id),
  type_code: char("type_code", { length: 2 })
    .notNull()
    .references(() => product_types.type_code),
  item_name: nvarchar("item_name", { length: 100 }).notNull(),
  buyer_style_name: nvarchar("buyer_style_name", { length: 100 }),
  buyer_style_code: varchar("buyer_style_code", { length: 30 }),
  design_notes: nvarchar("design_notes", { length: 500 }),
  tech_pack_file: varchar("tech_pack_file", { length: 200 }),
  base_price: decimal("base_price", {
    precision: 16,
    scale: 2,
    mode: "number",
  }),
  status: varchar("status", { length: 8 }).notNull().default("AKTIF"),
  created_at: datetime2("created_at", { precision: 0 })
    .notNull()
    .default(sql`SYSDATETIME()`),
});

export const item_variants = garmentSchema.table("item_variants", {
  id: uniqueidentifier("id")
    .primaryKey()
    .notNull()
    .default(sql`NEWSEQUENTIALID()`),
  item_id: uniqueidentifier("item_id")
    .notNull()
    .references(() => items.id),
  sku: varchar("sku", { length: 30 }).notNull().unique(),
  size: varchar("size", { length: 10 }).notNull(),
  color: nvarchar("color", { length: 50 }).notNull(),
  weight_per_pcs_gram: decimal("weight_per_pcs_gram", {
    precision: 8,
    scale: 2,
    mode: "number",
  }),
});

export const orders = garmentSchema.table("orders", {
  id: uniqueidentifier("id")
    .primaryKey()
    .notNull()
    .default(sql`NEWSEQUENTIALID()`),
  order_code: char("order_code", { length: 12 }).notNull().unique(),
  buyer_id: uniqueidentifier("buyer_id")
    .notNull()
    .references(() => buyers.id),
  factory_id: uniqueidentifier("factory_id")
    .notNull()
    .references(() => factories.id),
  level_code: varchar("level_code", { length: 13 })
    .notNull()
    .default("DOMESTIK"),
  handled_by: uniqueidentifier("handled_by")
    .notNull()
    .references(() => employees.id),
  buyer_po_no: varchar("buyer_po_no", { length: 30 }),
  order_date: date("order_date", { mode: "string" }).notNull(),
  deadline: date("deadline", { mode: "string" }).notNull(),
  finish_date: date("finish_date", { mode: "string" }),
  scheme: varchar("scheme", { length: 3 }).notNull(),
  reject_limit_pct: decimal("reject_limit_pct", {
    precision: 5,
    scale: 2,
    mode: "number",
  }).notNull(),
  late_penalty: nvarchar("late_penalty", { length: 500 }).notNull(),
  currency: char("currency", { length: 3 }).notNull().default("IDR"),
  exchange_rate: decimal("exchange_rate", {
    precision: 12,
    scale: 4,
    mode: "number",
  }).notNull(),
  incoterm: varchar("incoterm", { length: 3 }),
  destination_country: char("destination_country", { length: 2 }),
  destination_port: nvarchar("destination_port", { length: 60 }),
  notes: nvarchar("notes", { length: 500 }),
  status: varchar("status", { length: 20 })
    .notNull()
    .default("MENUNGGU_PERSETUJUAN"),
  is_at_risk: bit("is_at_risk").notNull().default(false),
  is_over_reject: bit("is_over_reject").notNull().default(false),
  created_at: datetime2("created_at", { precision: 0 })
    .notNull()
    .default(sql`SYSDATETIME()`),
});

export const order_status_history = garmentSchema.table(
  "order_status_history",
  {
    id: bigint("id", { mode: "number" }).primaryKey().notNull().identity(),
    order_id: uniqueidentifier("order_id")
      .notNull()
      .references(() => orders.id),
    status: varchar("status", { length: 20 }).notNull(),
    changed_by: uniqueidentifier("changed_by")
      .notNull()
      .references(() => employees.id),
    reason: nvarchar("reason", { length: 500 }),
    changed_at: datetime2("changed_at", { precision: 0 })
      .notNull()
      .default(sql`SYSDATETIME()`),
  },
);

export const order_details = garmentSchema.table("order_details", {
  id: uniqueidentifier("id")
    .primaryKey()
    .notNull()
    .default(sql`NEWSEQUENTIALID()`),
  order_id: uniqueidentifier("order_id")
    .notNull()
    .references(() => orders.id),
  item_id: uniqueidentifier("item_id")
    .notNull()
    .references(() => items.id),
  color: nvarchar("color", { length: 50 }).notNull(),
  unit_price: decimal("unit_price", {
    precision: 16,
    scale: 2,
    mode: "number",
  }).notNull(),
  discount_pct: decimal("discount_pct", {
    precision: 5,
    scale: 2,
    mode: "number",
  })
    .notNull()
    .default(0),
  is_at_risk: bit("is_at_risk").notNull().default(false),
  is_over_reject: bit("is_over_reject").notNull().default(false),
});

export const order_detail_sizes = garmentSchema.table(
  "order_detail_sizes",
  {
    order_detail_id: uniqueidentifier("order_detail_id")
      .notNull()
      .references(() => order_details.id),
    size: varchar("size", { length: 10 }).notNull(),
    variant_id: uniqueidentifier("variant_id").references(
      () => item_variants.id,
    ),
    qty: int("qty").notNull(),
    cancelled_qty: int("cancelled_qty").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.order_detail_id, t.size] })],
);
