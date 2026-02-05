import { Router } from 'express';
import { KycController } from '../controllers/kyc.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { roleMiddleware } from '../middlewares/role.middleware';
import { ROLES } from '../config/constants';

const router = Router();
const kycController = new KycController();

router.use(authMiddleware);

// RM can create and manage KYC
router.post(
    '/',
    roleMiddleware([ROLES.RELATIONSHIP_MANAGER]),
    kycController.createKyc
);

router.put(
    '/:id',
    roleMiddleware([ROLES.RELATIONSHIP_MANAGER]),
    kycController.updateKyc
);

router.delete(
    '/:id',
    roleMiddleware([ROLES.RELATIONSHIP_MANAGER]),
    kycController.deleteKyc
);

// Verify KYC (placeholder for now, RM can verify)
router.post(
    '/:id/verify',
    roleMiddleware([ROLES.RELATIONSHIP_MANAGER]),
    kycController.verifyKyc
);

// All authenticated users can view
router.get('/customer/:customerId', kycController.getCustomerKyc);

export default router;
