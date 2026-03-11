import { Router } from 'express';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import roleRoutes from './role.routes';
import customersRoutes from './customer.routes';
import customerAPKRoutes from './customerAPK.routes';
import kycRoutes from './kyc.routes';
import creditRoutes, { creditController } from './credit.routes';
import approvalRoutes from './approval.routes';
import documentRoutes from './document.routes';
import operationsRoutes from './operations.routes';
import coApplicantRoutes from './coApplicant.routes';
import workflowRoutes from './workflow.routes';
import debugRoutes from './debug.routes';
import migrationRoutes from './migration.routes';
import onboardingRoutes from './onboarding.routes';
import partnerRoutes from './partner.routes';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/roles', roleRoutes);

// Customer routes - split into RM and Customer APK (all under /api/customers)
// IMPORTANT: Route order matters! More specific routes should come first
router.use('/customers', customersRoutes);    // Public + RM routes (authMiddleware)
router.use('/lms-customers', customerAPKRoutes);  // Customer APK routes (customerAuthMiddleware)

router.use('/kyc', kycRoutes);
router.use('/credit', creditRoutes);

// Sanctions endpoint - for fetching credit sanctions by customerId at /api/sanctions/:customerId
router.get('/sanctions/:customerId', authMiddleware, creditController.getSanctionsByCustomerId);

router.use('/approvals', approvalRoutes);
router.use('/documents', documentRoutes);
router.use('/operations', operationsRoutes);
router.use('/co-applicants', coApplicantRoutes);
router.use('/workflows', workflowRoutes);
router.use('/onboarding', onboardingRoutes);
router.use('/debug', debugRoutes);
router.use('/migration', migrationRoutes);
router.use('/partners', partnerRoutes);

export default router;
