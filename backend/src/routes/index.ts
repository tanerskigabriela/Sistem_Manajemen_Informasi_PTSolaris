import {
  Router,
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import { getPool } from '../db/pool';
import { sendSuccess } from '../utils/response';
import orderRoutes from "./order.routes";

const router = Router();

/**
 * GET /api/v1/health
 * Menguji koneksi SQL Server via getPool() dan mengembalikan status layanan.
 */
router.get(
  '/health',
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const pool = await getPool();
      const result = await pool
        .request()
        .query<{ db_ok: number }>('SELECT 1 AS db_ok');

      const dbOk = result.recordset[0]?.db_ok === 1;

      sendSuccess(
        res,
        {
          service: 'solaris-backend',
          db_ok: dbOk,
          timestamp: new Date().toISOString(),
        },
        'Layanan berjalan dengan baik.',
      );
    } catch (error) {
      next(error);
    }
  },
);

// Router modul A (auth, users, sessions, password-reset-requests, activity-logs, notifications)
// Router modul B (buyers, product-types, items, order-levels, orders, price-history, dashboard, reports, expeditions, shipments)
router.use(orderRoutes);
// Router modul C (suppliers, raw-materials, order-details, production-lines, spk, progress, qc-standards, defect-types, qc-results)

export default router;
