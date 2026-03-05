import { Router, Request, Response } from 'express';
import { CustomerController } from '../controllers/customer.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { roleMiddleware } from '../middlewares/role.middleware';
import { validateBody, sanitizeQueryParams } from '../middlewares/validation.middleware';
import { ROLES } from '../config/constants';

const router = Router();
const customerController = new CustomerController();

// =====================================================
// 🔹 PUBLIC CUSTOMER AUTH ROUTES (no authentication required)
// =====================================================

/**
 * POST /api/customers/login
 * Login with password
 */
router.post('/login', customerController.loginWithPassword);

/**
 * POST /api/customers/login/otp
 * Request login OTP
 */
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

/**
 * POST /api/customers/auth/refresh
 * Refresh customer access token
 */
router.post('/auth/refresh', validateBody([{ field: 'refreshToken', required: true }]), 
  (req: Request, res: Response) => customerController.refreshToken(req, res));

// =====================================================
// 🔹 RM / ADMIN CUSTOMER MANAGEMENT ROUTES
// All routes use authMiddleware (RM/Admin JWT token)
// =====================================================

// Apply authMiddleware to all routes below
router.use(authMiddleware);

/**
 * GET /api/customers
 * Get all customers
 */
router.get('/', customerController.getCustomers);

/**
 * GET /api/customers/basic
 * Get all customers with basic info
 */

/**
 * GET /api/customers/:id
 * Get single customer by ID
 */
router.get('/:id', customerController.getCustomerById);

/**
 * PUT /api/customers/:id
 * Update customer (RM only)
 */
router.put(
  '/:id',
  roleMiddleware([ROLES.RELATIONSHIP_MANAGER, ROLES.ADMIN]),
  customerController.updateCustomer
);

/**
 * POST /api/customers/:id/submit
 * Submit customer case (RM only)
 */
router.post(
  '/:id/submit',
  roleMiddleware([ROLES.RELATIONSHIP_MANAGER, ROLES.ADMIN]),
  customerController.submitCase
);

/**
 * POST /api/customers
 * Create a new customer (RM only)
 */
router.post(
  '/',
  roleMiddleware([ROLES.RELATIONSHIP_MANAGER, ROLES.ADMIN]),
  customerController.createCustomer
);

export default router;
