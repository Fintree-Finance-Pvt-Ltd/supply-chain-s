import { Request, Response } from 'express';
import { HistoryService } from '../services/history.service';

export class HistoryController {
  private historyService: HistoryService;

  constructor() {
    this.historyService = new HistoryService();
  }

  getStatusHistoryByCustomer = async (req: Request, res: Response): Promise<void> => {
    try {
      const customerId = Number(req.params.id || req.params.customerId);
      const page = req.query.page ? Number(req.query.page) : undefined;
      const limit = req.query.limit ? Number(req.query.limit) : undefined;

      if (!Number.isInteger(customerId) || customerId <= 0) {
        res.status(400).json({
          success: false,
          message: 'Invalid customer ID',
        });
        return;
      }

      const history = await this.historyService.getStatusHistoryByCustomer(customerId, {
        page,
        limit,
      });

      res.json({
        success: true,
        data: history.data,
        meta: {
          page: history.page,
          limit: history.limit,
          total: history.total,
          totalPages: Math.ceil(history.total / history.limit),
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch status history',
      });
    }
  };
}
