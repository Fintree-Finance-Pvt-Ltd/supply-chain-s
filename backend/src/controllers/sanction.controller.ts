import { Request, Response } from 'express';
import { CustomerSanctionService } from '../services/customer-sanction.service';

export class SanctionController {
  private sanctionService: CustomerSanctionService;

  constructor() {
    this.sanctionService = new CustomerSanctionService();
  }

  getSanctionsByCustomer = async (req: Request, res: Response): Promise<void> => {
    try {
      const customerId = Number(req.params.id || req.params.customerId);

      if (!Number.isInteger(customerId) || customerId <= 0) {
        res.status(400).json({
          success: false,
          message: 'Invalid customer ID',
        });
        return;
      }

      const sanctions = await this.sanctionService.getSanctionsByCustomer(customerId);

      res.json({
        success: true,
        data: sanctions,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch sanctions',
      });
    }
  };
}
