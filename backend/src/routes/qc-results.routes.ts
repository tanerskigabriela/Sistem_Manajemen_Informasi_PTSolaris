import { Router } from 'express';
import { ROLE } from '../constants';
import { createQcResult, listQcResults } from '../controllers/qc-result.controller';
import { validate } from '../middlewares/validate';
import { createQcResultBody, spkIdParams } from '../schemas/qc-result.schema';
import { requireRole } from '../utils/actor';

const router = Router();

router.get(
  '/spk/:id/qc-results',
  requireRole(ROLE.QC, ROLE.PPIC, ROLE.PIMPINAN),
  validate({ params: spkIdParams }),
  listQcResults,
);
router.post(
  '/spk/:id/qc-results',
  requireRole(ROLE.QC),
  validate({ params: spkIdParams, body: createQcResultBody }),
  createQcResult,
);

export default router;
