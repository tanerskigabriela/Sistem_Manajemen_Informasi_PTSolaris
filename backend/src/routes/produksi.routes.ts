import { Router } from 'express';
import masterProduksiRoutes from './master-produksi.routes';
import orderMaterialsRoutes from './order-materials.routes';
import progressRoutes from './progress.routes';
import qcResultsRoutes from './qc-results.routes';
import spkRoutes from './spk.routes';
import suppliersRoutes from './suppliers.routes';

/**
 * Semua router modul C. Di routes/index.ts (milik A) cukup satu baris:
 *   router.use(produksiRoutes);
 */
const router = Router();
router.use(suppliersRoutes);
router.use(masterProduksiRoutes);
router.use(orderMaterialsRoutes);
router.use(spkRoutes);
router.use(progressRoutes);
router.use(qcResultsRoutes);

export default router;
