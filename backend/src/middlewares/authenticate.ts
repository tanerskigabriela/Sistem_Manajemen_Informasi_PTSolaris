import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import sql from 'mssql';
import {
  ACTION_TYPE,
  ERROR_CODE,
  ERROR_MESSAGE,
  SESSION_END_REASON,
  SESSION_STATUS,
  type RoleCode,
} from '../constants';
import { getPool } from '../db/pool';
import { logActivity } from '../utils/activity-log';
import { AppError } from '../utils/errors';
import { getRequestMeta } from '../utils/request-meta';
import { withTransaction } from '../utils/transaction';

interface JwtPayload {
  sub: string;
  role: RoleCode;
  sid: string;
}

interface SessionLookupRow {
  session_id: string;
  session_status: string;
  idle_seconds: number;
  user_id: string;
  username: string;
  role_code: RoleCode;
  is_active: boolean;
  is_locked: boolean;
  must_change_password: boolean;
  employee_id: string;
  factory_id: string;
}

const MUST_CHANGE_ALLOWED_PATHS = new Set([
  '/auth/me',
  '/auth/logout',
  '/auth/change-password',
]);

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new AppError(
      500,
      ERROR_CODE.SYS_INTERNAL,
      ERROR_MESSAGE[ERROR_CODE.SYS_INTERNAL],
    );
  }
  return secret;
}

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = req.cookies?.token as string | undefined;
    if (!token) {
      throw new AppError(
        401,
        ERROR_CODE.AUTH_UNAUTHENTICATED,
        ERROR_MESSAGE[ERROR_CODE.AUTH_UNAUTHENTICATED],
      );
    }

    let payload: JwtPayload;
    try {
      payload = jwt.verify(token, getJwtSecret()) as JwtPayload;
    } catch {
      res.clearCookie('token');
      throw new AppError(
        401,
        ERROR_CODE.AUTH_SESSION_INVALID,
        ERROR_MESSAGE[ERROR_CODE.AUTH_SESSION_INVALID],
      );
    }

    if (!payload.sub || !payload.sid || !payload.role) {
      res.clearCookie('token');
      throw new AppError(
        401,
        ERROR_CODE.AUTH_SESSION_INVALID,
        ERROR_MESSAGE[ERROR_CODE.AUTH_SESSION_INVALID],
      );
    }

    const pool = await getPool();
    const lookup = await pool
      .request()
      .input('session_id', sql.UniqueIdentifier, payload.sid)
      .input('user_id', sql.UniqueIdentifier, payload.sub)
      .query<SessionLookupRow>(`
        SELECT
          s.id AS session_id,
          s.status AS session_status,
          DATEDIFF(SECOND, s.last_activity_at, SYSDATETIME()) AS idle_seconds,
          u.id AS user_id,
          u.username,
          u.role_code,
          u.is_active,
          u.is_locked,
          u.must_change_password,
          u.employee_id,
          e.factory_id
        FROM app.sessions s
        JOIN app.users u ON u.id = s.user_id
        JOIN garment.employees e ON e.id = u.employee_id
        WHERE s.id = @session_id AND s.user_id = @user_id
      `);

    const row = lookup.recordset[0];
    if (
      !row ||
      row.session_status !== SESSION_STATUS.AKTIF ||
      !row.is_active ||
      row.is_locked
    ) {
      res.clearCookie('token');
      throw new AppError(
        401,
        ERROR_CODE.AUTH_SESSION_INVALID,
        ERROR_MESSAGE[ERROR_CODE.AUTH_SESSION_INVALID],
      );
    }

    const timeoutMinutes = Number(process.env.SESSION_TIMEOUT_MINUTES ?? 30);
    const timeoutSeconds = timeoutMinutes * 60;

    if (row.idle_seconds > timeoutSeconds) {
      const { device, ip_address } = getRequestMeta(req);
      await withTransaction(async (tx) => {
        await new sql.Request(tx)
          .input('session_id', sql.UniqueIdentifier, row.session_id)
          .input('status', sql.VarChar(10), SESSION_STATUS.BERAKHIR)
          .input('end_reason', sql.VarChar(20), SESSION_END_REASON.TIDAK_AKTIF)
          .query(`
            UPDATE app.sessions
            SET status = @status,
                end_reason = @end_reason,
                ended_at = SYSDATETIME()
            WHERE id = @session_id AND status = 'AKTIF'
          `);

        await logActivity(tx, {
          user_id: row.user_id,
          username: row.username,
          action_type: ACTION_TYPE.SESI_BERAKHIR,
          resource_type: 'app.sessions',
          resource_id: row.session_id,
          device,
          ip_address,
        });
      });

      res.clearCookie('token');
      throw new AppError(
        401,
        ERROR_CODE.AUTH_SESSION_TIMEOUT,
        ERROR_MESSAGE[ERROR_CODE.AUTH_SESSION_TIMEOUT],
      );
    }

    // Perbarui waktu aktivitas terakhir
    await pool
      .request()
      .input('session_id', sql.UniqueIdentifier, row.session_id)
      .query(`
        UPDATE app.sessions
        SET last_activity_at = SYSDATETIME()
        WHERE id = @session_id
      `);

    req.user = {
      id: row.user_id,
      username: row.username,
      role_code: row.role_code,
      employee_id: row.employee_id,
      factory_id: row.factory_id,
      session_id: row.session_id,
      must_change_password: Boolean(row.must_change_password),
    };

    // Wajib ganti password setelah reset (KONTRAK v1 Bagian 8.3)
    const normalizedPath = `${req.baseUrl}${req.path}`.replace(/^\/api\/v1/, '');
    if (
      req.user.must_change_password &&
      !MUST_CHANGE_ALLOWED_PATHS.has(normalizedPath)
    ) {
      throw new AppError(
        403,
        ERROR_CODE.AUTH_MUST_CHANGE_PASSWORD,
        ERROR_MESSAGE[ERROR_CODE.AUTH_MUST_CHANGE_PASSWORD],
      );
    }

    next();
  } catch (error) {
    next(error);
  }
}