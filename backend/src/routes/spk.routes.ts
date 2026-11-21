import { Router } from 'express';
import { ROLE } from '../constants';
import { approveSpk, getSpk, listSpk, rejectSpk, submitSpk } from '../controllers/spk.controller';
import { validate } from '../middlewares/validate';
import { listSpkQuery, rejectSpkBody, spkIdParams, submitSpkBody } from '../schemas/spk.schema';
import { requireRole } from '../utils/actor';

const router = Router();

router.post('/spk', requireRole(ROLE.PPIC), validate({ body: submitSpkBody }), submitSpk);
router.get(
  '/spk',
  requireRole(ROLE.PPIC, ROLE.PIMPINAN, ROLE.SPV, ROLE.QC),
  validate({ query: listSpkQuery }),
  listSpk,
);
router.get(
  '/spk/:id',
  requireRole(ROLE.PPIC, ROLE.PIMPINAN, ROLE.SPV, ROLE.QC),
  validate({ params: spkIdParams }),
  getSpk,
);
router.post(
  '/spk/:id/approve',
  requireRole(ROLE.PIMPINAN),
  validate({ params: spkIdParams }),
  approveSpk,
);
router.post(
  '/spk/:id/reject',
  requireRole(ROLE.PIMPINAN),
  validate({ params: spkIdParams, body: rejectSpkBody }),
  rejectSpk,
);

export default router;
