import type { Request } from "express";
import { ERROR_CODE, ERROR_MESSAGE, type RoleCode } from "../constants";
import { AppError } from "./errors";

export { getRequestMeta } from "./request-meta";

// Pengguna yang sedang login. req.user diisi middleware authenticate milik A,
// jadi route yang memakai getActor wajib dipasangi authenticate.
export interface Actor {
  user_id: string;
  username: string;
  role_code: RoleCode;
  employee_id: string;
}

export function getActor(req: Request): Actor {
  const user = req.user;
  if (!user) {
    throw new AppError(
      401,
      ERROR_CODE.AUTH_UNAUTHENTICATED,
      ERROR_MESSAGE[ERROR_CODE.AUTH_UNAUTHENTICATED],
    );
  }
  return {
    user_id: user.id,
    username: user.username,
    role_code: user.role_code,
    employee_id: user.employee_id,
  };
}
