import sql from 'mssql';
import {
  SESSION_END_REASON,
  SESSION_STATUS,
  type RoleCode,
} from '../constants';
import { BaseRepository, type FindAllOptions } from './base.repository';

export interface UserRecord {
  id: string;
  employee_id: string;
  full_name: string;
  username: string;
  role_code: RoleCode;
  role_name: string;
  division_name: string;
  position_name: string;
  is_active: boolean;
  is_locked: boolean;
  must_change_password: boolean;
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface AvailableEmployeeRecord {
  id: string;
  full_name: string;
  employee_type: string;
  factory_name: string;
  division_name: string;
  position_name: string;
}

export interface ListUsersFilter {
  page: number;
  per_page: number;
  q?: string;
  role_code?: RoleCode;
  is_active?: boolean;
}

export interface CreateUserRowParams {
  employee_id: string;
  username: string;
  password_hash: string;
  role_code: RoleCode;
}

export interface UpdateUserRowParams {
  id: string;
  role_code: RoleCode;
  is_active: boolean;
}

export class UsersRepository extends BaseRepository<UserRecord> {
  constructor() {
    super('app.users', 'rsi');
  }

  async findById(id: string): Promise<UserRecord | null> {
    const pool = await this.getPool();
    const result = await pool
      .request()
      .input('id', sql.UniqueIdentifier, id)
      .query<UserRecord>(`
        SELECT
          u.id,
          u.employee_id,
          e.full_name,
          u.username,
          u.role_code,
          r.role_name,
          d.division_name,
          p.position_name,
          u.is_active,
          u.is_locked,
          u.must_change_password,
          u.last_login_at,
          u.created_at,
          u.updated_at
        FROM app.users u
        JOIN garment.employees e ON e.id = u.employee_id
        JOIN app.roles r ON r.role_code = u.role_code
        JOIN garment.divisions d ON d.id = e.division_id
        JOIN garment.positions p ON p.id = e.position_id
        WHERE u.id = @id
      `);

    return result.recordset[0] ?? null;
  }

  async findAll(options?: FindAllOptions): Promise<UserRecord[]> {
    const { items } = await this.findPaginated({
      page: options?.page ?? 1,
      per_page: options?.per_page ?? 20,
      q: options?.search,
    });
    return items;
  }

