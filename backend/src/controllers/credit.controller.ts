import { Request, Response } from 'express';
import { CreditService } from '../services/credit.service';
import { normalizeMonthlyPenalRate } from '../utils/penalCharges';

export class CreditController {
  private creditService: CreditService;

  constructor() {
    this.creditService = new CreditService();
  }

  createSanction = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      const sanction = await this.creditService.createSanction({
        ...req.body,
        customerId: Number(req.body.customerId),
        creditOfficerId: req.userId!,
      });

      res.status(201).json({
        success: true,
        data: sanction,
        message: 'Credit sanction created and submitted for approval',
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to create credit sanction',
      });
    }
  };

  getPendingSanctions = async (req: Request, res: Response): Promise<void> => {
    try {
      const sanctions = await this.creditService.getPendingSanctions();

      res.json({
        success: true,
        data: sanctions,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch pending sanctions',
      });
    }
  };

  getSanctionById = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const sanction = await this.creditService.getSanctionById(Number(id));

      if (!sanction) {
        res.status(404).json({
          success: false,
          message: 'Credit sanction not found',
        });
        return;
      }

      res.json({
        success: true,
        data: sanction,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch credit sanction',
      });
    }
  };

  updateSanction = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const sanction = await this.creditService.updateSanction(Number(id), req.body);

      res.json({
        success: true,
        data: sanction,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to update credit sanction',
      });
    }
  };

  getSanctionsByCustomerId = async (req: Request, res: Response): Promise<void> => {
    try {
      const { customerId } = req.params;
      const sanctions = await this.creditService.getSanctionsByCustomerId(Number(customerId));

      // Return in the format expected by the frontend
      const response = {
        sanctions: sanctions.map(s => ({
          partner: s.partner,
          sanction_limit: s.sanctionAmount,
          roi: s.interestRate,
          tenor: s.tenure,
          conditions: s.conditions,
          penalCharges: normalizeMonthlyPenalRate(s.penalCharges),
          processingFees: s.processingFees,
          cashCollateral: s.cashCollateral,
          legalCharges: s.legalCharges,
          serviceFee: s.serviceFee,
          renewalCycleId: s.renewalCycleId,
  
          status: s.status,
        })),
      };

      res.json(response);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch sanctions',
      });
    }
  };

  // Dedicated API for fetching all sanctions for a customer (for non-CREDIT_L1 roles)
  // Returns all sanctions without filtering by partner active status
  // Includes partner name and all sanction fields (tenure, interestRate, penalCharges, processingFees) for RM post sanction review
  getSanctionsByCustomerIdSimple = async (req: Request, res: Response): Promise<void> => {
    try {
      const { customerId } = req.params;
      const sanctions = await this.creditService.getSanctionsByCustomerIdSimple(Number(customerId));

      // Return in simple format with all required fields including partnerName, tenure, interestRate, penalCharges, processingFees
      const response = sanctions.map(s => ({
        customerId: s.customerId,
        partner: s.partner,
        partnerName: s.partnerName,
        sanctionAmount: s.sanctionAmount,
        tenure: s.tenure,
        interestRate: s.interestRate,
        penalCharges: normalizeMonthlyPenalRate(s.penalCharges),
        processingFees: s.processingFees,
        legalCharges: s.legalCharges,
        serviceFee: s.serviceFee,
        cashCollateral: s.cashCollateral,
        conditions: s.conditions,
        creditRemarks: s.creditRemarks,
        status: s.status,
        renewalCycleId: s.renewalCycleId,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      }));

      res.json(response);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch sanctions',
      });
    }
  };

  getCustomerNotepads = async (req: Request, res: Response): Promise<void> => {
    try {
      const customerId = Number(req.params.customerId);
      const notes = await this.creditService.getCustomerNotepads(
        customerId,
      );

      res.json({
        success: true,
        data: notes,
      });
    } catch (error: any) {
      res.status(error.message === 'Customer not found' ? 404 : 400).json({
        success: false,
        message: error.message || 'Failed to fetch credit notepad',
      });
    }
  };

  getAssignUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await this.creditService.getAssignUsers();

    if (!result.success) {
      res.status(500).json(result);
      return;
    }

    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch assign users',
    });
  }
};

assignCreditUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const customerId = Number(req.params.customerId);
    const assignedTo = Number(req.body.assignedTo);

    const result = await this.creditService.assignCreditUser(
      customerId,
      assignedTo,
      (req as any).user
    );

    if (!result.success) {
      res.status(400).json(result);
      return;
    }

    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to assign credit user',
    });
  }
};
  updateCustomerNotepad = async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    try {
      const customerId = Number(req.params.customerId);
      const userId = req.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      const note = await this.creditService.upsertCustomerNotepad(
        customerId,
        req.params.section,
        req.body?.content,
        req.body?.sanctionKey,
        userId,
        req.userRoles || [],
      );

      res.json({
        success: true,
        data: note,
        message: 'Credit notepad saved',
      });
    } catch (error: any) {
      const statusCode =
        error.message === 'Customer not found'
          ? 404
          : error.message?.includes('permission')
            ? 403
            : 400;

      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to save credit notepad',
      });
    }
  };
}



