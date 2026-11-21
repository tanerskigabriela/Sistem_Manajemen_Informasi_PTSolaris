"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logActivity = logActivity;
const mssql_1 = __importDefault(require("mssql"));
/**
 * Mencatat audit log ke tabel app.activity_logs di dalam transaksi yang sama
 * dengan perubahan data (KONTRAK v1 Bagian 10 & KONTRAK v2 Bagian 4.2).
 */
async function logActivity(tx, payload) {
    const oldValuesJson = payload.old_values !== undefined && payload.old_values !== null
        ? JSON.stringify(payload.old_values)
        : null;
    const newValuesJson = payload.new_values !== undefined && payload.new_values !== null
        ? JSON.stringify(payload.new_values)
        : null;
    await new mssql_1.default.Request(tx)
        .input('user_id', mssql_1.default.UniqueIdentifier, payload.user_id ?? null)
        .input('username', mssql_1.default.VarChar(50), payload.username)
        .input('action_type', mssql_1.default.VarChar(20), payload.action_type)
        .input('resource_type', mssql_1.default.VarChar(40), payload.resource_type ?? null)
        .input('resource_id', mssql_1.default.VarChar(36), payload.resource_id ?? null)
        .input('old_values', mssql_1.default.NVarChar(mssql_1.default.MAX), oldValuesJson)
        .input('new_values', mssql_1.default.NVarChar(mssql_1.default.MAX), newValuesJson)
        .input('device', mssql_1.default.NVarChar(150), payload.device ?? null)
        .input('ip_address', mssql_1.default.VarChar(45), payload.ip_address)
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
//# sourceMappingURL=activity-log.js.map