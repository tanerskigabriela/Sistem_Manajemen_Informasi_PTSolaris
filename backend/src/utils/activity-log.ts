import sql from 'mssql';
import type { ActionType } from '../constants';

export interface ActivityLogPayload {
  user_id?: string | null;
  username: string;
  action_type: ActionType;
  resource_type?: string | null;
  resource_id?: string | null;
  old_values?: Record<string, unknown> | unknown[] | null;
  new_values?: Record<string, unknown> | unknown[] | null;
  device?: string | null;
  ip_address: string;
}

/**
 * Mencatat audit log ke tabel app.activity_logs di dalam transaksi yang sama
 * dengan perubahan data (KONTRAK v1 Bagian 10 & KONTRAK v2 Bagian 4.2).
 */
export async function logActivity(
  tx: sql.Transaction,
  payload: ActivityLogPayload,
): Promise<void> {
  const oldValuesJson =
    payload.old_values !== undefined && payload.old_values !== null
      ? JSON.stringify(payload.old_values)
      : null;

  const newValuesJson =
    payload.new_values !== undefined && payload.new_values !== null
      ? JSON.stringify(payload.new_values)
      : null;

  await new sql.Request(tx)
    .input('user_id', sql.UniqueIdentifier, payload.user_id ?? null)
    .input('username', sql.VarChar(50), payload.username)
    .input('action_type', sql.VarChar(20), payload.action_type)
    .input('resource_type', sql.VarChar(40), payload.resource_type ?? null)
    .input('resource_id', sql.VarChar(36), payload.resource_id ?? null)
    .input('old_values', sql.NVarChar(sql.MAX), oldValuesJson)
    .input('new_values', sql.NVarChar(sql.MAX), newValuesJson)
    .input('device', sql.NVarChar(150), payload.device ?? null)
    .input('ip_address', sql.VarChar(45), payload.ip_address)
    .query(`
      INSERT INTO app.activity_logs (
        user_id,
        username,
        action_type,
        resource_type,
        resource_id,
        old_values,
        new_values,
        device,
        ip_address
      )
      VALUES (
        @user_id,
        @username,
        @action_type,
        @resource_type,
        @resource_id,
        @old_values,
        @new_values,
        @device,
        @ip_address
      )
    `);
}
