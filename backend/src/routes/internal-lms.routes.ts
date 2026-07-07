import { Router } from 'express';
import { InternalLmsController } from '../controllers/internal-lms.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { roleMiddleware } from '../middlewares/role.middleware';
import { ROLES } from '../config/constants';

const router = Router();
const internalLmsController = new InternalLmsController();

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
];

router.use(authMiddleware);

router.post(
  '/invoices/:invoiceId/book',
  roleMiddleware([ROLES.OPERATIONS_TEAM_L2, ROLES.OPERATIONS_HEAD, ROLES.SUPERADMIN]),
  internalLmsController.bookInvoiceDisbursement,
);

router.post(
  '/collections',
  roleMiddleware(OPS_ROLES),
  internalLmsController.recordCollection,
);

router.get(
  '/accounts/:lan',
  roleMiddleware(OPS_ROLES),
  internalLmsController.getLoanAccountSummary,
);

router.get(
  '/accounts/:lan/schedule',
  roleMiddleware(OPS_ROLES),
  internalLmsController.getDemandSchedule,
);

router.get(
  '/accounts/:lan/statement',
  roleMiddleware(OPS_ROLES),
  internalLmsController.getStatement,
);

router.get(
  '/collections/:lan/:utr',
  roleMiddleware(OPS_ROLES),
  internalLmsController.getCollectionDetail,
);

router.get(
  '/reports/portfolio',
  roleMiddleware(REPORT_ROLES),
  internalLmsController.getPortfolioReport,
);

router.get(
  '/reports/disbursements',
  roleMiddleware(REPORT_ROLES),
  internalLmsController.getDisbursementReport,
);

router.get(
  '/reports/collections',
  roleMiddleware(REPORT_ROLES),
  internalLmsController.getCollectionReport,
);

router.get(
  '/reports/scf-15d/export',
  roleMiddleware(REPORT_EXPORT_ROLES),
  internalLmsController.exportScf15DReport,
);

router.get(
  '/reports/scf-as-of-now/export',
  roleMiddleware(REPORT_EXPORT_ROLES),
  internalLmsController.exportScfAsOfNowReport,
);

router.get(
  '/reports/scf-collections/export',
  roleMiddleware(REPORT_EXPORT_ROLES),
  internalLmsController.exportScfCollectionsReport,
);

router.get(
  '/reports/scf-soa/export',
  roleMiddleware(REPORT_EXPORT_ROLES),
  internalLmsController.exportScfSoaReport,
);

export default router;
