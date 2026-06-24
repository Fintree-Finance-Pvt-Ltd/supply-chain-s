import { Request, Response } from 'express';
import { CustomerService } from '../services/customer.service';
import { TaskDistributionService } from '../services/task-distribution.service';
import { LMSDataSource } from '../config/lmsDatabase';
import { internalLmsService } from '../services/loan-calculation.service';

export class CustomerController {
  private customerService: CustomerService;

  constructor() {
    this.customerService = new CustomerService();
  }

  createCustomer = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      const customer = await this.customerService.createCustomer({
        ...req.body,
        rmId: req.body.rmId ? parseInt(req.body.rmId) : req.userId!,
      });

      res.status(201).json({
        success: true,
        data: customer,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to create customer',
      });
    }
  };

  getCustomers = async (req: Request, res: Response): Promise<void> => {
    try {
      const { status, rmId, page, limit } = req.query;

      const customers = await this.customerService.getCustomers({
        status: status as string,
        rmId: rmId ? parseInt(rmId as string) : undefined,
      }, {
        page: page ? parseInt(page as string, 10) : undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined,
      });

      res.json({
        success: true,
        data: customers.data,
        meta: {
          page: customers.page,
          limit: customers.limit,
          total: customers.total,
          totalPages: Math.ceil(customers.total / customers.limit),
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch customers',
      });
    }
  };

  getCustomerById = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const customerId = Number(id);

      if (!Number.isInteger(customerId) || customerId <= 0) {
        res.status(400).json({
          success: false,
          message: 'Invalid customer ID',
        });
        return;
      }

      const customer = await this.customerService.getCustomerById(customerId);

      if (!customer) {
        res.status(404).json({
          success: false,
          message: 'Customer not found',
        });
        return;
      }

      res.json({
        success: true,
        data: customer,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch customer',
      });
    }
  };

  updateCustomer = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const customer = await this.customerService.updateCustomer(Number(id), req.body);

      res.json({
        success: true,
        data: customer,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to update customer',
      });
    }
  };

  submitCase = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      if (!req.userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      const customer = await this.customerService.updateStatus(
        Number(id),
        'submitted',
        req.userId!,
        'Case submitted to credit team'
      );

      // 🔧 FIX: Trigger task distribution on case submission for round-robin assignment
      try {
        const taskDistributionService = new TaskDistributionService();
        
        // Determine workflow stage from status
        const workflowStage = taskDistributionService.getWorkflowStageFromStatus('submitted');
        
        // Assign case to an eligible user using round-robin
        const assignmentResult = await taskDistributionService.assignCase(
          id,
          'CUSTOMER_ONBOARDING',
          'submitted',
          workflowStage
        );

        // Update customer with assigned user information
        if (assignmentResult.assignedUserId) {
          customer.assignedUserId = assignmentResult.assignedUserId;
          customer.assignedStage = workflowStage;
          await this.customerService.updateCustomer(Number(id), {
            assignedUserId: assignmentResult.assignedUserId,
            assignedStage: workflowStage,
          });
          
          console.info('[TaskDistribution] Case assigned', {
            caseId: id,
            assignedUserId: assignmentResult.assignedUserId,
            assignedUserName: assignmentResult.assignedUserName,
          });
        } else {
          console.warn('[TaskDistribution] No eligible user found', { caseId: id });
        }
      } catch (assignmentError) {
        // Log error but don't fail the case submission
        console.error('[TaskDistribution] Error assigning case', assignmentError);
      }

      res.json({
        success: true,
        data: customer,
        message: 'Case submitted successfully',
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to submit case',
      });
    }
  };

  // =====================================================
  // 🔹 SIMPLIFIED CUSTOMER BASIC INFO API
  // =====================================================

  /**
   * GET /api/customers/basic
   * Get all customers with basic info (companyName, email, mobile, pan, gstNumber, address, bank details)
   */
  getAllCustomersBasic = async (req: Request, res: Response): Promise<void> => {
    try {
      const { status, rmId, page, limit } = req.query;

      const customers = await this.customerService.getAllCustomersBasicInfo({
        status: status as string,
        rmId: rmId ? parseInt(rmId as string) : undefined,
      }, {
        page: page ? parseInt(page as string, 10) : undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined,
      });

      res.json({
        success: true,
        data: customers.data,
        count: customers.data.length,
        meta: {
          page: customers.page,
          limit: customers.limit,
          total: customers.total,
          totalPages: Math.ceil(customers.total / customers.limit),
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch customers',
      });
    }
  };

  /**
   * GET /api/customers/:id/basic
   * Get single customer basic info by ID
   */
  getCustomerBasicById = async (req: Request, res: Response): Promise<void> => {
    try {
      const partnerLoanId = req.partnerLoanId;
      const customer = await this.customerService.getCustomerBasicInfo(partnerLoanId as any);

      if (!customer) {
        res.status(404).json({
          success: false,
          message: 'Customer not found',
        });
        return;
      }

      res.json({
        success: true,
        data: customer,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch customer',
      });
    }
  };

  // =====================================================
  // 🔹 CUSTOMER LOGIN APIs
  // =====================================================

  /**
   * POST /api/customers/login
   * Login with mobile number and password
   */
  loginWithPassword = async (req: Request, res: Response): Promise<void> => {
    try {
      const { mobile, password } = req.body;

      if (!mobile || !password) {
        res.status(400).json({
          success: false,
          message: 'Mobile number and password are required',
        });
        return;
      }

      const result = await this.customerService.loginWithPassword(mobile, password);

      if (!result.success) {
        res.status(401).json(result);
        return;
      }

      res.json({
        success: true,
        token: result.token,
        partnerLanId: result.partnerLanId,
        customer: result.customer,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Login failed',
      });
    }
  };

  /**
   * POST /api/customers/login/otp
   * Request OTP for login
   */
  requestLoginOtp = async (req: Request, res: Response): Promise<void> => {
    try {
      const { mobile } = req.body;

      if (!mobile) {
        res.status(400).json({
          success: false,
          message: 'Mobile number is required',
        });
        return;
      }

      const result = await this.customerService.requestLoginOtp(mobile);

      if (!result.success) {
        res.status(400).json(result);
        return;
      }

      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to send OTP',
      });
    }
  };

  /**
   * POST /api/customers/login/otp/verify
   * Verify OTP and login
   */
  verifyLoginOtp = async (req: Request, res: Response): Promise<void> => {
    try {
      const { mobile, otp } = req.body;
      if (!mobile || !otp) {
        res.status(400).json({
          success: false,
          message: 'Mobile number and OTP are required',
        });
        return;
      }

      const result = await this.customerService.verifyLoginOtp(mobile, otp);

      if (!result.success) {
        res.status(401).json(result);
        return;
      }

      res.json({
        success: true,
        token: result.token,
        customer: result.customer,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'OTP verification failed',
      });
    }
  };

  /**
   * POST /api/customers/password
   * Set or update customer password
   */
  setPassword = async (req: Request, res: Response): Promise<void> => {
    try {
      const { mobile, password } = req.body;

      if (!mobile || !password) {
        res.status(400).json({
          success: false,
          message: 'Mobile number and password are required',
        });
        return;
      }

      const result = await this.customerService.setPassword(mobile, password);

      if (!result.success) {
        res.status(400).json(result);
        return;
      }

      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to set password',
      });
    }
  };

  // =====================================================
  // 🔹 CUSTOMER APP APIS (Mobile App)
  // =====================================================

  /**
   * POST /api/auth/refresh
   * Refresh access token
   */
  refreshToken = async (req: Request, res: Response): Promise<void> => {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        res.status(400).json({
          success: false,
          message: 'Refresh token is required',
        });
        return;
      }

      const result = await this.customerService.refreshTokenFull(refreshToken);

      if (!result.success) {
        res.status(401).json(result);
        return;
      }

      res.json({
        success: true,
        data: {
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Token refresh failed',
      });
    }
  };

  /**
   * POST /api/auth/logout
   * Logout customer
   */
  logout = async (req: Request, res: Response): Promise<void> => {
    try {
      const customerId = (req as any).customerId;
      const { refreshToken } = req.body;

      if (!customerId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      await this.customerService.logoutFull(customerId, refreshToken);

      res.json({
        success: true,
        message: 'Logged out successfully',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Logout failed',
      });
    }
  };

  /**
   * GET /api/customers/:id/customerDetails
   * Get customer details by ID
   */
  getCustomerDetails = async (req: Request, res: Response): Promise<void> => {
    try {
      const customerId = (req as any).partnerLoanId;

      if (!customerId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      const customer = await this.customerService.getCustomerDetailsById(customerId);

      res.json({
        success: true,
        data: customer,
      });
    } catch (error: any) {
      const statusCode = error.message.includes('only access your own') ? 403 : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to fetch customer details',
      });
    }
  };

  /**
   * GET /api/dashboard
   * Get customer dashboard
   */
  getDashboard = async (req: Request, res: Response): Promise<void> => {
    try {
      const partnerLoanId = (req as any).partnerLoanId;
      console.info('[CustomerDashboard] Fetching dashboard', { partnerLoanId });
      if (!partnerLoanId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      const dashboard = await internalLmsService.getCustomerDashboard(Number(partnerLoanId));

      res.json({
        success: true,
        data: dashboard.data,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch dashboard',
      });
    }
  };

  /**
 * GET /api/loans
 * Get loan list (SCF - supply_chain_sanctions)
 */
getLoanList = async (req: Request, res: Response): Promise<void> => {
  try {
    const partnerLoanId = (req as any).partnerLoanId;

    if (!partnerLoanId) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    const result = await internalLmsService.getCustomerLoanSummary(Number(partnerLoanId));

    if (!result.success) {
      res.status(500).json(result);
      return;
    }

    res.json(result);

  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch loans',
    });
  }
};

  /**
   * GET /api/drawdown/list
   * Get drawdown list
   */
  getDrawdownList = async (req: Request, res: Response): Promise<void> => {
    try {
      const partnerLoanId = (req as any).partnerLoanId;
      const { page, limit, status, startDate, endDate } = req.query;

      if (!partnerLoanId) {
        res.status(401).json({ success: false, message: 'Authentication required' });
        return;
      }

      const result = await this.customerService.getDrawdownList(partnerLoanId, {
        page: page ? parseInt(page as string, 10) : undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined,
        status: status as string,
        startDate: startDate as string,
        endDate: endDate as string,
      });

      res.json({
        success: true,
        data: result.data,
        meta: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: Math.ceil(result.total / result.limit),
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch drawdowns',
      });
    }
  };

  /**
   * POST /api/drawdown
   * Create drawdown
   */
  createDrawdown = async (req: Request, res: Response): Promise<void> => {
    try {
      const customerId = (req as any).customerId;
      const { loanId, requestedAmount, purpose, description, invoiceNumber, beneficiaryName, beneficiaryBankAccount, beneficiaryIfsc } = req.body;

      if (!requestedAmount || requestedAmount <= 0) {
        res.status(400).json({
          success: false,
          message: 'Valid requested amount is required',
        });
        return;
      }

      const drawdown = await this.customerService.createDrawdown(customerId, {
        loanId,
        requestedAmount,
        purpose,
        description,
        invoiceNumber,
        beneficiaryName,
        beneficiaryBankAccount,
        beneficiaryIfsc,
      });

      res.status(201).json({
        success: true,
        data: drawdown,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to create drawdown',
      });
    }
  };

  /**
   * GET /api/loans/detail
   * Get loan details
   */
  getLoanDetails = async (req: Request, res: Response): Promise<void> => {
    try {
      const customerId = (req as any).customerId;
      const { id } = req.query;

      if (!id) {
        res.status(400).json({ success: false, message: 'Loan ID is required' });
        return;
      }

      const loan = await this.customerService.getLoanDetails(customerId, parseInt(id as string, 10));

      res.json({ success: true, data: loan });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message || 'Failed to fetch loan' });
    }
  };

  /**
   * GET /api/loans/schedule
   * Get loan schedule
   */