  async findPaginated(
    filter: ListUsersFilter,
  ): Promise<{ items: UserRecord[]; total: number }> {
    const pool = await this.getPool();
    const conditions: string[] = [];

    const buildRequest = () => {
      const req = pool.request();
      if (filter.q) {
        req.input('q', sql.NVarChar(102), `%${filter.q}%`);
      }
      if (filter.role_code) {
        req.input('role_code', sql.VarChar(12), filter.role_code);
      }
      if (filter.is_active !== undefined) {
        req.input('is_active', sql.Bit, filter.is_active ? 1 : 0);
      }
      return req;
    };

    if (filter.q) {
      conditions.push('(u.username LIKE @q OR e.full_name LIKE @q)');
    }
    if (filter.role_code) {
      conditions.push('u.role_code = @role_code');
    }
    if (filter.is_active !== undefined) {
      conditions.push('u.is_active = @is_active');
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (filter.page - 1) * filter.per_page;

    const countResult = await buildRequest().query<{ total: number }>(`
      SELECT COUNT(*) AS total
      FROM app.users u
      JOIN garment.employees e ON e.id = u.employee_id
      ${whereClause}
    `);

    const listResult = await buildRequest()
      .input('offset', sql.Int, offset)
      .input('per_page', sql.Int, filter.per_page)
      .query<UserRecord>(`
        SELECT
          u.id,
          u.employee_id,
          e.full_name,
          u.username,
          u.role_code,
          r.role_name,
          d.division_name,
          p.position_name,
          u.is_active,
          u.is_locked,
          u.must_change_password,
          u.last_login_at,
          u.created_at,
          u.updated_at
        FROM app.users u
        JOIN garment.employees e ON e.id = u.employee_id
        JOIN app.roles r ON r.role_code = u.role_code
        JOIN garment.divisions d ON d.id = e.division_id
        JOIN garment.positions p ON p.id = e.position_id
        ${whereClause}
        ORDER BY u.created_at DESC, u.username ASC
        OFFSET @offset ROWS FETCH NEXT @per_page ROWS ONLY
      `);

    return {
      items: listResult.recordset,
      total: countResult.recordset[0]?.total ?? 0,
    };
  }

  /**
   * Karyawan aktif yang belum memiliki akun di app.users (untuk dropdown SCR-03).
   */
  async findAvailableEmployees(q?: string): Promise<AvailableEmployeeRecord[]> {
    const pool = await this.getPool();
    const req = pool.request();
    const searchCond = q
      ? 'AND (v.full_name LIKE @q OR v.division_name LIKE @q OR v.position_name LIKE @q)'
      : '';

    if (q) {
      req.input('q', sql.NVarChar(102), `%${q}%`);
    }

    const result = await req.query<AvailableEmployeeRecord>(`
      SELECT
        v.id,
        v.full_name,
        v.employee_type,
        v.factory_name,
        v.division_name,
        v.position_name
      FROM garment.v_employee_directory v
      WHERE v.is_active = 1
        AND NOT EXISTS (
          SELECT 1 FROM app.users u WHERE u.employee_id = v.id
        )
        ${searchCond}
      ORDER BY v.full_name ASC
    `);

    return result.recordset;
  }

  async isEmployeeActive(
    tx: sql.Transaction,
    employeeId: string,
  ): Promise<boolean> {
    const result = await new sql.Request(tx)
      .input('employee_id', sql.UniqueIdentifier, employeeId)
      .query<{ id: string }>(`
        SELECT id
        FROM garment.employees
        WHERE id = @employee_id AND is_active = 1
      `);

    return result.recordset.length > 0;
  }

  async existsByUsernameOrEmployee(
    tx: sql.Transaction,
    username: string,
    employeeId: string,
  ): Promise<{ usernameExists: boolean; employeeExists: boolean }> {
    const result = await new sql.Request(tx)
      .input('username', sql.VarChar(50), username)
      .input('employee_id', sql.UniqueIdentifier, employeeId)
      .query<{ username: string; employee_id: string }>(`
        SELECT username, employee_id
        FROM app.users
        WHERE username = @username OR employee_id = @employee_id
      `);

    return {
      usernameExists: result.recordset.some(
        (row) => row.username.toLowerCase() === username.toLowerCase(),
      ),
      employeeExists: result.recordset.some(
        (row) => row.employee_id.toLowerCase() === employeeId.toLowerCase(),
      ),
    };
  }

  async create(
    tx: sql.Transaction,
    params: CreateUserRowParams,
  ): Promise<string> {
    const result = await new sql.Request(tx)
      .input('employee_id', sql.UniqueIdentifier, params.employee_id)
      .input('username', sql.VarChar(50), params.username)
      .input('password_hash', sql.VarChar(100), params.password_hash)
      .input('role_code', sql.VarChar(12), params.role_code)
      .query<{ id: string }>(`
        INSERT INTO app.users (employee_id, username, password_hash, role_code)
        OUTPUT inserted.id
        VALUES (@employee_id, @username, @password_hash, @role_code)
      `);

    return result.recordset[0].id;
  }

  async update(
    tx: sql.Transaction,
    params: UpdateUserRowParams,
  ): Promise<void> {
    await new sql.Request(tx)
      .input('id', sql.UniqueIdentifier, params.id)
      .input('role_code', sql.VarChar(12), params.role_code)
      .input('is_active', sql.Bit, params.is_active ? 1 : 0)
      .query(`
        UPDATE app.users
        SET role_code = @role_code,
            is_active = @is_active,
            updated_at = SYSDATETIME()
        WHERE id = @id
      `);
  }

  async terminateSessionsOnDeactivate(
    tx: sql.Transaction,
    userId: string,
  ): Promise<void> {
    await new sql.Request(tx)
      .input('user_id', sql.UniqueIdentifier, userId)
      .input('status', sql.VarChar(10), SESSION_STATUS.BERAKHIR)
      .input('end_reason', sql.VarChar(20), SESSION_END_REASON.AKUN_NONAKTIF)
      .query(`
        UPDATE app.sessions
        SET status = @status,
            end_reason = @end_reason,
            ended_at = SYSDATETIME()
        WHERE user_id = @user_id AND status = 'AKTIF'
      `);
  }
}

export const usersRepository = new UsersRepository();