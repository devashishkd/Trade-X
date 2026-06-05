import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { requireAuth }      from '../middleware/auth.middleware';
import { registerValidator, loginValidator } from '../validators/auth.validators';
import { validate }         from '../middleware/validate.middleware';

const router = Router();

router.post('/register', registerValidator, validate, authController.register);
router.post('/login',    loginValidator,    validate, authController.login);
router.get('/me',        requireAuth,               authController.me);

export default router;
