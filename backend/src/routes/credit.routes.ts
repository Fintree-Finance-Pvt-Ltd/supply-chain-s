import { Router } from 'express';
import { CreditController } from '../controllers/credit.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { roleMiddleware } from '../middlewares/role.middleware';
import { ROLES } from '../config/constants';

const router = Router();
const creditController = new CreditController();

export { creditController };

router.use(authMiddleware);

// Credit team routes
router.post(
  '/sanction',
  roleMiddleware([ROLES.CREDIT_TEAM_L1, ROLES.CREDIT_TEAM_L2]),
  creditController.createSanction
);

router.get(
  '/pending',
  roleMiddleware([ROLES.CREDIT_TEAM_L1, ROLES.CREDIT_TEAM_L2]),
  creditController.getPendingSanctions
);

router.get('/sanction/:id', creditController.getSanctionById);
router.put('/sanction/:id', creditController.updateSanction);

// Get sanctions by customerId - for loading existing sanctions in CreditCaseDetail
// Available at both /api/credit/customer/:customerId/sanctions and /api/sanctions/:customerId
router.get(
  '/customer/:customerId/sanctions',
  roleMiddleware([ROLES.CREDIT_TEAM_L1, ROLES.CREDIT_TEAM_L2, ROLES.CEO, ROLES.MD, ROLES.RELATIONSHIP_MANAGER]),
  creditController.getSanctionsByCustomerId
);

router.get(
  '/sanctions/:customerId',
  roleMiddleware([ROLES.CREDIT_TEAM_L1, ROLES.CREDIT_TEAM_L2, ROLES.CEO, ROLES.MD, ROLES.RELATIONSHIP_MANAGER]),
  creditController.getSanctionsByCustomerId
);

export default router;



