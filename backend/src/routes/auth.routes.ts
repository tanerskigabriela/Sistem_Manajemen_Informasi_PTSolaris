import { Router } from 'express';
import { login, logout, me } from '../controllers/auth.controller';
import { authenticate } from '../middlewares/authenticate';
import { validate } from '../middlewares/validate';
import { loginSchema } from '../schemas/auth.schema';

const router = Router();

router.post('/auth/login', validate(loginSchema), login);
router.post('/auth/logout', authenticate, logout);
router.get('/auth/me', authenticate, me);

export default router;