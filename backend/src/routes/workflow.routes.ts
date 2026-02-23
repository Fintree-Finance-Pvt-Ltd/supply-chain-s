import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { CustomerOnboardingService } from '../services/customer-onboarding.service';
import { SupplierOnboardingService } from '../services/supplier-onboarding.service';
import { InvoiceDiscountingService } from '../services/invoice-discounting.service';
import { DocumentService } from '../services/document.service';

const router = Router();

// Apply auth middleware to all workflow routes
router.use(authMiddleware);

// Initialize services
const customerOnboardingService = new CustomerOnboardingService();
const supplierOnboardingService = new SupplierOnboardingService();
const invoiceDiscountingService = new InvoiceDiscountingService();

/**
 * Role-based access control middleware
 */
const checkRole = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user || !user.roles || user.roles.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'User does not have any roles assigned',
      });
    }

    const userRoles = user.roles.map((r: any) => r.name);
    const hasRole = allowedRoles.some((role) => userRoles.includes(role));

    if (!hasRole) {
      return res.status(403).json({
        success: false,
        message: `User must have one of these roles: ${allowedRoles.join(', ')}`,
      });
    }

    next();
  };
};

// ==================== CUSTOMER ONBOARDING ROUTES ====================

/**
 * POST /api/workflows/customers/create
 * RM creates a new customer for onboarding
 */
