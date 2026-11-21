import type { RoleCode } from '../constants';

export interface AuthUser {
  id: string;
  username: string;
  role_code: RoleCode;
  employee_id: string;
  factory_id: string;
  session_id: string;
  must_change_password: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export {};