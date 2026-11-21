import { sql } from 'drizzle-orm';
import {
  type AnyMsSqlColumn,
  bit,
  char,
  customType,
  date,
  datetime2,
  mssqlSchema,
  nvarchar,
  varchar,
} from 'drizzle-orm/mssql-core';

export const garmentSchema = mssqlSchema('garment');

/**
 * Custom column helper untuk tipe UNIQUEIDENTIFIER SQL Server.
 * Dapat diimpor ulang oleh skema modul lain (app, order, produksi).
 */
export const uniqueidentifier = customType<{
  data: string;
  driverData: string;
}>({
  dataType() {
    return 'uniqueidentifier';
  },
});

export const factories = garmentSchema.table('factories', {
  id: uniqueidentifier('id')
    .primaryKey()
    .notNull()
    .default(sql`NEWSEQUENTIALID()`),
  factory_name: nvarchar('factory_name', { length: 100 }).notNull(),
  address: nvarchar('address', { length: 200 }).notNull(),
  city: nvarchar('city', { length: 50 }).notNull(),
  province: nvarchar('province', { length: 50 }).notNull(),
  phone: varchar('phone', { length: 20 }).notNull(),
  email: varchar('email', { length: 100 }),
  bonded_zone_status: bit('bonded_zone_status').notNull().default(false),
  operating_status: varchar('operating_status', { length: 10 }).notNull(),
  created_at: datetime2('created_at', { precision: 0 })
    .notNull()
    .default(sql`SYSDATETIME()`),
});

export const divisions = garmentSchema.table('divisions', {
  id: uniqueidentifier('id')
    .primaryKey()
    .notNull()
    .default(sql`NEWSEQUENTIALID()`),
  factory_id: uniqueidentifier('factory_id')
    .notNull()
    .references(() => factories.id),
  division_name: nvarchar('division_name', { length: 60 }).notNull(),
  head_employee_id: uniqueidentifier('head_employee_id').references(
    (): AnyMsSqlColumn => employees.id,
  ),
});

export const employees = garmentSchema.table('employees', {
  id: uniqueidentifier('id')
    .primaryKey()
    .notNull()
    .default(sql`NEWSEQUENTIALID()`),
  nik: char('nik', { length: 16 }).notNull().unique(),
  full_name: nvarchar('full_name', { length: 100 }).notNull(),
  birth_date: date('birth_date', { mode: 'string' }).notNull(),
  gender: char('gender', { length: 1 }).notNull(),
  employee_type: varchar('employee_type', { length: 12 }).notNull(),
  address: nvarchar('address', { length: 200 }).notNull(),
  phone: varchar('phone', { length: 20 }).notNull(),
  email: varchar('email', { length: 100 }),
  npwp: varchar('npwp', { length: 20 }),
  bpjs_health_no: varchar('bpjs_health_no', { length: 20 }),
  bpjs_employment_no: varchar('bpjs_employment_no', { length: 20 }),
  bank_name: nvarchar('bank_name', { length: 50 }),
  account_no: varchar('account_no', { length: 30 }),
  factory_id: uniqueidentifier('factory_id')
    .notNull()
    .references(() => factories.id),
  division_id: uniqueidentifier('division_id')
    .notNull()
    .references(() => divisions.id),
  position_id: uniqueidentifier('position_id').notNull(),
  shift_id: uniqueidentifier('shift_id'),
  is_active: bit('is_active').notNull().default(true),
  join_date: date('join_date', { mode: 'string' }).notNull(),
  created_at: datetime2('created_at', { precision: 0 })
    .notNull()
    .default(sql`SYSDATETIME()`),
  updated_at: datetime2('updated_at', { precision: 0 })
    .notNull()
    .default(sql`SYSDATETIME()`),
});
