import type { NextFunction, Request, Response } from 'express';
import { ERROR_CODE, ERROR_MESSAGE } from '../constants';
import type {
  AvailableEmployeesQuery,
  CreateUserInput,
  ListUsersQuery,
  UpdateUserInput,
  UserIdParams,
} from '../schemas/users.schema';
import { usersService } from '../services/users.service';
import { AppError } from '../utils/errors';
import { getRequestMeta } from '../utils/request-meta';
import { sendSuccess } from '../utils/response';

export async function listUsers(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const query = req.query as unknown as ListUsersQuery;
    const { items, meta } = await usersService.listUsers(query);
    sendSuccess(res, items, undefined, meta);
  } catch (error) {
    next(error);
  }
}

export async function listAvailableEmployees(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const query = req.query as unknown as AvailableEmployeesQuery;
    const items = await usersService.listAvailableEmployees(query.q);
    sendSuccess(res, items);
  } catch (error) {
    next(error);
  }
}

export async function createUser(
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

    const body = req.body as CreateUserInput;
    const meta = getRequestMeta(req);
    const created = await usersService.createUser(body, req.user, meta);
    sendSuccess(res, created, 'Akun pengguna berhasil dibuat.', undefined, 201);
  } catch (error) {
    next(error);
  }
}

export async function updateUser(
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

    const { id } = req.params as unknown as UserIdParams;
    const body = req.body as UpdateUserInput;
    const meta = getRequestMeta(req);
    const updated = await usersService.updateUser(id, body, req.user, meta);
    sendSuccess(res, updated, 'Data pengguna berhasil diperbarui.');
  } catch (error) {
    next(error);
  }
}