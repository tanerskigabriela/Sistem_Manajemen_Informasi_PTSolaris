import type { NextFunction, Request, Response } from 'express';
import {
  ACTION_TYPE,
  ERROR_CODE,
  ERROR_MESSAGE,
  type RoleCode,
} from '../constants';
import { logActivity } from '../utils/activity-log';
import { AppError } from '../utils/errors';
import { getRequestMeta } from '../utils/request-meta';
import { withTransaction } from '../utils/transaction';

/**
 * Middleware otorisasi berbasis role (KONTRAK v1 Bagian 9 & 10).
 * Urutan pemakaian di route: authenticate -> authorize(...) -> validate -> controller.
 */
export function authorize(...allowedRoles: RoleCode[]) {
  return async (
    req: Request,
    _res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = req.user;
      if (!user) {
        throw new AppError(
          401,
          ERROR_CODE.AUTH_UNAUTHENTICATED,
          ERROR_MESSAGE[ERROR_CODE.AUTH_UNAUTHENTICATED],
        );
      }

      if (allowedRoles.length > 0 && !allowedRoles.includes(user.role_code)) {
        const { device, ip_address } = getRequestMeta(req);

        await withTransaction(async (tx) => {
          await logActivity(tx, {
            user_id: user.id,
            username: user.username,
            action_type: ACTION_TYPE.AKSES_DITOLAK,
            resource_type: `${req.method} ${req.originalUrl}`.slice(0, 40),
            new_values: {
              role_code: user.role_code,
              required_roles: allowedRoles,
              path: req.originalUrl,
            },
            device,
            ip_address,
          });
        });

        throw new AppError(
          403,
          ERROR_CODE.AUTH_FORBIDDEN,
          ERROR_MESSAGE[ERROR_CODE.AUTH_FORBIDDEN],
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}