import { Router } from 'express';
import { ApprovalController } from '../controllers/approval.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { adminMiddleware, roleMiddleware } from '../middlewares/role.middleware';
import { ROLES } from '../config/constants';

const router = Router();
const approvalController = new ApprovalController();

router.use(authMiddleware);

// Approval actions (non-admin)
router.get(
  '/pending',
  roleMiddleware([
    ROLES.CEO,
    ROLES.CFO,
    ROLES.MD,
    ROLES.CREDIT_TEAM_L1,
    ROLES.CREDIT_TEAM_L2,
    ROLES.OPERATIONS_TEAM_L1,
    ROLES.OPERATIONS_TEAM_L2,
    ROLES.OPERATIONS_HEAD,
  ]),
  approvalController.getPendingApprovals
);

router.post(
  '/:id/action',
  roleMiddleware([
    ROLES.CEO,
    ROLES.CFO,
    ROLES.MD,
    ROLES.CREDIT_TEAM_L1,
    ROLES.CREDIT_TEAM_L2,
    ROLES.OPERATIONS_TEAM_L1,
    ROLES.OPERATIONS_TEAM_L2,
    ROLES.OPERATIONS_HEAD,
  ]),
  approvalController.processApproval
);

router.get('/:id/history', approvalController.getApprovalHistory);

// Admin only - Approval Flow Management
router.post('/flows', adminMiddleware, approvalController.createApprovalFlow);
router.get('/flows', adminMiddleware, approvalController.getAllFlows);
router.get('/flows/:id', adminMiddleware, approvalController.getFlowById);
router.put('/flows/:id', adminMiddleware, approvalController.updateApprovalFlow);
router.delete('/flows/:id', adminMiddleware, approvalController.deleteApprovalFlow);
router.patch('/flows/:id/toggle-status', adminMiddleware, approvalController.toggleFlowStatus);

// Admin only - Approval Step Management
router.post('/steps', adminMiddleware, approvalController.addApprovalStep);
router.put('/steps/:stepId', adminMiddleware, approvalController.updateApprovalStep);
router.delete('/steps/:stepId', adminMiddleware, approvalController.removeApprovalStep);

export default router;



