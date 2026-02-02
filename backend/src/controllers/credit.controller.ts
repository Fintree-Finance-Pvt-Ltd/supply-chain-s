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
        creditOfficerId: req.userId,
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
      const sanction = await this.creditService.getSanctionById(id);

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
      const sanction = await this.creditService.updateSanction(id, req.body);

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
}

