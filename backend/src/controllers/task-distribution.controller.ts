import { Request, Response } from 'express';
import { TaskDistributionService, TaskAssignmentResult, UserTaskStats } from '../services/task-distribution.service';
import { ROLES, CASE_STATUS } from '../config/constants';

/**
 * Task Distribution Controller
 * 
 * Handles API endpoints for automatic task distribution based on workflow stages.
 * Implements round-robin with workload balancing and maker-checker validation.
 */
export class TaskDistributionController {
  private taskDistributionService: TaskDistributionService;

  constructor() {
    this.taskDistributionService = new TaskDistributionService();
  }

  /**
   * POST /api/task-distribution/assign
   * Assign a single case to an eligible user
   */
  assignCase = async (req: Request, res: Response): Promise<void> => {
    try {
      const { caseId, caseType, currentStatus } = req.body;

      if (!caseId || !caseType || !currentStatus) {
        res.status(400).json({
          success: false,
          message: 'Missing required fields: caseId, caseType, and currentStatus are required',
        });
        return;
      }

      // Validate case type
      const validCaseTypes = ['CUSTOMER_ONBOARDING', 'SUPPLIER_ONBOARDING', 'INVOICE_DISCOUNTING'];
      if (!validCaseTypes.includes(caseType)) {
        res.status(400).json({
          success: false,
          message: `Invalid caseType. Must be one of: ${validCaseTypes.join(', ')}`,
        });
        return;
      }

      // Determine workflow stage from status
      const workflowStage = this.taskDistributionService.getStageFromStatus(currentStatus);

      if (!workflowStage || workflowStage === 'unknown') {
        res.status(400).json({
          success: false,
          message: `Unable to determine workflow stage from status: ${currentStatus}`,
        });
        return;
      }

      const result = await this.taskDistributionService.assignCase(
        caseId,
        caseType,
        currentStatus,
        workflowStage
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };

  /**
   * POST /api/task-distribution/distribute
   * Distribute multiple cases in batch
   */
  distributeCases = async (req: Request, res: Response): Promise<void> => {
    try {
      const { cases } = req.body;

      if (!cases || !Array.isArray(cases) || cases.length === 0) {
        res.status(400).json({
          success: false,
          message: 'Missing or invalid cases array',
        });
        return;
      }

      // Validate each case
      for (let i = 0; i < cases.length; i++) {
        const caseItem = cases[i];
        if (!caseItem.caseId || !caseItem.caseType || !caseItem.currentStatus) {
          res.status(400).json({
            success: false,
            message: `Invalid case at index ${i}. Required: caseId, caseType, currentStatus`,
          });
          return;
        }
      }

      const results = await this.taskDistributionService.distributeCases(cases);

      res.json({
        success: true,
        data: results,
        summary: {
          total: results.length,
          assigned: results.filter(r => r.assignedUserId !== null).length,
          pending: results.filter(r => r.assignedUserId === null).length,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };

  /**
   * GET /api/task-distribution/stats
   * Get distribution statistics for all users
   */
  getDistributionStats = async (req: Request, res: Response): Promise<void> => {
    try {
      const stats = await this.taskDistributionService.getDistributionStats();

      res.json({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };

  /**
   * GET /api/task-distribution/user/:userId/stats
   * Get task statistics for a specific user
   */
  getUserStats = async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = req.params;

      if (!userId) {
        res.status(400).json({
          success: false,
          message: 'User ID is required',
        });
        return;
      }

      const stats = await this.taskDistributionService.getUserTaskStats(parseInt(userId));

      res.json({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };

  /**
   * GET /api/task-distribution/eligible-users/:roleName
   * Get eligible users for a specific workflow stage role
   */
  getEligibleUsers = async (req: Request, res: Response): Promise<void> => {
    try {
      const { roleName } = req.params;
      const { workflowStage } = req.query;

      if (!roleName) {
        res.status(400).json({
          success: false,
          message: 'Role name is required',
        });
        return;
      }

      const eligibleUsers = await this.taskDistributionService.getEligibleUsersForRole(
        roleName,
        workflowStage as string || 'default'
      );

      res.json({
        success: true,
        data: eligibleUsers,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };

  /**
   * GET /api/task-distribution/user/:userId/pending
   * Get pending cases for a user by role
   */
  getUserPendingCases = async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = req.params;
      const { roleName } = req.query;

      if (!userId) {
        res.status(400).json({
          success: false,
          message: 'User ID is required',
        });
        return;
      }

      const pendingCases = await this.taskDistributionService.getUserPendingCasesByRole(
        parseInt(userId),
        (roleName as string) || 'default'
      );

      res.json({
        success: true,
        data: pendingCases,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };

  /**
   * POST /api/task-distribution/complete
   * Mark a task as completed
   */
  completeTask = async (req: Request, res: Response): Promise<void> => {
    try {
      const { taskId, userId } = req.body;

      if (!taskId || !userId) {
        res.status(400).json({
          success: false,
          message: 'Missing required fields: taskId and userId are required',
        });
        return;
      }

      await this.taskDistributionService.completeTask(taskId, parseInt(userId));

      res.json({
        success: true,
        message: 'Task marked as completed',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };

  /**
   * GET /api/task-distribution/workflow-stage/:status
   * Get workflow stage from case status
   */
  getWorkflowStage = async (req: Request, res: Response): Promise<void> => {
    try {
      const { status } = req.params;

      if (!status) {
        res.status(400).json({
          success: false,
          message: 'Status is required',
        });
        return;
      }

      const stage = this.taskDistributionService.getStageFromStatus(status);
      const shouldMove = this.taskDistributionService.shouldMoveToNextStage(status);
      const nextStage = this.taskDistributionService.getNextWorkflowStage(stage);

      res.json({
        success: true,
        data: {
          currentStage: stage,
          nextStage,
          shouldMoveToNext: shouldMove,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };

  /**
   * POST /api/task-distribution/validate-maker-checker
   * Validate if a user can be assigned a case based on maker-checker rules
   */
  validateMakerChecker = async (req: Request, res: Response): Promise<void> => {
    try {
      const { caseId, caseType, userId, currentStage } = req.body;

      if (!caseId || !caseType || !userId || !currentStage) {
        res.status(400).json({
          success: false,
          message: 'Missing required fields: caseId, caseType, userId, currentStage',
        });
        return;
      }

      const isValid = await this.taskDistributionService.validateMakerChecker(
        caseId,
        caseType,
        parseInt(userId),
        currentStage
      );

      res.json({
        success: true,
        data: {
          isValid,
          message: isValid 
            ? 'User can be assigned to this case' 
            : 'User cannot be assigned - previous handler in maker stage',
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };
}

export default TaskDistributionController;