import type { NextFunction, Request, Response } from 'express';
import { ERROR_CODE, ERROR_MESSAGE } from '../constants';
import type { ListActivityLogsQuery } from '../schemas/activity-logs.schema';
import { activityLogsService } from '../services/activity-logs.service';
import { AppError } from '../utils/errors';
import { sendSuccess } from '../utils/response';

export async function listActivityLogs(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError(
        401,
        ERROR_CODE.AUTH_UNAUTHENTICATED,
        ERROR_MESSAGE[ERROR_CODE.AUTH_UNAUTHENTICATED],
      );
    }

    const query = req.query as unknown as ListActivityLogsQuery;
    const { items, meta } = await activityLogsService.listActivityLogs(
      query,
      req.user.role_code,
    );
    sendSuccess(res, items, undefined, meta);
  } catch (error) {
    next(error);
  }
}