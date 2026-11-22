import sql from 'mssql';
import {
  SESSION_STATUS,
  type RoleCode,
  type SessionEndReason,
} from '../constants';
import { BaseRepository, type FindAllOptions } from './base.repository';

export interface AuthUserRecord {
  id: string;
  employee_id: string;
  factory_id: string;
  username: string;
  password_hash: string;
  full_name: string;
  role_code: RoleCode;
  role_name: string;
  is_active: boolean;
  is_locked: boolean;
  must_change_password: boolean;
}

export interface RecordLoginParams {
  username: string;
  success: boolean;
  device: string;
  ip_address: string;
}

export interface RecordLoginResult {
  session_id: string | null;
  is_locked: boolean;
}

export class AuthRepository extends BaseRepository<AuthUserRecord> {
  constructor() {
    super('app.users', 'rsi');
  }

  async findById(id: string): Promise<AuthUserRecord | null> {
    const pool = await this.getPool();
    const result = await pool
      .request()
      .input('id', sql.UniqueIdentifier, id)
      .query<AuthUserRecord>(`
        SELECT
          u.id,
          u.employee_id,
          e.factory_id,
          u.username,
          u.password_hash,
          e.full_name,
          u.role_code,
          r.role_name,
          u.is_active,
          u.is_locked,
          u.must_change_password
        FROM app.users u
        JOIN garment.employees e ON e.id = u.employee_id
        JOIN app.roles r ON r.role_code = u.role_code
        WHERE u.id = @id
      `);

    return result.recordset[0] ?? null;
  }

  async findAll(_options?: FindAllOptions): Promise<AuthUserRecord[]> {
    const pool = await this.getPool();
    const result = await pool.request().query<AuthUserRecord>(`
      SELECT
        u.id,
        u.employee_id,
        e.factory_id,
        u.username,
        u.password_hash,
        e.full_name,
        u.role_code,
        r.role_name,
        u.is_active,
        u.is_locked,
        u.must_change_password
      FROM app.users u
      JOIN garment.employees e ON e.id = u.employee_id
      JOIN app.roles r ON r.role_code = u.role_code
      ORDER BY u.username
    `);

    return result.recordset;
  }

  async findByUsername(username: string): Promise<AuthUserRecord | null> {
    const pool = await this.getPool();
    const result = await pool
      .request()
      .input('username', sql.VarChar(50), username)
      .query<AuthUserRecord>(`
        SELECT
          u.id,
          u.employee_id,
          e.factory_id,
          u.username,
          u.password_hash,
          e.full_name,
          u.role_code,
          r.role_name,
          u.is_active,
          u.is_locked,
          u.must_change_password
        FROM app.users u
        JOIN garment.employees e ON e.id = u.employee_id
        JOIN app.roles r ON r.role_code = u.role_code
        WHERE u.username = @username
      `);

    return result.recordset[0] ?? null;
  }

  /**
   * Memanggil app.sp_record_login di dalam transaksi aktif.
   * SP ini otomatis membuat sesi, mencatat LOGIN_BERHASIL/LOGIN_GAGAL/AKUN_TERKUNCI,
   * serta mengirim notifikasi N-11 saat kegagalan ke-5.
   */
  async recordLoginAttempt(
    tx: sql.Transaction,
    params: RecordLoginParams,
  ): Promise<RecordLoginResult> {
    const result = await new sql.Request(tx)
      .input('username', sql.VarChar(50), params.username)
      .input('success', sql.Bit, params.success ? 1 : 0)
      .input('device', sql.NVarChar(150), params.device)
      .input('ip_address', sql.VarChar(45), params.ip_address)
      .output('session_id', sql.UniqueIdentifier)
      .output('is_locked', sql.Bit)
      .execute('app.sp_record_login');

    return {
      session_id: (result.output.session_id as string | null) ?? null,
      is_locked: Boolean(result.output.is_locked),
    };
  }

  async endSession(
    tx: sql.Transaction,
    sessionId: string,
    endReason: SessionEndReason,
  ): Promise<void> {
    await new sql.Request(tx)
      .input('session_id', sql.UniqueIdentifier, sessionId)
      .input('status', sql.VarChar(10), SESSION_STATUS.BERAKHIR)
      .input('end_reason', sql.VarChar(20), endReason)
      .query(`
        UPDATE app.sessions
        SET status = @status,
            end_reason = @end_reason,
            ended_at = SYSDATETIME()
        WHERE id = @session_id AND status = 'AKTIF'
      `);
  }

  async countUnreadNotifications(userId: string): Promise<number> {
    const pool = await this.getPool();
    const result = await pool
      .request()
      .input('recipient_id', sql.UniqueIdentifier, userId)
      .query<{ unread_count: number }>(`
        SELECT COUNT(*) AS unread_count
        FROM app.notifications
        WHERE recipient_id = @recipient_id AND is_read = 0
      `);

    return result.recordset[0]?.unread_count ?? 0;
  }
}

export const authRepository = new AuthRepository();