import { Router } from 'express';
import * as walletController from '../controllers/wallet.controller';
import { requireAuth }       from '../middleware/auth.middleware';
import { depositValidator }  from '../validators/wallet.validators';
import { validate }          from '../middleware/validate.middleware';

const router = Router();

// All wallet routes require authentication
router.use(requireAuth);

router.get('/balance',          walletController.getBalance);
router.post('/deposit', depositValidator, validate, walletController.deposit);

export default router;
