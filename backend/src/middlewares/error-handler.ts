import type { NextFunction, Request, Response } from 'express';
import sql from 'mssql';
import { ZodError } from 'zod';
import { ERROR_CODE, ERROR_MESSAGE } from '../constants';
import { AppError, type FieldError } from '../utils/errors';

const SQL_CONNECTION_ERROR_CODES = new Set([
  'ELOGIN',
  'ESOCKET',
  'ETIMEOUT',
  'ENOTOPEN',
  'ECONNCLOSED',
  'ECONNRESET',
  'EINSTLOOKUP',
  'ENOCONN',
]);

function isDatabaseConnectionError(err: unknown): boolean {
  if (err instanceof sql.ConnectionError) {
    return true;
  }

  if (typeof err === 'object' && err !== null) {
    const candidate = err as { name?: unknown; code?: unknown };
    if (candidate.name === 'ConnectionError') {
      return true;
    }
    if (
      typeof candidate.code === 'string' &&
      SQL_CONNECTION_ERROR_CODES.has(candidate.code)
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Global error handler sesuai KONTRAK v1 Bagian 8.2–8.3 dan KONTRAK v2 Bagian 9.
 * Detail teknis (stack trace / pesan SQL) tidak pernah dikirim ke client.
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    if (err.httpStatus >= 500) {
      console.error('[AppError]', err);
    }

    res.status(err.httpStatus).json({
      status: 'error',
      error_code: err.errorCode,
      message: err.message,
      ...(err.errors && err.errors.length > 0 ? { errors: err.errors } : {}),
    });
    return;
  }

  if (err instanceof ZodError) {
    const formattedErrors: FieldError[] = err.issues.map((issue) => ({
      field: issue.path.length > 0 ? issue.path.join('.') : 'input',
      message: issue.message,
    }));

    res.status(422).json({
      status: 'error',
      error_code: ERROR_CODE.VALIDATION_REQUIRED,
      message: ERROR_MESSAGE[ERROR_CODE.VALIDATION_REQUIRED],
      errors: formattedErrors,
    });
    return;
  }

  if (isDatabaseConnectionError(err)) {
    console.error('[DatabaseConnectionError]', err);

    res.status(503).json({
      status: 'error',
      error_code: ERROR_CODE.SYS_UNAVAILABLE,
      message: ERROR_MESSAGE[ERROR_CODE.SYS_UNAVAILABLE],
    });
    return;
  }

  console.error('[UnhandledError]', err);

  res.status(500).json({
    status: 'error',
    error_code: ERROR_CODE.SYS_INTERNAL,
    message: ERROR_MESSAGE[ERROR_CODE.SYS_INTERNAL],
  });
}
