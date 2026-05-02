import { Router, Request, Response } from 'express';
import { CustomerController } from '../controllers/customer.controller';
import { AddressController } from '../controllers/address.controller';
import { CoApplicantController } from '../controllers/coApplicant.controller';
import { ContactPersonController } from '../controllers/contactPerson.controller';
import { DocumentController } from '../controllers/document.controller';
import { HistoryController } from '../controllers/history.controller';
import { KycController } from '../controllers/kyc.controller';
import { SanctionController } from '../controllers/sanction.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { roleMiddleware } from '../middlewares/role.middleware';
import { validateBody, sanitizeQueryParams } from '../middlewares/validation.middleware';
import { ROLES } from '../config/constants';

const router = Router();
const customerController = new CustomerController();
const addressController = new AddressController();
const coApplicantController = new CoApplicantController();
const contactPersonController = new ContactPersonController();
const documentController = new DocumentController();
const historyController = new HistoryController();
const kycController = new KycController();
const sanctionController = new SanctionController();

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
router.get('/basic', customerController.getAllCustomersBasic);

/**
 * Customer detail relation endpoints.
 * These keep /api/customers/:id small and load each large section on demand.
 */
router.get('/:id/documents', documentController.getDocumentsByCustomer);
router.get('/:id/kyc', kycController.getCustomerKycSummary);
router.get('/:id/coapplicants', coApplicantController.getCoApplicantsByCustomer);
router.get('/:id/addresses', addressController.getAddressesByCustomer);
router.get('/:id/history', historyController.getStatusHistoryByCustomer);
router.get('/:id/sanctions', sanctionController.getSanctionsByCustomer);
router.get('/:id/contact-persons', contactPersonController.getContactPersonsByCustomer);

/**
 * GET /api/customers/:id
 * Get single customer basic info by ID
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
