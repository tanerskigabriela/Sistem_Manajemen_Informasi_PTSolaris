import { sql } from 'drizzle-orm';
import {
  bit,
  char,
  date,
  datetime2,
  decimal,
  int,
  nvarchar,
  smallint,
  varchar,
} from 'drizzle-orm/mssql-core';
import { garmentSchema, uniqueidentifier } from './org';

/**
 * Skema Drizzle modul C (04-produksi.sql). Hanya tabel yang dibaca lewat Drizzle
 * oleh modul RSI. Tabel lain (stok, PO, penerimaan, aset) dibaca lewat SP/view di tahap SMBD.
 * Penulisan data tetap lewat SP atau query bertransaksi di repository.
 */

const id = () =>
  uniqueidentifier('id')
    .primaryKey()
    .notNull()
    .default(sql`NEWSEQUENTIALID()`);

export const production_lines = garmentSchema.table('production_lines', {
  id: id(),
  factory_id: uniqueidentifier('factory_id').notNull(),
  supervisor_id: uniqueidentifier('supervisor_id').notNull(),
  line_name: nvarchar('line_name', { length: 50 }).notNull(),
  capacity_pcs_per_day: int('capacity_pcs_per_day').notNull(),
});

export const suppliers = garmentSchema.table('suppliers', {
  id: id(),
  supplier_name: nvarchar('supplier_name', { length: 100 }).notNull(),
  supplier_type: varchar('supplier_type', { length: 6 }).notNull(),
  country_code: char('country_code', { length: 2 }).notNull(),
  contact_name: nvarchar('contact_name', { length: 100 }).notNull(),
  phone: varchar('phone', { length: 20 }).notNull(),
  email: varchar('email', { length: 100 }),
  address: nvarchar('address', { length: 200 }).notNull(),
  city: nvarchar('city', { length: 50 }).notNull(),
  currency: char('currency', { length: 3 }).notNull().default('IDR'),
  tax_id_no: varchar('tax_id_no', { length: 30 }),
  rating: decimal('rating', { precision: 2, scale: 1, mode: 'number' }),
  payment_term: varchar('payment_term', { length: 10 }).notNull(),
  payment_term_days: smallint('payment_term_days').notNull().default(0),
  is_active: bit('is_active').notNull().default(true),
  created_at: datetime2('created_at', { precision: 0 })
    .notNull()
    .default(sql`SYSDATETIME()`),
});

export const material_categories = garmentSchema.table('material_categories', {
  id: id(),
  category_name: nvarchar('category_name', { length: 50 }).notNull(),
});

export const raw_materials = garmentSchema.table('raw_materials', {
  id: id(),
  material_code: varchar('material_code', { length: 20 }).notNull(),
  category_id: uniqueidentifier('category_id').notNull(),
  material_name: nvarchar('material_name', { length: 100 }).notNull(),
  specification: nvarchar('specification', { length: 200 }),
  color: nvarchar('color', { length: 50 }),
  unit: nvarchar('unit', { length: 20 }).notNull(),
  hs_code: varchar('hs_code', { length: 12 }),
  minimum_stock: decimal('minimum_stock', {
    precision: 12,
    scale: 2,
    mode: 'number',
  }).notNull(),
});

export const defect_types = garmentSchema.table('defect_types', {
  id: id(),
  defect_name: nvarchar('defect_name', { length: 60 }).notNull(),
  level: varchar('level', { length: 6 }).notNull(),
});

export const qc_standards = garmentSchema.table('qc_standards', {
  id: id(),
  type_code: char('type_code', { length: 2 }),
  parameter_name: nvarchar('parameter_name', { length: 100 }).notNull(),
  tolerance_value: nvarchar('tolerance_value', { length: 50 }).notNull(),
  sampling_reference: varchar('sampling_reference', { length: 30 }).notNull(),
});

export const spk = garmentSchema.table('spk', {
  id: id(),
  spk_no: char('spk_no', { length: 12 }).notNull(),
  order_detail_id: uniqueidentifier('order_detail_id').notNull(),
  line_id: uniqueidentifier('line_id').notNull(),
  created_by: uniqueidentifier('created_by').notNull(),
  materials_complete_by: uniqueidentifier('materials_complete_by').notNull(),
  decided_by: uniqueidentifier('decided_by'),
  start_date: date('start_date', { mode: 'string' }),
  target_date: date('target_date', { mode: 'string' }).notNull(),
  finish_date: date('finish_date', { mode: 'string' }),
  status: varchar('status', { length: 20 }).notNull(),
  approved_at: datetime2('approved_at', { precision: 0 }),
  reject_reason: nvarchar('reject_reason', { length: 500 }),
  created_at: datetime2('created_at', { precision: 0 }).notNull(),
});

export const spk_sizes = garmentSchema.table('spk_sizes', {
  spk_id: uniqueidentifier('spk_id').notNull(),
  size: varchar('size', { length: 10 }).notNull(),
  qty: int('qty').notNull(),
});

export const order_materials = garmentSchema.table('order_materials', {
  id: id(),
  order_detail_id: uniqueidentifier('order_detail_id').notNull(),
  material_id: uniqueidentifier('material_id').notNull(),
  qty: decimal('qty', { precision: 12, scale: 2, mode: 'number' }).notNull(),
  unit: nvarchar('unit', { length: 20 }).notNull(),
  source: varchar('source', { length: 8 }).notNull(),
  supplier_id: uniqueidentifier('supplier_id'),
  material_price: decimal('material_price', {
    precision: 16,
    scale: 2,
    mode: 'number',
  }),
  received_date: date('received_date', { mode: 'string' }).notNull(),
  checked_by: uniqueidentifier('checked_by').notNull(),
  checked_at: datetime2('checked_at', { precision: 0 }).notNull(),
  updated_at: datetime2('updated_at', { precision: 0 }).notNull(),
});
