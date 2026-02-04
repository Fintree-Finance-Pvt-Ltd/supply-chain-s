import { Router } from 'express';
import { CustomerController } from '../controllers/customer.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { roleMiddleware } from '../middlewares/role.middleware';
import { ROLES } from '../config/constants';

const router = Router();
const customerController = new CustomerController();

router.use(authMiddleware);

// RM can create and manage customers
router.post(
  '/',
  roleMiddleware([ROLES.RELATIONSHIP_MANAGER]),
  customerController.createCustomer
);

// All authenticated users can view
router.get('/', customerController.getCustomers);
router.get('/:id', customerController.getCustomerById);

// RM can update
router.put(
  '/:id',
  roleMiddleware([ROLES.RELATIONSHIP_MANAGER]),
  customerController.updateCustomer
);

// RM can submit
router.post(
  '/:id/submit',
  roleMiddleware([ROLES.RELATIONSHIP_MANAGER]),
  customerController.submitCase
);

export default router;



