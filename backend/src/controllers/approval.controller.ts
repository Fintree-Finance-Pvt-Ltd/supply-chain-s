import { Request, Response } from 'express';
import { ApprovalService } from '../services/approval.service';
import { APPROVAL_STATUS } from '../config/constants';

export class ApprovalController {
  private approvalService: ApprovalService;

  constructor() {
    this.approvalService = new ApprovalService();
  }

  getPendingApprovals = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      const approvals = await this.approvalService.getPendingApprovalsForUser(
        parseInt(req.userId)
      );

      res.json({
        success: true,
        data: approvals,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch pending approvals',
      });
    }
  };

  processApproval = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { action, comments } = req.body;

      if (!req.userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      if (!action || !['approved', 'rejected'].includes(action)) {
        res.status(400).json({
          success: false,
          message: 'Valid action (approved/rejected) is required',
        });
        return;
      }

      const approvalInstance = await this.approvalService.processApproval(
        id,
        parseInt(req.userId),
        action,
        comments
      );

      res.json({
        success: true,
        data: approvalInstance,
        message: `Approval ${action} successfully`,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to process approval',
      });
    }
  };

  getApprovalHistory = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const history = await this.approvalService.getApprovalHistory(id);

      res.json({
        success: true,
        data: history,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch approval history',
      });
    }
  };

  getFlows = async (req: Request, res: Response): Promise<void> => {
    try {
      const flows = await this.approvalService.getFlows();
      res.json({
        success: true,
        data: flows,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch approval flows',
      });
    }
  };

  updateFlow = async (req: Request, res: Response): Promise<void> => {
    try {
      const { flowType } = req.params;
      const { steps } = req.body;

      if (!steps || !Array.isArray(steps)) {
        res.status(400).json({
          success: false,
          message: 'Invalid steps configuration',
        });
        return;
      }

      const flow = await this.approvalService.updateFlow(flowType, steps);

      res.json({
        success: true,
        data: flow,
        message: 'Approval flow updated successfully',
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to update approval flow',
      });
    }
  };
}

