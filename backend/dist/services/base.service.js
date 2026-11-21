"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseService = void 0;
const constants_1 = require("../constants");
const activity_log_1 = require("../utils/activity-log");
const transaction_1 = require("../utils/transaction");
const HIDDEN_PRICE_FIELD_SET = new Set(constants_1.HIDDEN_PRICE_FIELDS);
function stripPriceFieldsRecursive(value) {
    if (value === null || value === undefined) {
        return value;
    }
    if (value instanceof Date) {
        return value;
    }
    if (Array.isArray(value)) {
        return value.map((item) => stripPriceFieldsRecursive(item));
    }
    if (typeof value === 'object') {
        const source = value;
        const sanitized = {};
        for (const [key, entry] of Object.entries(source)) {
            if (HIDDEN_PRICE_FIELD_SET.has(key)) {
                continue;
            }
            sanitized[key] = stripPriceFieldsRecursive(entry);
        }
        return sanitized;
    }
    return value;
}
/**
 * Kelas dasar abstrak untuk lapisan Service (KONTRAK v2 Bagian 8 & 9).
 * Menyediakan penyembunyian kolom harga untuk role non-komersial dan wrapper transaksi SQL.
 */
class BaseService {
    poolName;
    constructor(poolName = 'rsi') {
        this.poolName = poolName;
    }
    /**
     * Menghapus seluruh field harga (`HIDDEN_PRICE_FIELDS`) secara rekursif dari data response
     * apabila `roleCode` bukan termasuk `PRICE_VISIBLE_ROLES` (MARKETING dan PIMPINAN).
     */
    maskPriceFields(data, roleCode) {
        if (constants_1.PRICE_VISIBLE_ROLES.includes(roleCode)) {
            return data;
        }
        return stripPriceFieldsRecursive(data);
    }
    /**
     * Menjalankan operasi bisnis tulis di dalam satu transaksi atomik SQL Server.
     */
    async runInTransaction(work, poolName) {
        return (0, transaction_1.withTransaction)(work, poolName ?? this.poolName);
    }
    /**
     * Helper pencatatan log aktivitas di dalam transaksi aktif.
     */
    async recordActivity(tx, payload) {
        await (0, activity_log_1.logActivity)(tx, payload);
    }
}
exports.BaseService = BaseService;
//# sourceMappingURL=base.service.js.map