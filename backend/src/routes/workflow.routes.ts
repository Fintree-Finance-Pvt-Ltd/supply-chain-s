import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { CustomerOnboardingService } from '../services/customer-onboarding.service';
import { SupplierOnboardingService } from '../services/supplier-onboarding.service';
import { InvoiceDiscountingService } from '../services/invoice-discounting.service';
import { DocumentService } from '../services/document.service';
import { AppDataSource } from '../config/database';
import { Partner, PARTNER_STATUS } from '../entities/Partner';
import multer from 'multer';
import path from 'path';
import { CLIENT_RENEG_LIMIT } from 'tls';
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


const supplierUploadStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, path.join(__dirname, '../../uploads')),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});

const supplierUpload = multer({ storage: supplierUploadStorage });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, path.join(__dirname, '../../uploads')),
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
  }),
});


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
router.post('/customers/:customerId/submit', checkRole(['relationship_manager','credit_team_l1']), async (req: Request, res: Response) => {
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
 * POST /api/workflows/customers/:customerId/resend-partner-sanction
 * RM resends an already sanctioned case to new partner sections only.
 * Existing approved partner sanctions remain locked and cannot be resent.
 */
router.post('/customers/:customerId/resend-partner-sanction', checkRole(['relationship_manager']), async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { remarks } = req.body;
    const user = (req as any).user;

    const partnerCodes = Array.isArray(req.body.partnerCodes)
      ? req.body.partnerCodes
      : Array.isArray(req.body.partners)
        ? req.body.partners
        : Array.isArray(req.body.partnerSanctions)
          ? req.body.partnerSanctions.map((ps: any) => ps.partner)
          : [];

    const workflow = await customerOnboardingService.resendToNewPartnerSections(
      parseInt(customerId),
      user.id,
      partnerCodes,
      remarks || '',
    );

    res.json({
      success: true,
      message: 'Case resent to new partner section for fresh sanction',
      data: workflow,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

router.post(
  "/customers/:customerId/return",
  checkRole(["credit_team_l1"]),
  async (req, res) => {
    try {
      const { customerId } = req.params;
      const { remarks } = req.body;
      const user = (req as any).user;

      const workflow =
        await customerOnboardingService.returnToRM(
          Number(customerId),
          user.id,
          remarks
        );

      res.json({
        success: true,
        message: "Case returned to RM successfully",
        data: workflow,
      });

    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }
);

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
 * Now supports multiple partner sanction limits (dynamically loaded from partners table)
 * NOTE: Credit L1/L2 can only edit sanctionAmount.
 * CEO can edit tenure and interestRate.
 * Only MD can edit all fields.
 */
router.post('/customers/:customerId/credit-l1', checkRole(['credit_team_l1', 'credit_team_l2', 'credit_head']), async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { approved, remarks, partnerSanctions } = req.body;
    const user = (req as any).user;
    const userRoles = (user?.roles || []).map((r: any) => r.name.toLowerCase());
    const userRole = userRoles[0]?.toLowerCase() || '';
    
    // Check if user has L1 role - if they have both L1 and L2, they should have L1 access
    // If they only have L2, deny access to L1 approval
    // Credit head can also access L1
    const hasL1Role = userRoles.includes('credit_team_l1') || userRoles.includes('credit_head');
    
    // Allow access if user has L1 role (either alone or with L2 or credit_head)
    if (!hasL1Role) {
      res.status(403).json({
        success: false,
        message: 'You do not have Credit Team L1 role to approve L1 cases',
      });
      return;
    }

    // Check if user is trying to modify sanction data
    const isModifyingSanctions = approved && partnerSanctions && Array.isArray(partnerSanctions) && partnerSanctions.length > 0;
    
    // Credit team can only modify sanctionAmount (not tenure, ROI, etc.)
    // Check if user has L1 role
    if (isModifyingSanctions && userRoles.includes('credit_team_l1')) {
      // Validate that credit team only sends sanctionAmount
      for (const ps of partnerSanctions) {
        if (ps.tenure || ps.interestRate || ps.penalCharges || ps.processingFees || ps.conditions) {
          res.status(403).json({
            success: false,
            message: 'Credit L1 can only modify sanctionAmount. ROI, Tenure, and other terms cannot be edited.',
          });
          return;
        }
      }
    }

    // Validate partnerSanctions if provided
    let sanctionData = undefined;
    if (isModifyingSanctions) {
      // Validate each partner sanction entry
      for (const ps of partnerSanctions) {
        if (!ps.partner || !ps.sanctionAmount) {
          throw new Error('Each partner sanction must have partner and sanctionAmount');
        }
      }
      sanctionData = { partnerSanctions };
    }

    // MAKER-CHECKER VALIDATION: If user has both L1 and L2 roles, they cannot approve their own cases
    // This prevents conflict of interest - a user shouldn't review their own work
    const hasBothRoles = userRoles.includes('credit_team_l1') && userRoles.includes('credit_team_l2');
    if (hasBothRoles && approved) {
      // Check if user already created any sanctions for this customer as L1
      // We'll check the sanction history to see if this user was the creator
      const { CreditSanction } = require('../entities');
      const existingSanctions = await AppDataSource.getRepository(CreditSanction).find({
        where: { customerId: parseInt(customerId) }
      });
      const userAsCreator = existingSanctions.find(s => s.creditOfficerId === user.id);
      if (userAsCreator) {
        res.status(403).json({
          success: false,
          message: 'You have both L1 and L2 roles. You already created sanctions for this case as L1, so you cannot approve it at L1. Please assign this case to another L1 reviewer.',
        });
        return;
      }
    }

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
 * GET /api/workflows/customers/:customerId/sanction-limits
 * Get all sanction limits for a customer (all partner sanctions)
 * Restricted to RM, MD, and CEO roles
 */
router.get('/customers/:customerId/sanction-limits', async (req: Request, res: Response) => {
  try {
    // Check if user has RM, MD, or CEO role
    const user = (req as any).user;
    const userRoles = user.roles.map((r: any) => r.name);
    if (!userRoles.includes('relationship_manager') && !userRoles.includes('md') && !userRoles.includes('ceo')) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to access sanction details',
      });
    }

    const { customerId } = req.params;
    const sanctionLimits = await customerOnboardingService.getSanctionLimitsByCustomerId(
      parseInt(customerId)
    );

    res.json({
      success: true,
      data: sanctionLimits,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * POST /api/workflows/customers/:customerId/credit-l2
 * Credit Team L2 reviews and approves/rejects (generates LAN ID if approved)
 * NOTE: Credit L2 can only edit sanctionAmount for each partner.
 * CEO can edit tenure and interestRate.
 * Only MD can edit all fields.
 */
router.post('/customers/:customerId/credit-l2', checkRole(['credit_team_l1', 'credit_team_l2', 'credit_head']), async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { approved, remarks, partnerSanctions, sanctionAmount, tenure, interestRate, conditions, penalCharges, processingFees } = req.body;
    const user = (req as any).user;
    const userRoles = (user?.roles || []).map((r: any) => r.name.toLowerCase());
    const userRole = userRoles[0]?.toLowerCase() || '';
    
    // Check if user has L2 role - if they have both L1 and L2, they should have L2 access
    // Credit head also has L2 access
    const hasL2Role = userRoles.includes('credit_team_l2') || userRoles.includes('credit_head');
    
    // Allow access if user has L2 role (either alone or with L1 or credit_head)
    if (!hasL2Role) {
      res.status(403).json({
        success: false,
        message: 'You do not have Credit Team L2 role to approve L2 cases',
      });
      return;
    }

    // Check if user is trying to modify sanction data
    const isModifyingSanctions = approved && (sanctionAmount || partnerSanctions);
    
    // Validate that all active partners have sanction amounts when Credit L2 approves
    if (approved && isModifyingSanctions && partnerSanctions && Array.isArray(partnerSanctions)) {
      // Fetch all active partners
      const partnerRepository = AppDataSource.getRepository(Partner);
      const activePartners = await partnerRepository.find({ where: { status: PARTNER_STATUS.ACTIVE } });
      
      // Get the list of partners that have sanction amounts
      const partnersWithSanction = partnerSanctions
        .filter((ps: any) => ps.partner && ps.sanctionAmount && ps.sanctionAmount > 0)
        .map((ps: any) => ps.partner.toUpperCase());
      
      // Check if all active partners have sanction amounts
      // const missingPartners = activePartners.filter(
      //   (p) => !partnersWithSanction.includes(p.code.toUpperCase())
      // );
      
      // if (missingPartners.length > 0) {
      //   res.status(400).json({
      //     success: false,
      //     message: `Please fill sanction amount for all partners. Missing: ${missingPartners.map(p => p.code).join(', ')}`,
      //   });
      //   return;
      // }
    }
    
    // Credit L2 can only modify sanctionAmount (not tenure, ROI, etc.)
    // But can modify sanctionAmount for all partners via partnerSanctions
    // Check if user has L2 role
    if (isModifyingSanctions && userRoles.includes('credit_team_l2')) {
      // If using partnerSanctions format, validate each entry
      if (partnerSanctions && Array.isArray(partnerSanctions)) {
        for (const ps of partnerSanctions) {
          if (ps.tenure || ps.interestRate || ps.penalCharges || ps.processingFees || ps.conditions) {
            res.status(403).json({
              success: false,
              message: 'Credit L2 can only modify sanctionAmount. ROI, Tenure, and other terms cannot be edited.',
            });
            return;
          }
        }
      }
      // If using old format (single sanction), check for forbidden fields
      if (sanctionAmount && (tenure || interestRate || penalCharges || processingFees || conditions)) {
        res.status(403).json({
          success: false,
          message: 'Credit L2 can only modify sanctionAmount. ROI, Tenure, and other terms cannot be edited.',
        });
        return;
      }
    }

    const sanctionData = partnerSanctions ? { partnerSanctions } : (sanctionAmount ? { sanctionAmount, tenure, interestRate, conditions, penalCharges, processingFees } : undefined);

    // MAKER-CHECKER VALIDATION: If user has both L1 and L2 roles, they cannot approve their own L1 approvals
    // This prevents conflict of interest - user who approved at L1 shouldn't approve at L2
    const hasBothRoles = userRoles.includes('credit_team_l1') && userRoles.includes('credit_team_l2');
    if (hasBothRoles && approved) {
      // Check if this user already approved this case at L1
      const { CaseStatusHistory } = require('../entities');
      const historyRepo = AppDataSource.getRepository(CaseStatusHistory);
      const l1Approval = await historyRepo.findOne({
        where: { 
          caseWorkflow: { customerId: parseInt(customerId) },
          status: 'credit_l1_approved'
        },
        relations: ['caseWorkflow', 'changedByUser'],
        order: { createdAt: 'DESC' }
      });
      if (l1Approval && l1Approval.changedByUser?.id === user.id) {
        res.status(403).json({
          success: false,
          message: 'You have both L1 and L2 roles. You already approved this case at L1, so you cannot approve it at L2. Please assign this case to another L2 reviewer.',
        });
        return;
      }
    }

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
 * NOTE: CEO can edit sanctionAmount, tenure and interestRate for all partners.
 * Only MD can edit all fields including penalCharges, processingFees, conditions.
 */
router.post('/customers/:customerId/ceo-approve', checkRole(['ceo']), async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { approved, remarks, partnerSanctions, sanctionAmount, tenure, interestRate, conditions, penalCharges, processingFees } = req.body;
    const user = (req as any).user;
    const userRole = (user?.roles?.[0]?.name || '').toLowerCase();

    // Check if user is trying to modify sanction data
    const isModifyingSanctions = approved && (sanctionAmount || partnerSanctions);
    
    // CEO can ONLY modify sanctionAmount (not tenure, ROI, etc.)
    // These fields should not be sent by frontend for CEO role
    const userRolesForCheck = (user?.roles || []).map((r: any) => r.name.toLowerCase());
    if (isModifyingSanctions && userRolesForCheck.includes('ceo')) {
      // If using old format (single sanction), check for forbidden fields
      if (sanctionAmount && (tenure || interestRate || penalCharges || processingFees || conditions)) {
        res.status(403).json({
          success: false,
          message: 'CEO can only modify sanctionAmount. Tenor, ROI, penal charges, processing fees, and conditions can only be edited by MD.',
        });
        return;
      }
      // If using partnerSanctions format, validate CEO can only edit sanctionAmount
      if (partnerSanctions && Array.isArray(partnerSanctions)) {
        for (const ps of partnerSanctions) {
          if (ps.tenure || ps.interestRate || ps.penalCharges || ps.processingFees || ps.conditions) {
            res.status(403).json({
              success: false,
              message: 'CEO can only modify sanctionAmount for each partner. Tenor, ROI, penal charges, processing fees, and conditions can only be edited by MD.',
            });
            return;
          }
        }
      }
    }

    const sanctionData = partnerSanctions ? { partnerSanctions } : (sanctionAmount ? { sanctionAmount } : undefined);

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
 * Disabled: MD approval is now final and returns the case to RM for operations submission.
 */
router.post('/customers/:customerId/rm-submit-md', checkRole(['relationship_manager']), async (req: Request, res: Response) => {
  res.status(410).json({
    success: false,
    message: 'RM-to-MD final terms submission is disabled. MD approval is final and moves the case to RM for operations submission.',
  });
});

/**
 * POST /api/workflows/customers/:customerId/md-approve
 * MD reviews and approves/rejects (final credit decision)
 * NOTE: MD can edit all sanction fields including sanctionAmount, tenure, ROI, etc.
 */
router.post('/customers/:customerId/md-approve', checkRole(['md']), async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { approved, remarks, sanctionAmount, tenure, interestRate, conditions, penalCharges, processingFees, serviceFee, partnerSanctions } = req.body;
    const user = (req as any).user;

    let sanctionData;
    
    // Support both single sanction and partner-specific sanctions
    if (partnerSanctions && Array.isArray(partnerSanctions) && partnerSanctions.length > 0) {
      // MD is providing partner-specific sanctions
      sanctionData = { partnerSanctions };
    } else if (sanctionAmount) {
      // Legacy single sanction format
      sanctionData = { sanctionAmount, tenure, interestRate, conditions, penalCharges, processingFees, serviceFee };
    }

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
router.post('/documents/:documentId/verify', checkRole(['relationship_manager', 'credit_team_l1', 'credit_team_l2', 'credit_head', 'operations_team_l1', 'operations_head']), async (req: Request, res: Response) => {
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
router.patch('/documents/:documentId', checkRole(['relationship_manager', 'credit_team_l1', 'credit_team_l2', 'credit_head', 'operations_team_l1', 'operations_head']), async (req: Request, res: Response) => {
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
 * FIXED: Allow users with both L1 and L2 roles to access L1 approval
 */
router.post('/customers/:customerId/ops-l1', checkRole(['operations_team_l1', 'operations_team_l2']), async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { approved, remarks } = req.body;
    const user = (req as any).user;
    const userRoles = (user?.roles || []).map((r: any) => r.name.toLowerCase());
    
    // Check if user has L1 role
    const hasL1Role = userRoles.includes('operations_team_l1');
    
    if (!hasL1Role) {
      res.status(403).json({
        success: false,
        message: 'You do not have Operations Team L1 role to approve L1 cases',
      });
      return;
    }

    // MAKER-CHECKER VALIDATION: If user has both L1 and L2 roles, they cannot approve their own cases
    const hasBothRoles = userRoles.includes('operations_team_l1') && userRoles.includes('operations_team_l2');
    if (hasBothRoles && approved) {
      const { OperationsCheck } = require('../entities');
      const existingChecks = await AppDataSource.getRepository(OperationsCheck).find({
        where: { customerId: parseInt(customerId) }
      });
      const userAsCreator = existingChecks.find(c => c.opsUserId === user.id);
      if (userAsCreator) {
        res.status(403).json({
          success: false,
          message: 'You have both L1 and L2 roles. You already performed operations check for this case as L1, so you cannot approve it at L1.',
        });
        return;
      }
    }

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



router.get('/invoices/customers/:customerId/lans/:lanId/rates', async (req, res) => {
  try {
    const { customerId, lanId } = req.params;

    const lans = await invoiceDiscountingService.getLANsByCustomer(parseInt(customerId));
    const loanAccount = lans.find(la => la.id === parseInt(lanId));

    if (!loanAccount) {
      return res.status(404).json({ success: false, message: 'LAN not found' });
    }

    const CreditSanction = AppDataSource.getRepository('CreditSanction');
    const sanction = await CreditSanction.findOne({
      where: {
        customerId: parseInt(customerId),
        partner: loanAccount.lender || loanAccount.partnerId,
        status: 'approved'
      },
      order: { createdAt: 'DESC' }
    });

    // ✅ ADD CACHE DISABLE HEADERS
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.set('Surrogate-Control', 'no-store');

    res.json({
      success: true,
      data: {
        roi: sanction?.interestRate || 0,
        penalCharges: sanction?.penalCharges || 0,
        serviceFee: sanction?.serviceFee || 0,
        sanctionAmount: sanction?.sanctionAmount || 0,
      }
    });

  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
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
 * Modified: Now supports users with both L1 and L2 roles, plus credit_head
 */
router.get('/customers/dashboard/credit/:level', checkRole(['credit_team_l1', 'credit_team_l2', 'credit_head']), async (req: Request, res: Response) => {
  try {
    const { level } = req.params;
    const user = (req as any).user;
    const parsePositiveInt = (value: any, fallback: number) => {
      const rawValue = Array.isArray(value) ? value[0] : value;
      const parsed = Number(rawValue);
      return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
    };
    console.log("level",level)
    // Handle credit_head - can see all cases (no round-robin restriction)
    const userRoles = user?.roles?.map((r: any) => r.name.toLowerCase()) || [];
    if (userRoles.includes('credit_head')) {
      const dashboard = await customerOnboardingService.getCreditHeadPending(user?.id, {
        page: parsePositiveInt(req.query.handledPage ?? req.query.page, 1),
        limit: parsePositiveInt(req.query.handledLimit ?? req.query.limit, 10),
      });
      
      return res.json({
        success: true,
        data: dashboard,
      });
    }
    // Handle 'both' level request - user has both L1 and L2 roles
    if (level === 'both') {
      // Get all user roles
      const userRoles = user?.roles?.map((r: any) => r.name.toLowerCase()) || [];
      const hasL1Role = userRoles.includes('credit_team_l1');
      const hasL2Role = userRoles.includes('credit_team_l2');
      
      if (hasL1Role && hasL2Role) {
        const l1Dashboard = await customerOnboardingService.getCreditTeamPending('CREDIT_TEAM_L1', user?.id);
        const l2Dashboard = await customerOnboardingService.getCreditTeamPending('CREDIT_TEAM_L2', user?.id);
        
        // Combine pending from both L1 and L2
        const combinedPending = [...(l1Dashboard.pending || []), ...(l2Dashboard.pending || [])];
        
        // Get handled cases from both
        const combinedHandled = [...(l1Dashboard.handled || []), ...(l2Dashboard.handled || [])];
        
        // Remove duplicates based on workflow ID
        const uniquePending = Array.from(new Map(combinedPending.map(item => [item.id, item])).values());
        const uniqueHandled = Array.from(new Map(combinedHandled.map(item => [item.id, item])).values());
        
        res.json({
          success: true,
          data: { pending: uniquePending, handled: uniqueHandled },
        });
      } else {
        // Fallback to single role
        const roleParam = userRoles.includes('credit_team_l2') ? 'CREDIT_TEAM_L2' : 'CREDIT_TEAM_L1';
        const dashboard = await customerOnboardingService.getCreditTeamPending(roleParam, user?.id);
        res.json({ success: true, data: dashboard });
      }
    } else {
      // Standard single level request
      const roleParam = level === '2' ? 'CREDIT_TEAM_L2' : 'CREDIT_TEAM_L1';
      console.log("single-->",roleParam,user?.id)
      const dashboard = await customerOnboardingService.getCreditTeamPending(roleParam, user?.id);

      res.json({
        success: true,
        data: dashboard,
      });
    }
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
router.get('/customers/dashboard/executive', checkRole(['ceo', 'md', 'credit_head']), async (req: Request, res: Response) => {
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

// ==================== SUPPLIER ONBOARDING ROUTES ====================

/**
 * POST /api/workflows/suppliers/create
 * RM creates a new supplier for an approved customer
 */
router.post('/suppliers/create', checkRole(['relationship_manager']), async (req: Request, res: Response) => {
  try {
    const {
      customerId,
      supplierName,
      supplierCode,
      email,
      contactNumber,
      address,
      gstNumber,
      panNumber,
    } = req.body;
    const user = (req as any).user;

    if (!customerId || !supplierName || !supplierCode) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
      });
    }

    const supplier = await supplierOnboardingService.createSupplierByRM(
      {
        customerId,
        supplierName,
        supplierCode,
        email,
        contactNumber,
        address,
        gstNumber,
        panNumber,
      },
      user.id,
    );

    res.status(201).json({
      success: true,
      message: 'Supplier created successfully',
      data: supplier,
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
 * FIXED: Allow users with both L1 and L2 roles to access L1 approval
 */
router.post('/suppliers/:supplierId/ops-l1', checkRole(['operations_team_l1', 'operations_team_l2']), async (req: Request, res: Response) => {
  try {
    const { supplierId } = req.params;
    const { approved, remarks } = req.body;
    const user = (req as any).user;
    const userRoles = (user?.roles || []).map((r: any) => r.name.toLowerCase());
    
    // Check if user has L1 role
    const hasL1Role = userRoles.includes('operations_team_l1');
    
    if (!hasL1Role) {
      res.status(403).json({
        success: false,
        message: 'You do not have Operations Team L1 role to approve L1 cases',
      });
      return;
    }

    // MAKER-CHECKER VALIDATION: If user has both L1 and L2 roles, they cannot approve their own cases
    const hasBothRoles = userRoles.includes('operations_team_l1') && userRoles.includes('operations_team_l2');
    if (hasBothRoles && approved) {
      const { Supplier } = require('../entities');
      const supplier = await AppDataSource.getRepository(Supplier).findOne({
        where: { id: parseInt(supplierId) }
      });
      if (supplier && supplier.createdByUserId === user.id) {
        res.status(403).json({
          success: false,
          message: 'You have both L1 and L2 roles. You already created this supplier as L1, so you cannot approve it at L1.',
        });
        return;
      }
    }

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
 * Operations Head reviews and finalizes supplier onboarding
 */
router.post('/suppliers/:supplierId/ops-head', checkRole(['operations_head']), async (req: Request, res: Response) => {
  try {
    const { supplierId } = req.params;
    const { remarks, approved } = req.body;
    const user = (req as any).user;

    const workflow = await supplierOnboardingService.opsHeadApprove(
      parseInt(supplierId),
      user.id,
      remarks || '',
      !!approved,
    );

    res.json({
      success: true,
      message: 'Supplier onboarding completed by Operations Head',
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
 * Operations Dashboard - gets pending suppliers based on role
 */
router.get('/suppliers/dashboard/operations', checkRole(['operations_team_l1', 'operations_team_l2', 'operations_head']), async (req, res) => {
  try {
    const user = (req as any).user;
    const userRole = (user?.roles?.[0]?.name || '').toLowerCase();
    const dashboard = await supplierOnboardingService.getOperationsPending(userRole);

    res.json({ success: true, data: dashboard });
  } catch (error: any) {
    res.status(404).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/workflows/suppliers/dashboard/all
 * Get all suppliers (for Completed/Rejected tab)
 */
router.get('/suppliers/dashboard/all', async (req, res) => {
  try {
    const suppliers = await supplierOnboardingService.getAllSuppliers();
    res.json({ success: true, data: suppliers });
  } catch (error: any) {
    res.status(404).json({ success: false, message: error.message });
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
      loanAccountId,
      supplierId,
      invoiceNumber,
      invoiceAmount,
      invoiceDate,
      disbursementAmount,
      roiPercentage,
      penalCharges,
      serviceFee,  
      sanctionAmount,
        invoiceFilePath,
    } = req.body;
    const user = (req as any).user;

    if (!customerId || !loanAccountId || !supplierId || !invoiceNumber || !invoiceAmount) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: customerId, loanAccountId, supplierId, invoiceNumber, invoiceAmount are mandatory',
      });
    }

    const invoice = await invoiceDiscountingService.createInvoice(
      {
        customerId,
        loanAccountId,
        supplierId,
        invoiceNumber,
        invoiceAmount,
        invoiceDate,
        disbursementAmount,
        roiPercentage,
        penalCharges,
        serviceFee,
        sanctionAmount,
          invoiceFilePath,

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
 * FIXED: Allow users with both L1 and L2 roles to access L1 approval
 */
router.post('/invoices/:invoiceId/ops-l1', checkRole(['operations_team_l1', 'operations_team_l2']), async (req: Request, res: Response) => {
  try {
    const { invoiceId } = req.params;
    const { approved, remarks } = req.body;
    const user = (req as any).user;
    const userRoles = (user?.roles || []).map((r: any) => r.name.toLowerCase());
    
    // Check if user has L1 role
    const hasL1Role = userRoles.includes('operations_team_l1');
    
    if (!hasL1Role) {
      res.status(403).json({
        success: false,
        message: 'You do not have Operations Team L1 role to approve L1 cases',
      });
      return;
    }

    // MAKER-CHECKER VALIDATION: If user has both L1 and L2 roles, they cannot approve their own cases
    const hasBothRoles = userRoles.includes('operations_team_l1') && userRoles.includes('operations_team_l2');
    if (hasBothRoles && approved) {
      // Check if user already verified this invoice
      const { Invoice } = require('../entities');
      const invoice = await AppDataSource.getRepository(Invoice).findOne({
        where: { id: parseInt(invoiceId) }
      });
      if (invoice && invoice.createdBy === user.id) {
        res.status(403).json({
          success: false,
          message: 'You have both L1 and L2 roles. You already created this invoice as L1, so you cannot approve it at L1.',
        });
        return;
      }
    }

    const workflow = await invoiceDiscountingService.opsL1Verification(
      parseInt(invoiceId),
      user.id,
      approved ? 'approve' : 'reject',
      remarks || '',
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
 * FIXED: Allow users with both L1 and L2 roles to access L2 approval
 */
router.post('/invoices/:invoiceId/ops-l2', checkRole(['operations_team_l1', 'operations_team_l2']), async (req: Request, res: Response) => {
  try {
    const { invoiceId } = req.params;
    const { approved, remarks } = req.body;
    const user = (req as any).user;
    const userRoles = (user?.roles || []).map((r: any) => r.name.toLowerCase());
    
    // Check if user has L2 role
    const hasL2Role = userRoles.includes('operations_team_l2');
    
    if (!hasL2Role) {
      res.status(403).json({
        success: false,
        message: 'You do not have Operations Team L2 role to approve L2 cases',
      });
      return;
    }

    // MAKER-CHECKER VALIDATION: If user has both L1 and L2 roles, they cannot approve their own L1 approvals
    const hasBothRoles = userRoles.includes('operations_team_l1') && userRoles.includes('operations_team_l2');
    if (hasBothRoles && approved) {
      // Check if this user already approved this invoice at L1
      const { Invoice } = require('../entities');
      const invoice = await AppDataSource.getRepository(Invoice).findOne({
        where: { id: parseInt(invoiceId) }
      });
      // Check history for L1 approval by this user
      const { CaseStatusHistory } = require('../entities');
      const historyRepo = AppDataSource.getRepository(CaseStatusHistory);
      const l1Approval = await historyRepo.findOne({
        where: { 
          caseWorkflow: { id: invoice?.caseWorkflowId },
          status: 'ops_l1_approved'
        },
        relations: ['caseWorkflow', 'changedByUser'],
        order: { createdAt: 'DESC' }
      });
      if (l1Approval && l1Approval.changedByUser?.id === user.id) {
        res.status(403).json({
          success: false,
          message: 'You have both L1 and L2 roles. You already approved this invoice at L1, so you cannot approve it at L2.',
        });
        return;
      }
    }

    const workflow = await invoiceDiscountingService.opsL2Verification(
      parseInt(invoiceId),
      user.id,
      approved ? 'approve' : 'reject',
      remarks || '',
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
    const { approved, remarks } = req.body;
    const user = (req as any).user;

    const workflow = await invoiceDiscountingService.opsHeadApproval(
      parseInt(invoiceId),
      user.id,
      approved ? 'approve' : 'reject',
      remarks || '',
    );

    res.json({
      success: true,
      message: approved ? 'Invoice approved by Operations Head' : 'Invoice rejected by Operations Head',
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

    const workflow = await invoiceDiscountingService.opsHeadApproval(
      parseInt(invoiceId),
      user.id,
      approved ? 'approve' : 'reject',
      remarks || '',
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
 * POST /api/workflows/invoices/:invoiceId/md-approve
 * MD approves or rejects invoice (without disbursement)
 */
router.post('/invoices/:invoiceId/md-approve', checkRole(['md']), async (req: Request, res: Response) => {
  try {
    const { invoiceId } = req.params;
    const { approved, remarks } = req.body;
    const user = (req as any).user;

    const workflow = await invoiceDiscountingService.mdApproval(
      parseInt(invoiceId),
      user.id,
      approved ? 'approve' : 'reject',
      remarks || '',
    );

    res.json({
      success: true,
      message: approved ? 'Invoice approved by MD' : 'Invoice rejected by MD',
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

    const workflow = await invoiceDiscountingService.mdApproval(
      parseInt(invoiceId),
      user.id,
      approved ? 'approve' : 'reject',
      remarks || '',
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
router.get('/invoices/dashboard/rm', checkRole(['relationship_manager']), async (req: Request, res: Response) => {
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


/**
 * POST /api/workflows/suppliers/ops-l1/create
 * Operations L1 creates supplier onboarding directly -> goes to DRAFT first
 */
router.post('/suppliers/ops-l1/create', checkRole(['operations_team_l1']), async (req, res) => {
  try {
    const user = (req as any).user;
    const { customerId, supplierName, partnerLoanId, mobileNumber, email, address, gstNumber, panNumber } = req.body;

    if (!customerId || !supplierName || !mobileNumber) {
      return res.status(400).json({ success: false, message: 'customerId, supplierName, mobileNumber required' });
    }

    const result = await supplierOnboardingService.createSupplierByOpsL1(
      { customerId, supplierName, partnerLoanId, mobileNumber, email, address, gstNumber, panNumber },
      user.id
    );

    res.status(201).json({ success: true, message: 'Supplier created in Draft status', data: result });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/workflows/suppliers/:supplierId/submit-to-ops-head
 * Ops L1 submits supplier to Ops Head for approval
 */
router.post('/suppliers/:supplierId/submit-to-ops-head', checkRole(['operations_team_l1']), async (req, res) => {
  try {
    const { supplierId } = req.params;
    const { remarks } = req.body;
    const user = (req as any).user;

    const workflow = await supplierOnboardingService.opsL1SubmitToOpsHead(
      parseInt(supplierId),
      user.id,
      remarks || 'Submitted to Operations Head'
    );

    res.json({ 
      success: true, 
      message: 'Supplier submitted to Operations Head for approval', 
      data: workflow 
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/workflows/suppliers/:supplierId/cheque
 * Upload cheque and auto-fill bank details
 */
router.post(
  '/suppliers/:supplierId/cheque',
  checkRole(['operations_team_l1']),
  supplierUpload.single('cheque'),
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { supplierId } = req.params;

      if (!req.file) return res.status(400).json({ success: false, message: 'cheque file is required' });

      const result = await supplierOnboardingService.uploadSupplierChequeAndAutofill(
        Number(supplierId),
        req.file,
        user.id
      );

      res.json({
        success: true,
        message: 'Cheque uploaded and bank details auto-filled',
        data: result,
      });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }
);

/**
 * POST /api/workflows/suppliers/:supplierId/bank-details
 * Update bank details manually
 */
router.post(
  '/suppliers/:supplierId/bank-details',
  checkRole(['operations_team_l1']),
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { supplierId } = req.params;
      const { bankAccountNumber, ifscCode, bankName, accountHolderName, micrCode, chequeNumber } = req.body;

      const result = await supplierOnboardingService.updateBankDetails(
        Number(supplierId),
        {
          bankAccountNumber,
          ifscCode,
          bankName,
          accountHolderName,
          micrCode,
          chequeNumber,
        },
        user.id
      );

      res.json({
        success: true,
        message: 'Bank details updated successfully',
        data: result,
      });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }
);

/**
 * DELETE /api/workflows/suppliers/:supplierId/cheque
 * Delete cheque document and associated bank details
 */
router.delete(
  '/suppliers/:supplierId/cheque',
  checkRole(['operations_team_l1']),
  async (req: Request, res: Response) => {
    try {
      const { supplierId } = req.params;

      const result = await supplierOnboardingService.deleteChequeDocument(
        Number(supplierId)
      );

      res.json({
        success: true,
        message: 'Cheque document deleted successfully',
        data: result,
      });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }
);

/**
 * POST /api/workflows/suppliers/:supplierId/ops-head/decision
 * Operations Head final approve/reject
 */
router.post('/suppliers/:supplierId/ops-head', checkRole(['operations_head']), async (req, res) => {
  try {
    const { supplierId } = req.params;
    const { remarks, approved } = req.body;
    const user = (req as any).user;

    const workflow = await supplierOnboardingService.opsHeadDecision(
      parseInt(supplierId),
      user.id,
      remarks || '',
      !!approved
    );

    res.json({
      success: true,
      message: approved ? 'Supplier onboarded (completed)' : 'Supplier rejected by Operations Head',
      data: workflow,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/workflows/suppliers/customers/approved
 * Get approved customers for supplier onboarding dropdown
 */
router.get('/suppliers/customers/approved', async (req, res) => {
  try {
    const customers = await supplierOnboardingService.getApprovedCustomers();
    res.json({ success: true, data: customers });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/workflows/suppliers/:supplierId/details
 * Get supplier details with all relationships
 */
router.get('/suppliers/:supplierId/details', async (req, res) => {
  try {
    const { supplierId } = req.params;
    const result = await supplierOnboardingService.getSupplierById(parseInt(supplierId));
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(404).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/workflows/suppliers/rm/create
 * RM creates supplier in draft status
 */
router.post('/suppliers/rm/create', checkRole(['relationship_manager']), async (req, res) => {
  try {
    const user = (req as any).user;
    const { customerId, supplierName, supplierCode, email, contactNumber, address, gstNumber, panNumber, partnerLoanId } = req.body;

    if (!customerId || !supplierName) {
      return res.status(400).json({ success: false, message: 'customerId and supplierName are required' });
    }

    const result = await supplierOnboardingService.createSupplierByRM(
      {
        customerId,
        supplierName,
        supplierCode,
        email,
        contactNumber,
        address,
        gstNumber,
        panNumber,
        partnerLoanId,
      },
      user.id
    );

    res.status(201).json({ success: true, message: 'Supplier created successfully', data: result });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// ============================================
// INVOICE DISCOUNTING - ADDITIONAL ROUTES
// ============================================

/**
 * GET /api/workflows/invoices/customers
 * Get all approved customers for RM to select
 */
router.get('/invoices/customers', checkRole(['relationship_manager']), async (req, res) => {
  try {
    const customers = await invoiceDiscountingService.getCustomersForRM();
    res.json({ success: true, data: customers });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/workflows/invoices/customers/:customerId/lans
 * Get LANs for a specific customer
 */
router.get('/invoices/customers/:customerId/lans', checkRole(['relationship_manager']), async (req, res) => {
  try {
    const { customerId } = req.params;
    const lans = await invoiceDiscountingService.getLANsByCustomer(parseInt(customerId));
    res.json({ success: true, data: lans });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/workflows/invoices/customers/:customerId/suppliers
 * Get suppliers for a specific customer
 */
router.get('/invoices/customers/:customerId/suppliers', checkRole(['relationship_manager']), async (req, res) => {
  try {
    const { customerId } = req.params;
    const suppliers = await invoiceDiscountingService.getSuppliersByCustomer(parseInt(customerId));
    res.json({ success: true, data: suppliers });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/workflows/invoices/suppliers/:supplierId/bank-details
 * Get bank details for a specific supplier
 */
router.get('/invoices/suppliers/:supplierId/bank-details', async (req, res) => {
  try {
    const { supplierId } = req.params;
    const bankDetails = await invoiceDiscountingService.getSupplierBankDetails(parseInt(supplierId));
    res.json({ success: true, data: bankDetails });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/workflows/invoices/pending/customer
 * Get invoices pending customer approval
 * Optional: customerId query param to filter by specific customer
 */
router.get('/invoices/pending/customer', async (req, res) => {
  try {
    const { customerId } = req.query;
    const invoices = await invoiceDiscountingService.getCustomerPendingInvoices(
      customerId ? parseInt(customerId as string) : undefined
    );
    res.json({ success: true, data: invoices });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/workflows/invoices/:invoiceId/send-customer-email
 * Send approval email to customer for invoice
 * This can be triggered by RM or automatically when invoice is ready for customer approval
 */
router.post('/invoices/:invoiceId/send-customer-email', async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const { baseUrl } = req.body;
    
    const result = await invoiceDiscountingService.sendApprovalEmail(
      parseInt(invoiceId),
      baseUrl
    );
    
    res.json({
      success: result.success,
      message: result.message,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/workflows/invoices/:invoiceId/customer-approve
 * Customer approves or rejects invoice
 */
router.post('/invoices/:invoiceId/customer-approve', async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const { approved, remarks, customerId } = req.body;
    
    if (approved === undefined) {
      return res.status(400).json({ success: false, message: 'approved field is required' });
    }
    
    // If customerId not provided in body, get it from the invoice
    let finalCustomerId = customerId;
    if (!finalCustomerId) {
      // Try to get from authenticated user
      finalCustomerId = (req as any).user?.customerId;
      
      // If still not available, fetch the invoice to get customerId
      if (!finalCustomerId) {
        const invoice = await invoiceDiscountingService.getInvoiceById(parseInt(invoiceId));
        if (invoice) {
          finalCustomerId = invoice.customerId;
        }
      }
    }
    
    // Convert approved boolean to action string
    const action = approved ? 'approve' : 'reject';
    
    const workflow = await invoiceDiscountingService.customerApproval(
      parseInt(invoiceId),
      finalCustomerId,
      action,
      remarks || ''
    );
    
    res.json({
      success: true,
      message: approved ? 'Invoice approved by customer' : 'Invoice rejected by customer',
      data: workflow,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/workflows/invoices/pending/ops-l1
 * Get invoices pending OPS L1 verification
 */
router.get('/invoices/pending/ops-l1', checkRole(['operations_team_l1']), async (req, res) => {
  try {
    const invoices = await invoiceDiscountingService.getOPS1PendingInvoices();
    res.json({ success: true, data: invoices });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/workflows/invoices/pending/ops-l2
 * Get invoices pending OPS L2 verification
 */
router.get('/invoices/pending/ops-l2', checkRole(['operations_team_l2']), async (req, res) => {
  try {
    const invoices = await invoiceDiscountingService.getOPS2PendingInvoices();
    res.json({ success: true, data: invoices });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/workflows/invoices/pending/md
 * Get invoices pending MD approval
 */
router.get('/invoices/pending/md', checkRole(['md']), async (req, res) => {
  try {
    const invoices = await invoiceDiscountingService.getMDPendingInvoices();
    res.json({ success: true, data: invoices });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/workflows/invoices/pending/ops-head
 * Get invoices pending OPS Head approval
 */
router.get('/invoices/pending/ops-head', checkRole(['operations_head']), async (req, res) => {
  try {
    const invoices = await invoiceDiscountingService.getOPSHeadPendingInvoices();
    res.json({ success: true, data: invoices });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/workflows/invoices/pending/disbursement-entry
 * Get invoices pending disbursement data entry
 */
router.get('/invoices/pending/disbursement-entry', checkRole(['operations_team_l1']), async (req, res) => {
  try {
    const invoices = await invoiceDiscountingService.getDisbursementEntryInvoices();
    res.json({ success: true, data: invoices });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/workflows/invoices/pending/final-ops-l2
 * Get invoices pending final OPS L2 verification
 */
router.get('/invoices/pending/final-ops-l2', checkRole(['operations_team_l2']), async (req, res) => {
  try {
    const invoices = await invoiceDiscountingService.getFinalVerificationInvoices();
    res.json({ success: true, data: invoices });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/workflows/invoices/active
 * Get all active invoices
 */
router.get('/invoices/active', async (req, res) => {
  try {
    const invoices = await invoiceDiscountingService.getActiveInvoices();
    res.json({ success: true, data: invoices });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/workflows/invoices/:invoiceId/disburse
 * OPS L1 enters disbursement data
 */
router.post('/invoices/:invoiceId/disburse', checkRole(['operations_team_l1']), async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const { disbursementUtr, disbursementDate, invoiceDueDate, loanAccountId } = req.body;
    const user = (req as any).user;

    if (!disbursementUtr || !disbursementDate) {
      return res.status(400).json({ success: false, message: 'disbursementUtr and disbursementDate are required' });
    }

    const workflow = await invoiceDiscountingService.enterDisbursementData(
      parseInt(invoiceId),
      user.id,
      {
        disbursementUtr,
        disbursementDate,
        invoiceDueDate,
        loanAccountId: parseInt(loanAccountId),
      }
    );

    res.json({
      success: true,
      message: 'Disbursement data entered successfully',
      data: workflow,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/workflows/invoices/:invoiceId/final-ops-l2
 * OPS L2 final verification
 * FIXED: Allow users with both L1 and L2 roles to access L2 approval
 */
router.post('/invoices/:invoiceId/final-ops-l2', checkRole(['operations_team_l1', 'operations_team_l2']), async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const { approved, remarks } = req.body;
    const user = (req as any).user;
    const userRoles = (user?.roles || []).map((r: any) => r.name.toLowerCase());
    
    // Check if user has L2 role
    const hasL2Role = userRoles.includes('operations_team_l2');
    
    if (!hasL2Role) {
      res.status(403).json({ success: false, message: 'You do not have Operations Team L2 role to approve final L2 cases' });
      return;
    }

    // MAKER-CHECKER VALIDATION
    const hasBothRoles = userRoles.includes('operations_team_l1') && userRoles.includes('operations_team_l2');
    if (hasBothRoles && approved) {
      const { Invoice } = require('../entities');
      const invoice = await AppDataSource.getRepository(Invoice).findOne({ where: { id: parseInt(invoiceId) } });
      if (invoice && invoice.createdBy === user.id) {
        res.status(403).json({ success: false, message: 'You have both L1 and L2 roles. You already created this invoice as L1, so you cannot approve it at L2.' });
        return;
      }
    }

    if (approved === undefined) {
      return res.status(400).json({ success: false, message: 'approved field is required' });
    }

    const result = await invoiceDiscountingService.finalOPS2Verification(
      parseInt(invoiceId),
      user.id,
      approved,
      remarks || ''
    );

    // Include LMS result in response if invoice was approved
    const lmsInfo = approved && result.lmsResult ? {
      lmsSent: result.lmsResult.success,
      lmsError: result.lmsResult.error,
      lmsResponse: result.lmsResult.lmsResponse
    } : null;

    res.json({
      success: true,
      message: approved 
        ? 'Invoice finalized, activated and sent to LMS' 
        : 'Invoice rejected at final verification',
      data: result,
      lmsInfo,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

export default router;
