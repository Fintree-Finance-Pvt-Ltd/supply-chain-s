import { Router } from 'express';
import { LoanManagementController } from '../controllers/loan-management.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { roleMiddleware } from '../middlewares/role.middleware';
import { ROLES } from '../config/constants';

const router = Router();
const loanManagementController = new LoanManagementController();

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

const REPORT_EXPORT_ROLES = [
  ROLES.OPERATIONS_TEAM_L1,
  ROLES.OPERATIONS_TEAM_L2,
  ROLES.OPERATIONS_HEAD,
  ROLES.SUPERADMIN,
];

router.use(authMiddleware);

router.post(
  '/invoices/:invoiceId/book',
  roleMiddleware([ROLES.OPERATIONS_TEAM_L2, ROLES.OPERATIONS_HEAD, ROLES.SUPERADMIN]),
  loanManagementController.bookInvoiceDisbursement,
);

router.post(
  '/collections',
  roleMiddleware(OPS_ROLES),
  loanManagementController.recordCollection,
);

router.get(
  '/accounts/:lan',
  roleMiddleware(OPS_ROLES),
  loanManagementController.getLoanAccountSummary,
);

router.get(
  '/accounts/:lan/schedule',
  roleMiddleware(OPS_ROLES),
  loanManagementController.getDemandSchedule,
);

router.get(
  '/accounts/:lan/statement',
  roleMiddleware(OPS_ROLES),
  loanManagementController.getStatement,
);

router.get(
  '/collections/:lan/:utr',
  roleMiddleware(OPS_ROLES),
  loanManagementController.getCollectionDetail,
);

router.get(
  '/reports/portfolio',
  roleMiddleware(REPORT_ROLES),
  loanManagementController.getPortfolioReport,
);

router.get(
  '/reports/disbursements',
  roleMiddleware(REPORT_ROLES),
  loanManagementController.getDisbursementReport,
);

router.get(
  '/reports/collections',
  roleMiddleware(REPORT_ROLES),
  loanManagementController.getCollectionReport,
);

router.get(
  '/reports/scf-15d/export',
  roleMiddleware(REPORT_EXPORT_ROLES),
  loanManagementController.exportScf15DReport,
);

router.get(
  '/reports/scf-as-of-now/export',
  roleMiddleware(REPORT_EXPORT_ROLES),
  loanManagementController.exportScfAsOfNowReport,
);

router.get(
  '/reports/scf-collections/export',
  roleMiddleware(REPORT_EXPORT_ROLES),
  loanManagementController.exportScfCollectionsReport,
);

router.get(
  '/reports/scf-soa/export',
  roleMiddleware(REPORT_EXPORT_ROLES),
  loanManagementController.exportScfSoaReport,
);

export default router;
