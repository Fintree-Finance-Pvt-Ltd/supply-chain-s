import { Request, Response } from 'express';
import { OperationsService } from '../services/operations.service';

export class OperationsController {
  private operationsService: OperationsService;

  constructor() {
    this.operationsService = new OperationsService();
  }

  getPendingChecks = async (req: Request, res: Response): Promise<void> => {
    try {
      const checks = await this.operationsService.getPendingChecks();

      res.json({
        success: true,
        data: checks,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch pending checks',
      });
    }
  };

  getCheckById = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const check = await this.operationsService.getCheckById(Number(id));

      if (!check) {
        res.status(404).json({
          success: false,
          message: 'Operations check not found',
        });
        return;
      }

      res.json({
        success: true,
        data: check,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch operations check',
      });
    }
  };

  updateCheck = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      if (!req.userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      const check = await this.operationsService.updateCheck(Number(id), {
        ...req.body,
        opsUserId: req.userId!,
      });

      res.json({
        success: true,
        data: check,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to update operations check',
      });
    }
  };

  submitPostSanction = async (req: Request, res: Response): Promise<void> => {
    try {
      const { customerId } = req.params;

      if (!req.userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      const opsCheck = await this.operationsService.submitPostSanction(
        Number(customerId),
        req.userId!,
        req.body
      );

      res.json({
        success: true,
        data: opsCheck,
        message: 'Post-sanction submitted successfully to operations team',
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to submit post-sanction',
      });
    }
  };
}



