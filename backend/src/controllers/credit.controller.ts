import { Request, Response } from 'express';
import { CreditService } from '../services/credit.service';

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
          penalCharges: s.penalCharges,
          processingFees: s.processingFees,
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
  getSanctionsByCustomerIdSimple = async (req: Request, res: Response): Promise<void> => {
    try {
      const { customerId } = req.params;
      const sanctions = await this.creditService.getSanctionsByCustomerIdSimple(Number(customerId));

      // Return in simple format with all required fields
      const response = sanctions.map(s => ({
        customerId: s.customerId,
        partner: s.partner,
        sanctionAmount: s.sanctionAmount,
        status: s.status,
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
}



