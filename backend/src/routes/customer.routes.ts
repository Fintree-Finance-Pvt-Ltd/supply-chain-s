import { Router, Request, Response } from 'express';
import { CustomerController } from '../controllers/customer.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { roleMiddleware } from '../middlewares/role.middleware';
import { customerAuthMiddleware } from '../middlewares/customerAuth';
import { validateBody, sanitizeQueryParams } from '../middlewares/validation.middleware';
import { ROLES } from '../config/constants';

const router = Router();
const customerController = new CustomerController();
router.post('/login', customerController.loginWithPassword);
router.post('/login/otp', customerController.requestLoginOtp);

/**
 * POST /api/customers/login/otp/verify
 * Verify OTP and login
 */
router.post('/login/otp/verify', customerController.verifyLoginOtp);

/**
 * POST /api/customers/password
 * Set or update customer password
 */
router.post('/password', customerController.setPassword);

router.post('/auth/refresh', validateBody([{ field: 'refreshToken', required: true }]), 
  (req: Request, res: Response) => customerController.refreshToken(req, res));
router.use(authMiddleware);

// =====================================================
// 🔹 CUSTOMER LOGIN ROUTES (Public - no auth required)
// =====================================================

/**
 * POST /api/customers/login
 * Login with mobile number and password
 */

/**
 * POST /api/customers/login/otp
 * Request OTP for login
 */


// =====================================================
// 🔹 AUTH ROUTES (Public - refresh token)
// =====================================================

/**
 * POST /api/auth/refresh
 * Refresh access token
 */


// =====================================================
// 🔹 PROTECTED ROUTES (Authentication required)
// =====================================================

// Apply customer auth middleware to all routes below
router.use(customerAuthMiddleware);

/**
 * POST /api/auth/logout
 * Logout customer
 */
router.post('/auth/logout', (req: Request, res: Response) => customerController.logout(req, res));

/**
 * GET /api/customers/:id/customerDetails
 * Get customer details by ID (protected)
 */
router.get('/:id/customerDetails', (req: Request, res: Response) => customerController.getCustomerDetails(req, res));

/**
 * GET /api/dashboard
 * Get customer dashboard data
 */
router.get('/dashboard', (req: Request, res: Response) => customerController.getDashboard(req, res));

// =====================================================
// 🔹 DRAWDOWN ROUTES
// =====================================================

/**
 * GET /api/drawdown/list
 * Get drawdown list with pagination
 */
router.get('/drawdown/list', sanitizeQueryParams, (req: Request, res: Response) => customerController.getDrawdownList(req, res));

/**
 * POST /api/drawdown
 * Create new drawdown request
 */
router.post('/drawdown', validateBody([{ field: 'requestedAmount', required: true, type: 'number', min: 1 }]),
  (req: Request, res: Response) => customerController.createDrawdown(req, res));

// =====================================================
// 🔹 LOAN ROUTES
// =====================================================

/**
 * GET /api/loans
 * Get loan list with pagination
 */
router.get('/loans', (req: Request, res: Response) => customerController.getLoanList(req, res));

/**
 * GET /api/loans/detail
 * Get loan details by ID
 */
router.get('/loans/detail', (req: Request, res: Response) => customerController.getLoanDetails(req, res));

/**
 * GET /api/loans/schedule
 * Get loan schedule by ID
 */
router.get('/loans/schedule', (req: Request, res: Response) => customerController.getLoanSchedule(req, res));

/**
 * GET /api/loans/statement
 * Get loan statement/transactions
 */
router.get('/loans/statement', (req: Request, res: Response) => customerController.getLoanStatement(req, res));

/**
 * GET /api/loans/foreclosure-preview
 * Get foreclosure preview
 */
router.get('/loans/foreclosure-preview', (req: Request, res: Response) => customerController.getForeclosurePreview(req, res));

// =====================================================
// 🔹 TRANSACTION ROUTES
// =====================================================

/**
 * GET /api/transactions
 * Get transaction list with pagination
 */
router.get('/transactions', sanitizeQueryParams, (req: Request, res: Response) => customerController.getTransactionList(req, res));

/**
 * GET /api/transactions/:id/receipt
 * Get transaction receipt
 */
router.get('/transactions/:id/receipt', (req: Request, res: Response) => customerController.getTransactionReceipt(req, res));

// =====================================================
// 🔹 NOTIFICATION ROUTES
// =====================================================

/**
 * GET /api/notifications
 * Get notification list
 */
router.get('/notifications', (req: Request, res: Response) => customerController.getNotificationList(req, res));

/**
 * PUT /api/notifications/:id/read
 * Mark notification as read
 */
router.put('/notifications/:id/read', (req: Request, res: Response) => customerController.markNotificationAsRead(req, res));

/**
 * PUT /api/notifications/read-all
 * Mark all notifications as read
 */
router.put('/notifications/read-all', (req: Request, res: Response) => customerController.markAllNotificationsAsRead(req, res));

// =====================================================
// 🔹 PROFILE ROUTES
// =====================================================

/**
 * GET /api/profile/bank-details
 * Get bank details
 */
router.get('/profile/bank-details', (req: Request, res: Response) => customerController.getBankDetails(req, res));

// =====================================================
// 🔹 EXISTING CUSTOMER MANAGEMENT ROUTES (RM/Admin)
// =====================================================

// RM can create and manage customers
router.post(
  '/',
  roleMiddleware([ROLES.RELATIONSHIP_MANAGER]),
  customerController.createCustomer
);

// All authenticated users can view
router.get('/', customerController.getCustomers);

// =====================================================
// 🔹 SIMPLIFIED CUSTOMER BASIC INFO API (must be BEFORE /:id routes)
// =====================================================

/**
 * GET /api/customers/basic
 * Get all customers with basic info
 */
router.get('/basic', customerController.getAllCustomersBasic);

/**
 * GET /api/customers/:id/basic
 * Get single customer basic info by ID
 */
router.get('/:id/customerDetails', customerController.getCustomerBasicById);

// Get single customer by ID (must be AFTER /basic routes)
router.get('/:id', customerController.getCustomerById);

// RM can update
router.put(
  '/:id',
  roleMiddleware([ROLES.RELATIONSHIP_MANAGER]),
  customerController.updateCustomer
);

// RM can submit
router.post(
  '/:id/submit',
  roleMiddleware([ROLES.RELATIONSHIP_MANAGER]),
  customerController.submitCase
);

export default router;
