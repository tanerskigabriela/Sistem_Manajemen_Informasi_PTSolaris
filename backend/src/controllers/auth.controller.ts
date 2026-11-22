import type { NextFunction, Request, Response } from 'express';
import { ERROR_CODE, ERROR_MESSAGE } from '../constants';
import type { LoginInput } from '../schemas/auth.schema';
import { authService } from '../services/auth.service';
import { AppError } from '../utils/errors';
import { getRequestMeta } from '../utils/request-meta';
import { sendSuccess } from '../utils/response';

const TOKEN_COOKIE_NAME = 'token';

export async function login(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { username, password } = req.body as LoginInput;
    const meta = getRequestMeta(req);
    const result = await authService.login(username, password, meta);

    res.cookie(TOKEN_COOKIE_NAME, result.token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: result.ttlSeconds * 1000,
      path: '/',
    });

    sendSuccess(res, result.user, 'Login berhasil.');
  } catch (error) {
    next(error);
  }
}

export async function logout(
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

    const meta = getRequestMeta(req);
    await authService.logout(req.user, meta);
    res.clearCookie(TOKEN_COOKIE_NAME, { path: '/' });

    sendSuccess(res, null, 'Logout berhasil.');
  } catch (error) {
    next(error);
  }
}

export async function me(
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

    const profile = await authService.getMe(req.user.id);
    sendSuccess(res, profile);
  } catch (error) {
    next(error);
  }
}