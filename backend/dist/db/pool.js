"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPool = getPool;
exports.closeAllPools = closeAllPools;
const mssql_1 = __importDefault(require("mssql"));
const pools = {};
const connecting = {};
function buildConfig(poolName) {
    const isSmbdConfigured = poolName === 'smbd' && Boolean(process.env.DB_SMBD_USER);
    const user = isSmbdConfigured
        ? process.env.DB_SMBD_USER
        : (process.env.DB_USER ?? 'app_rsi');
    const password = isSmbdConfigured
        ? (process.env.DB_SMBD_PASSWORD ?? '')
        : (process.env.DB_PASSWORD ?? '');
    return {
        server: process.env.DB_HOST ?? 'localhost',
        port: Number(process.env.DB_PORT ?? 1433),
        database: process.env.DB_NAME ?? 'solaris_db',
        user,
        password,
        options: {
            encrypt: false,
            trustServerCertificate: true,
        },
        pool: {
            max: 10,
            min: 0,
            idleTimeoutMillis: 30000,
        },
    };
}
/**
 * Mengambil connection pool SQL Server.
 * Tahap awal menggunakan satu login default (`app_rsi`) sesuai RENCANA-TAHAP-2 Bagian 4.
 * Parameter `'smbd'` sudah disiapkan untuk tahap SMBD (fallback ke `'rsi'` bila DB_SMBD_USER belum diset).
 */
async function getPool(poolName = 'rsi') {
    const effectivePool = poolName === 'smbd' && process.env.DB_SMBD_USER ? 'smbd' : 'rsi';
    const existing = pools[effectivePool];
    if (existing && existing.connected) {
        return existing;
    }
    const pending = connecting[effectivePool];
    if (pending) {
        return pending;
    }
    const connectPromise = new mssql_1.default.ConnectionPool(buildConfig(effectivePool))
        .connect()
        .then((pool) => {
        pools[effectivePool] = pool;
        delete connecting[effectivePool];
        return pool;
    })
        .catch((err) => {
        delete connecting[effectivePool];
        throw err;
    });
    connecting[effectivePool] = connectPromise;
    return connectPromise;
}
async function closeAllPools() {
    const entries = Object.entries(pools);
    await Promise.all(entries.map(async ([name, pool]) => {
        if (pool && pool.connected) {
            await pool.close();
        }
        delete pools[name];
    }));
}
//# sourceMappingURL=pool.js.map