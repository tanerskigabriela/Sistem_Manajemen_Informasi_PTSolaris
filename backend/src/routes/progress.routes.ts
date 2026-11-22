import { Router } from 'express';
import { ROLE } from '../constants';
import { createProgress, listProgress, updateProgress } from '../controllers/progress.controller';
import { validate } from '../middlewares/validate';
import {
  createProgressBody,
  progressIdParams,
  spkIdParams,
  updateProgressBody,
} from '../schemas/progress.schema';
import { requireRole } from '../utils/actor';

const router = Router();

router.get(
  '/spk/:id/progress',
  requireRole(ROLE.SPV, ROLE.PPIC, ROLE.PIMPINAN, ROLE.QC),
  validate({ params: spkIdParams }),
  listProgress,
);
router.post(
  '/spk/:id/progress',
  requireRole(ROLE.SPV),
  validate({ params: spkIdParams, body: createProgressBody }),
  createProgress,
);
router.patch(
  '/progress/:id',
  requireRole(ROLE.SPV),
  validate({ params: progressIdParams, body: updateProgressBody }),
  updateProgress,
);

export default router;
