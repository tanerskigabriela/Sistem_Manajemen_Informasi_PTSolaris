import type { NextFunction, Request, Response } from 'express';
import type { ListActivityLogsQuery } from '../schemas/activity-logs.schema';
import { activityLogsService } from '../services/activity-logs.service';
import { sendSuccess } from '../utils/response';

export async function listActivityLogs(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const query = req.query as unknown as ListActivityLogsQuery;
    const { items, meta } = await activityLogsService.listActivityLogs(query);
    sendSuccess(res, items, undefined, meta);
  } catch (error) {
    next(error);
  }
}