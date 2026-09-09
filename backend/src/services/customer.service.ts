import { AppDataSource } from "../config/database";
import {
  Customer,
  CaseStatusHistory,
  CustomerAddress,
  OtpSession,
  LoanAccount,
  Loan,
  LoanSchedule,
  LoanTransaction,
  Drawdown,
  Notification,
  RefreshToken,
  Applicant,
  Invoice,
  Repayment,
} from "../entities";
import { CASE_STATUS, CaseStatus } from "../config/constants";
import { In, Repository } from "typeorm";
import { hashPassword, comparePassword } from "../utils/password";
import { generateOtp } from "../integrations/otp/generators";
import { IdentifierType, OtpSessionStatus } from "../entities/OtpSession";
import { KycOwnerType } from "../entities/KycVerificationStatus";
import {
  generateCustomerToken,
  generateTokenPair,
  refreshAccessToken,
  invalidateRefreshToken,
} from "../utils/jwt";
import { AlotSmsProvider } from "../integrations/notifications/sms/alot.provider";
import { loanManagementService } from "./loan-management.service";

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

export interface PaginationOptions {
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface UserSummary {
  id: number;
  name: string;
  email: string;
  mobile: string | null;
  defaultRole: string | null;
}

export interface CustomerListItem {
  id: number;
  name: string;
  mobile: string;
  email: string | null;
  companyName: string | null;
  companyMobile: string | null;
  companyEmail: string | null;
  gstNumber: string | null;
  status: string;
  customerCode: string | null;
  rmId: number;
  assignedUserId: number | null;
  assignedStage: string | null;
  createdAt: Date;
  updatedAt: Date;
  rm: UserSummary | null;
}

export interface CustomerBasicDetail {
  id: number;
  name: string;
  mobile: string;
  email: string | null;
  companyName: string | null;
  gstNumber: string | null;
  status: string;
  assignedStage: string | null;
  currentRenewalCycleId: number | null;
  createdAt: Date;
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const MAX_DETAIL_ROWS = 100;
const MAX_HISTORY_ROWS = 50;

export class CustomerService {
  private customerRepository: Repository<Customer>;
  private statusHistoryRepository: Repository<CaseStatusHistory>;
  private otpSessionRepository: Repository<OtpSession>;
  private loanAccountRepository: Repository<LoanAccount>;
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
    this.loanAccountRepository = AppDataSource.getRepository(LoanAccount);
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

