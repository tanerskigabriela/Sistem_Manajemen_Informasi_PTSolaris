"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.employees = exports.divisions = exports.factories = exports.uniqueidentifier = exports.garmentSchema = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const mssql_core_1 = require("drizzle-orm/mssql-core");
exports.garmentSchema = (0, mssql_core_1.mssqlSchema)('garment');
/**
 * Custom column helper untuk tipe UNIQUEIDENTIFIER SQL Server.
 * Dapat diimpor ulang oleh skema modul lain (app, order, produksi).
 */
exports.uniqueidentifier = (0, mssql_core_1.customType)({
    dataType() {
        return 'uniqueidentifier';
    },
});
exports.factories = exports.garmentSchema.table('factories', {
    id: (0, exports.uniqueidentifier)('id')
        .primaryKey()
        .notNull()
        .default((0, drizzle_orm_1.sql) `NEWSEQUENTIALID()`),
    factory_name: (0, mssql_core_1.nvarchar)('factory_name', { length: 100 }).notNull(),
    address: (0, mssql_core_1.nvarchar)('address', { length: 200 }).notNull(),
    city: (0, mssql_core_1.nvarchar)('city', { length: 50 }).notNull(),
    province: (0, mssql_core_1.nvarchar)('province', { length: 50 }).notNull(),
    phone: (0, mssql_core_1.varchar)('phone', { length: 20 }).notNull(),
    email: (0, mssql_core_1.varchar)('email', { length: 100 }),
    bonded_zone_status: (0, mssql_core_1.bit)('bonded_zone_status').notNull().default(false),
    operating_status: (0, mssql_core_1.varchar)('operating_status', { length: 10 }).notNull(),
    created_at: (0, mssql_core_1.datetime2)('created_at', { precision: 0 })
        .notNull()
        .default((0, drizzle_orm_1.sql) `SYSDATETIME()`),
});
exports.divisions = exports.garmentSchema.table('divisions', {
    id: (0, exports.uniqueidentifier)('id')
        .primaryKey()
        .notNull()
        .default((0, drizzle_orm_1.sql) `NEWSEQUENTIALID()`),
    factory_id: (0, exports.uniqueidentifier)('factory_id')
        .notNull()
        .references(() => exports.factories.id),
    division_name: (0, mssql_core_1.nvarchar)('division_name', { length: 60 }).notNull(),
    head_employee_id: (0, exports.uniqueidentifier)('head_employee_id').references(() => exports.employees.id),
});
exports.employees = exports.garmentSchema.table('employees', {
    id: (0, exports.uniqueidentifier)('id')
        .primaryKey()
        .notNull()
        .default((0, drizzle_orm_1.sql) `NEWSEQUENTIALID()`),
    nik: (0, mssql_core_1.char)('nik', { length: 16 }).notNull().unique(),
    full_name: (0, mssql_core_1.nvarchar)('full_name', { length: 100 }).notNull(),
    birth_date: (0, mssql_core_1.date)('birth_date', { mode: 'string' }).notNull(),
    gender: (0, mssql_core_1.char)('gender', { length: 1 }).notNull(),
    employee_type: (0, mssql_core_1.varchar)('employee_type', { length: 12 }).notNull(),
    address: (0, mssql_core_1.nvarchar)('address', { length: 200 }).notNull(),
    phone: (0, mssql_core_1.varchar)('phone', { length: 20 }).notNull(),
    email: (0, mssql_core_1.varchar)('email', { length: 100 }),
    npwp: (0, mssql_core_1.varchar)('npwp', { length: 20 }),
    bpjs_health_no: (0, mssql_core_1.varchar)('bpjs_health_no', { length: 20 }),
    bpjs_employment_no: (0, mssql_core_1.varchar)('bpjs_employment_no', { length: 20 }),
    bank_name: (0, mssql_core_1.nvarchar)('bank_name', { length: 50 }),
    account_no: (0, mssql_core_1.varchar)('account_no', { length: 30 }),
    factory_id: (0, exports.uniqueidentifier)('factory_id')
        .notNull()
        .references(() => exports.factories.id),
    division_id: (0, exports.uniqueidentifier)('division_id')
        .notNull()
        .references(() => exports.divisions.id),
    position_id: (0, exports.uniqueidentifier)('position_id').notNull(),
    shift_id: (0, exports.uniqueidentifier)('shift_id'),
    is_active: (0, mssql_core_1.bit)('is_active').notNull().default(true),
    join_date: (0, mssql_core_1.date)('join_date', { mode: 'string' }).notNull(),
    created_at: (0, mssql_core_1.datetime2)('created_at', { precision: 0 })
        .notNull()
        .default((0, drizzle_orm_1.sql) `SYSDATETIME()`),
    updated_at: (0, mssql_core_1.datetime2)('updated_at', { precision: 0 })
        .notNull()
        .default((0, drizzle_orm_1.sql) `SYSDATETIME()`),
});
//# sourceMappingURL=org.js.map