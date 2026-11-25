export type RoleCode =
  | 'SUPERADMIN'
  | 'ADMIN'
  | 'PIMPINAN'
  | 'MARKETING'
  | 'PPIC'
  | 'SPV'
  | 'QC';

export interface PaginationMeta {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
}

export interface ApiSuccessResponse<T> {
  status: 'success';
  data: T;
  message?: string;
  meta?: PaginationMeta;
}

export interface ApiFieldError {
  field: string;
  message: string;
}

export interface ApiErrorResponse {
  status: 'error';
  error_code: string;
  message: string;
  errors?: ApiFieldError[];
}

export interface MenuItem {
  code: string;
  label: string;
  path: string;
}

export interface AuthUser {
  id: string;
  full_name: string;
  username: string;
  role_code: RoleCode;
  role_name: string;
  employee_id: string;
  factory_id: string;
  must_change_password: boolean;
  menus: MenuItem[];
  unread_notifications: number;
}