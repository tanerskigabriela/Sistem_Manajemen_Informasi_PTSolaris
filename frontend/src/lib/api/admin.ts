import { http } from '../http';
import type {
  ApiSuccessResponse,
  PaginationMeta,
  RoleCode,
} from '../../types/api';

export type AssignableRoleCode = Exclude<RoleCode, 'SUPERADMIN'>;

export interface UserRecord {
  id: string;
  employee_id: string;
  full_name: string;
  username: string;
  role_code: RoleCode;
  role_name: string;
  division_name: string;
  position_name: string;
  is_active: boolean;
  is_locked: boolean;
  must_change_password: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AvailableEmployeeRecord {
  id: string;
  full_name: string;
  employee_type: string;
  factory_name: string;
  division_name: string;
  position_name: string;
}

export interface ListUsersParams {
  page?: number;
  per_page?: number;
  q?: string;
  role_code?: RoleCode;
  is_active?: boolean;
}

export interface CreateUserPayload {
  employee_id: string;
  username: string;
  password: string;
  role_code: AssignableRoleCode;
}

export interface UpdateUserPayload {
  role_code?: AssignableRoleCode;
  is_active?: boolean;
}

export interface ActivityLogRecord {
  id: number;
  user_id: string | null;
  username: string;
  full_name: string | null;
  action_type: string;
  resource_type: string | null;
  resource_id: string | null;
  old_values: Record<string, unknown> | unknown[] | null;
  new_values: Record<string, unknown> | unknown[] | null;
  device: string | null;
  ip_address: string;
  created_at: string;
}

export interface ListActivityLogsParams {
  page?: number;
  per_page?: number;
  action_type?: string;
  username?: string;
  resource_type?: string;
  date_from?: string;
  date_to?: string;
}

export async function fetchUsers(
  params: ListUsersParams = {},
): Promise<{ items: UserRecord[]; meta: PaginationMeta }> {
  const query: Record<string, string | number> = {
    page: params.page ?? 1,
    per_page: params.per_page ?? 15,
  };
  if (params.q && params.q.trim()) query.q = params.q.trim();
  if (params.role_code) query.role_code = params.role_code;
  if (params.is_active !== undefined) {
    query.is_active = params.is_active ? 'true' : 'false';
  }

  const res = await http.get<ApiSuccessResponse<UserRecord[]>>('/users', {
    params: query,
  });

  return {
    items: res.data.data,
    meta: res.data.meta ?? {
      current_page: params.page ?? 1,
      per_page: params.per_page ?? 15,
      total: res.data.data.length,
      last_page: 1,
    },
  };
}

export async function fetchAvailableEmployees(
  q?: string,
): Promise<AvailableEmployeeRecord[]> {
  const res = await http.get<ApiSuccessResponse<AvailableEmployeeRecord[]>>(
    '/users/available-employees',
    {
      params: q && q.trim() ? { q: q.trim() } : undefined,
    },
  );
  return res.data.data;
}

export async function createUser(
  payload: CreateUserPayload,
): Promise<UserRecord> {
  const res = await http.post<ApiSuccessResponse<UserRecord>>(
    '/users',
    payload,
  );
  return res.data.data;
}

export async function updateUser(
  id: string,
  payload: UpdateUserPayload,
): Promise<UserRecord> {
  const res = await http.patch<ApiSuccessResponse<UserRecord>>(
    `/users/${id}`,
    payload,
  );
  return res.data.data;
}

export async function fetchActivityLogs(
  params: ListActivityLogsParams = {},
): Promise<{ items: ActivityLogRecord[]; meta: PaginationMeta }> {
  const query: Record<string, string | number> = {
    page: params.page ?? 1,
    per_page: params.per_page ?? 20,
  };
  if (params.action_type) query.action_type = params.action_type;
  if (params.username && params.username.trim()) {
    query.username = params.username.trim();
  }
  if (params.resource_type && params.resource_type.trim()) {
    query.resource_type = params.resource_type.trim();
  }
  if (params.date_from) query.date_from = params.date_from;
  if (params.date_to) query.date_to = params.date_to;

  const res = await http.get<ApiSuccessResponse<ActivityLogRecord[]>>(
    '/activity-logs',
    { params: query },
  );

  return {
    items: res.data.data,
    meta: res.data.meta ?? {
      current_page: params.page ?? 1,
      per_page: params.per_page ?? 20,
      total: res.data.data.length,
      last_page: 1,
    },
  };
}