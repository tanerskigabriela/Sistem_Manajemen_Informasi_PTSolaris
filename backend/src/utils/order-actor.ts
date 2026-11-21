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
