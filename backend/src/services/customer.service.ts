import { AppDataSource } from "../config/database";
import { LMSDataSource } from "../config/lmsDatabase";
import {
  Customer,
  CaseStatusHistory,
  User,
  CustomerAddress,
  OtpSession,
  Loan,
  LoanSchedule,
  LoanTransaction,
  Drawdown,
  Notification,
  RefreshToken,
} from "../entities";
import { CASE_STATUS, CaseStatus } from "../config/constants";
import { LEGAL_TCP_SOCKET_OPTIONS, Repository } from "typeorm";
import { hashPassword, comparePassword } from "../utils/password";
import { generateOtp } from "../integrations/otp/generators";
import { IdentifierType, OtpSessionStatus } from "../entities/OtpSession";
import {
  generateCustomerToken,
  generateTokenPair,
  refreshAccessToken,
  invalidateRefreshToken,
} from "../utils/jwt";
import { param } from "express-validator";
import { AlotSmsProvider } from "../integrations/notifications/sms/alot.provider";

// DTO for simplified customer response
export interface CustomerBasicInfo {
  id: number;
  companyName: string;
  email: string;
  mobile: string;
  pan: string;
  gstNumber: string;
  addresses: {
    type: string;
    fullAddress: string;
    pincode: string;
    state: string;
    city: string;
  }[];
  bankAccountNo: string;
  bankName: string;
  bankBranch: string;
  bankIfscCode: string;
  bankType: string;
}

// DTO for customer login response (minimal info for mobile app)
export interface CustomerLoginInfo {
  id: number;
  name: string;
  companyName: string;
  mobile: string;
}

// DTO for login response with JWT
export interface CustomerLoginResponse {
  success: boolean;
  token?: string;
  customer?: CustomerLoginInfo;
  partnerLoanId?: string;
  partnerLanId?: string; // lanId from customer table
  message?: string;
}

export class CustomerService {
  private customerRepository: Repository<Customer>;
  private statusHistoryRepository: Repository<CaseStatusHistory>;
  private otpSessionRepository: Repository<OtpSession>;
  private loanRepository: Repository<Loan>;
  private loanScheduleRepository: Repository<LoanSchedule>;
  private loanTransactionRepository: Repository<LoanTransaction>;
  private drawdownRepository: Repository<Drawdown>;
  private notificationRepository: Repository<Notification>;
  private refreshTokenRepository: Repository<RefreshToken>;
  private smsProvider: AlotSmsProvider;

  constructor() {
    this.customerRepository = AppDataSource.getRepository(Customer);
    this.statusHistoryRepository =
      AppDataSource.getRepository(CaseStatusHistory);
    this.otpSessionRepository = AppDataSource.getRepository(OtpSession);
    this.loanRepository = AppDataSource.getRepository(Loan);
    this.loanScheduleRepository = AppDataSource.getRepository(LoanSchedule);
    this.loanTransactionRepository =
      AppDataSource.getRepository(LoanTransaction);
    this.drawdownRepository = AppDataSource.getRepository(Drawdown);
    this.notificationRepository = AppDataSource.getRepository(Notification);
    this.refreshTokenRepository = AppDataSource.getRepository(RefreshToken);

    // Initialize ALOT SMS Provider
    this.smsProvider = new AlotSmsProvider({
      apiUrl:
        process.env.ALOT_API_URL || "https://alotsolutions.in/api/mt/SendSMS",
      user: process.env.ALOT_USER || "Fintree",
      password: process.env.ALOT_PASSWORD || "P@ssw0rd",
      senderId: process.env.ALOT_SENDER_ID || "FTREEN",
      route: process.env.ALOT_ROUTE || "5",
      templateId: process.env.MOBILE_OTP_TEMPLATE_ID || "1707176622463150769",
      peid: process.env.DLT_PEID || "1201159568446234948",
    });
  }

  /**
   * Send OTP via SMS using ALOT provider
   */
  private async sendSmsOtp(msisdn: string, otp: string): Promise<void> {
    try {
      const message = `OTP for mobile number verification is ${otp}. Do not share this OTP with anyone. Thanks & Regards Fintree Finance Private Limited.`;
      await this.smsProvider.sendSms(msisdn, message);
      console.log(`[SMS OTP] OTP sent successfully to ${msisdn}`);
    } catch (error: any) {
      console.error("[SMS OTP] Error sending SMS:", error.message);
      throw new Error("Unable to send OTP");
    }
  }

  async createCustomer(data: {
    name: string;
    mobile: string;
    email?: string;
    companyType?: string;
    companyName?: string;
    gstNumber?: string;
    electricityBillNo?: string;
    rmId: number;
    customerCode?: string;
    companyMobile?: string;
    companyEmail?: string;
    companyPan?: string;
    pan?: string;
  }): Promise<Customer> {
    // Clean up empty strings
    const cleanedData = { ...data };
    if (cleanedData.gstNumber === "") cleanedData.gstNumber = undefined;
    if (cleanedData.customerCode === "") cleanedData.customerCode = undefined;

    // Check if GST already exists (if provided)
    if (cleanedData.gstNumber) {
      const existing = await this.customerRepository.findOne({
        where: { gstNumber: cleanedData.gstNumber },
      });

      if (existing) {
        throw new Error("Customer with this GST number already exists");
      }
    }

    const customer = this.customerRepository.create({
      ...cleanedData,
      status: CASE_STATUS.DRAFT,
    });

    const savedCustomer = await this.customerRepository.save(customer);

    // Create status history
    await this.createStatusHistory(
      savedCustomer.id,
      CASE_STATUS.DRAFT,
      data.rmId,
    );

    return savedCustomer;
  }

  async updateCustomer(id: number, data: Partial<Customer>): Promise<Customer> {
    const customer = await this.customerRepository.findOne({ where: { id } });

    if (!customer) {
      throw new Error("Customer not found");
    }

    // Clean up empty strings
    const cleanedData = { ...data };
    if (cleanedData.gstNumber === "") cleanedData.gstNumber = undefined;
    if (cleanedData.customerCode === "") cleanedData.customerCode = undefined;

    Object.assign(customer, cleanedData);
    return await this.customerRepository.save(customer);
  }

  async getCustomerById(id: number): Promise<Customer | null> {
    return await this.customerRepository.findOne({
      where: { id },
      relations: [
        "rm",
        "documents",
        "documents.uploadedByUser",
        "kycDetails",
        "creditSanctions",
        "postSanctions",
        "operationsChecks",
        "coApplicants",
        "coApplicants.kycDetails",
        "contactPersons",
        "addresses",
        "statusHistory",
        "statusHistory.changedByUser",
        "applicant", // <-- include applicant relation
        "sanctionLimitHistory", // Include sanction limit history for credit team
      ],
    });
  }

  async getCustomers(filters: {
    status?: string;
    rmId?: number;
  }): Promise<Customer[]> {
    const queryBuilder = this.customerRepository.createQueryBuilder("customer");

    if (filters.status) {
      queryBuilder.where("customer.status = :status", {
        status: filters.status,
      });
    }

    if (filters.rmId) {
      queryBuilder.andWhere("customer.rmId = :rmId", { rmId: filters.rmId });
    }

    queryBuilder
      .leftJoinAndSelect("customer.rm", "rm")
      .orderBy("customer.createdAt", "DESC");

    return await queryBuilder.getMany();
  }

