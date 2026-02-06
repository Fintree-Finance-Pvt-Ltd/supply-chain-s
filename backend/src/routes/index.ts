import { Router } from 'express';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import roleRoutes from './role.routes';
import customerRoutes from './customer.routes';
import kycRoutes from './kyc.routes';
import creditRoutes from './credit.routes';
import approvalRoutes from './approval.routes';
import documentRoutes from './document.routes';
import operationsRoutes from './operations.routes';
import coApplicantRoutes from './coApplicant.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/roles', roleRoutes);
router.use('/customers', customerRoutes);
router.use('/kyc', kycRoutes);
router.use('/credit', creditRoutes);
router.use('/approvals', approvalRoutes);
router.use('/documents', documentRoutes);
router.use('/operations', operationsRoutes);
router.use('/co-applicants', coApplicantRoutes);

export default router;



