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
        req.userId
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
        Number(id),
        req.userId,
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

      const history = await this.approvalService.getApprovalHistory(Number(id));

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

  createApprovalFlow = async (req: Request, res: Response): Promise<void> => {
    try {
      const { name, flowType, description, isSequential } = req.body;

      if (!name || !flowType) {
        res.status(400).json({
          success: false,
          message: 'Name and flowType are required',
        });
        return;
      }

      const flow = await this.approvalService.createApprovalFlow({
        name,
        flowType,
        description,
        isSequential,
      });

      res.status(201).json({
        success: true,
        message: 'Approval flow created successfully',
        data: flow,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to create approval flow',
      });
    }
  };

  getAllFlows = async (req: Request, res: Response): Promise<void> => {
    try {
      const flows = await this.approvalService.getAllFlows();
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

  getFlowById = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          success: false,
          message: 'Flow ID is required',
        });
        return;
      }

      const flow = await this.approvalService.getFlowById(Number(id));

      if (!flow) {
        res.status(404).json({
          success: false,
          message: 'Approval flow not found',
        });
        return;
      }

      res.json({
        success: true,
        data: flow,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch approval flow',
      });
    }
  };

  updateApprovalFlow = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { name, description, isActive, isSequential } = req.body;

      if (!id) {
        res.status(400).json({
          success: false,
          message: 'Flow ID is required',
        });
        return;
      }

      const flow = await this.approvalService.updateApprovalFlow(Number(id), {
        name,
        description,
        isActive,
        isSequential,
      });

      res.json({
        success: true,
        message: 'Approval flow updated successfully',
        data: flow,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to update approval flow',
      });
    }
  };

  deleteApprovalFlow = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          success: false,
          message: 'Flow ID is required',
        });
        return;
      }

      await this.approvalService.deleteApprovalFlow(Number(id));

      res.json({
        success: true,
        message: 'Approval flow deleted successfully',
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to delete approval flow',
      });
    }
  };

  toggleFlowStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          success: false,
          message: 'Flow ID is required',
        });
        return;
      }

      const flow = await this.approvalService.toggleFlowStatus(Number(id));

      res.json({
        success: true,
        message: `Approval flow ${flow.isActive ? 'activated' : 'deactivated'} successfully`,
        data: flow,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to toggle flow status',
      });
    }
  };

  addApprovalStep = async (req: Request, res: Response): Promise<void> => {
    try {
      const { flowId, approverRoleId, stepOrder, stepName, isRequired } = req.body;

      if (!flowId || !approverRoleId || stepOrder === undefined) {
        res.status(400).json({
          success: false,
          message: 'flowId, approverRoleId, and stepOrder are required',
        });
        return;
      }

      const step = await this.approvalService.addApprovalStep(Number(flowId), {
        approverRoleId: Number(approverRoleId),
        stepOrder: Number(stepOrder),
        stepName,
        isRequired,
      });

      res.status(201).json({
        success: true,
        message: 'Approval step added successfully',
        data: step,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to add approval step',
      });
    }
  };

  removeApprovalStep = async (req: Request, res: Response): Promise<void> => {
    try {
      const { stepId } = req.params;

      if (!stepId) {
        res.status(400).json({
          success: false,
          message: 'stepId is required',
        });
        return;
      }

      await this.approvalService.removeApprovalStep(Number(stepId));

      res.json({
        success: true,
        message: 'Approval step removed successfully',
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to remove approval step',
      });
    }
  };

  updateApprovalStep = async (req: Request, res: Response): Promise<void> => {
    try {
      const { stepId } = req.params;
      const { approverRoleId, stepOrder, stepName, isRequired } = req.body;

      if (!stepId) {
        res.status(400).json({
          success: false,
          message: 'stepId is required',
        });
        return;
      }

      const step = await this.approvalService.updateApprovalStep(Number(stepId), {
        approverRoleId: approverRoleId ? Number(approverRoleId) : undefined,
        stepOrder: stepOrder ? Number(stepOrder) : undefined,
        stepName,
        isRequired,
      });

      res.json({
        success: true,
        message: 'Approval step updated successfully',
        data: step,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to update approval step',
      });
    }
  };
}



