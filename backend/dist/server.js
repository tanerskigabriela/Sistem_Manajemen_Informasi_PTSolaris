"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
// Muat .env dari root repositori terlebih dahulu, lalu fallback ke backend/.env bila ada
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../.env') });
dotenv_1.default.config();
const app_1 = __importDefault(require("./app"));
const pool_1 = require("./db/pool");
const PORT = Number(process.env.PORT ?? 3000);
const server = app_1.default.listen(PORT, () => {
    console.log(`[Solaris] Server berjalan di http://localhost:${PORT}`);
    console.log(`[Solaris] API v1  : http://localhost:${PORT}/api/v1`);
    console.log(`[Solaris] Swagger : http://localhost:${PORT}/docs`);
});
async function shutdown(signal) {
    console.log(`[Solaris] Menerima sinyal ${signal}, menutup server...`);
    server.close(async () => {
        try {
            await (0, pool_1.closeAllPools)();
        }
        catch (error) {
            console.error('[Solaris] Gagal menutup connection pool:', error);
        }
        finally {
            process.exit(0);
        }
    });
}
process.on('SIGINT', () => {
    void shutdown('SIGINT');
});
process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
});
//# sourceMappingURL=server.js.map