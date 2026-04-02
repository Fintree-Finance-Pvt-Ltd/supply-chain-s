import { Request, Response } from 'express';
import { OperationsService } from '../services/operations.service';
import { REPAYMENT_UPLOAD_STATUS } from '../entities/RepaymentUpload';

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

  // =====================================================
  // REPAYMENT UPLOAD METHODS
  // =====================================================

  uploadRepayments = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      const { repayments } = req.body;

      if (!repayments || !Array.isArray(repayments) || repayments.length === 0) {
        res.status(400).json({
          success: false,
          message: 'Invalid payload: repayments array is required and must not be empty',
        });
        return;
      }

      const result = await this.operationsService.uploadRepayments(repayments, req.userId!);

      const statusCode = result.success ? 200 : 400;
      res.status(statusCode).json({
        success: result.success,
        message: result.message,
        data: result.results,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to upload repayments',
      });
    }
  };

  retryRepaymentUpload = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          success: false,
          message: 'Repayment record ID is required',
        });
        return;
      }

      const result = await this.operationsService.retryRepaymentUpload(Number(id));

      const statusCode = result.success ? 200 : 400;
      res.status(statusCode).json({
        success: result.success,
        message: result.message,
        data: result.results,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to retry repayment upload',
      });
    }
  };

  getRepaymentUploads = async (req: Request, res: Response): Promise<void> => {
    try {
      const { status, lan, startDate, endDate, limit, offset } = req.query;

      const filters: any = {};
      if (status) filters.status = status as REPAYMENT_UPLOAD_STATUS;
      if (lan) filters.lan = lan as string;
      if (startDate) {
        const parsedDate = new Date(startDate as string);
        if (!isNaN(parsedDate.getTime())) {
          filters.startDate = parsedDate;
        }
      }
      if (endDate) {
        const parsedDate = new Date(endDate as string);
        if (!isNaN(parsedDate.getTime())) {
          filters.endDate = parsedDate;
        }
      }
      if (limit) {
        const parsedLimit = parseInt(limit as string);
        if (!isNaN(parsedLimit)) filters.limit = parsedLimit;
      }
      if (offset) {
        const parsedOffset = parseInt(offset as string);
        if (!isNaN(parsedOffset)) filters.offset = parsedOffset;
      }

      const result = await this.operationsService.getRepaymentUploads(filters);

      res.json({
        success: true,
        data: result.data,
        total: result.total,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch repayment uploads',
      });
    }
  };

  getRepaymentUploadById = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const record = await this.operationsService.getRepaymentUploadById(Number(id));

      if (!record) {
        res.status(404).json({
          success: false,
          message: 'Repayment record not found',
        });
        return;
      }

      res.json({
        success: true,
        data: record,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch repayment record',
      });
    }
  };

  // Get available lenders for dropdown
  getLenders = async (req: Request, res: Response): Promise<void> => {
    try {
      const lenders = await this.operationsService.getLenders();
      res.json({
        success: true,
        data: lenders,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch lenders',
      });
    }
  };

  // Get LANs by selected lender
  getLansByLender = async (req: Request, res: Response): Promise<void> => {
    try {
      const { lender } = req.query;

      const partnerId = parseInt(req.params.partnerId, 10);

      if (!partnerId || isNaN(partnerId)) {
        res.status(400).json({
          success: false,
          message: 'Partner ID parameter is required and must be a valid number',
        });
        return;
      }

      const lans = await this.operationsService.getLansByLender(partnerId);
      res.json({
        success: true,
        data: lans,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch LANs',
      });
    }
  };
}



