import { Request, Response } from 'express';
import { loanManagementService } from '../services/loan-management.service';

const getReportFilters = (req: Request) => ({
  startDate: req.query.startDate as string | undefined,
  endDate: req.query.endDate as string | undefined,
  asOfDate: req.query.asOfDate as string | undefined,
  lan: req.query.lan ? String(req.query.lan).trim().toUpperCase() : undefined,
  allCases:
    String(req.query.allCases || '').toLowerCase() === 'true',
});

const getLoanSpecificReportFilters = (req: Request): {
  startDate?: string;
  endDate?: string;
  asOfDate?: string;
  lan?: string;
    allCases?: boolean;

} => {
  const filters = getReportFilters(req);
  // if (!filters.lan) {
  //   throw new Error('LAN is required for SCF report export');
  // }
  // return { ...filters, lan: filters.lan };
   if (!filters.lan && !filters.allCases) {
    throw new Error(
      'LAN is required for SCF report export'
    );
  }

  return filters;
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

export class LoanManagementController {
  bookInvoiceDisbursement = async (req: Request, res: Response): Promise<void> => {
    try {
      const invoiceId = Number(req.params.invoiceId);
      if (!Number.isInteger(invoiceId) || invoiceId <= 0) {
        res.status(400).json({ success: false, message: 'Valid invoiceId is required' });
        return;
      }

      const result = await loanManagementService.bookInvoiceDisbursement(invoiceId, req.userId);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message || 'Failed to book invoice' });
    }
  };

  recordCollection = async (req: Request, res: Response): Promise<void> => {
    try {
      const { lan, collectionDate, collectionUtr, collectionAmount } = req.body;
      const result = await loanManagementService.recordCollection({
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
  };

  getLoanAccountSummary = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await loanManagementService.getLoanAccountSummary(req.params.lan);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(404).json({ success: false, message: error.message || 'LAN not found' });
    }
  };

  getDemandSchedule = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await loanManagementService.getDemandSchedule(req.params.lan);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message || 'Failed to fetch schedule' });
    }
  };

  getStatement = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await loanManagementService.getStatement(req.params.lan, {
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
      });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message || 'Failed to fetch statement' });
    }
  };

  getCollectionDetail = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await loanManagementService.getCollectionDetail(req.params.lan, req.params.utr);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message || 'Failed to fetch collection detail' });
    }
  };

  getPortfolioReport = async (_req: Request, res: Response): Promise<void> => {
    try {
      const result = await loanManagementService.getPortfolioReport();
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message || 'Failed to fetch portfolio report' });
    }
  };

  getDisbursementReport = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await loanManagementService.getDisbursementReport({
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
      });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message || 'Failed to fetch disbursement report' });
    }
  };

  getCollectionReport = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await loanManagementService.getCollectionReport({
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
      });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message || 'Failed to fetch collection report' });
    }
  };

  // exportScf15DReport = async (req: Request, res: Response): Promise<void> => {
  //   try {
  //     const filters = getLoanSpecificReportFilters(req);
  //     const workbook = await loanManagementService.generateScf15DReportWorkbook(filters);
  //     sendWorkbook(res, workbook, `${getSafeFilePrefix(filters.lan)}_SCF_15D_Report.xlsx`);
  //   } catch (error: any) {
  //     sendReportError(res, error, 'Failed to generate SCF 15D report');
  //   }
  // };

exportScf15DReport = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const filters =
      getLoanSpecificReportFilters(req);

    console.log(
      'SCF 15D FILTERS:',
      filters
    );

    const workbook =
      await loanManagementService
        .generateScf15DReportWorkbook(
          filters
        );

    const prefix = filters.allCases
      ? 'ALL_CASES'
      : getSafeFilePrefix(
          filters.lan || 'loan'
        );

    sendWorkbook(
      res,
      workbook,
      `${prefix}_SCF_15D_Report.xlsx`
    );
  } catch (error: any) {

    // ADD THIS
    console.error(
      '❌ SCF 15D REPORT ERROR:',
      error
    );

    sendReportError(
      res,
      error,
      'Failed to generate SCF 15D report'
    );
  }
};

  // exportScfAsOfNowReport = async (req: Request, res: Response): Promise<void> => {
  //   try {
  //     const filters = getLoanSpecificReportFilters(req);
  //     const workbook = await loanManagementService.generateScfAsOfNowReportWorkbook(filters);
  //     sendWorkbook(res, workbook, `${getSafeFilePrefix(filters.lan)}_SCF_As_of_Now_Format.xlsx`);
  //   } catch (error: any) {
  //     sendReportError(res, error, 'Failed to generate SCF as-of-now report');
  //   }
  // };

  exportScfAsOfNowReport = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const filters =
      getLoanSpecificReportFilters(req);

    const workbook =
      await loanManagementService
        .generateScfAsOfNowReportWorkbook(
          filters
        );

    const prefix = filters.allCases
      ? 'ALL_CASES'
      : getSafeFilePrefix(
          filters.lan || 'loan'
        );

    sendWorkbook(
      res,
      workbook,
      `${prefix}_SCF_As_of_Now_Format.xlsx`
    );
  } catch (error: any) {
    sendReportError(
      res,
      error,
      'Failed to generate SCF as-of-now report'
    );
  }
};

  // exportScfCollectionsReport = async (req: Request, res: Response): Promise<void> => {
  //   try {
  //     const filters = getLoanSpecificReportFilters(req);
  //     const workbook = await loanManagementService.generateScfCollectionReportWorkbook(filters);
  //     sendWorkbook(res, workbook, `${getSafeFilePrefix(filters.lan)}_SCF_Collection_Format.xlsx`);
  //   } catch (error: any) {
  //     sendReportError(res, error, 'Failed to generate SCF collection report');
  //   }
  // };

exportScfCollectionsReport = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const filters =
      getLoanSpecificReportFilters(req);

    console.log(
      'SCF COLLECTION REQUEST:',
      filters
    );

    const workbook =
      await loanManagementService
        .generateScfCollectionReportWorkbook(
          filters
        );

    const prefix =
      filters.allCases
        ? 'ALL_CASES'
        : getSafeFilePrefix(
            filters.lan || 'loan'
          );

    sendWorkbook(
      res,
      workbook,
      `${prefix}_SCF_Collection_Format.xlsx`
    );

  } catch (error: any) {

    console.error(
      '❌ SCF COLLECTION REPORT ERROR:',
      error
    );

    sendReportError(
      res,
      error,
      'Failed to generate SCF collection report'
    );
  }
};

exportScfSoaReport = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const filters =
      getLoanSpecificReportFilters(req);

    const workbook =
      await loanManagementService
        .generateScfSoaReportWorkbook(
          filters
        );

    const prefix = filters.allCases
      ? 'ALL_CASES'
      : getSafeFilePrefix(
          filters.lan || 'loan'
        );

    sendWorkbook(
      res,
      workbook,
      `${prefix}_SCF_SOA.xlsx`
    );
  } catch (error: any) {
    sendReportError(
      res,
      error,
      'Failed to generate SCF SOA report'
    );
  }
};

  // exportScfSoaReport = async (req: Request, res: Response): Promise<void> => {
  //   try {
  //     const filters = getLoanSpecificReportFilters(req);
  //     const workbook = await loanManagementService.generateScfSoaReportWorkbook(filters);
  //     sendWorkbook(res, workbook, `${getSafeFilePrefix(filters.lan)}_SCF_SOA.xlsx`);
  //   } catch (error: any) {
  //     sendReportError(res, error, 'Failed to generate SCF SOA report');
  //   }
  // };
}
