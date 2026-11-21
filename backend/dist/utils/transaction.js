"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.withTransaction = withTransaction;
const mssql_1 = __importDefault(require("mssql"));
const pool_1 = require("../db/pool");
/**
 * Menjalankan sekumpulan operasi tulis SQL Server di dalam satu transaksi atomik.
 * Seluruh query tulis (termasuk SP dan logActivity) wajib memakai `new sql.Request(transaction)`.
 * Sesuai KONTRAK v1 Bagian 10.1.
 */
async function withTransaction(work, poolName = 'rsi') {
    const transaction = new mssql_1.default.Transaction(await (0, pool_1.getPool)(poolName));
    await transaction.begin();
    try {
        const result = await work(transaction);
        await transaction.commit();
        return result;
    }
    catch (error) {
        try {
            await transaction.rollback();
        }
        catch {
            /* sudah di-rollback SQL Server */
        }
        throw error;
    }
}
//# sourceMappingURL=transaction.js.map