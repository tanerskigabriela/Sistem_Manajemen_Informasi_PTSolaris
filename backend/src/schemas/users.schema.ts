import { z } from 'zod';
import { ERROR_CODE, ERROR_MESSAGE, ROLE } from '../constants';

const REQUIRED_MSG = ERROR_MESSAGE[ERROR_CODE.VALIDATION_REQUIRED];

const ALL_ROLE_VALUES = [
  ROLE.SUPERADMIN,
  ROLE.ADMIN,
  ROLE.PIMPINAN,
  ROLE.MARKETING,
  ROLE.PPIC,
  ROLE.SPV,
  ROLE.QC,
] as const;

// Role RSI yang boleh dibuat/diubah oleh ADMIN (tidak termasuk SUPERADMIN)
const ASSIGNABLE_RSI_ROLES = [
  ROLE.ADMIN,
  ROLE.PIMPINAN,
  ROLE.MARKETING,
  ROLE.PPIC,
  ROLE.SPV,
  ROLE.QC,
] as const;

export const userIdParamsSchema = z.object({
  id: z.string().uuid('Format ID pengguna tidak valid.'),
});

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(100).optional(),
  role_code: z.enum(ALL_ROLE_VALUES).optional(),
  is_active: z
    .enum(['true', 'false', '1', '0'])
    .transform((v) => v === 'true' || v === '1')
    .optional(),
});

export const availableEmployeesQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
});

export const createUserSchema = z.object({
  employee_id: z
    .string({ required_error: REQUIRED_MSG })
    .uuid('Karyawan tidak valid.'),
  username: z
    .string({ required_error: REQUIRED_MSG })
    .trim()
    .min(4, 'Username minimal 4 karakter.')
    .max(50, 'Username maksimal 50 karakter.')
    .regex(
      /^[a-zA-Z0-9._-]+$/,
      'Username hanya boleh berisi huruf, angka, titik, garis bawah, atau strip.',
    ),
  password: z
    .string({ required_error: REQUIRED_MSG })
    .min(8, 'Password minimal 8 karakter.')
    .max(72, 'Password maksimal 72 karakter.'),
  role_code: z.enum(ASSIGNABLE_RSI_ROLES, {
    errorMap: () => ({ message: 'Role tidak valid.' }),
  }),
});

export const updateUserSchema = z
  .object({
    role_code: z
      .enum(ASSIGNABLE_RSI_ROLES, {
        errorMap: () => ({ message: 'Role tidak valid.' }),
      })
      .optional(),
    is_active: z.boolean().optional(),
  })
  .refine(
    (data) => data.role_code !== undefined || data.is_active !== undefined,
    {
      message: 'Minimal satu kolom (role_code atau is_active) wajib diisi.',
    },
  );

export type UserIdParams = z.infer<typeof userIdParamsSchema>;
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
export type AvailableEmployeesQuery = z.infer<
  typeof availableEmployeesQuerySchema
>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;