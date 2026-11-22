import { z } from 'zod';
import { ERROR_CODE, ERROR_MESSAGE } from '../constants';

const REQUIRED_MSG = ERROR_MESSAGE[ERROR_CODE.VALIDATION_REQUIRED];

export const loginSchema = z.object({
  username: z.string({ required_error: REQUIRED_MSG }).trim().min(1, REQUIRED_MSG),
  password: z.string({ required_error: REQUIRED_MSG }).min(1, REQUIRED_MSG),
});

export type LoginInput = z.infer<typeof loginSchema>;