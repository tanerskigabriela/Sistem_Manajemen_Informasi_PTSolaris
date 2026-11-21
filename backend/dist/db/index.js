"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.schema = void 0;
exports.getDb = getDb;
const node_mssql_1 = require("drizzle-orm/node-mssql");
const pool_1 = require("./pool");
const schema = __importStar(require("./schema"));
exports.schema = schema;
function createDrizzle(pool) {
    return (0, node_mssql_1.drizzle)({ client: pool });
}
const dbCache = {};
/**
 * Menginisialisasi dan mengembalikan instance Drizzle ORM di atas connection pool SQL Server.
 * Digunakan untuk query baca (daftar, detail, dashboard) sesuai KONTRAK v1 Bagian 10.1.
 */
async function getDb(poolName = 'rsi') {
    const effectivePool = poolName === 'smbd' && process.env.DB_SMBD_USER ? 'smbd' : 'rsi';
    const pool = await (0, pool_1.getPool)(effectivePool);
    if (!dbCache[effectivePool]) {
        dbCache[effectivePool] = createDrizzle(pool);
    }
    return dbCache[effectivePool];
}
//# sourceMappingURL=index.js.map