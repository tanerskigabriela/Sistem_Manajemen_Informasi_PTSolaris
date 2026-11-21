import type { Request } from "express";
import sql from "mssql";
import type { RoleCode } from "../constants";
import { getPool } from "../db/pool";

// Pengguna yang sedang menjalankan request.
// SEMENTARA (RENCANA-TAHAP-2 Bagian 3): selama middleware authenticate milik A belum ada,
// dipakai akun seed dengan role fallbackRole. Setelah login A masuk, req.user yang dipakai.
export interface Actor {
  user_id: string;
  username: string;
  role_code: RoleCode;
  employee_id: string;
}

const cache = new Map<RoleCode, Actor>();

export async function getActor(
  req: Request,
  fallbackRole: RoleCode,
): Promise<Actor> {
  const user = (req as Request & { user?: Partial<Actor> & { id?: string } })
    .user;
  if (user?.employee_id && user.username && user.role_code) {
    return {
      user_id: (user.user_id ?? user.id) as string,
      username: user.username,
      role_code: user.role_code,
      employee_id: user.employee_id,
    };
  }

  const cached = cache.get(fallbackRole);
import type { NextFunction, Request, Response } from 'express';
import sql from 'mssql';
import type { RoleCode } from '../constants';
import { getPool } from '../db/pool';
import { AppError } from './errors';

/**
 * Identitas pengguna yang sedang memanggil endpoint.
 * Bentuknya mengikuti `req.user` yang nanti diisi middleware `authenticate` milik A.
 * `employee_id` dipakai untuk kolom created_by / decided_by / checked_by (FK ke garment.employees).
 */
export interface Actor {
  user_id: string;
  employee_id: string;
  username: string;
  role_code: RoleCode;
  ip_address: string;
  device: string | null;
}

interface AuthUserLike {
  id?: string;
  user_id?: string;
  employee_id?: string;
  username?: string;
  role_code?: string;
}

const devCache = new Map<string, Omit<Actor, 'ip_address' | 'device'>>();

/**
 * SEMENTARA (sampai login A selesai): bila `req.user` belum ada dan NODE_ENV bukan production,
 * pemanggil boleh mengirim header `x-dev-user: <username seed>` (ppic, pimpinan, supervisor, qc.solaris).
 * Data user diambil dari app.users + garment.employees, jadi tetap memakai employee id seed yang asli.
 * Hapus fallback ini setelah authenticate A di-merge.
 */
async function loadDevActor(
  username: string,
): Promise<Omit<Actor, 'ip_address' | 'device'> | null> {
  const cached = devCache.get(username);
  if (cached) return cached;

  const pool = await getPool();
  const result = await pool
    .request()
    .input("role_code", sql.VarChar(12), fallbackRole).query<Actor>(`
      SELECT TOP 1 u.id AS user_id, u.username, u.role_code, u.employee_id
      FROM app.users u
      WHERE u.role_code = @role_code AND u.is_active = 1
      ORDER BY u.username`);

  const actor = result.recordset[0];
  if (!actor)
    throw new Error(`Akun seed dengan role ${fallbackRole} tidak ditemukan.`);
  cache.set(fallbackRole, actor);
  return actor;
}

export function getRequestMeta(req: Request) {
  return {
    device: req.get("user-agent")?.slice(0, 150) ?? null,
    ip_address: (req.ip ?? "0.0.0.0").slice(0, 45),
  };
}
    .input('username', sql.VarChar(50), username)
    .query<{
      user_id: string;
      employee_id: string;
      username: string;
      role_code: RoleCode;
    }>(
      `SELECT u.id AS user_id, u.employee_id, u.username, u.role_code
       FROM app.users u
       WHERE u.username = @username AND u.is_active = 1`,
    );

  const row = result.recordset[0];
  if (!row) return null;
  devCache.set(username, row);
  return row;
}

export async function resolveActor(req: Request): Promise<Actor | null> {
  const ip_address = req.ip ?? '0.0.0.0';
  const device = req.get('user-agent')?.slice(0, 150) ?? null;
  const authUser = (req as Request & { user?: AuthUserLike }).user;

  if (authUser?.employee_id && authUser.role_code && authUser.username) {
    return {
      user_id: (authUser.user_id ?? authUser.id) as string,
      employee_id: authUser.employee_id,
      username: authUser.username,
      role_code: authUser.role_code as RoleCode,
      ip_address,
      device,
    };
  }

  const devUser = req.get('x-dev-user');
  if (devUser && process.env.NODE_ENV !== 'production') {
    const row = await loadDevActor(devUser);
    if (row) return { ...row, ip_address, device };
  }

  return null;
}

/**
 * Pengganti sementara `authorize(...roles)` milik A untuk route modul C.
 * Menaruh actor di `res.locals.actor`. Setelah authenticate/authorize A tersedia,
 * cukup ganti pemanggilan `requireRole` dengan middleware A.
 */
export function requireRole(...roles: RoleCode[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actor = await resolveActor(req);
      if (!actor) {
        throw new AppError(401, 'ERR-AUTH-01', 'Silakan login terlebih dahulu.');
      }
      if (roles.length > 0 && !roles.includes(actor.role_code)) {
        throw new AppError(
          403,
          'ERR-AUTH-03',
          'Anda tidak memiliki akses ke halaman ini.',
        );
      }
      res.locals.actor = actor;
      next();
    } catch (err) {
      next(err);
    }
  };
}

export function getActor(res: Response): Actor {
  return res.locals.actor as Actor;
}
