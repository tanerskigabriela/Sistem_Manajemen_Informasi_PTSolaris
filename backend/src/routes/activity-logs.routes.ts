import { Router } from 'express';
import { ROLE } from '../constants';
import { listActivityLogs } from '../controllers/activity-logs.controller';
import { authenticate } from '../middlewares/authenticate';
import { authorize } from '../middlewares/authorize';
import { validate } from '../middlewares/validate';
import { listActivityLogsQuerySchema } from '../schemas/activity-logs.schema';

const router = Router();

router.get(
  '/activity-logs',
  authenticate,
  authorize(ROLE.ADMIN),
  validate({ query: listActivityLogsQuerySchema }),
  listActivityLogs,
);

export default router;