async getLoanSchedule(req: Request, res: Response) {
  try {
    const { lan } = req.query;

    if (!lan) {
      return res.status(400).json({
        success: false,
        message: 'LAN is required'
      });
    }

    const result = await internalLmsService.getDemandSchedule(String(lan));

    return res.json(result);

  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

  /**
   * GET /api/loans/statement
   * Get loan statement
   */
  getLoanStatement = async (req: Request, res: Response): Promise<void> => {
    try {
      const customerId = (req as any).customerId;
      const { id, startDate, endDate, page, limit } = req.query;

      if (!id) {
        res.status(400).json({ success: false, message: 'Loan ID is required' });
        return;
      }

      const result = await internalLmsService.getStatementByLoanAccountId(parseInt(id as string, 10), {
        startDate: startDate as string,
        endDate: endDate as string,
      });

      res.json({
        success: true,
        data: result.data,
        meta: { page: page ? parseInt(page as string, 10) : 1, limit: limit ? parseInt(limit as string, 10) : result.data.length, total: result.data.length },
      });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message || 'Failed to fetch statement' });
    }
  };

  /**
   * GET /api/loans/foreclosure-preview
   * Get foreclosure preview
   */
  getForeclosurePreview = async (req: Request, res: Response): Promise<void> => {
    try {
      const lan = String(req.query.lan || req.query.id || '').trim();

      if (!lan) {
        res.status(400).json({ success: false, message: 'LAN is required' });
        return;
      }

      const preview = await internalLmsService.getForeclosurePreview(lan);

      res.json(preview);
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message || 'Failed to fetch preview' });
    }
  };



  /**
   * GET /api/transactions/:id/receipt
   * Get transaction receipt
   */
  getTransactionReceipt = async (req: Request, res: Response): Promise<void> => {
    try {
      const customerId = (req as any).customerId;
      const { id } = req.params;

      const transaction = await this.customerService.getTransactionReceipt(customerId, parseInt(id, 10));

      res.json({ success: true, data: transaction });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message || 'Failed to fetch receipt' });
    }
  };

  /**
   * GET /api/customer/transactions?lan={LAN}
   * Get transactions by LAN from supply_chain_repayments table
   * Returns collection_date, collection_amount, collection_utr, status (default SUCCESS)
   * Ordered by collection_date DESC
   */
  getTransactionsByLan = async (req: Request, res: Response): Promise<void> => {
    try {
      const lan = req.query.lan as string;

      // Basic validation: lan is required
      if (!lan) {
        res.status(400).json({
          success: false,
          message:  'LAN is required'
        });
        return;
      }
      const result = await internalLmsService.getTransactionsByLan(lan);

      if (!result) {
        res.status(500).json({
          success: false,
          message: 'Failed to fetch transactions'
        });
        return;
      }

      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch transactions'
      });
    }
  };

  /**
   * GET /api/customer/transaction-detail?lan={lan}&utr={utr}
   * Get transaction detail by LAN and UTR from supply_chain_allocation table
   * Returns allocation details with invoice-wise breakdown
   */
  getTransactionDetail = async (req: Request, res: Response): Promise<void> => {
    try {
      const lan = req.query.lan as string;
      const utr = req.query.utr as string;

      // Validate both lan and utr are required
      if (!lan) {
        res.status(400).json({
          success: false,
          message: 'LAN is required'
        });
        return;
      }

      if (!utr) {
        res.status(400).json({
          success: false,
          message: 'UTR is required'
        });
        return;
      }

      const result = await internalLmsService.getCollectionDetail(lan, utr);

      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch transaction detail'
      });
    }
  };

  /**
   * GET /api/notifications
   * Get notification list
   */
  getNotificationList = async (req: Request, res: Response): Promise<void> => {
    try {
      const customerId = (req as any).customerId;
      const { page, limit, readStatus, type } = req.query;

      const result = await this.customerService.getNotificationList(customerId, {
        page: page ? parseInt(page as string, 10) : undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined,
        readStatus: readStatus as string,
        type: type as string,
      });

      res.json({
        success: true,
        data: result.data,
        meta: { page: result.page, limit: result.limit, total: result.total },
      });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message || 'Failed to fetch notifications' });
    }
  };

  /**
   * PUT /api/notifications/:id/read
   * Mark notification as read
   */
  markNotificationAsRead = async (req: Request, res: Response): Promise<void> => {
    try {
      const customerId = (req as any).customerId;
      const { id } = req.params;

      const notification = await this.customerService.markNotificationAsRead(customerId, parseInt(id, 10));

      res.json({ success: true, data: notification });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message || 'Failed to mark as read' });
    }
  };

  /**
   * PUT /api/notifications/read-all
   * Mark all notifications as read
   */
  markAllNotificationsAsRead = async (req: Request, res: Response): Promise<void> => {
    try {
      const customerId = (req as any).customerId;

      const count = await this.customerService.markAllNotificationsAsRead(customerId);

      res.json({ success: true, data: { markedAsRead: count } });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message || 'Failed to mark all as read' });
    }
  };

  /**
   * GET /api/profile/bank-details
   * Get bank details
   */
  getBankDetails = async (req: Request, res: Response): Promise<void> => {
    try {
      const customerId = (req as any).customerId;

      const bankDetails = await this.customerService.getBankDetails(customerId);

      res.json({ success: true, data: bankDetails });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message || 'Failed to fetch bank details' });
    }
  };

  // =====================================================
  // 🔹 LAN RETRIEVAL FROM LMS DATABASE
  // =====================================================

  /**
   * GET /api/customers/lan
   * Get LAN from LMS database by various identifiers
   * Query params: customerId, mobile, partnerLoanId, loanNumber
   * Or get all LANs with optional filters
   */
getLan = async (req: Request, res: Response): Promise<void> => {
  try {
    const partnerLoanId  = req.partnerLoanId; // or req.params / req.body

    if (!partnerLoanId) {
      res.status(400).json({
        success: false,
        message: 'partnerLoanId is required',
      });
      return;
    }

    const result = await this.customerService.getAllLans(partnerLoanId);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch lenders from LMS',
    });
  }
};

/**
 * GET /api/customers/invoice-details
 * Get invoice details via lender
 * Query params: lender (required)
 * 1. Find LAN from sanction table via lender
 * 2. Find main data from invoice_disbursement table where lan and partnerloanId
 */
getInvoiceDetailsByLender = async (req: Request, res: Response): Promise<void> => {
  try {
    const partnerLoanId = req.partnerLoanId;
    const lender = req.query.lender as string;

    if (!partnerLoanId) {
      res.status(400).json({
        success: false,
        message: 'partnerLoanId is required',
      });
      return;
    }

    if (!lender) {
      res.status(400).json({
        success: false,
        message: 'lender query parameter is required',
      });
      return;
    }

    const result = await this.customerService.getInvoiceDetailsByLender(partnerLoanId, lender);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch invoice details from LMS',
    });
  }
};
}


