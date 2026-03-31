import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { TaskDistributionController } from '../controllers/task-distribution.controller';
import { ROLES } from '../config/constants';

const router = Router();

// Initialize controller
const taskDistributionController = new TaskDistributionController();

/**
 * Role-based access control middleware
 */
const checkRole = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user || !user.roles || user.roles.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'User does not have any roles assigned',
      });
    }

    const userRoles = user.roles.map((r: any) => r.name);
    const hasRole = allowedRoles.some((role) => userRoles.includes(role));

    if (!hasRole) {
      return res.status(403).json({
        success: false,
        message: `User must have one of these roles: ${allowedRoles.join(', ')}`,
      });
    }

    next();
  };
};

// Apply auth middleware to all routes
router.use(authMiddleware);

/**
 * POST /api/task-distribution/assign
 * Assign a single case to an eligible user
 * 
 * Request Body:
 * {
 *   "caseId": "123",
 *   "caseType": "CUSTOMER_ONBOARDING" | "SUPPLIER_ONBOARDING" | "INVOICE_DISCOUNTING",
 *   "currentStatus": "submitted" | "credit_l1_approved" | ...
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "caseId": "123",
 *     "assignedUserId": 1,
 *     "assignedUserName": "John Doe",
 *     "assignedRoleLevel": "credit_team_l1",
 *     "assignmentTimestamp": "2026-03-31T05:57:31.327Z",
 *     "userPendingCountAfterAssignment": 5,
 *     "makerCheckerValidationStatus": "Pass" | "Skipped Previous Handler",
 *     "caseType": "CUSTOMER_ONBOARDING",
 *     "workflowStage": "credit_l1"
 *   }
 * }
 */
router.post('/assign', checkRole([
  ROLES.SUPERADMIN,
  ROLES.ADMIN,
  ROLES.RELATIONSHIP_MANAGER,
  ROLES.CREDIT_TEAM_L1,
  ROLES.CREDIT_TEAM_L2,
  ROLES.OPERATIONS_TEAM_L1,
  ROLES.OPERATIONS_TEAM_L2,
]), taskDistributionController.assignCase);

/**
 * POST /api/task-distribution/distribute
 * Distribute multiple cases in batch
 * 
 * Request Body:
 * {
 *   "cases": [
 *     { "caseId": "1", "caseType": "CUSTOMER_ONBOARDING", "currentStatus": "submitted" },
 *     { "caseId": "2", "caseType": "CUSTOMER_ONBOARDING", "currentStatus": "submitted" },
 *     ...
 *   ]
 * }
 */
router.post('/distribute', checkRole([
  ROLES.SUPERADMIN,
  ROLES.ADMIN,
]), taskDistributionController.distributeCases);

/**
 * GET /api/task-distribution/stats
 * Get distribution statistics for all users
 */
router.get('/stats', checkRole([
  ROLES.SUPERADMIN,
  ROLES.ADMIN,
]), taskDistributionController.getDistributionStats);

/**
 * GET /api/task-distribution/user/:userId/stats
 * Get task statistics for a specific user
 */
router.get('/user/:userId/stats', checkRole([
  ROLES.SUPERADMIN,
  ROLES.ADMIN,
]), taskDistributionController.getUserStats);

/**
 * GET /api/task-distribution/eligible-users/:roleName
 * Get eligible users for a specific workflow stage role
 * 
 * Query Params:
 * - workflowStage: optional stage name
 */
router.get('/eligible-users/:roleName', checkRole([
  ROLES.SUPERADMIN,
  ROLES.ADMIN,
  ROLES.RELATIONSHIP_MANAGER,
  ROLES.CREDIT_TEAM_L1,
  ROLES.CREDIT_TEAM_L2,
  ROLES.OPERATIONS_TEAM_L1,
  ROLES.OPERATIONS_TEAM_L2,
]), taskDistributionController.getEligibleUsers);

/**
 * GET /api/task-distribution/user/:userId/pending
 * Get pending cases for a user by role
 * 
 * Query Params:
 * - roleName: optional role name to filter by
 */
router.get('/user/:userId/pending', checkRole([
  ROLES.SUPERADMIN,
  ROLES.ADMIN,
  ROLES.CREDIT_TEAM_L1,
  ROLES.CREDIT_TEAM_L2,
  ROLES.OPERATIONS_TEAM_L1,
  ROLES.OPERATIONS_TEAM_L2,
]), taskDistributionController.getUserPendingCases);

/**
 * POST /api/task-distribution/complete
 * Mark a task as completed
 * 
 * Request Body:
 * {
 *   "taskId": "123",
 *   "userId": 1
 * }
 */
router.post('/complete', checkRole([
  ROLES.SUPERADMIN,
  ROLES.ADMIN,
  ROLES.RELATIONSHIP_MANAGER,
  ROLES.CREDIT_TEAM_L1,
  ROLES.CREDIT_TEAM_L2,
  ROLES.OPERATIONS_TEAM_L1,
  ROLES.OPERATIONS_TEAM_L2,
]), taskDistributionController.completeTask);

/**
 * GET /api/task-distribution/workflow-stage/:status
 * Get workflow stage from case status
 */
router.get('/workflow-stage/:status', checkRole([
  ROLES.SUPERADMIN,
  ROLES.ADMIN,
]), taskDistributionController.getWorkflowStage);

/**
 * POST /api/task-distribution/validate-maker-checker
 * Validate if a user can be assigned a case based on maker-checker rules
 * 
 * Request Body:
 * {
 *   "caseId": "123",
 *   "caseType": "CUSTOMER_ONBOARDING",
 *   "userId": 1,
 *   "currentStage": "credit_l1"
 * }
 */
router.post('/validate-maker-checker', checkRole([
  ROLES.SUPERADMIN,
  ROLES.ADMIN,
]), taskDistributionController.validateMakerChecker);

export default router;