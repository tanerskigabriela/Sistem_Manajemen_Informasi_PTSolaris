import { Router } from 'express';
import { ROLE } from '../constants';
import {
  listDefectTypes,
  listProductionLines,
  listQcStandards,
  listRawMaterials,
} from '../controllers/master-produksi.controller';
import { validate } from '../middlewares/validate';
import {
  listProductionLinesQuery,
  listQcStandardsQuery,
  listRawMaterialsQuery,
} from '../schemas/master-produksi.schema';
import { requireRole } from '../utils/actor';

const router = Router();

// KONTRAK v2 Bagian 14.3: endpoint baca untuk dropdown
router.get(
  '/raw-materials',
  requireRole(ROLE.PPIC),
  validate({ query: listRawMaterialsQuery }),
  listRawMaterials,
);
router.get(
  '/production-lines',
  requireRole(ROLE.PPIC),
  validate({ query: listProductionLinesQuery }),
  listProductionLines,
);
router.get('/defect-types', requireRole(ROLE.QC), listDefectTypes);
router.get(
  '/qc-standards',
  requireRole(ROLE.QC),
  validate({ query: listQcStandardsQuery }),
  listQcStandards,
);

export default router;
