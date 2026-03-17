import { Router, Request, Response } from 'express';
import { CustomerController } from '../controllers/customer.controller';
import { customerAuthMiddleware } from '../middlewares/customerAuth';
import { validateBody, sanitizeQueryParams } from '../middlewares/validation.middleware';
import { InvoiceDiscountingService } from '../services/invoice-discounting.service';

const router = Router();
const customerController = new CustomerController();
const invoiceDiscountingService = new InvoiceDiscountingService();

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
// 🔹 INVOICE APPROVAL ROUTES (Customer APK)
// These routes are for customers to approve invoices after RM fills them
// =====================================================

/**
 * GET /api/customer-apk/invoices/pending-approval
 * Get invoices pending customer approval
 * Requires customer authentication
 */
router.get('/invoices/pending-approval', async (req: Request, res: Response) => {
  try {
    const customerId = req.partnerLoanId;
    console.log(customerId)
    if (!customerId) {
      res.status(401).json({ success: false, message: 'Customer authentication required' });
      return;
    }
    
    const invoices = await invoiceDiscountingService.getCustomerPendingInvoices(Number(customerId));
    res.json({ success: true, data: invoices });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/customer-apk/invoices/:invoiceId
 * Get invoice details for customer approval
 * Requires customer authentication
 */
router.get('/invoices/:invoiceId', async (req: Request, res: Response) => {
  try {
    const { invoiceId } = req.params;
    const customerId = req.partnerLoanId;
    console.log(customerId, invoiceId)
    if (!customerId) {
      res.status(401).json({ success: false, message: 'Customer authentication required' });
      return;
    }
    
    const invoice = await invoiceDiscountingService.getInvoiceById(parseInt(invoiceId));
    if (!invoice) {
      res.status(404).json({ success: false, message: 'Invoice not found' });
      return;
    }
    
    // Verify the invoice belongs to this customer
    if (invoice.customerId !== Number(customerId)) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }
    
    res.json({ success: true, data: invoice });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/customer-apk/invoices/:invoiceId/approve
 * Customer approves an invoice
 * Requires customer authentication
 */
router.post('/invoices/:invoiceId/approve', async (req: Request, res: Response) => {
  try {
    const { invoiceId } = req.params;
    const { remarks } = req.body;
    const customerId = req.customerId;
    
    if (!customerId) {
      res.status(401).json({ success: false, message: 'Customer authentication required' });
      return;
    }
    
    const result = await invoiceDiscountingService.customerApproval(
      parseInt(invoiceId),
      customerId,
      'approve',
      remarks || ''
    );
    
    res.json({
      success: true,
      message: 'Invoice approved successfully',
      data: result,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/customer-apk/invoices/:invoiceId/reject
 * Customer rejects an invoice
 * Requires customer authentication
 */
router.post('/invoices/:invoiceId/reject', async (req: Request, res: Response) => {
  try {
    const { invoiceId } = req.params;
    const { remarks } = req.body;
    const customerId = req.customerId;
    
    if (!customerId) {
      res.status(401).json({ success: false, message: 'Customer authentication required' });
      return;
    }
    
    if (!remarks) {
      res.status(400).json({ success: false, message: 'Rejection reason is required' });
      return;
    }
    
    const result = await invoiceDiscountingService.customerApproval(
      parseInt(invoiceId),
      customerId,
      'reject',
      remarks
    );
    
    res.json({
      success: true,
      message: 'Invoice rejected successfully',
      data: result,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// =====================================================
// 🔹 ROUTES WITH :id PARAM (must be after specific routes)
// =====================================================

router.get('/:id/customerDetails', (req: Request, res: Response) => customerController.getCustomerDetails(req, res));
router.get('/transactions/:id/receipt', (req: Request, res: Response) => customerController.getTransactionReceipt(req, res));

export default router;
