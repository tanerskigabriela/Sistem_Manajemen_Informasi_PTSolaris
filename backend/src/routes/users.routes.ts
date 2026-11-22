import { Router } from 'express';
import { ROLE } from '../constants';
import {
  createUser,
  listAvailableEmployees,
  listUsers,
  updateUser,
} from '../controllers/users.controller';
import { authenticate } from '../middlewares/authenticate';
import { authorize } from '../middlewares/authorize';
import { validate } from '../middlewares/validate';
import {
  availableEmployeesQuerySchema,
  createUserSchema,
  listUsersQuerySchema,
  updateUserSchema,
  userIdParamsSchema,
} from '../schemas/users.schema';

const router = Router();

router.get(
  '/users',
  authenticate,
  authorize(ROLE.ADMIN),
  validate({ query: listUsersQuerySchema }),
  listUsers,
);

router.get(
  '/users/available-employees',
  authenticate,
  authorize(ROLE.ADMIN),
  validate({ query: availableEmployeesQuerySchema }),
  listAvailableEmployees,
);

router.post(
  '/users',
  authenticate,
  authorize(ROLE.ADMIN),
  validate(createUserSchema),
  createUser,
);

router.patch(
  '/users/:id',
  authenticate,
  authorize(ROLE.ADMIN),
  validate({ params: userIdParamsSchema, body: updateUserSchema }),
  updateUser,
);

export default router;