router.post('/customers/create', checkRole(['relationship_manager']), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const customerData = req.body;

    // Support both 'name' and 'customerName' from different frontend versions
    const name = customerData.name || customerData.customerName;

    if (!name || !customerData.email) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: name and email are mandatory',
      });
    }

    const result = await customerOnboardingService.createCustomer(customerData, user.id);

    res.status(201).json({
      success: true,
      message: 'Customer created successfully',
      data: result.customer,
      workflow: result.workflow,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * POST /api/workflows/customers/:customerId/submit
 * RM submits customer for credit team review
 */
router.post('/customers/:customerId/submit', checkRole(['relationship_manager']), async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { remarks, pushedTo } = req.body;
    const user = (req as any).user;

    const workflow = await customerOnboardingService.submitCustomer(
      parseInt(customerId),
      user.id,
      remarks || '',
      pushedTo,
    );

    res.json({
      success: true,
      message: 'Customer submitted for credit team approval',
      data: workflow,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * PATCH /api/workflows/customers/:customerId/bank-details
 * RM updates bank details and e-nach/esign status
 */
router.patch('/customers/:customerId/bank-details', checkRole(['relationship_manager']), async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const data = req.body;

    const customer = await customerOnboardingService.updateBankDetails(
      parseInt(customerId),
      data
    );

    res.json({
      success: true,
      message: 'Bank details updated successfully',
      data: customer,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * POST /api/workflows/customers/:customerId/credit-l1
 * Credit Team L1 reviews and approves/rejects
 */
router.post('/customers/:customerId/credit-l1', checkRole(['credit_team_l1']), async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { approved, remarks, sanctionAmount, tenure, interestRate, conditions, penalCharges, processingFees } = req.body;
    const user = (req as any).user;

    const sanctionData = sanctionAmount ? { sanctionAmount, tenure, interestRate, conditions, penalCharges, processingFees } : undefined;

    const workflow = await customerOnboardingService.creditL1Approve(
      parseInt(customerId),
      user.id,
      remarks || '',
      approved,
      sanctionData
    );

    res.json({
      success: true,
      message: approved ? 'Customer approved by Credit L1' : 'Customer rejected by Credit L1',
      data: workflow,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * POST /api/workflows/customers/:customerId/credit-l2
 * Credit Team L2 reviews and approves/rejects (generates LAN ID if approved)
 */
router.post('/customers/:customerId/credit-l2', checkRole(['credit_team_l2']), async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { approved, remarks, sanctionAmount, tenure, interestRate, conditions, penalCharges, processingFees } = req.body;
    const user = (req as any).user;

    const sanctionData = sanctionAmount ? { sanctionAmount, tenure, interestRate, conditions, penalCharges, processingFees } : undefined;

    const workflow = await customerOnboardingService.creditL2Approve(
      parseInt(customerId),
      user.id,
      remarks || '',
      approved,
      sanctionData
    );

    res.json({
      success: true,
      message: approved ? 'Customer approved by Credit L2' : 'Customer rejected by Credit L2',
      data: workflow,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * POST /api/workflows/customers/:customerId/ceo-approve
 * CEO reviews and approves/rejects
 */
router.post('/customers/:customerId/ceo-approve', checkRole(['ceo']), async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { approved, remarks, sanctionAmount, tenure, interestRate, conditions, penalCharges, processingFees } = req.body;
    const user = (req as any).user;

    const sanctionData = sanctionAmount ? { sanctionAmount, tenure, interestRate, conditions, penalCharges, processingFees } : undefined;

    const workflow = await customerOnboardingService.ceoApprove(
      parseInt(customerId),
      user.id,
      remarks || '',
      approved,
      sanctionData
    );

    res.json({
      success: true,
      message: approved ? 'Customer approved by CEO' : 'Customer rejected by CEO',
      data: workflow,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * POST /api/workflows/customers/:customerId/rm-submit-md
 * RM submits final terms to MD after CEO approval
 */
router.post('/customers/:customerId/rm-submit-md', checkRole(['relationship_manager']), async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { remarks, sanctionAmount, tenure, interestRate, conditions, penalCharges, processingFees } = req.body;
    const user = (req as any).user;

    const sanctionData = sanctionAmount ? { sanctionAmount, tenure, interestRate, conditions, penalCharges, processingFees } : undefined;

    const workflow = await customerOnboardingService.rmSubmitToMD(
      parseInt(customerId),
      user.id,
      remarks || '',
      sanctionData
    );

    res.json({
      success: true,
      message: 'Case submitted to MD with final sanction terms',
      data: workflow,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * POST /api/workflows/customers/:customerId/md-approve
 * MD reviews and approves/rejects (final credit decision)
 */
router.post('/customers/:customerId/md-approve', checkRole(['md']), async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { approved, remarks, sanctionAmount, tenure, interestRate, conditions, penalCharges, processingFees } = req.body;
    const user = (req as any).user;

    const sanctionData = sanctionAmount ? { sanctionAmount, tenure, interestRate, conditions, penalCharges, processingFees } : undefined;

    const workflow = await customerOnboardingService.mdApprove(
      parseInt(customerId),
      user.id,
      remarks || '',
      approved,
      sanctionData
    );

    res.json({
      success: true,
      message: approved ? 'Customer approved by MD' : 'Customer rejected by MD',
      data: workflow,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * POST /api/workflows/customers/:customerId/ops-submit
 * RM resubmits customer to operations team after MD approval
 */
router.post('/customers/:customerId/ops-submit', checkRole(['relationship_manager']), async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { remarks } = req.body;
    const user = (req as any).user;

    const workflow = await customerOnboardingService.submitForOperationsApproval(
      parseInt(customerId),
      user.id,
      remarks || '',
    );

    res.json({
      success: true,
      message: 'Customer submitted to operations team',
      data: workflow,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * POST /api/workflows/documents/:documentId/verify
 * Verify an individual document (remarks + status)
 */
router.post('/documents/:documentId/verify', checkRole(['relationship_manager', 'credit_team_l1', 'credit_team_l2', 'operations_team_l1', 'operations_head']), async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params;
    const { remarks, status } = req.body;
    const user = (req as any).user;

    const document = await new DocumentService().verifyDocument(
      parseInt(documentId),
      user.id,
      remarks,
      status
    );

    res.json({
      success: true,
      data: document,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * PATCH /api/workflows/documents/:documentId
 * Update document metadata (type, remarks, etc.)
 */
router.patch('/documents/:documentId', checkRole(['relationship_manager', 'credit_team_l1', 'credit_team_l2', 'operations_team_l1', 'operations_head']), async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params;
    const data = req.body;

    const documentService = new DocumentService();
    const document = await documentService.updateMetadata(parseInt(documentId), data);

    res.json({
      success: true,
      message: 'Document updated successfully',
      data: document,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * POST /api/workflows/customers/:customerId/ops-l1
 * Operations L1 verifies customer documentation
 */
router.post('/customers/:customerId/ops-l1', checkRole(['operations_team_l1']), async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { approved, remarks } = req.body;
    const user = (req as any).user;

    const workflow = await customerOnboardingService.opsL1Approve(
      parseInt(customerId),
      user.id,
      remarks || '',
      approved,
    );

    res.json({
      success: true,
      message: approved ? 'Customer verified by Operations L1' : 'Customer rejected by Operations L1',
      data: workflow,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * POST /api/workflows/customers/:customerId/ops-head
 * Operations Head finalizes and completes customer onboarding
 */
router.post('/customers/:customerId/ops-head', checkRole(['operations_head']), async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { remarks } = req.body;
    const user = (req as any).user;

    const workflow = await customerOnboardingService.opsHeadApprove(
      parseInt(customerId),
      user.id,
      remarks || '',
    );

    res.json({
      success: true,
      message: 'Customer onboarding completed by Operations Head',
      data: workflow,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * GET /api/workflows/customers/dashboard/rm
 * RM Dashboard - Get all customers for RM
 */
router.get('/customers/dashboard/rm', checkRole(['relationship_manager']), async (req: Request, res: Response) => {
  try {
    const dashboard = await customerOnboardingService.getRMDashboard((req as any).user?.id);

    res.json({
      success: true,
      data: dashboard,
    });
  } catch (error: any) {
    res.status(404).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * GET /api/workflows/customers/dashboard/credit/:level
 * Credit Team Dashboard
 */
router.get('/customers/dashboard/credit/:level', checkRole(['credit_team_l1', 'credit_team_l2']), async (req: Request, res: Response) => {
  try {
    const { level } = req.params;
    const roleParam = level === '1' ? 'CREDIT_TEAM_L1' : 'CREDIT_TEAM_L2';
    const dashboard = await customerOnboardingService.getCreditTeamPending(roleParam, (req as any).user?.id);

    res.json({
      success: true,
      data: dashboard,
    });
  } catch (error: any) {
    res.status(404).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * GET /api/workflows/customers/dashboard/executive
 * Executive Dashboard
 */
router.get('/customers/dashboard/executive', checkRole(['ceo', 'md']), async (req: Request, res: Response) => {
  try {
    const userRole = req.userRole || 'ceo';
    const dashboard = await customerOnboardingService.getExecutivePending(userRole, (req as any).user?.id);

    res.json({
      success: true,
      data: dashboard,
    });
  } catch (error: any) {
    res.status(404).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * GET /api/workflows/customers/dashboard/operations
 * Operations Dashboard
 */
router.get('/customers/dashboard/operations', checkRole(['operations_team_l1', 'operations_team_l2', 'operations_head']), async (req: Request, res: Response) => {
  try {
    const userRole = req.userRole || 'operations_team_l1';
    const dashboard = await customerOnboardingService.getOperationsPending(userRole, (req as any).user?.id);

    res.json({
      success: true,
      data: dashboard,
    });
  } catch (error: any) {
    res.status(404).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * GET /api/workflows/customers/sanctioned
 * Get customers who are sanctioned/approved and eligible for supplier onboarding
 */
router.get('/customers/sanctioned', async (req: Request, res: Response) => {
  try {
    const customers = await supplierOnboardingService.getSanctionedCustomers();
    res.json({
      success: true,
      data: customers,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ==================== SUPPLIER ONBOARDING ROUTES ====================

/**
 * POST /api/workflows/suppliers/create
 * Operations L1 creates and onboards a new supplier
 */
router.post('/suppliers/create', checkRole(['operations_team_l1', 'relationship_manager']), async (req: Request, res: Response) => {
  try {
    const {
      customerId,
      supplierName,
      supplierCode,
      email,
      mobileNumber,
      contactNumber,
      address,
      gstNumber,
      panNumber,
      bankAccountNumber,
      ifscCode,
      bankName,
      accountHolderName,
      cancelledChequeUrl
    } = req.body;
    const user = (req as any).user;

    if (!customerId || !supplierName) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: customerId and supplierName are mandatory',
      });
    }

    const result = await supplierOnboardingService.createSupplier(
      {
        customerId,
        supplierName,
        supplierCode: supplierCode || `SUP-${Date.now()}`,
        email,
        mobileNumber: mobileNumber || contactNumber,
        address,
        gstNumber,
        panNumber,
        bankAccountNumber,
        ifscCode,
        bankName,
        accountHolderName,
        cancelledChequeUrl
      },
      user.id,
    );

    res.status(201).json({
      success: true,
      message: 'Supplier onboarded successfully and moved to Operations Head',
      data: result.supplier,
      workflow: result.workflow
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * POST /api/workflows/suppliers/:supplierId/submit
 * RM submits supplier for operations review
 */
router.post('/suppliers/:supplierId/submit', checkRole(['relationship_manager']), async (req: Request, res: Response) => {
  try {
    const { supplierId } = req.params;
    const { remarks } = req.body;
    const user = (req as any).user;

    const workflow = await supplierOnboardingService.submitSupplier(
      parseInt(supplierId),
      user.id,
      remarks || '',
    );

    res.json({
      success: true,
      message: 'Supplier submitted for operations approval',
      data: workflow,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * POST /api/workflows/suppliers/:supplierId/ops-l1
 * Operations L1 reviews and approves/rejects supplier
 */
router.post('/suppliers/:supplierId/ops-l1', checkRole(['operations_team_l1']), async (req: Request, res: Response) => {
  try {
    const { supplierId } = req.params;
    const { approved, remarks } = req.body;
    const user = (req as any).user;

    const workflow = await supplierOnboardingService.opsL1Approve(
      parseInt(supplierId),
      user.id,
      remarks || '',
      approved,
    );

    res.json({
      success: true,
      message: approved ? 'Supplier approved by Operations L1' : 'Supplier rejected by Operations L1',
      data: workflow,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * POST /api/workflows/suppliers/:supplierId/ops-head
 * Operations Head finalizes (approve or reject) supplier onboarding
 */
router.post('/suppliers/:supplierId/ops-head', checkRole(['operations_head']), async (req: Request, res: Response) => {
  try {
    const { supplierId } = req.params;
    const { remarks, approved } = req.body;
    const user = (req as any).user;

    let workflow;
    if (approved !== false) {
      workflow = await supplierOnboardingService.opsHeadApprove(parseInt(supplierId), user.id, remarks || '');
      return res.json({ success: true, message: 'Supplier successfully onboarded!', data: workflow });
    } else {
      workflow = await supplierOnboardingService.opsHeadReject(parseInt(supplierId), user.id, remarks || '');
      return res.json({ success: true, message: 'Supplier rejected by Operations Head', data: workflow });
    }
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/workflows/suppliers/dashboard/rm
 * RM Dashboard - Get all suppliers
 */
router.get('/suppliers/dashboard/rm', checkRole(['relationship_manager']), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const dashboard = await supplierOnboardingService.getRMSupplierDashboard(user.id);

    res.json({
      success: true,
      data: dashboard,
    });
  } catch (error: any) {
    res.status(404).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * GET /api/workflows/suppliers/dashboard/operations
 * Operations Dashboard
 */
router.get('/suppliers/dashboard/operations', checkRole(['operations_team_l1', 'operations_head']), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userRole = user.roles?.[0]?.name || 'OPERATIONS_L1';
    const dashboard = await supplierOnboardingService.getOperationsPending(userRole);

    res.json({
      success: true,
      data: dashboard,
    });
  } catch (error: any) {
    res.status(404).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * GET /api/workflows/suppliers/customer/:customerId/all
 * Get suppliers for a specific customer LAN
 */
router.get('/suppliers/customer/:customerId/all', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const suppliers = await supplierOnboardingService.getSuppliersByCustomerLan(parseInt(customerId));

    res.json({
      success: true,
      data: suppliers,
    });
  } catch (error: any) {
    res.status(404).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * GET /api/workflows/suppliers/:supplierId
 * Get a single supplier by ID
 */
router.get('/suppliers/:supplierId', checkRole(['operations_team_l1', 'operations_head']), async (req: Request, res: Response) => {
  try {
    const { supplierId } = req.params;
    const supplier = await supplierOnboardingService.getSupplierById(parseInt(supplierId));
    if (!supplier) {
      return res.status(404).json({ success: false, message: 'Supplier not found' });
    }
    res.json({ success: true, data: supplier });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/workflows/suppliers/customer/:customerId/approved
 * Get only approved suppliers for a specific customer LAN
 */
router.get('/suppliers/customer/:customerId/approved', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const suppliers = await supplierOnboardingService.getApprovedSuppliersByCustomerLan(parseInt(customerId));

    res.json({
      success: true,
      data: suppliers,
    });
  } catch (error: any) {
    res.status(404).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * GET /api/workflows/suppliers/customer/:customerId/check-limit
 * Check if more suppliers can be added to a customer's LAN
 */
router.get('/suppliers/customer/:customerId/check-limit', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const canAdd = await supplierOnboardingService.canAddMoreSuppliers(parseInt(customerId));
    const currentCount = (await supplierOnboardingService.getSupplierCountForLan(parseInt(customerId))) || 0;

    res.json({
      success: true,
      data: {
        canAdd,
        currentCount,
        maxLimit: 20,
        minLimit: 10,
      },
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

// ==================== INVOICE DISCOUNTING ROUTES ====================

/**
 * POST /api/workflows/invoices/create
 * RM creates a new invoice for discounting
 */
router.post('/invoices/create', checkRole(['relationship_manager']), async (req: Request, res: Response) => {
  try {
    const {
      customerId,
      supplierId,
      invoiceNumber,
      invoiceAmount,
      invoiceDate,
      dueDate,
    } = req.body;
    const user = (req as any).user;

    if (!customerId || !supplierId || !invoiceNumber || !invoiceAmount) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
      });
    }

    const invoice = await invoiceDiscountingService.createInvoice(
      {
        customerId,
        supplierId,
        invoiceNumber,
        invoiceAmount,
        invoiceDate,
        dueDate,
      },
      user.id,
    );

    res.status(201).json({
      success: true,
      message: 'Invoice created successfully',
      data: invoice,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * POST /api/workflows/invoices/:invoiceId/submit
 * RM submits invoice for operations review
 */
router.post('/invoices/:invoiceId/submit', checkRole(['relationship_manager']), async (req: Request, res: Response) => {
  try {
    const { invoiceId } = req.params;
    const { remarks } = req.body;
    const user = (req as any).user;

    const workflow = await invoiceDiscountingService.submitInvoice(
      parseInt(invoiceId),
      user.id,
      remarks || '',
    );

    res.json({
      success: true,
      message: 'Invoice submitted for operations review',
      data: workflow,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * POST /api/workflows/invoices/:invoiceId/ops-l1
 * Operations L1 performs initial verification
 */
router.post('/invoices/:invoiceId/ops-l1', checkRole(['operations_team_l1']), async (req: Request, res: Response) => {
  try {
    const { invoiceId } = req.params;
    const { approved, remarks } = req.body;
    const user = (req as any).user;

    const workflow = await invoiceDiscountingService.opsL1Verify(
      parseInt(invoiceId),
      user.id,
      remarks || '',
      approved,
    );

    res.json({
      success: true,
      message: approved ? 'Invoice verified by Operations L1' : 'Invoice rejected by Operations L1',
      data: workflow,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * POST /api/workflows/invoices/:invoiceId/ops-l2
 * Operations L2 performs validation
 */
router.post('/invoices/:invoiceId/ops-l2', checkRole(['operations_team_l2']), async (req: Request, res: Response) => {
  try {
    const { invoiceId } = req.params;
    const { approved, remarks } = req.body;
    const user = (req as any).user;

    const workflow = await invoiceDiscountingService.opsL2Validate(
      parseInt(invoiceId),
      user.id,
      remarks || '',
      approved,
    );

    res.json({
      success: true,
      message: approved ? 'Invoice validated by Operations L2' : 'Invoice rejected by Operations L2',
      data: workflow,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * POST /api/workflows/invoices/:invoiceId/ops-head
 * Operations Head approves for financial review
 */
router.post('/invoices/:invoiceId/ops-head', checkRole(['operations_head']), async (req: Request, res: Response) => {
  try {
    const { invoiceId } = req.params;
    const { remarks } = req.body;
    const user = (req as any).user;

    const workflow = await invoiceDiscountingService.opsHeadApprove(
      parseInt(invoiceId),
      user.id,
      remarks || '',
    );

    res.json({
      success: true,
      message: 'Invoice approved by Operations Head',
      data: workflow,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * POST /api/workflows/invoices/:invoiceId/ceo
 * CEO reviews and approves
 */
router.post('/invoices/:invoiceId/ceo', checkRole(['ceo']), async (req: Request, res: Response) => {
  try {
    const { invoiceId } = req.params;
    const { approved, remarks } = req.body;
    const user = (req as any).user;

    const workflow = await invoiceDiscountingService.ceoReview(
      parseInt(invoiceId),
      user.id,
      remarks || '',
      approved,
    );

    res.json({
      success: true,
      message: approved ? 'Invoice approved by CEO' : 'Invoice rejected by CEO',
      data: workflow,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * POST /api/workflows/invoices/:invoiceId/md-disburse
 * MD performs final approval and disburses amount
 */
router.post('/invoices/:invoiceId/md-disburse', checkRole(['md']), async (req: Request, res: Response) => {
  try {
    const { invoiceId } = req.params;
    const { approved, disbursedAmount, remarks } = req.body;
    const user = (req as any).user;

    if (!disbursedAmount || disbursedAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid disbursed amount is required',
      });
    }

    const workflow = await invoiceDiscountingService.mdFinalApprove(
      parseInt(invoiceId),
      user.id,
      remarks || '',
      approved,
      disbursedAmount,
    );

    res.json({
      success: true,
      message: approved ? 'Invoice disbursed by MD' : 'Invoice rejected by MD',
      data: workflow,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * GET /api/workflows/invoices/dashboard/rm
 * RM Dashboard
 */
router.get('/invoices/dashboard/rm', checkRole(['RM']), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const dashboard = await invoiceDiscountingService.getRMInvoiceDashboard(user.id);

    res.json({
      success: true,
      data: dashboard,
    });
  } catch (error: any) {
    res.status(404).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * GET /api/workflows/invoices/dashboard/operations
 * Operations Dashboard
 */
router.get('/invoices/dashboard/operations', checkRole(['OPERATIONS_L1', 'OPERATIONS_L2', 'OPERATIONS_HEAD']), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userRole = user.roles?.[0]?.name || 'OPERATIONS_L1';
    const invoices = await invoiceDiscountingService.getPendingInvoices(userRole);

    res.json({
      success: true,
      data: invoices,
    });
  } catch (error: any) {
    res.status(404).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * GET /api/workflows/invoices/dashboard/executive
 * Executive Dashboard
 */
router.get('/invoices/dashboard/executive', checkRole(['CEO', 'MD']), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userRole = user.roles?.[0]?.name || 'CEO';
    const invoices = await invoiceDiscountingService.getPendingInvoices(userRole);

    res.json({
      success: true,
      data: invoices,
    });
  } catch (error: any) {
    res.status(404).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * GET /api/workflows/invoices/:invoiceId/details
 * Get invoice details with relationships
 */
router.get('/invoices/:invoiceId/details', async (req: Request, res: Response) => {
  try {
    const { invoiceId } = req.params;
    const invoice = await invoiceDiscountingService.getInvoiceDetails(parseInt(invoiceId));

    res.json({
      success: true,
      data: invoice,
    });
  } catch (error: any) {
    res.status(404).json({
      success: false,
      message: error.message,
    });
  }
});

export default router;
