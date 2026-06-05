import { Router } from 'express';
import * as orderController from '../controllers/order.controller';
import { requireAuth }      from '../middleware/auth.middleware';
import { placeOrderValidator, listOrdersValidator } from '../validators/order.validators';
import { validate }         from '../middleware/validate.middleware';

const router = Router();

// All order routes require authentication
router.use(requireAuth);

router.post('/',          placeOrderValidator,  validate, orderController.placeOrder);
router.get('/',           listOrdersValidator,  validate, orderController.getOrders);
router.get('/:orderId',                                   orderController.getOrder);
router.delete('/:orderId',                                orderController.cancelOrder);

export default router;
