import { Router, Request, Response } from 'express';
import { CustomerController } from '../controllers/customer.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { roleMiddleware } from '../middlewares/role.middleware';
import { customerAuthMiddleware } from '../middlewares/customerAuth';
import { validateBody, sanitizeQueryParams } from '../middlewares/validation.middleware';
import { ROLES } from '../config/constants';

const router = Router();
const customerController = new CustomerController();

// =====================================================
// 🔹 PUBLIC ROUTES (No auth required)
// =====================================================
router.post('/login', customerController.loginWithPassword);
router.post('/login/otp', customerController.requestLoginOtp);
router.post('/login/otp/verify', customerController.verifyLoginOtp);
router.post('/password', customerController.setPassword);

router.post('/auth/refresh', validateBody([{ field: 'refreshToken', required: true }]), 
  (req: Request, res: Response) => customerController.refreshToken(req, res));

// =====================================================
// 🔹 STAFF AUTHENTICATED ROUTES (authMiddleware for staff)
// =====================================================
router.use(authMiddleware);

// Staff routes - these are for RM/Admin to manage customers
router.post(
  '/',
  roleMiddleware([ROLES.RELATIONSHIP_MANAGER]),
  customerController.createCustomer
);

// All authenticated staff users can view
router.get('/', customerController.getCustomers);

// Staff routes for customer management
router.get('/basic', customerController.getAllCustomersBasic);
router.get('/:id', customerController.getCustomerById);

router.put(
  '/:id',
  roleMiddleware([ROLES.RELATIONSHIP_MANAGER]),
  customerController.updateCustomer
);

router.post(
  '/:id/submit',
  roleMiddleware([ROLES.RELATIONSHIP_MANAGER]),
  customerController.submitCase
);

// LAN retrieval from LMS (staff accessible)
router.get('/lan', customerController.getLan);
router.get('/invoice-details', customerController.getInvoiceDetailsByLender);

// =====================================================
// 🔹 CUSTOMER AUTHENTICATED ROUTES (customerAuthMiddleware for customers only)
// =====================================================
// These routes are customers accessing for end their own data

router.post('/auth/logout', (req: Request, res: Response) => customerController.logout(req, res));

router.get('/:id/customerDetails', (req: Request, res: Response) => customerController.getCustomerDetails(req, res));

router.get('/dashboard', (req: Request, res: Response) => customerController.getDashboard(req, res));

// Drawdown routes
router.get('/drawdown/list', sanitizeQueryParams, (req: Request, res: Response) => customerController.getDrawdownList(req, res));
router.post('/drawdown', validateBody([{ field: 'requestedAmount', required: true, type: 'number', min: 1 }]),
  (req: Request, res: Response) => customerController.createDrawdown(req, res));

// Loan routes
router.get('/loans', (req: Request, res: Response) => customerController.getLoanList(req, res));
router.get('/loans/detail', (req: Request, res: Response) => customerController.getLoanDetails(req, res));
router.get('/loans/schedule', (req: Request, res: Response) => customerController.getLoanSchedule(req, res));
router.get('/loans/statement', (req: Request, res: Response) => customerController.getLoanStatement(req, res));
router.get('/loans/foreclosure-preview', (req: Request, res: Response) => customerController.getForeclosurePreview(req, res));

// Transaction routes
router.get('/transactions/getRepayments', (req: Request, res: Response) => customerController.getTransactionsByLan(req, res));
router.get('/transaction-detail', (req: Request, res: Response) => customerController.getTransactionDetail(req, res));
router.get('/transactions/:id/receipt', (req: Request, res: Response) => customerController.getTransactionReceipt(req, res));

// Notification routes
router.get('/notifications', (req: Request, res: Response) => customerController.getNotificationList(req, res));
router.put('/notifications/:id/read', (req: Request, res: Response) => customerController.markNotificationAsRead(req, res));
router.put('/notifications/read-all', (req: Request, res: Response) => customerController.markAllNotificationsAsRead(req, res));

// Profile routes
router.get('/profile/bank-details', (req: Request, res: Response) => customerController.getBankDetails(req, res));

export default router;
