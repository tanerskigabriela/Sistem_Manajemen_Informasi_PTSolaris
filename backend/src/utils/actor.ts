import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { RoleCode } from '../constants';
import { authenticate } from '../middlewares/authenticate';
import { authorize } from '../middlewares/authorize';
import { getRequestMeta } from './request-meta';

/**
 * Identitas pengguna yang sedang memanggil endpoint modul C.
 * Diambil dari `req.user` yang diisi middleware `authenticate` milik A.
 * `employee_id` dipakai untuk kolom created_by / decided_by / checked_by / recorded_by / inspected_by.
 */
export interface Actor {
  user_id: string;
  employee_id: string;
  username: string;
  role_code: RoleCode;
  ip_address: string;
  device: string | null;
}

/** Menyalin req.user + meta request ke res.locals.actor. */
function attachActor(req: Request, res: Response, next: NextFunction): void {
  const user = req.user;
  if (user) {
    const { device, ip_address } = getRequestMeta(req);
    const actor: Actor = {
      user_id: user.id,
      employee_id: user.employee_id,
      username: user.username,
      role_code: user.role_code,
      ip_address,
      device,
    };
    res.locals.actor = actor;
  }
  next();
}

/**
 * Rangkaian middleware route modul C:
 *   authenticate (A) -> authorize(...roles) (A) -> attachActor
 * 401 ERR-AUTH-01 bila belum login, 403 ERR-AUTH-03 + log AKSES_DITOLAK bila role tidak sesuai.
 */
export function requireRole(...roles: RoleCode[]): RequestHandler[] {
  return [authenticate, authorize(...roles), attachActor];
}

export function getActor(res: Response): Actor {
  return res.locals.actor as Actor;
}
