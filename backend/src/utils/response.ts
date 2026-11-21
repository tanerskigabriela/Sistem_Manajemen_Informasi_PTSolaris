import type { Response } from 'express';

export interface PaginationMeta {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
}

export type ResponseMeta = PaginationMeta | Record<string, unknown>;

export function sendSuccess<T>(
  res: Response,
  data: T,
  message?: string,
  meta?: ResponseMeta,
  statusCode = 200,
): Response {
  return res.status(statusCode).json({
    status: 'success',
    data,
    ...(message !== undefined ? { message } : {}),
    ...(meta !== undefined ? { meta } : {}),
  });
}
