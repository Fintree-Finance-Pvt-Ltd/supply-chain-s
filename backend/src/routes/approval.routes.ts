import { Router } from 'express';
import { ApprovalController } from '../controllers/approval.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { roleMiddleware } from '../middlewares/role.middleware';
import { ROLES } from '../config/constants';

const router = Router();
const approvalController = new ApprovalController();

router.use(authMiddleware);

// Management roles can view pending approvals
router.get(
  '/pending',
  roleMiddleware([ROLES.CEO, ROLES.CFO, ROLES.MD]),
  approvalController.getPendingApprovals
);

// Process approval (approve/reject)
router.post(
  '/:id/action',
  roleMiddleware([ROLES.CEO, ROLES.CFO, ROLES.MD]),
  approvalController.processApproval
);

// Get approval history
router.get('/:id/history', approvalController.getApprovalHistory);

export default router;