  async updateStatus(
    customerId: number,
    newStatus: string,
    changedBy: number,
    remarks?: string,
  ): Promise<Customer> {
    const customer = await this.customerRepository.findOne({
      where: { id: customerId },
    });

    if (!customer) {
      throw new Error("Customer not found");
    }

    const previousStatus = customer.status;
    customer.status = newStatus as CaseStatus;

    const savedCustomer = await this.customerRepository.save(customer);

    // Create status history
    await this.createStatusHistory(
      customerId,
      newStatus as CaseStatus,
      changedBy,
      previousStatus,
      remarks,
    );

    return savedCustomer;
  }

  private async createStatusHistory(
    customerId: number,
    status: CaseStatus,
    changedBy: number,
    previousStatus?: string,
    remarks?: string,
  ): Promise<CaseStatusHistory> {
    const history = this.statusHistoryRepository.create({
      customerId,
      status,
      previousStatus: previousStatus as CaseStatus,
      changedBy,
      remarks,
    });

    return await this.statusHistoryRepository.save(history);
  }

  // =====================================================
  // 🔹 SIMPLIFIED CUSTOMER BASIC INFO API (FROM LMS)
  // =====================================================

  async getCustomerBasicInfo(
    partnerId: any,
  ): Promise<CustomerBasicInfo | null> {
    try {
      // Fetch from LMS database
      const lmsCustomer = await this.findCustomerById(partnerId);

      if (!lmsCustomer) {
        // Fallback to local DB

        console.log("fallback to get from customer in supply chain");
        const customer = await this.customerRepository.findOne({
          where: { id: partnerId },
          relations: ["addresses"],
        });

        if (!customer) return null;

        const addresses =
          customer.addresses?.map((addr: CustomerAddress) => ({
            type: addr.type,
            fullAddress: addr.fullAddress,
            pincode: addr.pincode,
            state: addr.state,
            city: addr.city,
          })) || [];

        return {
          id: customer.id,
          companyName: customer.companyName || "",
          email: customer.email || customer.companyEmail || "",
          mobile: customer.mobile || customer.companyMobile || "",
          pan: customer.pan || customer.companyPan || "",
          gstNumber: customer.gstNumber || "",
          addresses,
          bankAccountNo: customer.bankAccountNo || "",
          bankName: customer.bankName || "",
          bankBranch: customer.bankBranch || "",
          bankIfscCode: customer.bankIfscCode || "",
          bankType: customer.bankType || "",
        };
      }

      return {
        id: lmsCustomer.id,
        companyName: lmsCustomer.company_name || lmsCustomer.name || "",
        email: lmsCustomer.email || "",
        mobile: lmsCustomer.mobile || "",
        pan: lmsCustomer.pan || "",
        gstNumber: lmsCustomer.gst_number || "",
        addresses: [],
        bankAccountNo: lmsCustomer.bank_account_no || "",
        bankName: lmsCustomer.bank_name || "",
        bankBranch: lmsCustomer.bank_branch || "",
        bankIfscCode: lmsCustomer.bank_ifsc_code || "",
        bankType: lmsCustomer.bank_account_type || "",
      };
    } catch (error) {
      console.error("Error fetching customer basic info from LMS:", error);
      return null;
    }
  }

  // Get all customers with basic info
  async getAllCustomersBasicInfo(filters?: {
    status?: string;
    rmId?: number;
  }): Promise<CustomerBasicInfo[]> {
    const queryBuilder = this.customerRepository.createQueryBuilder("customer");

    if (filters?.status) {
      queryBuilder.where("customer.status = :status", {
        status: filters.status,
      });
    }

    if (filters?.rmId) {
      queryBuilder.andWhere("customer.rmId = :rmId", { rmId: filters.rmId });
    }

    queryBuilder.leftJoinAndSelect("customer.addresses", "addresses");
    queryBuilder.orderBy("customer.createdAt", "DESC");

    const customers = await queryBuilder.getMany();
    console.log(customers);
    return customers.map((customer) => ({
      id: customer.id,
      companyName: customer.companyName || "",
      email: customer.email || customer.companyEmail || "",
      mobile: customer.mobile || customer.companyMobile || "",
      pan: customer.pan || customer.companyPan || "",
      gstNumber: customer.gstNumber || "",
      addresses:
        customer.addresses?.map((addr: CustomerAddress) => ({
          type: addr.type,
          fullAddress: addr.fullAddress,
          pincode: addr.pincode,
          state: addr.state,
          city: addr.city,
        })) || [],
      bankAccountNo: customer.bankAccountNo || "",
      bankName: customer.bankName || "",
      bankBranch: customer.bankBranch || "",
      bankIfscCode: customer.bankIfscCode || "",
      bankType: customer.bankType || "",
    }));
  }

  // =====================================================
  // 🔹 LOGIN METHODS (with partner_loan_id)
  // =====================================================

  /**
   * Login with mobile number and password
   * READ ONLY from LMS supply_chain_loans table
   * 1. Find customer by applicant_mobile from LMS
   * 2. Validate password from internal DB if customer exists in LMS
   * 3. Return JWT token
   */
  async loginWithPassword(
    mobile: string,
    password: string,
  ): Promise<CustomerLoginResponse> {
    try {
      // Step 1: Find customer in LMS supply_chain_loans by applicant_mobile
      const lmsCustomer = await this.findCustomerByMobile(mobile);

      if (!lmsCustomer) {
        return {
          success: false,
          message: "Customer not found with this mobile number",
        };
      }

      console.log(lmsCustomer)
      // Step 4: Validate password
      const isPasswordValid = await comparePassword(
        password,
        lmsCustomer.password,
      );
      if (!isPasswordValid) {
        return { success: false, message: "Invalid password" };
      }

      // Step 5: Generate JWT token with partnerLoanId from LMS
      const partnerLoanId = lmsCustomer.partner_loan_id || "";
      const token = generateCustomerToken(lmsCustomer.id, partnerLoanId);

      return {
        success: true,
        token,
        customer: {
          id: lmsCustomer.id,
          name: lmsCustomer.applicant_name || lmsCustomer.company_name || "",
          companyName: lmsCustomer.company_name || "",
          mobile: lmsCustomer.applicant_mobile,
        },
        partnerLoanId: partnerLoanId,
      };
    } catch (error: any) {
      console.error("Login error:", error);
      return { success: false, message: error.message || "Login failed" };
    }
  }

  /**
   * Request OTP for login
   * READ ONLY from LMS supply_chain_loans table
   */
  async requestLoginOtp(mobile: string): Promise<{
    success: boolean;
    message?: string;
    expiresAt?: Date;
  }> {
    // Check customer in LMS
    const lmsCustomer = await this.findCustomerByMobile(mobile);

    if (!lmsCustomer) {
      return {
        success: false,
        message: "Customer not found with this mobile number",
      };
    }

    // Check existing OTP session in LMS DB
    const existing = await LMSDataSource.query(
      `
    SELECT *
    FROM otp_sessions
    WHERE customer_id = ?
    AND identifier = ?
    AND identifier_type = 'MOBILE'
    AND status = 'SENT'
    ORDER BY created_at DESC
    LIMIT 1
    `,
      [lmsCustomer.id, mobile],
    );

    const existingSession = existing[0];

    if (existingSession) {
      const timeSinceLastSent =
        Date.now() - new Date(existingSession.created_at).getTime();

      if (timeSinceLastSent < 30000) {
        const remainingTime = Math.ceil((30000 - timeSinceLastSent) / 1000);
        return {
          success: false,
          message: `Please wait ${remainingTime} seconds before requesting new OTP`,
        };
      }
    }

    // Generate OTP
    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    // Insert OTP session into LMS DB
    await LMSDataSource.query(
      `
    INSERT INTO otp_sessions
    (
      customer_id,
      identifier,
      identifier_type,
      owner_type,
      otp,
      purpose,
      status,
      attempts,
      expires_at,
      created_at
    )
    VALUES (?, ?, 'MOBILE', 'COMPANY', ?, 'LOGIN', 'SENT', 0, ?, NOW())
    `,
      [lmsCustomer.id, mobile, otp, expiresAt],
    );

    // Send SMS
    await this.sendSmsOtp(mobile, otp);

    return {
      success: true,
      message: "OTP sent successfully",
      expiresAt,
    };
  }

