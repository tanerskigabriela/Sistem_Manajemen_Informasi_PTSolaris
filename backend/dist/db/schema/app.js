"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifications = exports.password_reset_requests = exports.activity_logs = exports.sessions = exports.users = exports.roles = exports.appSchema = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const mssql_core_1 = require("drizzle-orm/mssql-core");
const org_1 = require("./org");
exports.appSchema = (0, mssql_core_1.mssqlSchema)('app');
exports.roles = exports.appSchema.table('roles', {
    role_code: (0, mssql_core_1.varchar)('role_code', { length: 12 }).primaryKey().notNull(),
    role_name: (0, mssql_core_1.nvarchar)('role_name', { length: 50 }).notNull(),
    access_tier: (0, mssql_core_1.varchar)('access_tier', { length: 10 }).notNull(),
});
exports.users = exports.appSchema.table('users', {
    id: (0, org_1.uniqueidentifier)('id')
        .primaryKey()
        .notNull()
        .default((0, drizzle_orm_1.sql) `NEWSEQUENTIALID()`),
    employee_id: (0, org_1.uniqueidentifier)('employee_id')
        .notNull()
        .unique()
        .references(() => org_1.employees.id),
    username: (0, mssql_core_1.varchar)('username', { length: 50 }).notNull().unique(),
    password_hash: (0, mssql_core_1.varchar)('password_hash', { length: 100 }).notNull(),
    role_code: (0, mssql_core_1.varchar)('role_code', { length: 12 })
        .notNull()
        .references(() => exports.roles.role_code),
    is_active: (0, mssql_core_1.bit)('is_active').notNull().default(true),
    is_locked: (0, mssql_core_1.bit)('is_locked').notNull().default(false),
    failed_login_count: (0, mssql_core_1.tinyint)('failed_login_count').notNull().default(0),
    must_change_password: (0, mssql_core_1.bit)('must_change_password').notNull().default(false),
    last_login_at: (0, mssql_core_1.datetime2)('last_login_at', { precision: 0 }),
    created_at: (0, mssql_core_1.datetime2)('created_at', { precision: 0 })
        .notNull()
        .default((0, drizzle_orm_1.sql) `SYSDATETIME()`),
    updated_at: (0, mssql_core_1.datetime2)('updated_at', { precision: 0 })
        .notNull()
        .default((0, drizzle_orm_1.sql) `SYSDATETIME()`),
});
exports.sessions = exports.appSchema.table('sessions', {
    id: (0, org_1.uniqueidentifier)('id')
        .primaryKey()
        .notNull()
        .default((0, drizzle_orm_1.sql) `NEWSEQUENTIALID()`),
    user_id: (0, org_1.uniqueidentifier)('user_id')
        .notNull()
        .references(() => exports.users.id),
    device: (0, mssql_core_1.nvarchar)('device', { length: 150 }).notNull(),
    ip_address: (0, mssql_core_1.varchar)('ip_address', { length: 45 }).notNull(),
    login_at: (0, mssql_core_1.datetime2)('login_at', { precision: 0 })
        .notNull()
        .default((0, drizzle_orm_1.sql) `SYSDATETIME()`),
    last_activity_at: (0, mssql_core_1.datetime2)('last_activity_at', { precision: 0 })
        .notNull()
        .default((0, drizzle_orm_1.sql) `SYSDATETIME()`),
    status: (0, mssql_core_1.varchar)('status', { length: 10 }).notNull().default('AKTIF'),
    end_reason: (0, mssql_core_1.varchar)('end_reason', { length: 20 }),
    ended_at: (0, mssql_core_1.datetime2)('ended_at', { precision: 0 }),
});
exports.activity_logs = exports.appSchema.table('activity_logs', {
    id: (0, mssql_core_1.bigint)('id', { mode: 'number' }).identity().primaryKey(),
    user_id: (0, org_1.uniqueidentifier)('user_id').references(() => exports.users.id),
    username: (0, mssql_core_1.varchar)('username', { length: 50 }).notNull(),
    action_type: (0, mssql_core_1.varchar)('action_type', { length: 20 }).notNull(),
    resource_type: (0, mssql_core_1.varchar)('resource_type', { length: 40 }),
    resource_id: (0, mssql_core_1.varchar)('resource_id', { length: 36 }),
    old_values: (0, mssql_core_1.nvarchar)('old_values'),
    new_values: (0, mssql_core_1.nvarchar)('new_values'),
    device: (0, mssql_core_1.nvarchar)('device', { length: 150 }),
    ip_address: (0, mssql_core_1.varchar)('ip_address', { length: 45 }).notNull(),
    created_at: (0, mssql_core_1.datetime2)('created_at', { precision: 0 })
        .notNull()
        .default((0, drizzle_orm_1.sql) `SYSDATETIME()`),
});
exports.password_reset_requests = exports.appSchema.table('password_reset_requests', {
    id: (0, org_1.uniqueidentifier)('id')
        .primaryKey()
        .notNull()
        .default((0, drizzle_orm_1.sql) `NEWSEQUENTIALID()`),
    user_id: (0, org_1.uniqueidentifier)('user_id')
        .notNull()
        .references(() => exports.users.id),
    note: (0, mssql_core_1.nvarchar)('note', { length: 200 }),
    status: (0, mssql_core_1.varchar)('status', { length: 10 }).notNull().default('MENUNGGU'),
    handled_by: (0, org_1.uniqueidentifier)('handled_by').references(() => exports.users.id),
    requested_at: (0, mssql_core_1.datetime2)('requested_at', { precision: 0 })
        .notNull()
        .default((0, drizzle_orm_1.sql) `SYSDATETIME()`),
    handled_at: (0, mssql_core_1.datetime2)('handled_at', { precision: 0 }),
});
exports.notifications = exports.appSchema.table('notifications', {
    id: (0, org_1.uniqueidentifier)('id')
        .primaryKey()
        .notNull()
        .default((0, drizzle_orm_1.sql) `NEWSEQUENTIALID()`),
    recipient_id: (0, org_1.uniqueidentifier)('recipient_id')
        .notNull()
        .references(() => exports.users.id),
    event_code: (0, mssql_core_1.char)('event_code', { length: 4 }).notNull(),
    message: (0, mssql_core_1.nvarchar)('message', { length: 300 }).notNull(),
    link: (0, mssql_core_1.varchar)('link', { length: 200 }),
    dedup_key: (0, mssql_core_1.varchar)('dedup_key', { length: 80 }),
    is_read: (0, mssql_core_1.bit)('is_read').notNull().default(false),
    created_at: (0, mssql_core_1.datetime2)('created_at', { precision: 0 })
        .notNull()
        .default((0, drizzle_orm_1.sql) `SYSDATETIME()`),
});
//# sourceMappingURL=app.js.map