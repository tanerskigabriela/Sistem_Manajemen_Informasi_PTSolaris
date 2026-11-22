import sql from 'mssql';
import type { ActionType } from '../constants';
import { BaseRepository, type FindAllOptions } from './base.repository';

interface RawActivityLogRow {
  id: string | number;
  user_id: string | null;
  username: string;
  full_name: string | null;
  action_type: ActionType;
  resource_type: string | null;
  resource_id: string | null;
  old_values: string | null;
  new_values: string | null;
  device: string | null;
  ip_address: string;
  created_at: Date;
}

export interface ActivityLogRecord {
  id: number;
  user_id: string | null;
  username: string;
  full_name: string | null;
  action_type: ActionType;
  resource_type: string | null;
  resource_id: string | null;
  old_values: Record<string, unknown> | unknown[] | null;
  new_values: Record<string, unknown> | unknown[] | null;
  device: string | null;
  ip_address: string;
  created_at: Date;
}

export interface ListActivityLogsFilter {
  page: number;
  per_page: number;
  action_type?: ActionType;
  username?: string;
  resource_type?: string;
  date_from?: string;
  date_to?: string;
}

function safeParseJson(
  raw: string | null,
): Record<string, unknown> | unknown[] | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, unknown> | unknown[];
  } catch {
    return null;
  }
}

function mapRow(row: RawActivityLogRow): ActivityLogRecord {
  return {
    id: Number(row.id),
    user_id: row.user_id,
    username: row.username,
    full_name: row.full_name,
    action_type: row.action_type,
    resource_type: row.resource_type,
    resource_id: row.resource_id,
    old_values: safeParseJson(row.old_values),
    new_values: safeParseJson(row.new_values),
    device: row.device,
    ip_address: row.ip_address,
    created_at: row.created_at,
  };
}

export class ActivityLogsRepository extends BaseRepository<ActivityLogRecord> {
  constructor() {
    super('app.activity_logs', 'rsi');
  }

  async findById(id: string): Promise<ActivityLogRecord | null> {
    const numericId = Number(id);
    if (!Number.isInteger(numericId) || numericId <= 0) {
      return null;
    }

    const pool = await this.getPool();
    const result = await pool
      .request()
      .input('id', sql.BigInt, numericId)
      .query<RawActivityLogRow>(`
        SELECT
          l.id,
          l.user_id,
          l.username,
          e.full_name,
          l.action_type,
          l.resource_type,
          l.resource_id,
          l.old_values,
          l.new_values,
          l.device,
          l.ip_address,
          l.created_at
        FROM app.activity_logs l
        LEFT JOIN app.users u ON u.id = l.user_id
        LEFT JOIN garment.employees e ON e.id = u.employee_id
        WHERE l.id = @id
      `);

    const row = result.recordset[0];
    return row ? mapRow(row) : null;
  }

  async findAll(options?: FindAllOptions): Promise<ActivityLogRecord[]> {
    const { items } = await this.findPaginated({
      page: options?.page ?? 1,
      per_page: options?.per_page ?? 20,
      username: options?.search,
    });
    return items;
  }

  async findPaginated(
    filter: ListActivityLogsFilter,
  ): Promise<{ items: ActivityLogRecord[]; total: number }> {
    const pool = await this.getPool();
    const conditions: string[] = [];

    const buildRequest = () => {
      const req = pool.request();
      if (filter.action_type) {
        req.input('action_type', sql.VarChar(20), filter.action_type);
      }
      if (filter.username) {
        req.input('username', sql.VarChar(52), `%${filter.username}%`);
      }
      if (filter.resource_type) {
        req.input(
          'resource_type',
          sql.VarChar(42),
          `%${filter.resource_type}%`,
        );
      }
      if (filter.date_from) {
        req.input('date_from', sql.VarChar(10), filter.date_from);
      }
      if (filter.date_to) {
        req.input('date_to', sql.VarChar(10), filter.date_to);
      }
      return req;
    };

    if (filter.action_type) {
      conditions.push('l.action_type = @action_type');
    }
    if (filter.username) {
      conditions.push('l.username LIKE @username');
    }
    if (filter.resource_type) {
      conditions.push('l.resource_type LIKE @resource_type');
    }
    if (filter.date_from) {
      conditions.push('l.created_at >= CAST(@date_from AS DATETIME2(0))');
    }
    if (filter.date_to) {
      conditions.push(
        'l.created_at < DATEADD(DAY, 1, CAST(@date_to AS DATETIME2(0)))',
      );
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (filter.page - 1) * filter.per_page;

    const countResult = await buildRequest().query<{ total: number }>(`
      SELECT COUNT(*) AS total
      FROM app.activity_logs l
      ${whereClause}
    `);

    const listResult = await buildRequest()
      .input('offset', sql.Int, offset)
      .input('per_page', sql.Int, filter.per_page)
      .query<RawActivityLogRow>(`
        SELECT
          l.id,
          l.user_id,
          l.username,
          e.full_name,
          l.action_type,
          l.resource_type,
          l.resource_id,
          l.old_values,
          l.new_values,
          l.device,
          l.ip_address,
          l.created_at
        FROM app.activity_logs l
        LEFT JOIN app.users u ON u.id = l.user_id
        LEFT JOIN garment.employees e ON e.id = u.employee_id
        ${whereClause}
        ORDER BY l.id DESC
        OFFSET @offset ROWS FETCH NEXT @per_page ROWS ONLY
      `);

    return {
      items: listResult.recordset.map(mapRow),
      total: countResult.recordset[0]?.total ?? 0,
    };
  }
}

export const activityLogsRepository = new ActivityLogsRepository();