  private toNumber(value: unknown): number {
    const parsed = Number(value || 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private getTokenPartnerLoanId(customerId: number): string {
    return String(customerId);
  }

  private getCustomerDisplayName(customer: Customer): string {
    return customer.name || customer.customerName || customer.companyName || "";
  }

  private getCustomerMobile(customer: Customer): string {
    return customer.mobile || customer.companyMobile || "";
  }

  private getCustomerPan(customer: Customer): string {
    return customer.pan || customer.companyPan || "";
  }

  private getAddressText(customer: Customer & { addresses?: CustomerAddress[] }): string {
    const address = customer.addresses?.[0];
    return address?.fullAddress || "";
  }

  private async findLocalCustomerEntityByIdentifier(
    identifier: string | number,
  ): Promise<(Customer & { password?: string | null; addresses?: CustomerAddress[] }) | null> {
    const value = String(identifier || "").trim();
    if (!value) return null;

    const numericId = Number(value);
    const hasNumericId = Number.isInteger(numericId) && numericId > 0;

    const queryBuilder = this.customerRepository
      .createQueryBuilder("customer")
      .addSelect("customer.password")
      .leftJoinAndSelect("customer.addresses", "addresses")
      .leftJoin("customer.loanAccounts", "loanAccount")
      .where(
        [
          hasNumericId ? "customer.id = :numericId" : null,
          "customer.customerCode = :identifier",
          "loanAccount.lanId = :identifier",
          "loanAccount.partnerLanId = :identifier",
        ]
          .filter(Boolean)
          .join(" OR "),
        { numericId, identifier: value },
      )
      .orderBy("customer.createdAt", "DESC")
      .addOrderBy("addresses.createdAt", "ASC");

    return (await queryBuilder.getOne()) as
      | (Customer & { password?: string | null; addresses?: CustomerAddress[] })
      | null;
  }

  private async findLocalCustomerEntityByMobile(
    mobile: string,
  ): Promise<(Customer & { password?: string | null; addresses?: CustomerAddress[] }) | null> {
    const cleanMobile = String(mobile || "").trim();
    if (!cleanMobile) return null;

    return (await this.customerRepository
      .createQueryBuilder("customer")
      .addSelect("customer.password")
      .leftJoinAndSelect("customer.addresses", "addresses")
      .where("customer.mobile = :mobile", { mobile: cleanMobile })
      .orWhere("customer.companyMobile = :mobile", { mobile: cleanMobile })
      .orderBy("customer.createdAt", "DESC")
      .addOrderBy("addresses.createdAt", "ASC")
      .getOne()) as
      | (Customer & { password?: string | null; addresses?: CustomerAddress[] })
      | null;
  }

  private async getPrimaryLoanAccount(customerId: number): Promise<LoanAccount | null> {
    return await this.loanAccountRepository.findOne({
      where: { customerId },
      relations: ["partner"],
      order: { createdAt: "DESC" },
    });
  }

  private async getCustomerLoanAccounts(customerId: number): Promise<LoanAccount[]> {
    return await this.loanAccountRepository.find({
      where: { customerId },
      relations: ["partner"],
      order: { createdAt: "DESC" },
    });
  }

  private mapLocalCustomerToLegacyShape(
    customer: Customer & { password?: string | null; addresses?: CustomerAddress[] },
    loanAccount?: LoanAccount | null,
  ): any {
    const displayName = this.getCustomerDisplayName(customer);
    const mobile = this.getCustomerMobile(customer);
    const pan = this.getCustomerPan(customer);
    const address = this.getAddressText(customer);

    return {
      id: customer.id,
      partner_loan_id: this.getTokenPartnerLoanId(customer.id),
      customer_code: customer.customerCode || this.getTokenPartnerLoanId(customer.id),
      applicant_name: displayName,
      applicant_mobile: mobile,
      applicant_pan: pan,
      applicant_aadhaar: "",
      applicant_address: address,
      co_applicant_name: "",
      co_applicant_pan: "",
      co_applicant_aadhaar: "",
      co_applicant_mobile: "",
      co_applicant_address: "",
      company_name: customer.companyName || displayName,
      company_pan: customer.companyPan || pan,
      company_address: address,
      email: customer.email || customer.companyEmail || "",
      mobile,
      pan,
      gst_number: customer.gstNumber || "",
      bank_account_no: customer.bankAccountNo || "",
      bank_name: customer.bankName || "",
      bank_branch: customer.bankBranch || "",
      bank_ifsc_code: customer.bankIfscCode || "",
      bank_account_type: customer.bankType || "",
      bank_verified: Boolean(customer.bankAccountNo && customer.bankIfscCode),
      status: customer.status || "",
      roi_percentage: null,
      created_at: customer.createdAt,
      updated_at: customer.updatedAt,
      password: customer.password || null,
      lan_id: loanAccount?.lanId || null,
      partner_lan_id: loanAccount?.partnerLanId || null,
      lender: loanAccount?.lender || loanAccount?.partner?.code || null,
    };
  }

  private async mapLocalCustomerEntityToLegacyShape(
    customer: Customer & { password?: string | null; addresses?: CustomerAddress[] },
  ): Promise<any> {
    const loanAccount = await this.getPrimaryLoanAccount(customer.id);
    return this.mapLocalCustomerToLegacyShape(customer, loanAccount);
  }

  private async safeRefreshLoanAccountSnapshot(loanAccountId: number): Promise<any | null> {
    try {
      return await loanManagementService.refreshSnapshot(loanAccountId);
    } catch (error: any) {
      console.warn("[CustomerService] Unable to refresh loan account snapshot", {
        loanAccountId,
        message: error?.message,
      });
      return null;
    }
  }

  private mapLoanAccountToLegacyLoan(loanAccount: LoanAccount, snapshot?: any | null): any {
    return {
      id: loanAccount.id,
      customer_id: loanAccount.customerId,
      loan_number: loanAccount.lanId,
      lan: loanAccount.lanId,
      partner_lan_id: loanAccount.partnerLanId,
      product_type: loanAccount.partner?.name || loanAccount.partner?.code || loanAccount.lender || "SCF",
      sanctioned_amount: this.toNumber(loanAccount.sanctionedAmount),
      disbursed_amount: this.toNumber(snapshot?.totalDisbursed ?? loanAccount.disbursedAmount),
      outstanding_amount: this.toNumber(snapshot?.totalOutstanding),
      interest_rate: null,
      tenure: null,
      emi_amount: this.toNumber(snapshot?.totalOutstanding),
      status: loanAccount.status,
      start_date: loanAccount.createdAt,
      end_date: snapshot?.nextDueDate || null,
      processing_fee: null,
      insurance_premium: null,
      other_charges: null,
      snapshot,
    };
  }

  private mapDrawdownToLegacyShape(drawdown: Drawdown): any {
    return {
      id: drawdown.id,
      customer_id: drawdown.customerId,
      loan_id: drawdown.loanId,
      drawdown_number: drawdown.drawdownNumber,
      amount: this.toNumber(drawdown.requestedAmount),
      requested_amount: this.toNumber(drawdown.requestedAmount),
      approved_amount: this.toNumber(drawdown.approvedAmount),
      disbursed_amount: this.toNumber(drawdown.disbursedAmount),
      status: drawdown.status,
      request_date: drawdown.requestDate,
      approval_date: drawdown.approvalDate,
      disbursement_date: drawdown.disbursementDate,
      created_at: drawdown.createdAt,
    };
  }

  private mapRepaymentToLegacyTransaction(repayment: Repayment): any {
    return {
      id: repayment.id,
      customer_id: repayment.loanAccount?.customerId || null,
      loan_id: repayment.loanAccountId,
      loan_number: repayment.lan,
      transaction_date: repayment.repaymentDate,
      transaction_type: "REPAYMENT",
      amount: this.toNumber(repayment.amount),
      description: "Collection",
      reference_number: repayment.utr,
      payment_mode: repayment.source,
      running_balance: null,
      collection_date: repayment.repaymentDate,
      collection_amount: this.toNumber(repayment.amount),
      collection_utr: repayment.utr,
      status: repayment.status,
    };
  }

  private normalizePagination(options?: PaginationOptions): Required<PaginationOptions> {
    const rawPage = Number(options?.page);
    const rawLimit = Number(options?.limit);
    const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : DEFAULT_PAGE;
    const limit =
      Number.isInteger(rawLimit) && rawLimit > 0
        ? Math.min(rawLimit, MAX_LIMIT)
        : DEFAULT_LIMIT;

    return { page, limit };
  }

  private mapUserSummary(user?: Partial<UserSummary> | null): UserSummary | null {
    if (!user?.id) return null;

    return {
      id: user.id,
      name: user.name || "",
      email: user.email || "",
      mobile: user.mobile || null,
      defaultRole: user.defaultRole || null,
    };
  }

  private mapCustomerListItem(customer: Customer): CustomerListItem {
    return {
      id: customer.id,
      name: customer.name,
      mobile: customer.mobile,
      email: customer.email || null,
      companyName: customer.companyName || null,
      companyMobile: customer.companyMobile || null,
      companyEmail: customer.companyEmail || null,
      gstNumber: customer.gstNumber || null,
      status: customer.status,
      customerCode: customer.customerCode || null,
      rmId: customer.rmId,
      assignedUserId: customer.assignedUserId || null,
      assignedStage: customer.assignedStage || null,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
      rm: this.mapUserSummary(customer.rm),
    };
  }

  /**
   * Send OTP via SMS using ALOT provider
   */
  private async sendSmsOtp(msisdn: string, otp: string): Promise<void> {
    try {
      const message = `OTP for mobile number verification is ${otp}. Do not share this OTP with anyone. Thanks & Regards Fintree Finance Private Limited.`;
      await this.smsProvider.sendSms(msisdn, message);
      console.info("[SMS OTP] OTP sent successfully", { msisdn });
    } catch (error: any) {
      console.error("[SMS OTP] Error sending SMS", error);
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
    const cleanedData: any = { ...data };
    if (cleanedData.gstNumber === "") cleanedData.gstNumber = undefined;
    if (cleanedData.customerCode === "") cleanedData.customerCode = undefined;

    // ✅ Draft save: persist non-empty aadhaarNumber/aadhaarAddress into applicants table
    const applicantAadhaarRaw = cleanedData.aadhaarNumber;
    const applicantAadhaar =
      typeof applicantAadhaarRaw === "string" ? applicantAadhaarRaw.trim() : "";

const applicantAadhaarAddressRaw =cleanedData.applicantAddress ;
    const applicantAadhaarAddress =
      typeof applicantAadhaarAddressRaw === "string"
        ? applicantAadhaarAddressRaw.trim()
        : "";

    const shouldSaveAadhaarNumber =
      Boolean(applicantAadhaar) && /^\d{12}$/.test(applicantAadhaar);
    const shouldSaveAadhaarAddress = Boolean(applicantAadhaarAddress);

    if (shouldSaveAadhaarNumber || shouldSaveAadhaarAddress) {
      const applicantRepo = AppDataSource.getRepository(Applicant);
      const applicant = await applicantRepo.findOne({ where: { customerId: id } });

      if (applicant) {
        if (shouldSaveAadhaarNumber) applicant.aadhaarNumber = applicantAadhaar;
        if (shouldSaveAadhaarAddress)
          applicant.aadhaarAddress = applicantAadhaarAddress;

          await applicantRepo.save(applicant);
      } else {
        await applicantRepo.save(
          applicantRepo.create({
            customerId: id,
            ...(shouldSaveAadhaarNumber ? { aadhaarNumber: applicantAadhaar } : {}),
            ...(shouldSaveAadhaarAddress
              ? { aadhaarAddress: applicantAadhaarAddress }
              : {}),
          } as any),
        );
      }
    }


    Object.assign(customer, cleanedData);
    return await this.customerRepository.save(customer);
  }

  async getCustomerById(id: number): Promise<CustomerBasicDetail | null> {
    const customer = await this.customerRepository
      .createQueryBuilder("customer")
      .select([
        "customer.id",
        "customer.name",
        "customer.mobile",
        "customer.email",
        "customer.companyName",
        "customer.gstNumber",
        "customer.status",
        "customer.assignedStage",
        "customer.currentRenewalCycleId",
        "customer.createdAt",
      ])
      .where("customer.id = :id", { id })
      .getOne();

    if (!customer) return null;

    return {
      id: customer.id,
      name: customer.name,
      mobile: customer.mobile,
      email: customer.email || null,
      companyName: customer.companyName || null,
      gstNumber: customer.gstNumber || null,
      status: customer.status,
      assignedStage: customer.assignedStage || null,
      currentRenewalCycleId: customer.currentRenewalCycleId || null,
      createdAt: customer.createdAt,
    };
  }

  async getCustomers(
    filters: {
      status?: string;
      rmId?: number;
    },
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<CustomerListItem>> {
    const { page, limit } = this.normalizePagination(pagination);
    const queryBuilder = this.customerRepository
      .createQueryBuilder("customer")
      .leftJoin("customer.rm", "rm")
      .select([
        "customer.id",
        "customer.name",
        "customer.mobile",
        "customer.email",
        "customer.companyName",
        "customer.companyMobile",
        "customer.companyEmail",
        "customer.gstNumber",
        "customer.status",
        "customer.customerCode",
        "customer.rmId",
        "customer.assignedUserId",
        "customer.assignedStage",
        "customer.createdAt",
        "customer.updatedAt",
        "rm.id",
        "rm.name",
        "rm.email",
        "rm.mobile",
        "rm.defaultRole",
      ]);

    if (filters.status) {
      queryBuilder.andWhere("customer.status = :status", {
        status: filters.status,
      });
    }

    if (filters.rmId) {
      queryBuilder.andWhere("customer.rmId = :rmId", { rmId: filters.rmId });
    }

    const [customers, total] = await queryBuilder
      .orderBy("customer.createdAt", "DESC")
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data: customers.map((customer) => this.mapCustomerListItem(customer)),
      total,
      page,
      limit,
    };
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
  // 🔹 SIMPLIFIED CUSTOMER BASIC INFO API
  // =====================================================

  async getCustomerBasicInfo(
    partnerId: any,
  ): Promise<CustomerBasicInfo | null> {
    try {
      const localCustomer = await this.findLocalCustomerEntityByIdentifier(partnerId);
      if (!localCustomer) return null;

      const addressRows = await AppDataSource.getRepository(CustomerAddress).find({
        where: { customerId: localCustomer.id },
        select: {
          id: true,
          customerId: true,
          type: true,
          fullAddress: true,
          pincode: true,
          state: true,
          city: true,
        },
        order: { createdAt: "ASC" },
        take: MAX_DETAIL_ROWS,
      });

      const addresses =
        addressRows.map((addr: CustomerAddress) => ({
          type: addr.type,
          fullAddress: addr.fullAddress,
          pincode: addr.pincode,
          state: addr.state,
          city: addr.city,
        })) || [];

      return {
        id: localCustomer.id,
        companyName: localCustomer.companyName || localCustomer.name || "",
        email: localCustomer.email || localCustomer.companyEmail || "",
        mobile: localCustomer.mobile || localCustomer.companyMobile || "",
        pan: localCustomer.pan || localCustomer.companyPan || "",
        gstNumber: localCustomer.gstNumber || "",
        addresses,
        bankAccountNo: localCustomer.bankAccountNo || "",
        bankName: localCustomer.bankName || "",
        bankBranch: localCustomer.bankBranch || "",
        bankIfscCode: localCustomer.bankIfscCode || "",
        bankType: localCustomer.bankType || "",
      };
    } catch (error) {
      console.error("Error fetching customer basic info", error);
      return null;
    }
  }

  // Get all customers with basic info
  async getAllCustomersBasicInfo(
    filters?: {
      status?: string;
      rmId?: number;
    },
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<CustomerBasicInfo>> {
    const { page, limit } = this.normalizePagination(pagination);
    const queryBuilder = this.customerRepository
      .createQueryBuilder("customer")
      .select([
        "customer.id",
        "customer.companyName",
        "customer.email",
        "customer.companyEmail",
        "customer.mobile",
        "customer.companyMobile",
        "customer.pan",
        "customer.companyPan",
        "customer.gstNumber",
        "customer.bankAccountNo",
        "customer.bankName",
        "customer.bankBranch",
        "customer.bankIfscCode",
        "customer.bankType",
        "customer.createdAt",
      ]);

    if (filters?.status) {
      queryBuilder.andWhere("customer.status = :status", {
        status: filters.status,
      });
    }

    if (filters?.rmId) {
      queryBuilder.andWhere("customer.rmId = :rmId", { rmId: filters.rmId });
    }

    const [customers, total] = await queryBuilder
      .orderBy("customer.createdAt", "DESC")
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const customerIds = customers.map((customer) => customer.id);
    const addressRows = customerIds.length
      ? await AppDataSource.getRepository(CustomerAddress).find({
          where: { customerId: In(customerIds) },
          select: {
            id: true,
            customerId: true,
            type: true,
            fullAddress: true,
            pincode: true,
            state: true,
            city: true,
            createdAt: true,
          },
          order: { createdAt: "ASC" },
        })
      : [];

    const addressesByCustomerId = new Map<number, CustomerAddress[]>();
    for (const address of addressRows) {
      const entries = addressesByCustomerId.get(address.customerId) || [];
      entries.push(address);
      addressesByCustomerId.set(address.customerId, entries);
    }

    const data = customers.map((customer) => ({
      id: customer.id,
      companyName: customer.companyName || "",
      email: customer.email || customer.companyEmail || "",
      mobile: customer.mobile || customer.companyMobile || "",
      pan: customer.pan || customer.companyPan || "",
      gstNumber: customer.gstNumber || "",
      addresses:
        (addressesByCustomerId.get(customer.id) || []).map((addr: CustomerAddress) => ({
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

    console.info("[CustomerBasicInfo] Fetched customers page", {
      page,
      limit,
      total,
      returned: data.length,
      filters,
    });

    return { data, total, page, limit };
  }

  // =====================================================
  // 🔹 LOGIN METHODS (with partner_loan_id)
  // =====================================================

  /**
   * Login with mobile number and password
   * Uses the local customers table only.
   */
  async loginWithPassword(
    mobile: string,
    password: string,
  ): Promise<CustomerLoginResponse> {
    try {
      const customer = await this.findCustomerByMobile(mobile);

      if (!customer) {
        return {
          success: false,
          message: "Customer not found with this mobile number",
        };
      }

      console.info("[CustomerLogin] Local customer found", {
        customerId: customer.id,
      });

      if (!customer.password) {
        return {
          success: false,
          message: "Password is not set. Please set password or use OTP login.",
        };
      }

      const isPasswordValid = await comparePassword(
        password,
        customer.password,
      );
      if (!isPasswordValid) {
        return { success: false, message: "Invalid password" };
      }

      const partnerLoanId = this.getTokenPartnerLoanId(customer.id);
      const token = generateCustomerToken(customer.id, partnerLoanId);

      return {
        success: true,
        token,
        customer: {
          id: customer.id,
          name: customer.applicant_name || customer.company_name || "",
          companyName: customer.company_name || "",
          mobile: customer.applicant_mobile,
        },
        partnerLoanId,
        partnerLanId: customer.lan_id || undefined,
      };
    } catch (error: any) {
      console.error("Login error", error);
      return { success: false, message: error.message || "Login failed" };
    }
  }

  /**
   * Request OTP for login
   * Uses local customer and OTP session tables.
   */
  async requestLoginOtp(mobile: string): Promise<{
    success: boolean;
    message?: string;
    expiresAt?: Date;
  }> {
    const customer = await this.findCustomerByMobile(mobile);

    if (!customer) {
      return {
        success: false,
        message: "Customer not found with this mobile number",
      };
    }

    const existingSession = await this.otpSessionRepository.findOne({
      where: {
        customerId: customer.id,
        identifier: mobile,
        identifierType: IdentifierType.MOBILE,
        status: OtpSessionStatus.SENT,
      },
      order: { createdAt: "DESC" },
    });

    if (existingSession) {
      const timeSinceLastSent =
        Date.now() - new Date(existingSession.createdAt).getTime();

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

    await this.otpSessionRepository.save(
      this.otpSessionRepository.create({
        customerId: customer.id,
        identifier: mobile,
        identifierType: IdentifierType.MOBILE,
        ownerType: KycOwnerType.COMPANY,
        applicantId: null,
        coApplicantId: null,
        otp,
        purpose: "LOGIN",
        status: OtpSessionStatus.SENT,
        attempts: 0,
        expiresAt,
      }),
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
   * Uses local customer and OTP session tables.
   */
  async verifyLoginOtp(
    mobile: string,
    otp: string,
  ): Promise<CustomerLoginResponse> {
    const customer = await this.findCustomerByMobile(mobile);
    console.info("[CustomerOtp] Local customer lookup completed", {
      found: Boolean(customer),
      customerId: customer?.id,
    });
    if (!customer) {
      return {
        success: false,
        message: "Customer not found with this mobile number",
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
    console.info("[CustomerOtp] OTP session lookup completed", {
      found: Boolean(otpSession),
    });

    if (!otpSession) {
      return { success: false, message: "No OTP request found." };
    }

    // Expiry check
    if (new Date() > new Date(otpSession.expiresAt)) {
      otpSession.status = OtpSessionStatus.EXPIRED;
      await this.otpSessionRepository.save(otpSession);

      return { success: false, message: "OTP expired" };
    }

    // Attempt check
    if (otpSession.attempts >= 3) {
      otpSession.status = OtpSessionStatus.FAILED;
      await this.otpSessionRepository.save(otpSession);

      return { success: false, message: "Maximum attempts exceeded" };
    }

    // Wrong OTP
    if (otpSession.otp !== otp) {
      otpSession.attempts += 1;
      await this.otpSessionRepository.save(otpSession);

      return { success: false, message: "Invalid OTP" };
    }

    // Mark verified
    otpSession.status = OtpSessionStatus.VERIFIED;
    await this.otpSessionRepository.save(otpSession);

    const partnerLoanId = this.getTokenPartnerLoanId(customer.id);
    console.info("[CustomerOtp] OTP verified for local customer", {
      customerId: customer.id,
      partnerLoanId,
    });
    // Generate JWT token
    const token = generateCustomerToken(customer.id, partnerLoanId);

    return {
      success: true,
      token,
      customer: {
        id: customer.id,
        name: customer.applicant_name || customer.company_name || "",
        companyName: customer.company_name || "",
        mobile: customer.applicant_mobile,
      },
      partnerLoanId,
      partnerLanId: customer.lan_id || undefined,
    };
  }

  /**
   * Set or update customer password
   * Stores the hashed password on the local customer record.
   */
async setPassword(
  mobile: string,
  password: string,
): Promise<{
  success: boolean;
  message?: string;
}> {
  try {
    const customer = await this.findCustomerByMobile(mobile);

    if (!customer) {
      return {
        success: false,
        message: "Customer not found with this mobile number",
      };
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    await this.customerRepository.update(customer.id, {
      password: hashedPassword,
    });

    return {
      success: true,
      message: "Password set successfully",
    };
  } catch (error: any) {
    console.error("Set password error", error);
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
   * Uses local customer password and refresh token tables.
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
      const customer = await this.findCustomerByMobile(mobile);

      if (!customer) {
        return {
          success: false,
          message: "Customer not found with this mobile number",
        };
      }

      if (!customer.password) {
        return {
          success: false,
          message: "Password is not set. Please set password or use OTP login.",
        };
      }

      const isPasswordValid = await comparePassword(password, customer.password);
      if (!isPasswordValid) {
        return { success: false, message: "Invalid password" };
      }

      const partnerLoanId = this.getTokenPartnerLoanId(customer.id);
      const tokens = await generateTokenPair(customer.id, partnerLoanId);

      return {
        success: true,
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        customer: {
          id: customer.id,
          name: customer.applicant_name || customer.company_name || "",
          companyName: customer.company_name || "",
          mobile: customer.applicant_mobile,
        },
      };
    } catch (error: any) {
      console.error("Login error", error);
      return { success: false, message: error.message || "Login failed" };
    }
  }

  /**
   * Verify OTP and login (with refresh token)
   * Uses local customer and OTP session tables.
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
    const customer = await this.findCustomerByMobile(mobile);

    if (!customer) {
      return {
        success: false,
        message: "Customer not found with this mobile number",
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

    const partnerLoanId = this.getTokenPartnerLoanId(customer.id);

    const tokens = await generateTokenPair(customer.id, partnerLoanId);

    return {
      success: true,
      token: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      customer: {
        id: customer.id,
        name: customer.applicant_name || customer.company_name || "",
        companyName: customer.company_name || "",
        mobile: customer.applicant_mobile,
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
   */
  async getCustomerDetailsById(customerId: any): Promise<any> {
    const customer = await this.findCustomerById(customerId);

    if (!customer) {
      throw new Error("Customer not found");
    }

    return {
      id: customer.id,
      customerCode: customer.customer_code || customer.partner_loan_id || "",
      name: customer.applicant_name || "",
      companyName: customer.company_name || "",
      email: customer.email || "",
      mobile: customer.applicant_mobile || "",
      pan: customer.applicant_pan || "",
      gstNumber: customer.gst_number || "",
      lanId: customer.lan_id || "",
      partnerLoanId: customer.partner_loan_id || "",
      status: customer.status || "",
      addresses: [],
      applicant_name: customer.applicant_name,
      applicant_mobile: customer.applicant_mobile,
      applicant_pan: customer.applicant_pan,
      applicant_aadhaar: customer.applicant_aadhaar,
      applicant_address: customer.applicant_address,
      co_applicant_name: customer.co_applicant_name,
      co_applicant_pan: customer.co_applicant_pan,
      co_applicant_aadhaar: customer.co_applicant_aadhaar,
      co_applicant_mobile: customer.co_applicant_mobile,
      co_applicant_address: customer.co_applicant_address,
      company_name: customer.company_name,
      company_pan: customer.company_pan,
      company_address: customer.company_address,
      roi_percentage: customer.roi_percentage,
      created_at: customer.created_at,
    };
  }

  /**
   * Get dashboard data from internal loan management using the local customer id.
   */
  async getDashboard(partnerLoanId: string): Promise<any> {
    try {
      const customer = await this.findCustomerById(partnerLoanId);
      if (!customer) throw new Error("Customer not found");

      const dashboard = await loanManagementService.getCustomerDashboard(customer.id);

      if (!dashboard.success) {
        throw new Error("Dashboard failed");
      }

      const unreadNotifications = await this.notificationRepository.count({
        where: { customerId: customer.id, readStatus: "UNREAD", isActive: true },
      });

      return {
        ...dashboard.data,
        unreadNotifications,
      };
    } catch (error) {
      console.error("Dashboard error", error);

      return {
        totalSanctioned: 0,
        totalOutstanding: 0,
        totalDrawdowns: 0,
        activeLoans: 0,
        pendingDrawdowns: 0,
        unreadNotifications: 0,
        recentTransactions: [],
      };
    }
  }

  /**
   * Get drawdown list from local drawdown records.
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
          })),
          total: result.total,
          page,
          limit,
        };
      }
    } catch (error) {
      console.error("Error fetching drawdowns", error);
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
    let legacyLoanId = data.loanId;

    if (data.loanId) {
      const loan = await this.loanRepository.findOne({
        where: { id: data.loanId, customerId },
      });

      if (loan) {
        if (!["ACTIVE", "DISBURSED"].includes(loan.status)) {
          throw new Error("Loan is not active");
        }
      } else {
        const loanAccount = await this.loanAccountRepository.findOne({
          where: { id: data.loanId, customerId },
        });
        if (!loanAccount) throw new Error("Loan not found");
        if (String(loanAccount.status || "").toLowerCase() !== "active") {
          throw new Error("Loan is not active");
        }
        legacyLoanId = undefined;
      }
    }

    const drawdownCount = await this.drawdownRepository.count();
    const drawdownNumber = `DRW-${Date.now()}-${drawdownCount + 1}`;

    const drawdown = this.drawdownRepository.create({
      customerId,
      loanId: legacyLoanId,
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
   * Get loan list from local loan accounts.
   */
  async getLoanList(partnerLoanId: string) {
    try {
      const result = await this.getLoansPaginated(partnerLoanId, 1, MAX_LIMIT);

      return {
        success: true,
        data: result.data,
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  /**
   * Get loan details from local loan accounts.
   */
  async getLoanDetails(customerId: number, loanId: number): Promise<any> {
    const loanAccount = await this.loanAccountRepository.findOne({
      where: { id: loanId, customerId },
      relations: ["customer", "partner"],
    });

    if (loanAccount) {
      const summary = await loanManagementService.getLoanAccountSummary(loanAccount.lanId);
      return {
        ...this.mapLoanAccountToLegacyLoan(loanAccount, summary.snapshot),
        loanNumber: loanAccount.lanId,
        productType: loanAccount.partner?.name || loanAccount.partner?.code || loanAccount.lender || "SCF",
        sanctionedAmount: this.toNumber(loanAccount.sanctionedAmount),
        disbursedAmount: this.toNumber(summary.snapshot?.totalDisbursed ?? loanAccount.disbursedAmount),
        outstandingAmount: this.toNumber(summary.snapshot?.totalOutstanding),
        status: loanAccount.status,
        demands: summary.demands,
        disbursements: summary.disbursements,
      };
    }

    const loan = await this.loanRepository.findOne({
      where: { id: loanId, customerId },
      relations: ["schedules", "drawdowns"],
    });

    if (!loan) throw new Error("Loan not found");
    return loan;
  }

  /**
   * Get loan schedule from internal demands or legacy local loan schedules.
   */
  async getLoanSchedule(customerId: number, loanId: number): Promise<any[]> {
    const loanAccount = await this.loanAccountRepository.findOne({
      where: { id: loanId, customerId },
    });

    if (loanAccount) {
      const schedule = await loanManagementService.getDemandSchedule(loanAccount.lanId);
      return (schedule.data || []).map((s: any, index: number) => ({
        installmentNumber: index + 1,
        dueDate: s.dueDate,
        principalAmount: s.principalDue,
        interestAmount: s.interestDue,
        totalAmount: s.totalDue,
        outstandingPrincipal: s.outstandingAmount,
        status: s.status,
        paidDate: null,
        invoiceNumber: s.invoiceNumber,
      }));
    }

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
   * Get loan statement from internal loan management or legacy local transactions.
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

    const loanAccount = await this.loanAccountRepository.findOne({
      where: { id: loanId, customerId },
    });

    if (loanAccount) {
      const statement = await loanManagementService.getStatement(loanAccount.lanId, {
        startDate: options.startDate,
        endDate: options.endDate,
      });
      const rows = statement.data || [];
      const skip = (page - 1) * limit;
      const paginatedRows = rows.slice(skip, skip + limit);

      return {
        data: paginatedRows.map((t: any) => ({
          id: t.id,
          transactionDate: t.transactionDate || t.valueDate,
          transactionType: t.entryType,
          amount: this.toNumber(t.debit) || this.toNumber(t.credit),
          description: t.narration || t.remarks,
          referenceNumber: t.referenceId,
          runningBalance: t.runningBalance,
          debit: t.debit,
          credit: t.credit,
        })),
        total: rows.length,
        page,
        limit,
      };
    }

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
   * Get foreclosure preview from internal loan management.
   */
  async getForeclosurePreview(lan: string) {
    try {
      return await loanManagementService.getForeclosurePreview(lan);
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  /**
   * Get transactions by LAN from internal repayments.
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
      console.info("[CustomerTransactions] Fetching local transactions by LAN", { lan });
      const result = await loanManagementService.getTransactionsByLan(lan);
      const transactions = Array.isArray(result.data) ? result.data : [];
      console.info("[CustomerTransactions] Transactions fetched by LAN", {
        lan,
        rows: Array.isArray(transactions) ? transactions.length : 0,
      });
      return {
        success: true,
        data: transactions,
      };
    } catch (error: any) {
      console.error("Error fetching transactions by LAN", error);
      return {
        success: false,
        data: [],
      };
    }
  }

  /**
   * Get transaction receipt from local transactions.
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
        };
      }
    } catch (error) {
      console.error("Error fetching transaction receipt", error);
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
   * Get transaction detail by LAN and UTR from internal allocation records.
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

      return await loanManagementService.getCollectionDetail(lan, utr);
    } catch (error: any) {
      console.error("Error fetching transaction detail", error);
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
   * Get bank details from local customer.
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
        };
      }
    } catch (error) {
      console.error("Error fetching bank details", error);
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
  // 🔹 LOCAL CUSTOMER APK COMPATIBILITY METHODS
  // =====================================================

  /**
   * Find customer by partner_loan_id
   */
  async findCustomerByPartnerLoanId(partnerLoanId: string): Promise<any> {
    return await this.findCustomerById(partnerLoanId);
  }

  /**
   * Find customer by mobile number from the local customers table.
   */
  async findCustomerByMobile(mobile: string): Promise<any> {
    const customer = await this.findLocalCustomerEntityByMobile(mobile);
    return customer ? await this.mapLocalCustomerEntityToLegacyShape(customer) : null;
  }

  /**
   * Find customer by local id, customer code, system LAN, or old partner LAN.
   */
  async findCustomerById(id: any): Promise<any> {
    const customer = await this.findLocalCustomerEntityByIdentifier(id);
    return customer ? await this.mapLocalCustomerEntityToLegacyShape(customer) : null;
  }

  /**
   * Get loan by ID
   */
  async getLoanById(loanId: number): Promise<any> {
    const loanAccount = await this.loanAccountRepository.findOne({
      where: { id: loanId },
      relations: ["customer", "partner"],
    });

    if (loanAccount) {
      const snapshot = await this.safeRefreshLoanAccountSnapshot(loanAccount.id);
      return this.mapLoanAccountToLegacyLoan(loanAccount, snapshot);
    }

    const loan = await this.loanRepository.findOne({ where: { id: loanId } });
    if (!loan) return null;

    return {
      id: loan.id,
      customer_id: loan.customerId,
      loan_number: loan.loanNumber,
      product_type: loan.loanType || "SCF",
      sanctioned_amount: this.toNumber(loan.sanctionedAmount),
      disbursed_amount: this.toNumber(loan.disbursedAmount),
      outstanding_amount: this.toNumber(loan.outstandingAmount),
      interest_rate: this.toNumber(loan.interestRate),
      tenure: loan.tenureMonths,
      emi_amount: null,
      status: loan.status,
      start_date: loan.firstDisbursementDate || loan.sanctionDate,
      end_date: loan.maturityDate,
      processing_fee: this.toNumber(loan.processingFee),
      insurance_premium: null,
      other_charges: null,
    };
  }

  /**
   * Get loan by partner_loan_id
   */
  async getLoanByPartnerLoanId(partnerLoanId: string): Promise<any> {
    const customer = await this.findCustomerById(partnerLoanId);
    if (!customer) return null;

    const loanAccount = await this.getPrimaryLoanAccount(customer.id);
    if (loanAccount) {
      const snapshot = await this.safeRefreshLoanAccountSnapshot(loanAccount.id);
      return this.mapLoanAccountToLegacyLoan(loanAccount, snapshot);
    }

    const loan = await this.loanRepository.findOne({
      where: { customerId: customer.id },
      order: { createdAt: "DESC" },
    });

    return loan ? await this.getLoanById(loan.id) : null;
  }

  /**
   * Get loan by loan number
   */
  async getLoanByNumber(loanNumber: string): Promise<any> {
    const cleanLoanNumber = String(loanNumber || "").trim();
    if (!cleanLoanNumber) return null;

    const loanAccount = await this.loanAccountRepository.findOne({
      where: [
        { lanId: cleanLoanNumber },
        { partnerLanId: cleanLoanNumber },
      ] as any,
      relations: ["customer", "partner"],
    });

    if (loanAccount) {
      const snapshot = await this.safeRefreshLoanAccountSnapshot(loanAccount.id);
      return this.mapLoanAccountToLegacyLoan(loanAccount, snapshot);
    }

    const loan = await this.loanRepository.findOne({
      where: { loanNumber: cleanLoanNumber },
    });

    return loan ? await this.getLoanById(loan.id) : null;
  }

  /**
   * Get loan schedule by loan ID
   */
  async getLoanScheduleByLoanId(loanId: number): Promise<any[]> {
    const loanAccount = await this.loanAccountRepository.findOne({
      where: { id: loanId },
    });

    if (loanAccount) {
      const schedule = await loanManagementService.getDemandSchedule(loanAccount.lanId);
      return (schedule.data || []).map((row: any, index: number) => ({
        id: row.id,
        loan_id: loanAccount.id,
        installment_number: index + 1,
        due_date: row.dueDate,
        principal_amount: row.principalDue,
        interest_amount: row.interestDue,
        total_amount: row.totalDue,
        outstanding_principal: row.outstandingAmount,
        status: row.status,
        invoice_number: row.invoiceNumber,
      }));
    }

    const schedules = await this.loanScheduleRepository.find({
      where: { loanId },
      order: { installmentNumber: "ASC" },
    });

    return schedules.map((row) => ({
      id: row.id,
      loan_id: row.loanId,
      installment_number: row.installmentNumber,
      due_date: row.dueDate,
      principal_amount: row.principalAmount,
      interest_amount: row.interestAmount,
      total_amount: row.totalAmount,
      outstanding_principal: this.toNumber(row.totalAmount) - this.toNumber(row.paidAmount),
      status: row.status,
      paid_date: row.paidDate,
    }));
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
    const customer = await this.findCustomerById(partnerLoanId);
    if (!customer) return [];

    const loanAccounts = await this.getCustomerLoanAccounts(customer.id);
    const loanAccountIds = loanAccounts.map((loanAccount) => loanAccount.id);
    if (!loanAccountIds.length) return [];

    const repayments = await AppDataSource.getRepository(Repayment).find({
      where: { loanAccountId: In(loanAccountIds) },
      relations: ["loanAccount"],
      order: { repaymentDate: "DESC", id: "DESC" },
      skip: offset,
      take: limit,
    });

    return repayments.map((repayment) => this.mapRepaymentToLegacyTransaction(repayment));
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
    const loanAccount = await this.loanAccountRepository.findOne({
      where: { id: loanId },
    });

    if (loanAccount) {
      const repayments = await AppDataSource.getRepository(Repayment).find({
        where: { loanAccountId: loanId },
        relations: ["loanAccount"],
        order: { repaymentDate: "DESC", id: "DESC" },
        skip: offset,
        take: limit,
      });
      return repayments.map((repayment) => this.mapRepaymentToLegacyTransaction(repayment));
    }

    const transactions = await this.loanTransactionRepository.find({
      where: { loanId },
      order: { transactionDate: "DESC", id: "DESC" },
      skip: offset,
      take: limit,
    });

    return transactions.map((transaction) => ({
      id: transaction.id,
      customer_id: transaction.customerId,
      loan_id: transaction.loanId,
      loan_number: null,
      transaction_date: transaction.transactionDate,
      transaction_type: transaction.type,
      amount: this.toNumber(transaction.amount),
      description: transaction.description,
      reference_number: transaction.referenceNumber || transaction.utrNumber,
      payment_mode: transaction.mode,
      running_balance: null,
      status: transaction.status,
    }));
  }

  /**
   * Get transaction by ID
   */
  async getTransactionById(transactionId: number): Promise<any> {
    const repayment = await AppDataSource.getRepository(Repayment).findOne({
      where: { id: transactionId },
      relations: ["loanAccount"],
    });

    if (repayment) {
      return this.mapRepaymentToLegacyTransaction(repayment);
    }

    const transaction = await this.loanTransactionRepository.findOne({
      where: { id: transactionId },
      relations: ["loan", "loan.customer"],
    });

    if (!transaction) return null;

    return {
      id: transaction.id,
      customer_id: transaction.customerId,
      loan_id: transaction.loanId,
      loan_number: transaction.loan?.loanNumber || null,
      customer_name: transaction.loan?.customer?.name || "",
      transaction_date: transaction.transactionDate,
      transaction_type: transaction.type,
      amount: this.toNumber(transaction.amount),
      description: transaction.description,
      reference_number: transaction.referenceNumber || transaction.utrNumber,
      payment_mode: transaction.mode,
      bank_name: null,
      instrument_number: null,
      running_balance: null,
      receipt_number: transaction.transactionNumber,
    };
  }

  /**
   * Count customer transactions
   */
  async countCustomerTransactions(partnerLoanId: string): Promise<number> {
    const customer = await this.findCustomerById(partnerLoanId);
    if (!customer) return 0;

    const loanAccounts = await this.getCustomerLoanAccounts(customer.id);
    const loanAccountIds = loanAccounts.map((loanAccount) => loanAccount.id);
    if (!loanAccountIds.length) return 0;

    return await AppDataSource.getRepository(Repayment).count({
      where: { loanAccountId: In(loanAccountIds) },
    });
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
    const customer = await this.findCustomerById(partnerLoanId);
    if (!customer) return [];

    const drawdowns = await this.drawdownRepository.find({
      where: { customerId: customer.id },
      order: { createdAt: "DESC", id: "DESC" },
      skip: offset,
      take: limit,
    });

    return drawdowns.map((drawdown) => this.mapDrawdownToLegacyShape(drawdown));
  }

  /**
   * Get drawdown by ID
   */
  async getDrawdownById(drawdownId: number): Promise<any> {
    const drawdown = await this.drawdownRepository.findOne({
      where: { id: drawdownId },
    });

    return drawdown ? this.mapDrawdownToLegacyShape(drawdown) : null;
  }

  /**
   * Count customer drawdowns
   */
  async countCustomerDrawdowns(partnerLoanId: string): Promise<number> {
    const customer = await this.findCustomerById(partnerLoanId);
    if (!customer) return 0;

    return await this.drawdownRepository.count({
      where: { customerId: customer.id },
    });
  }

  /**
   * Get customer dashboard data by partner_loan_id
   */
  async getCustomerDashboard(partnerLoanId: string): Promise<any> {
    try {
      console.info("[CustomerDashboard] Fetching local dashboard", { partnerLoanId });
      const customer = await this.findCustomerById(partnerLoanId);
      if (!customer) throw new Error("Customer not found");

      const dashboard = await loanManagementService.getCustomerDashboard(customer.id);
      if (!dashboard.success) throw new Error(dashboard.message || "Dashboard failed");
      const dashboardData = dashboard.data || {};

      // 1️⃣ Sanction Summary
      const sanction = {
        totalSanctioned: dashboardData.totalSanctioned || 0,
        totalUtilized: dashboardData.totalUtilized || 0,
        totalAvailable: dashboardData.totalAvailable || 0,
      };

      // 2️⃣ Loan Summary
      const loanSummary = {
        totalDisbursed: dashboardData.totalDisbursed || 0,
        totalOutstanding: dashboardData.totalOutstanding || 0,
      };

      // 3️⃣ Active Loans
      const active = {
        activeLoans: dashboardData.activeLoans || dashboardData.totalLoans || 0,
      };

      // 4️⃣ Recent Repayments
      const repayments = dashboardData.recentRepayments || [];

      return {
        success: true,
        data: {
          totalSanctioned: Number(sanction.totalSanctioned),
          totalUtilized: Number(sanction.totalUtilized),
          totalAvailable: Number(sanction.totalAvailable),
          totalLoans: Number(active.activeLoans),
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
  // 🔹 SCF LOAN SCHEDULE
  // =====================================================

  async getLoanScheduleByLan(lan: string): Promise<any> {
    try {
      return await loanManagementService.getDemandSchedule(lan);
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
    const customer = await this.findCustomerById(partnerLoanId);
    if (!customer) return { data: [], total: 0, page, limit };

    const [loanAccounts, total] = await this.loanAccountRepository.findAndCount({
      where: { customerId: customer.id },
      relations: ["partner"],
      order: { createdAt: "DESC" },
      skip: offset,
      take: limit,
    });

    const data = await Promise.all(
      loanAccounts.map(async (loanAccount) => {
        const snapshot = await this.safeRefreshLoanAccountSnapshot(loanAccount.id);
        return {
          ...this.mapLoanAccountToLegacyLoan(loanAccount, snapshot),
          partner_loan_id: this.getTokenPartnerLoanId(customer.id),
          sanction_amount: this.toNumber(loanAccount.sanctionedAmount),
          utilized_sanction_limit: this.toNumber(snapshot?.utilizedLimit ?? loanAccount.utilizedLimit),
          unutilization_sanction_limit: this.toNumber(snapshot?.unutilizedLimit ?? loanAccount.unutilizedLimit),
          interest_rate: null,
          penal_rate: null,
          tenure_months: null,
          created_at: loanAccount.createdAt,
        };
      }),
    );

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
    const data = await this.getTransactionsByPartnerLoanId(partnerLoanId, page, limit);
    const total = await this.countCustomerTransactions(partnerLoanId);
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
    const data = await this.getDrawdownsByPartnerLoanId(partnerLoanId, page, limit);
    const total = await this.countCustomerDrawdowns(partnerLoanId);
    return { data, total, page, limit };
  }

  // =====================================================
  // 🔹 LAN RETRIEVAL FROM LOCAL LOAN ACCOUNTS
  // =====================================================

  /**
   * Get LAN from local loan accounts by customer ID.
   */
  async getLanByCustomerId(
    customerId: number,
  ): Promise<{ lan: string | null; customerId: number }> {
    const loanAccount = await this.getPrimaryLoanAccount(customerId);
    return {
      lan: loanAccount?.lanId || null,
      customerId,
    };
  }

  /**
   * Get LAN from local loan accounts by mobile number.
   */
  async getLanByMobile(
    mobile: string,
  ): Promise<{ lan: string | null; mobile: string }> {
    const customer = await this.findCustomerByMobile(mobile);
    const loanAccount = customer ? await this.getPrimaryLoanAccount(customer.id) : null;
    return {
      lan: loanAccount?.lanId || null,
      mobile,
    };
  }

  /**
   * Get LAN from local loan accounts by local customer id/code.
   */
  async getLanByPartnerLoanId(
    partnerLoanId: string,
  ): Promise<{ lan: string | null; partnerLoanId: string }> {
    const customer = await this.findCustomerById(partnerLoanId);
    const loanAccount = customer ? await this.getPrimaryLoanAccount(customer.id) : null;
    return {
      lan: loanAccount?.lanId || null,
      partnerLoanId,
    };
  }

  /**
   * Get LAN from local loan accounts by loan number.
   */
  async getLanByLoanNumber(
    loanNumber: string,
  ): Promise<{ lan: string | null; loanNumber: string }> {
    const loan = await this.getLoanByNumber(loanNumber);
    return {
      lan: loan?.lan || loan?.loan_number || null,
      loanNumber,
    };
  }

  /**
   * Get all lender labels from local loan accounts for a customer.
   */
  async getAllLans(partnerId: any) {
    const customer = await this.findCustomerById(partnerId);
    if (!customer) return [];

    const loanAccounts = await this.getCustomerLoanAccounts(customer.id);
    return Array.from(
      new Set(
        loanAccounts
          .map((row) => row.lender || row.partner?.code || row.partner?.name || row.lanId)
          .filter(Boolean),
      ),
    );
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
    const customer = await this.findCustomerById(partnerLoanId);
    if (!customer) {
      return { lan: null, lender, partnerLoanId };
    }

    const cleanLender = String(lender || "").trim().toLowerCase();
    const loanAccount = await this.loanAccountRepository
      .createQueryBuilder("loanAccount")
      .leftJoinAndSelect("loanAccount.partner", "partner")
      .where("loanAccount.customerId = :customerId", { customerId: customer.id })
      .andWhere(
        `(LOWER(loanAccount.lender) = :lender
          OR LOWER(partner.code) = :lender
          OR LOWER(partner.name) = :lender
          OR LOWER(loanAccount.lanId) = :lender
          OR LOWER(loanAccount.partnerLanId) = :lender)`,
        { lender: cleanLender },
      )
      .orderBy("loanAccount.createdAt", "DESC")
      .getOne();

    return {
      lan: loanAccount?.lanId || null,
      lender,
      partnerLoanId: this.getTokenPartnerLoanId(customer.id),
    };
  }

  /**
   * Get all LANs with lender from sanction table
   * @param partnerLoanId - Partner loan ID
   */
  async getLansByPartnerLoanId(partnerLoanId: string): Promise<any[]> {
    const customer = await this.findCustomerById(partnerLoanId);
    if (!customer) return [];

    const loanAccounts = await this.getCustomerLoanAccounts(customer.id);
    return loanAccounts.map((loanAccount) => ({
      lan: loanAccount.lanId,
      lender: loanAccount.lender || loanAccount.partner?.code || loanAccount.partner?.name || "",
      partnerLanId: loanAccount.partnerLanId,
    }));
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
    const customer = await this.findCustomerById(partnerLoanId);
    if (!customer) return [];

    const loanAccount = await this.loanAccountRepository.findOne({
      where: { lanId: lan, customerId: customer.id },
      relations: ["partner"],
    });
    if (!loanAccount) return [];

    const invoices = await AppDataSource.getRepository(Invoice).find({
      where: { customerId: customer.id, loanAccountId: loanAccount.id },
      relations: ["supplier", "loanAccount"],
      order: { createdAt: "DESC" },
    });

    return invoices.map((invoice) => ({
      id: invoice.id,
      invoice_number: invoice.invoiceNumber,
      supplier_name: invoice.supplier?.supplierName || "",
      invoice_amount: this.toNumber(invoice.invoiceAmount),
      invoice_due_date: invoice.invoiceDueDate || invoice.dueDate,
      status: invoice.status,
    }));
  }

  /**
   * Get the full details of a single invoice owned by the authenticated customer.
   * @param partnerLoanId - Partner loan ID (authenticated customer)
   * @param invoiceId - Invoice ID
   */
  async getInvoiceFullDetailsById(
    partnerLoanId: string,
    invoiceId: number,
  ): Promise<any> {
    const customer = await this.findCustomerById(partnerLoanId);
    if (!customer) {
      throw new Error("Customer not found");
    }

    const invoice = await AppDataSource.getRepository(Invoice).findOne({
      where: { id: invoiceId, customerId: customer.id },
      relations: ["supplier", "loanAccount", "loanAccount.partner"],
    });

    if (!invoice) {
      throw new Error("Invoice not found");
    }

    return {
      id: invoice.id,
      partner_loan_id: this.getTokenPartnerLoanId(customer.id),
      lan: invoice.loanAccount?.lanId || null,
      lender:
        invoice.loanAccount?.lender ||
        invoice.loanAccount?.partner?.code ||
        invoice.loanAccount?.partner?.name ||
        "",
      invoice_number: invoice.invoiceNumber,
      invoice_date: invoice.invoiceDate,
      invoice_amount: this.toNumber(invoice.invoiceAmount),
      sanction_amount: this.toNumber(invoice.sanctionAmount),
      service_fee: this.toNumber(invoice.serviceFee),
      disbursement_amount: this.toNumber(invoice.disbursementAmount ?? invoice.disbursedAmount),
      disbursement_utr: invoice.disbursementUtr || null,
      disbursement_date: invoice.disbursementDate || invoice.disbursedDate || null,
      invoice_due_date: invoice.invoiceDueDate || invoice.dueDate || null,
      due_date: invoice.dueDate || null,
      invoice_file_path: invoice.invoiceFilePath || null,
      roi_percentage: this.toNumber(invoice.roiPercentage),
      roi_amount: this.toNumber(invoice.roiAmount),
      emi_amount: this.toNumber(invoice.emiAmount),
      penal_charges: this.toNumber(invoice.penalCharges),
      utilized_limit: this.toNumber(invoice.utilizedLimit),
      unutilized_limit: this.toNumber(invoice.unutilizedLimit),
      status: invoice.status,
      approved_via: invoice.approvedVia || null,
      rejection_reason: invoice.rejectionReason || null,
      supplier: invoice.supplier
        ? {
            id: invoice.supplier.id,
            supplier_name: invoice.supplier.supplierName,
            supplier_code: invoice.supplier.supplierCode,
            email: invoice.supplier.email,
            contact_number: invoice.supplier.contactNumber,
          }
        : null,
      created_at: invoice.createdAt,
      updated_at: invoice.updatedAt,
    };
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
