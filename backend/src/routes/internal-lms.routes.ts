import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { roleMiddleware } from '../middlewares/role.middleware';
import { ROLES } from '../config/constants';
import { internalLmsService } from '../services/loan-calculation.service';

const router = Router();

const OPS_ROLES = [
  ROLES.OPERATIONS_TEAM_L1,
  ROLES.OPERATIONS_TEAM_L2,
  ROLES.OPERATIONS_HEAD,
  ROLES.SUPERADMIN,
  ROLES.ADMIN,
];

const REPORT_ROLES = [
  ...OPS_ROLES,
  ROLES.CEO,
  ROLES.MD,
  ROLES.CFO,
];

const getReportFilters = (req: Request) => ({
  startDate: req.query.startDate as string | undefined,
  endDate: req.query.endDate as string | undefined,
  asOfDate: req.query.asOfDate as string | undefined,
  lan: req.query.lan ? String(req.query.lan).trim().toUpperCase() : undefined,
});

const getLoanSpecificReportFilters = (req: Request): {
  startDate?: string;
  endDate?: string;
  asOfDate?: string;
  lan: string;
} => {
  const filters = getReportFilters(req);
  if (!filters.lan) {
    throw new Error('LAN is required for SCF report export');
  }
  return { ...filters, lan: filters.lan };
};

const getSafeFilePrefix = (value: string): string => String(value || 'loan').replace(/[^a-z0-9_-]/gi, '_');

const sendWorkbook = (res: Response, workbook: Buffer, fileName: string): void => {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.send(workbook);
};

const sendReportError = (res: Response, error: any, fallbackMessage: string): void => {
  const message = error.message || fallbackMessage;
  res.status(message.includes('LAN is required') ? 400 : 500).json({ success: false, message });
};

router.use(authMiddleware);

router.post(
  '/invoices/:invoiceId/book',
  roleMiddleware([ROLES.OPERATIONS_TEAM_L2, ROLES.OPERATIONS_HEAD, ROLES.SUPERADMIN]),
  async (req: Request, res: Response) => {
    try {
      const invoiceId = Number(req.params.invoiceId);
      if (!Number.isInteger(invoiceId) || invoiceId <= 0) {
        res.status(400).json({ success: false, message: 'Valid invoiceId is required' });
        return;
      }

      const result = await internalLmsService.bookInvoiceDisbursement(invoiceId, req.userId);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message || 'Failed to book invoice' });
    }
  },
);

router.post(
  '/collections',
  roleMiddleware(OPS_ROLES),
  async (req: Request, res: Response) => {
    try {
      const { lan, collectionDate, collectionUtr, collectionAmount } = req.body;
      const result = await internalLmsService.recordCollection({
        lan,
        collectionDate,
        collectionUtr,
        collectionAmount: Number(collectionAmount),
        userId: req.userId,
      });
      res.status(201).json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message || 'Failed to post collection' });
    }
  },
);

router.get(
  '/accounts/:lan',
  roleMiddleware(OPS_ROLES),
  async (req: Request, res: Response) => {
    try {
      const result = await internalLmsService.getLoanAccountSummary(req.params.lan);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(404).json({ success: false, message: error.message || 'LAN not found' });
    }
  },
);

router.get(
  '/accounts/:lan/schedule',
  roleMiddleware(OPS_ROLES),
  async (req: Request, res: Response) => {
    try {
      const result = await internalLmsService.getDemandSchedule(req.params.lan);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message || 'Failed to fetch schedule' });
    }
  },
);

router.get(
  '/accounts/:lan/statement',
  roleMiddleware(OPS_ROLES),
  async (req: Request, res: Response) => {
    try {
      const result = await internalLmsService.getStatement(req.params.lan, {
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
      });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message || 'Failed to fetch statement' });
    }
  },
);

router.get(
  '/collections/:lan/:utr',
  roleMiddleware(OPS_ROLES),
  async (req: Request, res: Response) => {
    try {
      const result = await internalLmsService.getCollectionDetail(req.params.lan, req.params.utr);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message || 'Failed to fetch collection detail' });
    }
  },
);

router.get(
  '/reports/portfolio',
  roleMiddleware(REPORT_ROLES),
  async (_req: Request, res: Response) => {
    try {
      const result = await internalLmsService.getPortfolioReport();
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message || 'Failed to fetch portfolio report' });
    }
  },
);

router.get(
  '/reports/disbursements',
  roleMiddleware(REPORT_ROLES),
  async (req: Request, res: Response) => {
    try {
      const result = await internalLmsService.getDisbursementReport({
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
      });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message || 'Failed to fetch disbursement report' });
    }
  },
);

router.get(
  '/reports/collections',
  roleMiddleware(REPORT_ROLES),
  async (req: Request, res: Response) => {
    try {
      const result = await internalLmsService.getCollectionReport({
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
      });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message || 'Failed to fetch collection report' });
    }
  },
);

router.get(
  '/reports/scf-15d/export',
  roleMiddleware(REPORT_ROLES),
  async (req: Request, res: Response) => {
    try {
      const filters = getLoanSpecificReportFilters(req);
      const workbook = await internalLmsService.generateScf15DReportWorkbook(filters);
      sendWorkbook(res, workbook, `${getSafeFilePrefix(filters.lan)}_SCF_15D_Report.xlsx`);
    } catch (error: any) {
      sendReportError(res, error, 'Failed to generate SCF 15D report');
    }
  },
);

router.get(
  '/reports/scf-as-of-now/export',
  roleMiddleware(REPORT_ROLES),
  async (req: Request, res: Response) => {
    try {
      const filters = getLoanSpecificReportFilters(req);
      const workbook = await internalLmsService.generateScfAsOfNowReportWorkbook(filters);
      sendWorkbook(res, workbook, `${getSafeFilePrefix(filters.lan)}_SCF_As_of_Now_Format.xlsx`);
    } catch (error: any) {
      sendReportError(res, error, 'Failed to generate SCF as-of-now report');
    }
  },
);

router.get(
  '/reports/scf-collections/export',
  roleMiddleware(REPORT_ROLES),
  async (req: Request, res: Response) => {
    try {
      const filters = getLoanSpecificReportFilters(req);
      const workbook = await internalLmsService.generateScfCollectionReportWorkbook(filters);
      sendWorkbook(res, workbook, `${getSafeFilePrefix(filters.lan)}_SCF_Collection_Format.xlsx`);
    } catch (error: any) {
      sendReportError(res, error, 'Failed to generate SCF collection report');
    }
  },
);

router.get(
  '/reports/scf-soa/export',
  roleMiddleware(REPORT_ROLES),
  async (req: Request, res: Response) => {
    try {
      const filters = getLoanSpecificReportFilters(req);
      const workbook = await internalLmsService.generateScfSoaReportWorkbook(filters);
      sendWorkbook(res, workbook, `${getSafeFilePrefix(filters.lan)}_SCF_SOA.xlsx`);
    } catch (error: any) {
      sendReportError(res, error, 'Failed to generate SCF SOA report');
    }
  },
);

export default router;
