"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseRepository = void 0;
const mssql_1 = __importDefault(require("mssql"));
const db_1 = require("../db");
const pool_1 = require("../db/pool");
/**
 * Kelas dasar abstrak untuk lapisan Repository (KONTRAK v2 Bagian 8).
 * Menerapkan enkapsulasi akses koneksi, inheritance, generics, method overloading,
 * dan polymorphism bagi seluruh repository modul A, B, dan C.
 */
class BaseRepository {
    tableName;
    poolName;
    constructor(tableName, poolName = 'rsi') {
        this.tableName = tableName;
        this.poolName = poolName;
    }
    async getPool(poolName) {
        return (0, pool_1.getPool)(poolName ?? this.poolName);
    }
    async getDb(poolName) {
        return (0, db_1.getDb)(poolName ?? this.poolName);
    }
    async executeSp(tx, spName, inputs) {
        const request = new mssql_1.default.Request(tx);
        if (Array.isArray(inputs)) {
            for (const param of inputs) {
                if (param.type) {
                    request.input(param.name, param.type, param.value);
                }
                else {
                    request.input(param.name, param.value);
                }
            }
        }
        else if (inputs) {
            for (const [name, param] of Object.entries(inputs)) {
                if (param.type) {
                    request.input(name, param.type, param.value);
                }
                else {
                    request.input(name, param.value);
                }
            }
        }
        return request.execute(spName);
    }
}
exports.BaseRepository = BaseRepository;
//# sourceMappingURL=base.repository.js.map