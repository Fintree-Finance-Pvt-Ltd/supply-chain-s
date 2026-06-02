import { Router } from 'express';
import { OperationsController } from '../controllers/operations.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { roleMiddleware } from '../middlewares/role.middleware';
import { ROLES } from '../config/constants';
import { upload } from '../utils/upload';

const router = Router();
const operationsController = new OperationsController();

router.use(authMiddleware);

// IMPORTANT: More specific routes must come BEFORE generic /:id route

// Data Migration Routes (OPS only)
router.post(
  '/migrations/customers',
  roleMiddleware([ROLES.OPERATIONS_TEAM_L1, ROLES.OPERATIONS_TEAM_L2, ROLES.OPERATIONS_HEAD]),
  upload.single('file'),
  operationsController.migrateCustomers
);

router.post(
  '/migrations/suppliers',
  roleMiddleware([ROLES.OPERATIONS_TEAM_L1, ROLES.OPERATIONS_TEAM_L2, ROLES.OPERATIONS_HEAD]),
  upload.single('file'),
  operationsController.migrateSuppliers
);

// Repayment Upload Routes (OPS L1/L2)
router.post(
  '/repayments/upload',
  roleMiddleware([ROLES.OPERATIONS_TEAM_L1, ROLES.OPERATIONS_TEAM_L2, ROLES.OPERATIONS_HEAD]),
  operationsController.uploadRepayments
);

router.get(
  '/repayments',
  roleMiddleware([ROLES.OPERATIONS_TEAM_L1, ROLES.OPERATIONS_TEAM_L2, ROLES.OPERATIONS_HEAD]),
  operationsController.getRepaymentUploads
);

// Lender and LAN endpoints - must come before /:id
router.get(
  '/repayments/lenders',
  roleMiddleware([ROLES.OPERATIONS_TEAM_L1, ROLES.OPERATIONS_TEAM_L2, ROLES.OPERATIONS_HEAD]),
  operationsController.getLenders
);

router.get(
  '/repayments/lans/:partnerId',
  roleMiddleware([ROLES.OPERATIONS_TEAM_L1, ROLES.OPERATIONS_TEAM_L2, ROLES.OPERATIONS_HEAD]),
  operationsController.getLansByLender
);

router.get(
  '/repayments/:id',
  roleMiddleware([ROLES.OPERATIONS_TEAM_L1, ROLES.OPERATIONS_TEAM_L2, ROLES.OPERATIONS_HEAD]),
  operationsController.getRepaymentUploadById
);

router.post(
  '/repayments/:id/retry',
  roleMiddleware([ROLES.OPERATIONS_TEAM_L1, ROLES.OPERATIONS_TEAM_L2, ROLES.OPERATIONS_HEAD]),
  operationsController.retryRepaymentUpload
);

// Operations check routes
router.get(
  '/pending',
  roleMiddleware([ROLES.OPERATIONS_TEAM_L1, ROLES.OPERATIONS_TEAM_L2, ROLES.OPERATIONS_HEAD]),
  operationsController.getPendingChecks
);

// RM submits post-sanction completion
router.post(
  '/post-sanction/:customerId/submit',
  roleMiddleware([ROLES.RELATIONSHIP_MANAGER]),
  operationsController.submitPostSanction
);

// Generic /:id route - must be LAST
router.get('/:id', operationsController.getCheckById);
router.put(
  '/:id',
  roleMiddleware([ROLES.OPERATIONS_TEAM_L1, ROLES.OPERATIONS_TEAM_L2, ROLES.OPERATIONS_HEAD]),
  operationsController.updateCheck
);

export default router;
