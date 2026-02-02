import { Router } from 'express';
import { OperationsController } from '../controllers/operations.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { roleMiddleware } from '../middlewares/role.middleware';
import { ROLES } from '../config/constants';

const router = Router();
const operationsController = new OperationsController();

router.use(authMiddleware);

router.get(
  '/pending',
  roleMiddleware([ROLES.OPERATIONS_TEAM]),
  operationsController.getPendingChecks
);

router.get('/:id', operationsController.getCheckById);
router.put(
  '/:id',
  roleMiddleware([ROLES.OPERATIONS_TEAM]),
  operationsController.updateCheck
);

export default router;

