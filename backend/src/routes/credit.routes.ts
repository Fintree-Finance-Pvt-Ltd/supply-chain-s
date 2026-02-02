import { Router } from 'express';
import { CreditController } from '../controllers/credit.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { roleMiddleware } from '../middlewares/role.middleware';
import { ROLES } from '../config/constants';

const router = Router();
const creditController = new CreditController();

router.use(authMiddleware);

// Credit team routes
router.post(
  '/sanction',
  roleMiddleware([ROLES.CREDIT_TEAM]),
  creditController.createSanction
);

router.get(
  '/pending',
  roleMiddleware([ROLES.CREDIT_TEAM]),
  creditController.getPendingSanctions
);

router.get('/sanction/:id', creditController.getSanctionById);
router.put('/sanction/:id', creditController.updateSanction);

export default router;