  /**
   * Verify OTP and login
   * READ ONLY from LMS supply_chain_loans table
   */
  async verifyLoginOtp(
    mobile: string,
    otp: string,
  ): Promise<CustomerLoginResponse> {
    // Check if customer exists in LMS supply_chain_loans by applicant_mobile
    const lmsCustomer = await this.findCustomerByMobile(mobile);
    console.log("lmsCustomer:", lmsCustomer);
    if (!lmsCustomer) {
      return {
        success: false,
        message: "Customer not found with this mobile number",
      };
    }

    const result = await LMSDataSource.query(
      `
  SELECT *
  FROM otp_sessions
  WHERE customer_id = ?
  AND identifier = ?
  AND identifier_type = 'MOBILE'
  AND status = 'SENT'
  ORDER BY created_at DESC
  LIMIT 1
  `,
      [lmsCustomer.id, mobile],
    );
 console.log("result",result)
    const otpSession = result[0];

    if (!otpSession) {
      return { success: false, message: "No OTP request found." };
    }

    // Expiry check
    if (new Date() > new Date(otpSession.expires_at)) {
      await LMSDataSource.query(
        `UPDATE otp_sessions SET status = 'EXPIRED' WHERE id = ?`,
        [otpSession.id],
      );

      return { success: false, message: "OTP expired" };
    }

    // Attempt check
    if (otpSession.attempts >= 3) {
      await LMSDataSource.query(
        `UPDATE otp_sessions SET status = 'FAILED' WHERE id = ?`,
        [otpSession.id],
      );

      return { success: false, message: "Maximum attempts exceeded" };
    }

    // Wrong OTP
    if (otpSession.otp !== otp) {
      await LMSDataSource.query(
        `UPDATE otp_sessions SET attempts = attempts + 1 WHERE id = ?`,
        [otpSession.id],
      );

      return { success: false, message: "Invalid OTP" };
    }

    // Mark verified
    await LMSDataSource.query(
      `UPDATE otp_sessions SET status = 'VERIFIED' WHERE id = ?`,
      [otpSession.id],
    );

    // Get partnerLoanId from LMS
    const partnerLoanId = lmsCustomer.partner_loan_id || "";
    console.log(lmsCustomer);
    // Generate JWT token
    const token = generateCustomerToken(lmsCustomer.id, partnerLoanId);

    return {
      success: true,
      token,
      customer: {
        id: lmsCustomer.id,
        name: lmsCustomer.applicant_name || lmsCustomer.company_name || "",
        companyName: lmsCustomer.company_name || "",
        mobile: lmsCustomer.applicant_mobile,
      },
      partnerLoanId,
    };
  }

