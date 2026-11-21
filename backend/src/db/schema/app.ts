import { sql } from 'drizzle-orm';
import {
  bigint,
  bit,
  char,
  datetime2,
  mssqlSchema,
  nvarchar,
  tinyint,
  varchar,
} from 'drizzle-orm/mssql-core';
import { employees, uniqueidentifier } from './org';

export const appSchema = mssqlSchema('app');

export const roles = appSchema.table('roles', {
  role_code: varchar('role_code', { length: 12 }).primaryKey().notNull(),
  role_name: nvarchar('role_name', { length: 50 }).notNull(),
  access_tier: varchar('access_tier', { length: 10 }).notNull(),
});

export const users = appSchema.table('users', {
  id: uniqueidentifier('id')
    .primaryKey()
    .notNull()
    .default(sql`NEWSEQUENTIALID()`),
  employee_id: uniqueidentifier('employee_id')
    .notNull()
    .unique()
    .references(() => employees.id),
  username: varchar('username', { length: 50 }).notNull().unique(),
  password_hash: varchar('password_hash', { length: 100 }).notNull(),
  role_code: varchar('role_code', { length: 12 })
    .notNull()
    .references(() => roles.role_code),
  is_active: bit('is_active').notNull().default(true),
  is_locked: bit('is_locked').notNull().default(false),
  failed_login_count: tinyint('failed_login_count').notNull().default(0),
  must_change_password: bit('must_change_password').notNull().default(false),
  last_login_at: datetime2('last_login_at', { precision: 0 }),
  created_at: datetime2('created_at', { precision: 0 })
    .notNull()
    .default(sql`SYSDATETIME()`),
  updated_at: datetime2('updated_at', { precision: 0 })
    .notNull()
    .default(sql`SYSDATETIME()`),
});

export const sessions = appSchema.table('sessions', {
  id: uniqueidentifier('id')
    .primaryKey()
    .notNull()
    .default(sql`NEWSEQUENTIALID()`),
  user_id: uniqueidentifier('user_id')
    .notNull()
    .references(() => users.id),
  device: nvarchar('device', { length: 150 }).notNull(),
  ip_address: varchar('ip_address', { length: 45 }).notNull(),
  login_at: datetime2('login_at', { precision: 0 })
    .notNull()
    .default(sql`SYSDATETIME()`),
  last_activity_at: datetime2('last_activity_at', { precision: 0 })
    .notNull()
    .default(sql`SYSDATETIME()`),
  status: varchar('status', { length: 10 }).notNull().default('AKTIF'),
  end_reason: varchar('end_reason', { length: 20 }),
  ended_at: datetime2('ended_at', { precision: 0 }),
});

export const activity_logs = appSchema.table('activity_logs', {
  id: bigint('id', { mode: 'number' }).identity().primaryKey(),
  user_id: uniqueidentifier('user_id').references(() => users.id),
  username: varchar('username', { length: 50 }).notNull(),
  action_type: varchar('action_type', { length: 20 }).notNull(),
  resource_type: varchar('resource_type', { length: 40 }),
  resource_id: varchar('resource_id', { length: 36 }),
  old_values: nvarchar('old_values'),
  new_values: nvarchar('new_values'),
  device: nvarchar('device', { length: 150 }),
  ip_address: varchar('ip_address', { length: 45 }).notNull(),
  created_at: datetime2('created_at', { precision: 0 })
    .notNull()
    .default(sql`SYSDATETIME()`),
});

export const password_reset_requests = appSchema.table(
  'password_reset_requests',
  {
    id: uniqueidentifier('id')
      .primaryKey()
      .notNull()
      .default(sql`NEWSEQUENTIALID()`),
    user_id: uniqueidentifier('user_id')
      .notNull()
      .references(() => users.id),
    note: nvarchar('note', { length: 200 }),
    status: varchar('status', { length: 10 }).notNull().default('MENUNGGU'),
    handled_by: uniqueidentifier('handled_by').references(() => users.id),
    requested_at: datetime2('requested_at', { precision: 0 })
      .notNull()
      .default(sql`SYSDATETIME()`),
    handled_at: datetime2('handled_at', { precision: 0 }),
  },
);

export const notifications = appSchema.table('notifications', {
  id: uniqueidentifier('id')
    .primaryKey()
    .notNull()
    .default(sql`NEWSEQUENTIALID()`),
  recipient_id: uniqueidentifier('recipient_id')
    .notNull()
    .references(() => users.id),
  event_code: char('event_code', { length: 4 }).notNull(),
  message: nvarchar('message', { length: 300 }).notNull(),
  link: varchar('link', { length: 200 }),
  dedup_key: varchar('dedup_key', { length: 80 }),
  is_read: bit('is_read').notNull().default(false),
  created_at: datetime2('created_at', { precision: 0 })
    .notNull()
    .default(sql`SYSDATETIME()`),
});
