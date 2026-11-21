"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const pool_1 = require("../db/pool");
const response_1 = require("../utils/response");
const router = (0, express_1.Router)();
/**
 * GET /api/v1/health
 * Menguji koneksi SQL Server via getPool() dan mengembalikan status layanan.
 */
router.get('/health', async (_req, res, next) => {
    try {
        const pool = await (0, pool_1.getPool)();
        const result = await pool
            .request()
            .query('SELECT 1 AS db_ok');
        const dbOk = result.recordset[0]?.db_ok === 1;
        (0, response_1.sendSuccess)(res, {
            service: 'solaris-backend',
            db_ok: dbOk,
            timestamp: new Date().toISOString(),
        }, 'Layanan berjalan dengan baik.');
    }
    catch (error) {
        next(error);
    }
});
// Router modul A (auth, users, sessions, password-reset-requests, activity-logs, notifications)
// Router modul B (buyers, product-types, items, order-levels, orders, price-history, dashboard, reports, expeditions, shipments)
// Router modul C (suppliers, raw-materials, order-details, production-lines, spk, progress, qc-standards, defect-types, qc-results)
exports.default = router;
//# sourceMappingURL=index.js.map