  /**
   * Set or update customer password
   * READ ONLY from LMS supply_chain_loans table - customer must exist in LMS
   */
async setPassword(
  mobile: string,
  password: string,
): Promise<{
  success: boolean;
  message?: string;
}> {
  try {
    // Check if customer exists in LMS
    const lmsCustomer = await this.findCustomerByMobile(mobile);

    if (!lmsCustomer) {
      return {
        success: false,
        message: "Customer not found with this mobile number",
      };
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Update password in LMS database
    await LMSDataSource.query(
      `
      UPDATE supply_chain_loans
      SET password = ?
      WHERE applicant_mobile = ?
      `,
      [hashedPassword, mobile]
    );

    return {
      success: true,
      message: "Password set successfully",
    };
  } catch (error: any) {
    console.error("Set password error:", error);
    return {
      success: false,
      message: "Unable to set password",
    };
  }
}
  /**
   * Map customer to basic info for localStorage
   */
  private mapToBasicInfo(
    customer: Customer & { addresses?: CustomerAddress[] },
  ): CustomerBasicInfo {
    return {
      id: customer.id,
      companyName: customer.companyName || customer.name || "",
      email: customer.email || customer.companyEmail || "",
      mobile: customer.mobile || customer.companyMobile || "",
      pan: customer.pan || customer.companyPan || "",
      gstNumber: customer.gstNumber || "",
      addresses:
        customer.addresses?.map((addr: CustomerAddress) => ({
          type: addr.type,
          fullAddress: addr.fullAddress,
          pincode: addr.pincode,
          state: addr.state,
          city: addr.city,
        })) || [],
      bankAccountNo: customer.bankAccountNo || "",
      bankName: customer.bankName || "",
      bankBranch: customer.bankBranch || "",
      bankIfscCode: customer.bankIfscCode || "",
      bankType: customer.bankType || "",
    };
  }

  /**
   * Map customer to login info for response
   */
  private mapToLoginInfo(customer: Customer): CustomerLoginInfo {
    return {
      id: customer.id,
      name: customer.name || customer.companyName || "",
      companyName: customer.companyName || "",
      mobile: customer.mobile,
    };
  }

  // =====================================================
  // 🔹 CUSTOMER APP METHODS (For Mobile App)
  // =====================================================

  /**
   * Login with mobile and password (with refresh token)
   * READ ONLY from LMS supply_chain_loans table
   */
  async loginWithPasswordFull(
    mobile: string,
    password: string,
  ): Promise<{
    success: boolean;
    token?: string;
    refreshToken?: string;
    customer?: any;
    message?: string;
  }> {
    try {
      // Find customer in LMS supply_chain_loans by applicant_mobile
      const lmsCustomer = await this.findCustomerByMobile(mobile);

      if (!lmsCustomer) {
        return {
          success: false,
          message: "Customer not found with this mobile number",
        };
      }

      // Try to find in internal DB for password validation
      let customer = await this.customerRepository.findOne({
        where: { mobile },
        relations: ["addresses"],
      });

      // If customer doesn't exist in internal DB, they can't login with password
      if (!customer) {
        return {
          success: false,
          message: "Customer not found. Please use OTP login.",
        };
      }

      // Check if password is set
      if (!customer.password) {
        return {
          success: false,
          message: "Password not set. Please set password first.",
        };
      }

      // Validate password
      const isPasswordValid = await comparePassword(
        password,
        customer.password,
      );
      if (!isPasswordValid) {
        return { success: false, message: "Invalid password" };
      }

      // Generate JWT token with partnerLoanId from LMS
      const partnerLoanId = lmsCustomer.partner_loan_id || "";
      const token = generateCustomerToken(lmsCustomer.id, partnerLoanId);

      // Generate refresh token
      const tokens = await generateTokenPair(lmsCustomer.id, partnerLoanId);

      return {
        success: true,
        token,
        refreshToken: tokens.refreshToken,
        customer: {
          id: lmsCustomer.id,
          name: lmsCustomer.applicant_name || lmsCustomer.company_name || "",
          companyName: lmsCustomer.company_name || "",
          mobile: lmsCustomer.applicant_mobile,
        },
      };
    } catch (error: any) {
      console.error("Login error:", error);
      return { success: false, message: error.message || "Login failed" };
    }
  }

  /**
   * Verify OTP and login (with refresh token)
   * READ ONLY from LMS supply_chain_loans table
   */
  async verifyLoginOtpFull(
    mobile: string,
    otp: string,
  ): Promise<{
    success: boolean;
    token?: string;
    refreshToken?: string;
    customer?: any;
    message?: string;
  }> {
    // Check if customer exists in LMS supply_chain_loans by applicant_mobile
    const lmsCustomer = await this.findCustomerByMobile(mobile);

    if (!lmsCustomer) {
      return {
        success: false,
        message: "Customer not found with this mobile number",
      };
    }

    // Find customer in internal DB for OTP session
    const customer = await this.customerRepository.findOne({
      where: { mobile },
      relations: ["addresses"],
    });

    if (!customer) {
      return {
        success: false,
        message: "Customer not found. Please contact support.",
      };
    }

    const otpSession = await this.otpSessionRepository.findOne({
      where: {
        customerId: customer.id,
        identifier: mobile,
        identifierType: IdentifierType.MOBILE,
        status: OtpSessionStatus.SENT,
      },
      order: { createdAt: "DESC" },
    });

    if (!otpSession) {
      return {
        success: false,
        message: "No OTP request found. Please request OTP first.",
      };
    }

    if (new Date() > otpSession.expiresAt) {
      otpSession.status = OtpSessionStatus.EXPIRED;
      await this.otpSessionRepository.save(otpSession);
      return {
        success: false,
        message: "OTP has expired. Please request a new OTP.",
      };
    }

    if (otpSession.attempts >= 3) {
      otpSession.status = OtpSessionStatus.FAILED;
      await this.otpSessionRepository.save(otpSession);
      return {
        success: false,
        message: "Maximum attempts exceeded. Please request a new OTP.",
      };
    }

    otpSession.attempts++;
    if (otpSession.otp !== otp) {
      await this.otpSessionRepository.save(otpSession);
      return { success: false, message: "Invalid OTP" };
    }

    otpSession.status = OtpSessionStatus.VERIFIED;
    await this.otpSessionRepository.save(otpSession);

    // Get partnerLoanId from LMS
    const partnerLoanId = lmsCustomer.partner_loan_id || "";

    const tokens = await generateTokenPair(lmsCustomer.id, partnerLoanId);

    return {
      success: true,
      token: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      customer: {
        id: lmsCustomer.id,
        name: lmsCustomer.applicant_name || lmsCustomer.company_name || "",
        companyName: lmsCustomer.company_name || "",
        mobile: lmsCustomer.applicant_mobile,
      },
    };
  }

  /**
   * Refresh access token
   */
  async refreshTokenFull(refreshToken: string): Promise<{
    success: boolean;
    accessToken?: string;
    refreshToken?: string;
    message?: string;
  }> {
    try {
      const tokens = await refreshAccessToken(refreshToken);
      return {
        success: true,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || "Invalid refresh token",
      };
    }
  }

  /**
   * Logout
   */
  async logoutFull(
    customerId: number,
    refreshToken?: string,
  ): Promise<{ success: boolean; message?: string }> {
    if (refreshToken) {
      await invalidateRefreshToken(refreshToken);
    }
    return { success: true, message: "Logged out successfully" };
  }

  /**
   * Get customer details by ID (with ownership validation) - FROM INTERNAL DB ONLY
   * Note: This API does NOT fetch from LMS as per requirement
   */
  async getCustomerDetailsById(customerId: any): Promise<any> {
    // Fetch from LMS supply_chain_loans table only (READ ONLY)
    const lmsCustomer = await this.findCustomerById(customerId);

    if (!lmsCustomer) {
      throw new Error("Customer not found");
    }

    // Map LMS supply_chain_loans fields to response format
    return {
      id: lmsCustomer.id,
      customerCode: lmsCustomer.partner_loan_id || "",
      name: lmsCustomer.applicant_name || "",
      companyName: lmsCustomer.company_name || "",
      email: "",
      mobile: lmsCustomer.applicant_mobile || "",
      pan: lmsCustomer.applicant_pan || "",
      gstNumber: lmsCustomer.gst_number || "",
      lanId: lmsCustomer.partner_loan_id || "",
      status: lmsCustomer.status || "",
      addresses: [],
      // Include all LMS fields
      applicant_name: lmsCustomer.applicant_name,
      applicant_mobile: lmsCustomer.applicant_mobile,
      applicant_pan: lmsCustomer.applicant_pan,
      applicant_aadhaar: lmsCustomer.applicant_aadhaar,
      applicant_address: lmsCustomer.applicant_address,
      co_applicant_name: lmsCustomer.co_applicant_name,
      co_applicant_pan: lmsCustomer.co_applicant_pan,
      co_applicant_aadhaar: lmsCustomer.co_applicant_aadhaar,
      co_applicant_mobile: lmsCustomer.co_applicant_mobile,
      co_applicant_address: lmsCustomer.co_applicant_address,
      company_name: lmsCustomer.company_name,
      company_pan: lmsCustomer.company_pan,
      company_address: lmsCustomer.company_address,
      roi_percentage: lmsCustomer.roi_percentage,
      created_at: lmsCustomer.created_at,
      isLmsData: true,
    };
  }

  /**
   * Get dashboard data - FROM LMS using partner_loan_id
   */
  async getDashboard(partnerLoanId: string): Promise<any> {
    try {
      if (!partnerLoanId) {
        throw new Error("partnerLoanId missing");
      }

      const dashboard = await this.getCustomerDashboard(partnerLoanId);

      if (!dashboard.success) {
        throw new Error("LMS dashboard failed");
      }

      const unreadNotifications = await this.notificationRepository.count({
        where: { readStatus: "UNREAD", isActive: true },
      });

      return {
        ...dashboard.data,
        unreadNotifications,
        isLmsData: true,
      };
    } catch (error) {
      console.error("Dashboard error:", error);

      return {
        totalSanctioned: 0,
        totalOutstanding: 0,
        totalDrawdowns: 0,
        activeLoans: 0,
        pendingDrawdowns: 0,
        unreadNotifications: 0,
        recentTransactions: [],
        isLmsData: false,
      };
    }
  }

  /**
   * Get drawdown list - FROM LMS using partner_loan_id
   */
  async getDrawdownList(
    partnerLoanId: string,
    options: {
      page?: number;
      limit?: number;
      status?: string;
      startDate?: string;
      endDate?: string;
    },
  ): Promise<{ data: any[]; total: number; page: number; limit: number }> {
    const page = options.page || 1;
    const limit = options.limit || 10;

    try {
      const result = await this.getDrawdownsPaginated(
        partnerLoanId,
        page,
        limit,
      );

      if (result.data && result.data.length > 0) {
        let data = result.data;

        // Filter by status if provided
        if (options.status) {
          data = data.filter((d: any) => d.status === options.status);
        }

        return {
          data: data.map((d: any) => ({
            id: d.id,
            drawdownNumber: d.drawdown_number,
            loanId: d.loan_id,
            amount: d.amount,
            status: d.status,
            requestDate: d.request_date || d.created_at,
            approvalDate: d.approval_date,
            disbursementDate: d.disbursement_date,
            isLmsData: true,
          })),
          total: result.total,
          page,
          limit,
        };
      }
    } catch (error) {
      console.error("Error fetching drawdowns from LMS:", error);
    }

    return { data: [], total: 0, page, limit };
  }

  /**
   * Create drawdown
   */
  async createDrawdown(
    customerId: number,
    data: {
      loanId?: number;
      requestedAmount: number;
      purpose?: string;
      description?: string;
      invoiceNumber?: string;
      beneficiaryName?: string;
      beneficiaryBankAccount?: string;
      beneficiaryIfsc?: string;
    },
  ): Promise<Drawdown> {
    if (data.loanId) {
      const loan = await this.loanRepository.findOne({
        where: { id: data.loanId, customerId },
      });
      if (!loan) throw new Error("Loan not found");
      if (!["ACTIVE", "DISBURSED"].includes(loan.status)) {
        throw new Error("Loan is not active");
      }
    }

    const drawdownCount = await this.drawdownRepository.count();
    const drawdownNumber = `DRW-${Date.now()}-${drawdownCount + 1}`;

    const drawdown = this.drawdownRepository.create({
      customerId,
      loanId: data.loanId,
      drawdownNumber,
      requestedAmount: data.requestedAmount,
      purpose: data.purpose,
      description: data.description,
      invoiceNumber: data.invoiceNumber,
      beneficiaryName: data.beneficiaryName,
      beneficiaryBankAccount: data.beneficiaryBankAccount,
      beneficiaryIfsc: data.beneficiaryIfsc,
      status: "DRAFT",
      requestDate: new Date(),
      isActive: true,
    });

    return await this.drawdownRepository.save(drawdown);
  }

  /**
   * Get loan list - FROM LMS using partner_loan_id
   */
  async getLoanList(partnerLoanId: string) {
    try {
      const loans = await LMSDataSource.query(
        `
      SELECT 
        id,
        lan,
        sanction_amount,
        utilized_sanction_limit,
        unutilization_sanction_limit,
        interest_rate,
        penal_rate,
        tenure_months,
        created_at
      FROM supply_chain_sanctions
      WHERE partner_loan_id = ?
      ORDER BY created_at DESC
      `,
        [partnerLoanId],
      );

      return {
        success: true,
        data: loans,
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  /**
   * Get loan details - FROM LMS
   */
  async getLoanDetails(customerId: number, loanId: number): Promise<any> {
    try {
      // Try LMS first
      const loan = await this.getLoanById(loanId);

      if (loan && loan.customer_id === customerId) {
        return {
          id: loan.id,
          loanNumber: loan.loan_number,
          productType: loan.product_type,
          sanctionedAmount: loan.sanctioned_amount,
          disbursedAmount: loan.disbursed_amount,
          outstandingAmount: loan.outstanding_amount,
          interestRate: loan.interest_rate,
          tenure: loan.tenure,
          emiAmount: loan.emi_amount,
          status: loan.status,
          startDate: loan.start_date,
          endDate: loan.end_date,
          processingFee: loan.processing_fee,
          insurancePremium: loan.insurance_premium,
          otherCharges: loan.other_charges,
          isLmsData: true,
        };
      }
    } catch (error) {
      console.error("Error fetching loan details from LMS:", error);
    }

    // Fallback to local DB
    const loan = await this.loanRepository.findOne({
      where: { id: loanId, customerId },
      relations: ["schedules", "drawdowns"],
    });

    if (!loan) throw new Error("Loan not found");
    return loan;
  }

  /**
   * Get loan schedule - FROM LMS
   */
  async getLoanSchedule(customerId: number, loanId: number): Promise<any[]> {
    try {
      // Verify loan belongs to customer
      const loan = await this.getLoanById(loanId);

      if (loan && loan.customer_id === customerId) {
        const schedule = await this.getLoanScheduleByLoanId(loanId);
        return schedule.map((s: any) => ({
          installmentNumber: s.installment_number,
          dueDate: s.due_date,
          principalAmount: s.principal_amount,
          interestAmount: s.interest_amount,
          totalAmount: s.total_amount,
          outstandingPrincipal: s.outstanding_principal,
          status: s.status,
          paidDate: s.paid_date,
          isLmsData: true,
        }));
      }
    } catch (error) {
      console.error("Error fetching loan schedule from LMS:", error);
    }

    // Fallback to local DB
    const loan = await this.loanRepository.findOne({
      where: { id: loanId, customerId },
    });

    if (!loan) throw new Error("Loan not found");

    return await this.loanScheduleRepository.find({
      where: { loanId },
      order: { installmentNumber: "ASC" },
    });
  }

  /**
   * Get loan statement - FROM LMS
   */
  async getLoanStatement(
    customerId: number,
    loanId: number,
    options: {
      startDate?: string;
      endDate?: string;
      page?: number;
      limit?: number;
    },
  ): Promise<{ data: any[]; total: number; page: number; limit: number }> {
    const page = options.page || 1;
    const limit = options.limit || 10;

    try {
      // Verify loan belongs to customer
      const loan = await this.getLoanById(loanId);

      if (loan && loan.customer_id === customerId) {
        const transactions = await this.getTransactionsByLoanId(
          loanId,
          1,
          1000,
        );

        // Filter by date if provided
        let filteredTransactions = transactions;
        if (options.startDate || options.endDate) {
          filteredTransactions = transactions.filter((t: any) => {
            const txDate = new Date(t.transaction_date);
            if (options.startDate && txDate < new Date(options.startDate))
              return false;
            if (options.endDate && txDate > new Date(options.endDate))
              return false;
            return true;
          });
        }

        // Paginate
        const skip = (page - 1) * limit;
        const paginatedTransactions = filteredTransactions.slice(
          skip,
          skip + limit,
        );

        return {
          data: paginatedTransactions.map((t: any) => ({
            id: t.id,
            transactionDate: t.transaction_date,
            transactionType: t.transaction_type,
            amount: t.amount,
            description: t.description,
            referenceNumber: t.reference_number,
            runningBalance: t.running_balance,
            isLmsData: true,
          })),
          total: filteredTransactions.length,
          page,
          limit,
        };
      }
    } catch (error) {
      console.error("Error fetching loan statement from LMS:", error);
    }

    // Fallback to local DB
    const loan = await this.loanRepository.findOne({
      where: { id: loanId, customerId },
    });

    if (!loan) throw new Error("Loan not found");

    const skip = (page - 1) * limit;
    const queryBuilder = this.loanTransactionRepository
      .createQueryBuilder("transaction")
      .where("transaction.loanId = :loanId", { loanId });

    queryBuilder
      .orderBy("transaction.transactionDate", "DESC")
      .skip(skip)
      .take(limit);
    const [data, total] = await queryBuilder.getManyAndCount();

    return { data, total, page, limit };
  }

  /**
   * Get foreclosure preview - FROM LMS
   */
  async getForeclosurePreview(lan: string) {
    try {
      const [summary] = await LMSDataSource.query(
        `
      SELECT 
        IFNULL(SUM(remaining_principal),0) principal,
        IFNULL(SUM(remaining_interest),0) interest,
        IFNULL(SUM(remaining_penal_interest),0) penal
      FROM supply_chain_daily_demand
      WHERE lan = ?
      `,
        [lan],
      );

      const total =
        Number(summary.principal) +
        Number(summary.interest) +
        Number(summary.penal);

      return {
        success: true,
        data: {
          principal: Number(summary.principal),
          interest: Number(summary.interest),
          penal: Number(summary.penal),
          totalForeclosureAmount: total,
        },
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  /**
   * Get transactions by LAN - from supply_chain_repayments table
   * Returns collection_date, collection_amount, collection_utr, status (default SUCCESS)
   * Ordered by collection_date DESC
   */
  async getTransactionsByLan(lan: string): Promise<{
    success: boolean;
    data: Array<{
      collection_date: string | null;
      collection_amount: number | null;
      collection_utr: string | null;
    }>;
  }> {
    try {
      if (!lan) {
        return {
          success: false,
          data: [],
        };
      }
    console.log(lan)
      const results = await LMSDataSource.query(
        `
        SELECT 
          r.lan,
          r.collection_date,
          r.collection_amount,
          r.collection_utr
        FROM supply_chain_repayments r
        WHERE r.lan = ?
        ORDER BY r.collection_date DESC
        `,
        [lan],
      );

      // Return empty list if no transactions found (as per requirements)
      const transactions = Array.isArray(results)
        ? results.map((row: any) => ({
            lan: row.lan || lan,
            collection_date: row.collection_date || null,
            collection_amount: row.collection_amount
              ? parseFloat(row.collection_amount)
              : null,
            collection_utr: row.collection_utr || null,
          }))
        : [];
      console.log("transactions by lan", transactions);
      return {
        success: true,
        data: transactions,
      };
    } catch (error: any) {
      console.error("Error fetching transactions by LAN:", error);
      return {
        success: false,
        data: [],
      };
    }
  }

  /**
   * Get transaction receipt - FROM LMS
   */
  async getTransactionReceipt(
    customerId: number,
    transactionId: number,
  ): Promise<any> {
    try {
      const transaction = await this.getTransactionById(transactionId);

      if (transaction && transaction.customer_id === customerId) {
        return {
          id: transaction.id,
          receiptNumber: transaction.receipt_number || transaction.id,
          loanId: transaction.loan_id,
          loanNumber: transaction.loan_number,
          customerName: transaction.customer_name,
          transactionDate: transaction.transaction_date,
          transactionType: transaction.transaction_type,
          amount: transaction.amount,
          description: transaction.description,
          referenceNumber: transaction.reference_number,
          paymentMode: transaction.payment_mode,
          bankName: transaction.bank_name,
          instrumentNumber: transaction.instrument_number,
          runningBalance: transaction.running_balance,
          isLmsData: true,
        };
      }
    } catch (error) {
      console.error("Error fetching transaction receipt from LMS:", error);
    }

    // Fallback to local DB
    const transaction = await this.loanTransactionRepository.findOne({
      where: { id: transactionId, customerId },
      relations: ["loan", "loan.customer"],
    });

    if (!transaction) throw new Error("Transaction not found");
    return transaction;
  }

  /**
   * Get transaction detail by LAN and UTR from supply_chain_allocation table
   * Returns allocation details with invoice-wise breakdown
   */
  async getTransactionDetail(
    lan: string,
    utr: string,
  ): Promise<{
    success: boolean;
    data?: {
      lan: string;
      collection_utr: string;
      total_collected: number;
      allocation_breakup: {
        allocated_principal: number;
        allocated_interest: number;
        allocated_penal_interest: number;
        excess_payment: number;
      };
      invoice_wise_allocation: Array<{
        invoice_number: string;
        allocated_principal: number;
        allocated_interest: number;
        allocated_penal_interest?: number;
      }>;
    };
    message?: string;
  }> {
    try {
      if (!lan || !utr) {
        return {
          success: false,
          message: "LAN and UTR are required",
        };
      }


        const originalLanResult = await LMSDataSource.query(
      `
      SELECT lan
      FROM supply_chain_sanctions
      WHERE lender = ?
      LIMIT 1
      `,
      [lan],
    );

    const originalLan = originalLanResult?.[0]?.lan;

    if (!originalLan) {
      return {
        success: false,
        message: "LAN not found",
      };
    }
      const results = await LMSDataSource.query(
        `
      SELECT 
        lan,
        collection_utr,
        total_collected,
        allocated_principal,
        allocated_interest,
        allocated_penal_interest,
        excess_payment,
        invoice_number
      FROM supply_chain_allocation
      WHERE lan = ? AND collection_utr = ?
      `,
        [originalLan, utr],
      );

      if (!results || results.length === 0) {
        return {
          success: true,
          data: {
            lan,
            collection_utr: utr,
            total_collected: 0,
            allocation_breakup: {
              allocated_principal: 0,
              allocated_interest: 0,
              allocated_penal_interest: 0,
              excess_payment: 0,
            },
            invoice_wise_allocation: [],
          },
        };
      }

      const firstRecord = results[0];

      const invoice_wise_allocation = results.map((row: any) => ({
        invoice_number: row.invoice_number || "",
        allocated_principal: row.allocated_principal
          ? parseFloat(row.allocated_principal)
          : 0,
        allocated_interest: row.allocated_interest
          ? parseFloat(row.allocated_interest)
          : 0,
        allocated_penal_interest: row.allocated_penal_interest
          ? parseFloat(row.allocated_penal_interest)
          : 0,
      }));

      return {
        success: true,
        data: {
          lan: firstRecord.lan,
          collection_utr: firstRecord.collection_utr,
          total_collected: firstRecord.total_collected
            ? parseFloat(firstRecord.total_collected)
            : 0,
          allocation_breakup: {
            allocated_principal: firstRecord.allocated_principal
              ? parseFloat(firstRecord.allocated_principal)
              : 0,
            allocated_interest: firstRecord.allocated_interest
              ? parseFloat(firstRecord.allocated_interest)
              : 0,
            allocated_penal_interest: firstRecord.allocated_penal_interest
              ? parseFloat(firstRecord.allocated_penal_interest)
              : 0,
            excess_payment: firstRecord.excess_payment
              ? parseFloat(firstRecord.excess_payment)
              : 0,
          },
          invoice_wise_allocation,
        },
      };
    } catch (error: any) {
      console.error("Error fetching transaction detail:", error);
      return {
        success: false,
        message: error.message || "Failed to fetch transaction detail",
      };
    }
  }

  /**
   * Get notification list
   */
  async getNotificationList(
    customerId: number,
    options: {
      page?: number;
      limit?: number;
      readStatus?: string;
      type?: string;
    },
  ): Promise<{
    data: Notification[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = options.page || 1;
    const limit = options.limit || 10;
    const skip = (page - 1) * limit;

    const queryBuilder = this.notificationRepository
      .createQueryBuilder("notification")
      .where("notification.customerId = :customerId", { customerId })
      .andWhere("notification.isActive = :isActive", { isActive: true })
      .andWhere("notification.isArchived = :isArchived", { isArchived: false });

    if (options.readStatus) {
      queryBuilder.andWhere("notification.readStatus = :readStatus", {
        readStatus: options.readStatus,
      });
    }

    queryBuilder
      .orderBy("notification.createdAt", "DESC")
      .skip(skip)
      .take(limit);
    const [data, total] = await queryBuilder.getManyAndCount();

    return { data, total, page, limit };
  }

  /**
   * Mark notification as read
   */
  async markNotificationAsRead(
    customerId: number,
    notificationId: number,
  ): Promise<Notification> {
    const notification = await this.notificationRepository.findOne({
      where: { id: notificationId, customerId },
    });

    if (!notification) throw new Error("Notification not found");

    notification.readStatus = "READ";
    notification.readAt = new Date();

    return await this.notificationRepository.save(notification);
  }

  /**
   * Mark all notifications as read
   */
  async markAllNotificationsAsRead(customerId: number): Promise<number> {
    const result = await this.notificationRepository.update(
      { customerId, readStatus: "UNREAD", isActive: true },
      { readStatus: "READ", readAt: new Date() },
    );

    return result.affected || 0;
  }

  /**
   * Get bank details - FROM LMS
   */
  async getBankDetails(customerId: number): Promise<any> {
    try {
      const customer = await this.findCustomerById(customerId);

      if (customer) {
        return {
          bankAccountNo: customer.bank_account_no || "",
          bankName: customer.bank_name || "",
          bankBranch: customer.bank_branch || "",
          bankIfscCode: customer.bank_ifsc_code || "",
          accountType: customer.bank_account_type || "",
          isVerified: customer.bank_verified || false,
          isLmsData: true,
        };
      }
    } catch (error) {
      console.error("Error fetching bank details from LMS:", error);
    }

    // Fallback to local DB
    const customer = await this.customerRepository.findOne({
      where: { id: customerId },
    });

    if (!customer) throw new Error("Customer not found");

    return {
      bankAccountNo: customer.bankAccountNo || "",
      bankName: customer.bankName || "",
      bankBranch: customer.bankBranch || "",
      bankIfscCode: customer.bankIfscCode || "",
      bankType: customer.bankType || "",
    };
  }

  // =====================================================
  // 🔹 LMS DATABASE METHODS (Inline from LMSService)
  // =====================================================

  /**
   * Find customer by partner_loan_id
   */
  async findCustomerByPartnerLoanId(partnerLoanId: string): Promise<any> {
    const result = await LMSDataSource.query(
      `SELECT * FROM customers WHERE partner_loan_id = ? LIMIT 1`,
      [partnerLoanId],
    );
    return result[0] || null;
  }

  /**
   * Find customer by mobile number from LMS supply_chain_loans table
   */
  async findCustomerByMobile(mobile: string): Promise<any> {
    const result = await LMSDataSource.query(
      `SELECT * FROM supply_chain_loans WHERE applicant_mobile = ? LIMIT 1`,
      [mobile],
    );
    return result[0] || null;
  }

  /**
   * Find customer by ID from LMS supply_chain_loans table
   */
  async findCustomerById(id: any): Promise<any> {
    const result = await LMSDataSource.query(
      `SELECT * FROM supply_chain_loans WHERE partner_loan_id = ? LIMIT 1`,
      [id],
    );
    return result[0] || null;
  }

  /**
   * Get loan by ID
   */
  async getLoanById(loanId: number): Promise<any> {
    const result = await LMSDataSource.query(
      `SELECT * FROM loans WHERE id = ? LIMIT 1`,
      [loanId],
    );
    return result[0] || null;
  }

  /**
   * Get loan by partner_loan_id
   */
  async getLoanByPartnerLoanId(partnerLoanId: string): Promise<any> {
    const result = await LMSDataSource.query(
      `SELECT * FROM loans WHERE partner_loan_id = ? LIMIT 1`,
      [partnerLoanId],
    );
    return result[0] || null;
  }

  /**
   * Get loan by loan number
   */
  async getLoanByNumber(loanNumber: string): Promise<any> {
    const result = await LMSDataSource.query(
      `SELECT * FROM loans WHERE loan_number = ? LIMIT 1`,
      [loanNumber],
    );
    return result[0] || null;
  }

  /**
   * Get loan schedule by loan ID
   */
  async getLoanScheduleByLoanId(loanId: number): Promise<any[]> {
    return await LMSDataSource.query(
      `SELECT * FROM loan_schedules WHERE loan_id = ? ORDER BY installment_number ASC`,
      [loanId],
    );
  }

  /**
   * Get transactions by partner_loan_id
   */
  async getTransactionsByPartnerLoanId(
    partnerLoanId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<any[]> {
    const offset = (page - 1) * limit;
    return await LMSDataSource.query(
      `SELECT * FROM loan_transactions WHERE partner_loan_id = ? ORDER BY transaction_date DESC LIMIT ? OFFSET ?`,
      [partnerLoanId, limit, offset],
    );
  }

  /**
   * Get transactions by loan ID
   */
  async getTransactionsByLoanId(
    loanId: number,
    page: number = 1,
    limit: number = 10,
  ): Promise<any[]> {
    const offset = (page - 1) * limit;
    return await LMSDataSource.query(
      `SELECT * FROM loan_transactions WHERE loan_id = ? ORDER BY transaction_date DESC LIMIT ? OFFSET ?`,
      [loanId, limit, offset],
    );
  }

  /**
   * Get transaction by ID
   */
  async getTransactionById(transactionId: number): Promise<any> {
    const result = await LMSDataSource.query(
      `SELECT * FROM loan_transactions WHERE id = ? LIMIT 1`,
      [transactionId],
    );
    return result[0] || null;
  }

  /**
   * Count customer transactions
   */
  async countCustomerTransactions(partnerLoanId: string): Promise<number> {
    const result = await LMSDataSource.query(
      `SELECT COUNT(*) as count FROM loan_transactions WHERE partner_loan_id = ?`,
      [partnerLoanId],
    );
    return result[0]?.count || 0;
  }

  /**
   * Get drawdowns by partner_loan_id
   */
  async getDrawdownsByPartnerLoanId(
    partnerLoanId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<any[]> {
    const offset = (page - 1) * limit;
    return await LMSDataSource.query(
      `SELECT * FROM drawdowns WHERE partner_loan_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [partnerLoanId, limit, offset],
    );
  }

  /**
   * Get drawdown by ID
   */
  async getDrawdownById(drawdownId: number): Promise<any> {
    const result = await LMSDataSource.query(
      `SELECT * FROM drawdowns WHERE id = ? LIMIT 1`,
      [drawdownId],
    );
    return result[0] || null;
  }

  /**
   * Count customer drawdowns
   */
  async countCustomerDrawdowns(partnerLoanId: string): Promise<number> {
    const result = await LMSDataSource.query(
      `SELECT COUNT(*) as count FROM drawdowns WHERE partner_loan_id = ?`,
      [partnerLoanId],
    );
    return result[0]?.count || 0;
  }

  /**
   * Get customer dashboard data by partner_loan_id
   */
  async getCustomerDashboard(partnerLoanId: string): Promise<any> {
    try {
      console.log(partnerLoanId);

      // 1️⃣ Sanction Summary
      const [sanction] = await LMSDataSource.query(
        `
      SELECT 
        IFNULL(SUM(sanction_amount),0) totalSanctioned,
        IFNULL(SUM(utilized_sanction_limit),0) totalUtilized,
        IFNULL(SUM(unutilization_sanction_limit),0) totalAvailable
      FROM supply_chain_sanctions
      WHERE partner_loan_id = ?
      `,
        [partnerLoanId],
      );

      // 2️⃣ Loan Summary
      const [loanSummary] = await LMSDataSource.query(
        `
      SELECT 
        COUNT(*) totalLoans,
        IFNULL(SUM(disbursement_amount),0) totalDisbursed,
        IFNULL(SUM(remaining_disbursement_amount),0) totalOutstanding
      FROM supply_chain_daily_demand
      WHERE partner_loan_id = ?
      `,
        [partnerLoanId],
      );

      // 3️⃣ Active Loans
      const [active] = await LMSDataSource.query(
        `
      SELECT COUNT(*) activeLoans
      FROM supply_chain_daily_demand
      WHERE partner_loan_id = ?
      AND status IN ('Due','Late')
      `,
        [partnerLoanId],
      );

      // 4️⃣ Recent Repayments
      const repayments = await LMSDataSource.query(
        `
      SELECT id, lan, collection_date, collection_amount
      FROM supply_chain_repayments
      WHERE lan IN (
        SELECT lan FROM supply_chain_sanctions WHERE partner_loan_id = ?
      )
      ORDER BY created_at DESC
      LIMIT 5
      `,
        [partnerLoanId],
      );

      return {
        success: true,
        data: {
          totalSanctioned: Number(sanction.totalSanctioned),
          totalUtilized: Number(sanction.totalUtilized),
          totalAvailable: Number(sanction.totalAvailable),
          totalLoans: Number(loanSummary.totalLoans),
          totalDisbursed: Number(loanSummary.totalDisbursed),
          totalOutstanding: Number(loanSummary.totalOutstanding),
          activeLoans: Number(active.activeLoans),
          recentRepayments: repayments,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // =====================================================
  // 🔹 SCF LOAN SCHEDULE (Using supply_chain_daily_demand)
  // =====================================================

  async getLoanScheduleByLan(lan: string): Promise<any> {
    try {
      const schedule = await LMSDataSource.query(
        `
      SELECT 
        invoice_number,
        invoice_due_date,
        disbursement_date,
        total_amount_demand,
        remaining_disbursement_amount,
        cumulate_interest_demand,
        cumelate_penal_interest_demand,
        cumulate_interest_demand,
        overdue_amount_demand,
        status
      FROM supply_chain_daily_demand
      WHERE lan = ?
        AND daily_date = CURDATE()
      ORDER BY invoice_due_date ASC
      `,
        [lan],
      );

      return {
        success: true,
        data: schedule,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * Get paginated loans
   */
  async getLoansPaginated(partnerLoanId: string, page: number, limit: number) {
    const offset = (page - 1) * limit;
    const data = await LMSDataSource.query(
      `SELECT * FROM loans WHERE partner_loan_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [partnerLoanId, limit, offset],
    );
    const countResult = await LMSDataSource.query(
      `SELECT COUNT(*) as total FROM loans WHERE partner_loan_id = ?`,
      [partnerLoanId],
    );
    const total = countResult[0]?.total || 0;
    return { data, total, page, limit };
  }

  /**
   * Get paginated transactions
   */
  async getTransactionsPaginated(
    partnerLoanId: string,
    page: number,
    limit: number,
  ) {
    const offset = (page - 1) * limit;
    const data = await LMSDataSource.query(
      `SELECT * FROM loan_transactions WHERE partner_loan_id = ? ORDER BY transaction_date DESC LIMIT ? OFFSET ?`,
      [partnerLoanId, limit, offset],
    );
    const countResult = await LMSDataSource.query(
      `SELECT COUNT(*) as total FROM loan_transactions WHERE partner_loan_id = ?`,
      [partnerLoanId],
    );
    const total = countResult[0]?.total || 0;
    return { data, total, page, limit };
  }

  /**
   * Get paginated drawdowns
   */
  async getDrawdownsPaginated(
    partnerLoanId: string,
    page: number,
    limit: number,
  ) {
    const offset = (page - 1) * limit;
    const data = await LMSDataSource.query(
      `SELECT * FROM drawdowns WHERE partner_loan_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [partnerLoanId, limit, offset],
    );
    const countResult = await LMSDataSource.query(
      `SELECT COUNT(*) as total FROM drawdowns WHERE partner_loan_id = ?`,
      [partnerLoanId],
    );
    const total = countResult[0]?.total || 0;
    return { data, total, page, limit };
  }

  // =====================================================
  // 🔹 LAN RETRIEVAL FROM LMS DATABASE
  // =====================================================

  /**
   * Get LAN from LMS database by customer ID
   */
  async getLanByCustomerId(
    customerId: number,
  ): Promise<{ lan: string | null; customerId: number }> {
    const result = await LMSDataSource.query(
      `SELECT lan_id FROM customers WHERE id = ? LIMIT 1`,
      [customerId],
    );
    return {
      lan: result[0]?.lan_id || null,
      customerId,
    };
  }

  /**
   * Get LAN from LMS database by mobile number
   */
  async getLanByMobile(
    mobile: string,
  ): Promise<{ lan: string | null; mobile: string }> {
    const result = await LMSDataSource.query(
      `SELECT lan_id FROM customers WHERE mobile = ? LIMIT 1`,
      [mobile],
    );
    return {
      lan: result[0]?.lan_id || null,
      mobile,
    };
  }

  /**
   * Get LAN from LMS database by partner loan ID
   */
  async getLanByPartnerLoanId(
    partnerLoanId: string,
  ): Promise<{ lan: string | null; partnerLoanId: string }> {
    const result = await LMSDataSource.query(
      `SELECT lan_id FROM customers WHERE partner_loan_id = ? LIMIT 1`,
      [partnerLoanId],
    );
    return {
      lan: result[0]?.lan_id || null,
      partnerLoanId,
    };
  }

  /**
   * Get LAN from LMS database by loan number
   */
  async getLanByLoanNumber(
    loanNumber: string,
  ): Promise<{ lan: string | null; loanNumber: string }> {
    const result = await LMSDataSource.query(
      `SELECT c.lan_id FROM customers c 
       INNER JOIN loans l ON c.id = l.customer_id 
       WHERE l.loan_number = ? LIMIT 1`,
      [loanNumber],
    );
    return {
      lan: result[0]?.lan_id || null,
      loanNumber,
    };
  }

  /**
   * Get all LANs from LMS database with optional filters
   */
  async getAllLans(partnerId: any) {
    const query = `
     SELECT DISTINCT lender
     FROM supply_chain_sanctions
     WHERE partner_loan_id = ?
   `;

    const results = await LMSDataSource.query(query, [partnerId]);
    return results.map((row: any) => row.lender);
  }

  /**
   * Get LAN from sanction table by lender name
   * @param partnerLoanId - Partner loan ID
   * @param lender - Lender name
   */
  async getLanByLender(
    partnerLoanId: string,
    lender: string,
  ): Promise<{ lan: string | null; lender: string; partnerLoanId: string }> {
    const result = await LMSDataSource.query(
      `SELECT lan FROM supply_chain_sanctions 
      WHERE partner_loan_id = ? AND lender = ? 
      LIMIT 1`,
      [partnerLoanId, lender],
    );
    return {
      lan: result[0]?.lan || null,
      lender,
      partnerLoanId,
    };
  }

  /**
   * Get all LANs with lender from sanction table
   * @param partnerLoanId - Partner loan ID
   */
  async getLansByPartnerLoanId(partnerLoanId: string): Promise<any[]> {
    const result = await LMSDataSource.query(
      `SELECT DISTINCT lan, lender FROM supply_chain_sanctions 
      WHERE partner_loan_id = ?`,
      [partnerLoanId],
    );
    return result;
  }

  /**
   * Get invoice disbursement details by lan and partnerloanId
   * @param lan - LAN (Loan Account Number)
   * @param partnerLoanId - Partner loan ID
   */
  async getInvoiceDisbursementByLanAndPartnerLoanId(
    lan: string,
    partnerLoanId: string,
  ): Promise<any[]> {
    const result = await LMSDataSource.query(
      `SELECT * FROM invoice_disbursements 
      WHERE lan = ? AND partner_loan_id = ?`,
      [lan, partnerLoanId],
    );
    return result;
  }

  /**
   * Get invoice details via lender
   * 1. Find LAN from sanction table via lender
   * 2. Find main data from invoice_disbursement table where lan and partnerloanId
   * @param partnerLoanId - Partner loan ID
   * @param lender - Lender name
   */
  async getInvoiceDetailsByLender(
    partnerLoanId: string,
    lender: string,
  ): Promise<{
    lan: string | null;
    lender: string;
    partnerLoanId: string;
    invoices: any[];
  }> {
    // Step 1: Find LAN from sanction table via lender
    const lanResult = await this.getLanByLender(partnerLoanId, lender);

    if (!lanResult.lan) {
      return {
        lan: null,
        lender,
        partnerLoanId,
        invoices: [],
      };
    }

    // Step 2: Find main data from invoice_disbursement table
    const invoices = await this.getInvoiceDisbursementByLanAndPartnerLoanId(
      lanResult.lan,
      partnerLoanId,
    );

    return {
      lan: lanResult.lan,
      lender,
      partnerLoanId,
      invoices,
    };
  }
}
