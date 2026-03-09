import { Router, Request, Response } from 'express';
import { CustomerController } from '../controllers/customer.controller';
import { customerAuthMiddleware } from '../middlewares/customerAuth';
import { validateBody, sanitizeQueryParams } from '../middlewares/validation.middleware';

const router = Router();
const customerController = new CustomerController();

// =====================================================
// 🔹 CUSTOMER APK ROUTES
// All routes use customerAuthMiddleware (Customer JWT token)
// =====================================================

// Apply customerAuthMiddleware to all routes in this router
// =====================================================
// 🔹 PUBLIC CUSTOMER AUTH ROUTES (no authentication required)
// =====================================================

router.post('/login', customerController.loginWithPassword);


router.post('/login/otp', customerController.requestLoginOtp);

router.post('/login/otp/verify', customerController.verifyLoginOtp);

router.post('/password', customerController.setPassword);

router.post('/auth/refresh', validateBody([{ field: 'refreshToken', required: true }]), 
  (req: Request, res: Response) => customerController.refreshToken(req, res));

router.use(customerAuthMiddleware);
router.post('/auth/logout', (req: Request, res: Response) => customerController.logout(req, res));
router.get('/dashboard', (req: Request, res: Response) => customerController.getDashboard(req, res));
router.get('/basic', customerController.getAllCustomersBasic);
router.get('/drawdown/list', sanitizeQueryParams, (req: Request, res: Response) => customerController.getDrawdownList(req, res));
router.post('/drawdown', validateBody([{ field: 'requestedAmount', required: true, type: 'number', min: 1 }]),
  (req: Request, res: Response) => customerController.createDrawdown(req, res));
router.get('/loans', (req: Request, res: Response) => customerController.getLoanList(req, res));
router.get('/loans/detail', (req: Request, res: Response) => customerController.getLoanDetails(req, res));
router.get('/loans/schedule', (req: Request, res: Response) => customerController.getLoanSchedule(req, res));
router.get('/loans/statement', (req: Request, res: Response) => customerController.getLoanStatement(req, res));
router.get('/loans/foreclosure-preview', (req: Request, res: Response) => customerController.getForeclosurePreview(req, res));

router.get('/lan', customerController.getLan);
router.get('/invoice-details', customerController.getInvoiceDetailsByLender);

router.get('/transactions/getRepayments', (req: Request, res: Response) => customerController.getTransactionsByLan(req, res));
router.get('/transaction-detail', (req: Request, res: Response) => customerController.getTransactionDetail(req, res));

router.get('/notifications', (req: Request, res: Response) => customerController.getNotificationList(req, res));
router.put('/notifications/:id/read', (req: Request, res: Response) => customerController.markNotificationAsRead(req, res));
router.put('/notifications/read-all', (req: Request, res: Response) => customerController.markAllNotificationsAsRead(req, res));

router.get('/profile/bank-details', (req: Request, res: Response) => customerController.getBankDetails(req, res));

// =====================================================
// 🔹 ROUTES WITH :id PARAM (must be after specific routes)
// =====================================================

router.get('/:id/customerDetails', (req: Request, res: Response) => customerController.getCustomerDetails(req, res));
router.get('/transactions/:id/receipt', (req: Request, res: Response) => customerController.getTransactionReceipt(req, res));

export default router;
