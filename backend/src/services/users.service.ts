import bcrypt from 'bcryptjs';
import {
  ACTION_TYPE,
  ERROR_CODE,
  ERROR_MESSAGE,
  ROLE,
} from '../constants';
import {
  usersRepository,
  type AvailableEmployeeRecord,
  type UserRecord,
  type UsersRepository,
} from '../repositories/users.repository';
import type {
  CreateUserInput,
  ListUsersQuery,
  UpdateUserInput,
} from '../schemas/users.schema';
import type { AuthUser } from '../types/express';
import { AppError } from '../utils/errors';
import type { RequestMeta } from '../utils/request-meta';
import type { PaginationMeta } from '../utils/response';
import { sqlErrorNumber } from '../utils/sql-error';
import { BaseService } from './base.service';

const BCRYPT_ROUNDS = 10;

export class UsersService extends BaseService {
  constructor(private readonly repository: UsersRepository = usersRepository) {
    super('rsi');
  }

  async listUsers(
    query: ListUsersQuery,
  ): Promise<{ items: UserRecord[]; meta: PaginationMeta }> {
    const { items, total } = await this.repository.findPaginated({
      page: query.page,
      per_page: query.per_page,
      q: query.q,
      role_code: query.role_code,
      is_active: query.is_active,
    });

    const last_page = Math.max(1, Math.ceil(total / query.per_page));
    return {
      items,
      meta: {
        current_page: query.page,
        per_page: query.per_page,
        total,
        last_page,
      },
    };
  }

  async listAvailableEmployees(q?: string): Promise<AvailableEmployeeRecord[]> {
    return this.repository.findAvailableEmployees(q);
  }

  async createUser(
    input: CreateUserInput,
    actor: AuthUser,
    meta: RequestMeta,
  ): Promise<UserRecord> {
    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

    let newUserId: string;
    try {
      newUserId = await this.runInTransaction(async (tx) => {
        const employeeActive = await this.repository.isEmployeeActive(
          tx,
          input.employee_id,
        );
        if (!employeeActive) {
          throw new AppError(
            422,
            ERROR_CODE.VALIDATION_REQUIRED,
            'Data karyawan tidak valid.',
            [
              {
                field: 'employee_id',
                message: 'Karyawan tidak ditemukan atau tidak aktif.',
              },
            ],
          );
        }

        const duplicate = await this.repository.existsByUsernameOrEmployee(
          tx,
          input.username,
          input.employee_id,
        );
        if (duplicate.usernameExists) {
          throw new AppError(
            409,
            ERROR_CODE.VALIDATION_USERNAME_TAKEN,
            ERROR_MESSAGE[ERROR_CODE.VALIDATION_USERNAME_TAKEN],
            [
              {
                field: 'username',
                message: ERROR_MESSAGE[ERROR_CODE.VALIDATION_USERNAME_TAKEN],
              },
            ],
          );
        }
        if (duplicate.employeeExists) {
          throw new AppError(
            409,
            ERROR_CODE.VALIDATION_USERNAME_TAKEN,
            'Karyawan ini sudah memiliki akun.',
            [
              {
                field: 'employee_id',
                message: 'Karyawan ini sudah memiliki akun.',
              },
            ],
          );
        }

        const createdId = await this.repository.create(tx, {
          employee_id: input.employee_id,
          username: input.username,
          password_hash: passwordHash,
          role_code: input.role_code,
        });

        await this.recordActivity(tx, {
          user_id: actor.id,
          username: actor.username,
          action_type: ACTION_TYPE.TAMBAH,
          resource_type: 'app.users',
          resource_id: createdId,
          new_values: {
            employee_id: input.employee_id,
            username: input.username,
            role_code: input.role_code,
            is_active: true,
          },
          device: meta.device,
          ip_address: meta.ip_address,
        });

        return createdId;
      });
    } catch (error) {
      const errNo = sqlErrorNumber(error);
      if (errNo === 2601 || errNo === 2627) {
        throw new AppError(
          409,
          ERROR_CODE.VALIDATION_USERNAME_TAKEN,
          ERROR_MESSAGE[ERROR_CODE.VALIDATION_USERNAME_TAKEN],
        );
      }
      throw error;
    }

    const created = await this.repository.findById(newUserId);
    if (!created) {
      throw new AppError(
        500,
        ERROR_CODE.SYS_INTERNAL,
        ERROR_MESSAGE[ERROR_CODE.SYS_INTERNAL],
      );
    }

    return created;
  }

  async updateUser(
    targetUserId: string,
    input: UpdateUserInput,
    actor: AuthUser,
    meta: RequestMeta,
  ): Promise<UserRecord> {
    await this.runInTransaction(async (tx) => {
      const existing = await this.repository.findByIdForUpdate(
        tx,
        targetUserId,
      );
      if (!existing) {
        throw new AppError(
          404,
          ERROR_CODE.SYS_INTERNAL,
          'Data tidak ditemukan.',
        );
      }

      if (existing.role_code === ROLE.SUPERADMIN) {
        throw new AppError(
          403,
          ERROR_CODE.AUTH_FORBIDDEN,
          ERROR_MESSAGE[ERROR_CODE.AUTH_FORBIDDEN],
        );
      }

            if (
        existing.role_code === ROLE.PIMPINAN &&
        (input.is_active === false ||
          (input.role_code && input.role_code !== ROLE.PIMPINAN))
      ) {
        throw new AppError(
          403,
          ERROR_CODE.AUTH_FORBIDDEN,
          'Akun Pimpinan tidak dapat dinonaktifkan atau diubah perannya.',
        );
      }

      if (
        targetUserId.toLowerCase() === actor.id.toLowerCase() &&
        input.is_active === false
      ) {
        throw new AppError(
          409,
          ERROR_CODE.USER_SELF_DEACTIVATE,
          ERROR_MESSAGE[ERROR_CODE.USER_SELF_DEACTIVATE],
        );
      }

      const nextRole = input.role_code ?? existing.role_code;
      const nextActive = input.is_active ?? existing.is_active;

      await this.repository.update(tx, {
        id: targetUserId,
        role_code: nextRole,
        is_active: nextActive,
      });

      // Bila akun dinonaktifkan, seluruh sesi aktifnya segera diakhiri
      if (existing.is_active && !nextActive) {
        await this.repository.terminateSessionsOnDeactivate(tx, targetUserId);
      }

      await this.recordActivity(tx, {
        user_id: actor.id,
        username: actor.username,
        action_type: ACTION_TYPE.UBAH,
        resource_type: 'app.users',
        resource_id: targetUserId,
        old_values: {
          role_code: existing.role_code,
          is_active: existing.is_active,
        },
        new_values: {
          role_code: nextRole,
          is_active: nextActive,
        },
        device: meta.device,
        ip_address: meta.ip_address,
      });
    });

    const updated = await this.repository.findById(targetUserId);
    if (!updated) {
      throw new AppError(
        500,
        ERROR_CODE.SYS_INTERNAL,
        ERROR_MESSAGE[ERROR_CODE.SYS_INTERNAL],
      );
    }

    return updated;
  }
}

export const usersService = new UsersService();