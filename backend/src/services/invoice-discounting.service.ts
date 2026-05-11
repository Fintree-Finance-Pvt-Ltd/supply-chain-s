import { AppDataSource } from "../config/database";
import { Invoice } from "../entities/Invoice";
import { Customer } from "../entities/Customer";
import { Supplier } from "../entities/Supplier";
import { SupplierBankDetail } from "../entities/SupplierBankDetail";
import { CaseWorkflow } from "../entities/CaseWorkflow";
import { CaseStatusHistory } from "../entities/CaseStatusHistory";
import { LoanAccount } from "../entities/LoanAccount";
import { CreditSanction } from "../entities/CreditSanction";
import { Notification } from "../entities/Notification";
import { NodemailerProvider } from "../integrations/notifications/email/nodemailer.provider";
import axios from "axios";
import crypto from "crypto";

/**
 * LMS API Response interfaces
 */
interface LMSValidationResult {
  invoice_number: string;
  status: 'success' | 'failed';
  message: string;
  expected?: number;
  received?: number;
}

interface LMSResponse {
  message: string;
  total: number;
  success_count: number;
  failed_count: number;
  results: LMSValidationResult[];
}

/**
 * Invoice Disbursement Payload for LMS
 */
interface InvoiceDisbursementPayload {
  partner_loan_id: string;
  lan: string;
  invoice_number: string;
  invoice_date: string;
  invoice_amount: number;
  tenure_days: number;
  supplier_name: string;
  supplier_bank_details: {
    bank_account_number: string;
    ifsc_code: string;
    bank_name: string;
    account_holder_name: string;
  };
  disbursement_amount: number;
  disbursement_date: string;
  invoice_due_date: string;
  disbursement_utr: string;
  roi_percentage: number;
  penal_charges: number;
  total_roi_amount: number;
  emi_amount: number;
    service_fee: number; 
}

export class InvoiceDiscountingService {
  private invoiceRepository = AppDataSource.getRepository(Invoice);
  private customerRepository = AppDataSource.getRepository(Customer);
  private supplierRepository = AppDataSource.getRepository(Supplier);
  private supplierBankDetailRepository =
    AppDataSource.getRepository(SupplierBankDetail);
  private workflowRepository = AppDataSource.getRepository(CaseWorkflow);
  private historyRepository = AppDataSource.getRepository(CaseStatusHistory);
  private loanAccountRepository = AppDataSource.getRepository(LoanAccount);
  private creditSanctionRepository =
    AppDataSource.getRepository(CreditSanction);
  private notificationRepository = AppDataSource.getRepository(Notification);
  private emailProvider = new NodemailerProvider({
    host: process.env.SMTP_HOST!,
    port: Number(process.env.SMTP_PORT),
    user: process.env.SMTP_USER!,
    pass: process.env.SMTP_PASS!,
    fromName: process.env.SMTP_FROM_NAME!,
    fromEmail: process.env.SMTP_FROM_EMAIL!,
  });

  // Generate a secure random token
  private generateApprovalToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  // Send approval email to customer
  async sendApprovalEmail(invoiceId: number, baseUrl?: string): Promise<{ success: boolean; message: string }> {
    const invoice = await this.invoiceRepository.findOne({
      where: { id: invoiceId },
      relations: ["customer", "supplier", "loanAccount"],
    });

    if (!invoice) {
      throw new Error("Invoice not found");
    }

    if (invoice.status !== "PENDING_CUSTOMER_APPROVAL") {
      throw new Error("Invoice is not pending customer approval");
    }

    if (!invoice.customerId || !invoice.customer) {
      throw new Error("Customer not found for this invoice");
    }

    const customer = await this.customerRepository.findOne({
      where: { id: invoice.customerId },
    });

    if (!customer?.email && !customer?.companyEmail) {
      throw new Error("Customer email or mobile number not found");
    }
    const customerEmail = customer.email ?? customer.companyEmail!;

    // Generate approval token
    const approvalToken = this.generateApprovalToken();
    const tokenExpiry = new Date();
    tokenExpiry.setHours(tokenExpiry.getHours() + 48); // Token valid for 48 hours

    // Save token to invoice
    invoice.approvalToken = approvalToken;
    invoice.approvalTokenExpiry = tokenExpiry;
    invoice.emailApprovalSent = true;
    invoice.emailApprovalSentAt = new Date();
    await this.invoiceRepository.save(invoice);

    // Build approval URLs
    const approveUrl = `${baseUrl || ''}/lms-customers/invoices/email-approve?token=${approvalToken}&action=approve`;
    const rejectUrl = `${baseUrl || ''}/lms-customers/invoices/email-approve?token=${approvalToken}&action=reject`;

    // Build email HTML
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Invoice Approval Required</h2>
        <p>Dear Customer,</p>
        <p>Your invoice requires your approval. Please review the details below:</p>
        
        <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Invoice Number:</strong> ${invoice.invoiceNumber}</p>
          <p><strong>Invoice Date:</strong> ${invoice.invoiceDate ? new Date(invoice.invoiceDate).toLocaleDateString() : 'N/A'}</p>
          <p><strong>Invoice Amount:</strong> ₹${invoice.invoiceAmount?.toLocaleString() || '0'}</p>
          <p><strong>Supplier:</strong> ${invoice.supplier?.supplierName || 'N/A'}</p>
          <p><strong>Due Date:</strong> ${invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : 'N/A'}</p>
        </div>
        
        <p>Please click one of the buttons below to approve or reject this invoice:</p>
        
        <div style="margin: 30px 0;">
          <a href="${approveUrl}" style="background: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin-right: 10px; display: inline-block;">Approve Invoice</a>
          <a href="${rejectUrl}" style="background: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Reject Invoice</a>
        </div>
        
        <p style="color: #666; font-size: 12px;">
          This approval link will expire in 48 hours.
          You can also approve/reject this invoice through the mobile app.
        </p>
        
        <p style="color: #666; font-size: 12px;">
          If you did not expect this email, please ignore it or contact support.
        </p>
      </div>
    `;

    const textContent = `
      Invoice Approval Required
      
      Dear Customer,
      
      Your invoice requires your approval. Please review the details below:
      
      Invoice Number: ${invoice.invoiceNumber}
      Invoice Date: ${invoice.invoiceDate ? new Date(invoice.invoiceDate).toLocaleDateString() : 'N/A'}
      Invoice Amount: ₹${invoice.invoiceAmount?.toLocaleString() || '0'}
      Supplier: ${invoice.supplier?.supplierName || 'N/A'}
      Due Date: ${invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : 'N/A'}
      
      Please approve or reject this invoice by clicking the link in the email.
      This approval link will expire in 48 hours.
    `;

    try {
      await this.emailProvider.sendEmail(
        customerEmail,
        `Invoice Approval Required - ${invoice.invoiceNumber}`,
        htmlContent,
        textContent
      );

      return {
        success: true,
        message: `Approval email sent successfully to ${customerEmail}`
      };
    } catch (error: any) {
      console.error("Error sending approval email:", error);
      throw new Error(`Failed to send approval email: ${error.message}`);
    }
  }

  // Handle email-based approval
  async processEmailApproval(
    token: string,
    action: "approve" | "reject",
    remarks?: string
  ): Promise<{ success: boolean; message: string; invoice?: Invoice }> {
    // Find invoice by token
    const invoice = await this.invoiceRepository.findOne({
      where: { approvalToken: token },
      relations: ["customer", "supplier"],
    });

    if (!invoice) {
      return { success: false, message: "Invalid approval token" };
    }

    // Check if already approved/rejected
    if (invoice.customerApprovalStatus === "approved") {
      return { 
        success: false, 
        message: "This invoice has already been approved",
        invoice 
      };
    }

    if (invoice.customerApprovalStatus === "rejected") {
      return { 
        success: false, 
        message: "This invoice has already been rejected",
        invoice 
      };
    }

    // Check token expiry
    if (invoice.approvalTokenExpiry && new Date() > invoice.approvalTokenExpiry) {
      return { success: false, message: "Approval token has expired" };
    }

    // Check if invoice is still pending customer approval
    if (invoice.status !== "PENDING_CUSTOMER_APPROVAL") {
      return { 
        success: false, 
        message: `Invoice is not pending customer approval. Current status: ${invoice.status}`,
        invoice 
      };
    }

    const previousStatus = invoice.status;
    
    if (action === "approve") {
      invoice.status = "PENDING_OPS_L1_APPROVAL";
      invoice.customerApprovalStatus = "approved";
      invoice.customerApprovedAt = new Date();
      invoice.approvedVia = "email";
    } else {
      invoice.status = "REJECTED_BY_CUSTOMER";
      invoice.customerApprovalStatus = "rejected";
      invoice.approvedVia = "email";
    }

    invoice.customerRemarks = remarks || "";
    invoice.approvedByCustomerId = invoice.customerId;

    await this.invoiceRepository.save(invoice);

    // Update workflow
    const workflow = await this.createOrGetWorkflow(invoice.id);
    workflow.currentStatus = invoice.status;
    workflow.currentApproverRoleName = this.getApproverForStatus(invoice.status);
    if (action === "reject") {
      workflow.isRejected = true;
    }
    workflow.remarks = remarks || `Invoice ${action}d via email`;
    await this.workflowRepository.save(workflow);

    // Log history
    await this.logHistory({
      customerId: invoice.customerId,
      supplierId: invoice.supplierId,
      invoiceId: invoice.id,
      caseWorkflowId: workflow.id,
      status: invoice.status,
      previousStatus,
      changedBy: invoice.customerId,
      remarks: remarks || `Invoice ${action}d by customer via email`,
    });

    return {
      success: true,
      message: `Invoice ${action}d successfully via email`,
      invoice
    };
  }

  private getApproverForStatus(status: string): string {
    switch (status) {
      case "DRAFT":
        return "RM";
      case "PENDING_CUSTOMER_APPROVAL":
        return "CUSTOMER";
      case "REJECTED_BY_CUSTOMER":
        return "RM";
      case "PENDING_OPS_L1_APPROVAL":
        return "OPS_L1";
      case "PENDING_OPS_L2_APPROVAL":
        return "OPS_L2";
      case "PENDING_MD_APPROVAL":
        return "MD";
      case "PENDING_OPS_HEAD_APPROVAL":
        return "OPS_HEAD";
      case "DISBURSEMENT_DATA_ENTRY":
        return "OPS_L1";
      case "PENDING_FINAL_OPS_L2_APPROVAL":
        return "OPS_L2";
      case "ACTIVE":
        return "None";
      case "REJECTED":
        return "RM";
      default:
        return "RM";
    }
  }

  private async createOrGetWorkflow(invoiceId: number): Promise<CaseWorkflow> {
    let workflow = await this.workflowRepository.findOne({
      where: { invoiceId, workflowType: "INVOICE_DISCOUNTING" as any },
    });

    if (!workflow) {
      const invoice = await this.invoiceRepository.findOne({
        where: { id: invoiceId },
      });
      if (!invoice) throw new Error("Invoice not found");

      workflow = this.workflowRepository.create({
        workflowType: "INVOICE_DISCOUNTING" as any,
        invoiceId: invoice.id,
        customerId: invoice.customerId,
        supplierId: invoice.supplierId,
        currentStatus: invoice.status,
        currentApproverRoleName: this.getApproverForStatus(invoice.status),
      });
      workflow = await this.workflowRepository.save(workflow);
    }

    return workflow;
  }

  private async logHistory(data: {
    customerId: number;
    supplierId?: number;
    invoiceId?: number;
    caseWorkflowId?: number;
    status: string;
    previousStatus: string;
    changedBy: number;
    remarks?: string;
  }) {
    const history = this.historyRepository.create({
      ...data,
      status: data.status as any,
      previousStatus: data.previousStatus as any,
      changedBy: data.changedBy,
      remarks: data.remarks,
    });
    return await this.historyRepository.save(history);
  }

  // STEP 1: RM - Get Customer and LAN Selection
  async getCustomersByRM(rmId: number) {
    return this.customerRepository.find({
      where: { rmId, status: "completed" },
      select: ["id", "name", "companyName", "mobile", "email"],
    });
  }

  async getLANsByCustomer(customerId: number) {
    return this.loanAccountRepository.find({
      where: { customerId, status: "active" },
      select: [
        "id",
        "lanId",
        "sanctionedAmount",
        "disbursedAmount",
        "partnerId",
        "lender",
      ],
    });
  }

  async getCustomerById(customerId: number) {
    return this.customerRepository.findOne({
      where: { id: customerId },
      select: ["id", "name", "companyName", "mobile", "email"],
    });
  }

  // STEP 2: RM - Supplier Selection
  async getSuppliersByCustomer(customerId: number) {
    return this.supplierRepository.find({
      where: { customerId, isActive: true, status: "COMPLETED" },
      select: ["id", "supplierName", "supplierCode", "email", "contactNumber"],
    });
  }

  async getSupplierBankDetails(supplierId: number) {
    return this.supplierBankDetailRepository.findOne({
      where: { supplierId },
      select: [
        "id",
        "bankAccountNumber",
        "bankName",
        "ifscCode",
        "accountHolderName",
        "micrCode",
      ],
    });
  }

  // STEP 3: RM - Invoice Entry
  async createInvoice(
    data: {
      customerId: number;
      loanAccountId: number;
      supplierId: number;
      invoiceNumber: string;
      invoiceDate: string;
      invoiceAmount: number;
      disbursementAmount: number;
      roiPercentage?: number;
      penalCharges?: number;
        serviceFee?: number;
          invoiceFilePath?: string;

    },
    rmId: number,
  ) {
    const customer = await this.customerRepository.findOne({
      where: { id: data.customerId, status: "completed" },
    });
    if (!customer) {
      throw new Error("Customer must be fully approved (COMPLETED status)");
    }

    const supplier = await this.supplierRepository.findOne({
      where: { id: data.supplierId, status: "COMPLETED", isActive: true },
    });
    if (!supplier) {
      throw new Error("Supplier must be fully approved and active");
    }

    const loanAccount = await this.loanAccountRepository.findOne({
      where: { id: data.loanAccountId, customerId: data.customerId },
    });
    if (!loanAccount) {
      throw new Error("Invalid Loan Account Number (LAN) for this customer");
    }

    const existingInvoice = await this.invoiceRepository.findOne({
      where: { invoiceNumber: data.invoiceNumber },
    });
    if (existingInvoice) {
      throw new Error("Invoice number already exists");
    }

    const invoice = this.invoiceRepository.create({
      ...data,
      
        // ✅ save uploaded invoice path
  invoiceFilePath: data.invoiceFilePath,
      invoiceDate: new Date(data.invoiceDate),
      createdByUserId: rmId,
      status: "DRAFT",
    });


    const savedInvoice = await this.invoiceRepository.save(invoice);

    const workflow = this.workflowRepository.create({
      workflowType: "INVOICE_DISCOUNTING" as any,
      invoiceId: savedInvoice.id,
      customerId: data.customerId,
      supplierId: data.supplierId,
      currentStatus: "DRAFT",
      currentApproverRoleName: "RM",
    });
    const savedWorkflow = await this.workflowRepository.save(workflow);

    await this.logHistory({
      customerId: data.customerId,
      supplierId: data.supplierId,
      invoiceId: savedInvoice.id,
      caseWorkflowId: savedWorkflow.id,
      status: "DRAFT",
      previousStatus: "None",
      changedBy: rmId,
      remarks: "Invoice created in Draft state",
    });

    return { invoice: savedInvoice, workflow: savedWorkflow };
  }

  async saveInvoice(
    invoiceId: number,
    data: {
      invoiceNumber?: string;
      invoiceDate?: string;
      invoiceAmount?: number;
      disbursementAmount?: number;
      roiPercentage?: number;
      penalCharges?: number;
        serviceFee?: number; 
    },
    userId: number,
  ) {
    const invoice = await this.invoiceRepository.findOne({
      where: { id: invoiceId },
    });
    if (!invoice) throw new Error("Invoice not found");
    if (invoice.status !== "DRAFT") {
      throw new Error("Can only save draft invoices");
    }
    Object.assign(invoice, data);
    if (data.invoiceDate) {
      invoice.invoiceDate = new Date(data.invoiceDate);
    }
    return await this.invoiceRepository.save(invoice);
  }

  async submitInvoice(invoiceId: number, userId: number, remarks?: string) {
    const invoice = await this.invoiceRepository.findOne({
      where: { id: invoiceId },
    });
    if (!invoice) throw new Error("Invoice not found");
    if (invoice.status !== "DRAFT") {
      throw new Error("Can only submit draft invoices");
    }

    const previousStatus = invoice.status;
    invoice.status = "PENDING_CUSTOMER_APPROVAL";
    await this.invoiceRepository.save(invoice);

    const workflow = await this.createOrGetWorkflow(invoiceId);
    workflow.currentStatus = "PENDING_CUSTOMER_APPROVAL";
    workflow.currentApproverRoleName = "CUSTOMER";
    workflow.remarks = remarks || "";
    await this.workflowRepository.save(workflow);

    await this.logHistory({
      customerId: invoice.customerId,
      supplierId: invoice.supplierId,
      invoiceId: invoice.id,
      caseWorkflowId: workflow.id,
      status: "PENDING_CUSTOMER_APPROVAL",
      previousStatus,
      changedBy: userId,
      remarks: remarks || "Invoice submitted for customer approval",
    });

    await this.sendCustomerNotification(invoice.customerId, invoice.id);
    return { invoice, workflow };
  }

  private async sendCustomerNotification(
    customerId: number,
    invoiceId: number,
  ) {
    const notification = this.notificationRepository.create({
      customerId,
      title: "Invoice Approval Required",
      message: `Your invoice #${invoiceId} requires approval. Please review and approve/reject in the mobile app.`,
      type: "INVOICE" as any,
      readStatus: "UNREAD",
      referenceType: "INVOICE",
      referenceId: invoiceId,
    });
    await this.notificationRepository.save(notification);
  }

  // STEP 4: Customer - Review and Approval (Mobile App)
  async getCustomerInvoiceDetails(invoiceId: number, customerId: number) {
    const invoice = await this.invoiceRepository.findOne({
      where: { id: invoiceId, customerId },
      relations: ["customer", "loanAccount", "supplier"],
    });
    if (!invoice) {
      throw new Error("Invoice not found");
    }
    const supplierBankDetail = await this.supplierBankDetailRepository.findOne({
      where: { supplierId: invoice.supplierId },
    });
    return { ...invoice, supplierBankDetail };
  }

  async customerApproval(
    invoiceId: number,
    customerId: number | null,
    action: "approve" | "reject",
    remarks?: string,
  ) {

    const invoice = await this.invoiceRepository.findOne({ where: { id: invoiceId } });
    if (!invoice) {
      throw new Error("Invoice not found");
    }
    if (!invoice.customerId) {
      throw new Error("Customer ID is missing for history logging");
    }
    const customer = await this.customerRepository.findOne({
      where: { id: invoice.customerId },
    });

    if (!customer) {
      throw new Error(`Customer not found for ID ${invoice.customerId}`);
    }

    // Check if already approved/rejected (from email or mobile)
    if (invoice.customerApprovalStatus === "approved") {
      throw new Error("This invoice has already been approved");
    }
    if (invoice.customerApprovalStatus === "rejected") {
      throw new Error("This invoice has already been rejected");
    }

    if (invoice.status !== "PENDING_CUSTOMER_APPROVAL") {
      throw new Error("Invoice is not pending customer approval");
    }

    const previousStatus = invoice.status;
    if (action === "approve") {
      invoice.status = "PENDING_OPS_L1_APPROVAL";
      invoice.customerApprovalStatus = "approved";
      invoice.customerApprovedAt = new Date();
      invoice.approvedVia = "mobile";
    } else {
      invoice.status = "REJECTED_BY_CUSTOMER";
      invoice.customerApprovalStatus = "rejected";
      invoice.approvedVia = "mobile";
    }
    invoice.customerRemarks = remarks || "";

    // Store customer approval info
    invoice.approvedByCustomerId = invoice.customerId;

    await this.invoiceRepository.save(invoice);

    const workflow = await this.createOrGetWorkflow(invoiceId);
    workflow.currentStatus = invoice.status;
    workflow.currentApproverRoleName = this.getApproverForStatus(
      invoice.status,
    );
    if (action === "reject") {
      workflow.isRejected = true;
    }
    workflow.remarks = remarks || "";
    await this.workflowRepository.save(workflow);

    // Use RM's user ID for changedBy (foreign key references users table)
    // The customer.rmId is the Relationship Manager's user ID
    await this.logHistory({
      customerId: invoice.customerId,
      supplierId: invoice.supplierId,
      invoiceId: invoice.id,
      caseWorkflowId: workflow.id,
      status: invoice.status,
      previousStatus,
      changedBy: customer.rmId,
      remarks: remarks || `Invoice ${action}d by customer`,
    });

    return { invoice, workflow };
  }

  async getCustomerPendingInvoices(customerId?: number) {
    return this.invoiceRepository.find({
      where: { customerId, status: "PENDING_CUSTOMER_APPROVAL" as any },
      relations: ["supplier", "loanAccount"],
    });
  }

  // STEP 5: OPS L1 - Verification
  async getOPSL1PendingInvoices() {
    console.log(
      "[OPS L1] Fetching pending invoices with status: PENDING_OPS_L1_APPROVAL",
    );
    const invoices = await this.invoiceRepository.find({
      where: { status: "PENDING_OPS_L1_APPROVAL" as any },
      relations: ["customer", "supplier", "loanAccount"],
    });
    console.log(`[OPS L1] Found ${invoices.length} pending invoices`);
    if (invoices.length > 0) {
      console.log(
        "[OPS L1] Invoice IDs:",
        invoices.map((i) => i.id),
      );
    }
    return invoices;
  }

  async opsL1Verification(
    invoiceId: number,
    userId: number,
    action: "approve" | "reject",
    remarks?: string,
  ) {
    const invoice = await this.invoiceRepository.findOne({
      where: { id: invoiceId },
      relations: ["customer", "supplier"],
    });
    if (!invoice) throw new Error("Invoice not found");
    if (invoice.status !== "PENDING_OPS_L1_APPROVAL") {
      throw new Error("Invoice is not pending OPS L1 approval");
    }

    const previousStatus = invoice.status;
    const newStatus =
      action === "approve" ? "PENDING_OPS_L2_APPROVAL" : "REJECTED";
    invoice.status = newStatus;
    await this.invoiceRepository.save(invoice);

    const workflow = await this.createOrGetWorkflow(invoiceId);
    workflow.currentStatus = newStatus;
    workflow.currentApproverRoleName = this.getApproverForStatus(newStatus);
    if (action === "reject") {
      workflow.isRejected = true;
    }
    workflow.remarks = remarks || "";
    await this.workflowRepository.save(workflow);

    await this.logHistory({
      customerId: invoice.customerId,
      supplierId: invoice.supplierId,
      invoiceId: invoice.id,
      caseWorkflowId: workflow.id,
      status: newStatus,
      previousStatus,
      changedBy: userId,
      remarks: remarks || `OPS L1 ${action}d the invoice`,
    });

    return { invoice, workflow };
  }

  // STEP 6: OPS L2 - Verification
  async getOPSL2PendingInvoices() {
    return this.invoiceRepository.find({
      where: { status: "PENDING_OPS_L2_APPROVAL" as any },
      relations: ["customer", "supplier", "loanAccount"],
    });
  }

  async opsL2Verification(
    invoiceId: number,
    userId: number,
    action: "approve" | "reject",
    remarks?: string,
  ) {
    const invoice = await this.invoiceRepository.findOne({
      where: { id: invoiceId },
      relations: ["customer", "supplier"],
    });
    if (!invoice) throw new Error("Invoice not found");
    if (invoice.status !== "PENDING_OPS_L2_APPROVAL") {
      throw new Error("Invoice is not pending OPS L2 approval");
    }

    const previousStatus = invoice.status;
    const newStatus = action === "approve" ? "PENDING_MD_APPROVAL" : "REJECTED";
    invoice.status = newStatus;
    await this.invoiceRepository.save(invoice);

    const workflow = await this.createOrGetWorkflow(invoiceId);
    workflow.currentStatus = newStatus;
    workflow.currentApproverRoleName = this.getApproverForStatus(newStatus);
    if (action === "reject") {
      workflow.isRejected = true;
    }
    workflow.remarks = remarks || "";
    await this.workflowRepository.save(workflow);

    await this.logHistory({
      customerId: invoice.customerId,
      supplierId: invoice.supplierId,
      invoiceId: invoice.id,
      caseWorkflowId: workflow.id,
      status: newStatus,
      previousStatus,
      changedBy: userId,
      remarks: remarks || `OPS L2 ${action}d the invoice`,
    });

    return { invoice, workflow };
  }

  // STEP 7: MD - Approval
  async getMDPendingInvoices() {
    return this.invoiceRepository.find({
      where: { status: "PENDING_MD_APPROVAL" as any },
      relations: ["customer", "supplier", "loanAccount"],
    });
  }

  async mdApproval(
    invoiceId: number,
    userId: number,
    action: "approve" | "reject",
    remarks?: string,
  ) {
    const invoice = await this.invoiceRepository.findOne({
      where: { id: invoiceId },
      relations: ["customer", "supplier"],
    });
    if (!invoice) throw new Error("Invoice not found");
    if (invoice.status !== "PENDING_MD_APPROVAL") {
      throw new Error("Invoice is not pending MD approval");
    }

    const previousStatus = invoice.status;
    const newStatus =
      action === "approve" ? "PENDING_OPS_HEAD_APPROVAL" : "REJECTED";
    invoice.status = newStatus;
    await this.invoiceRepository.save(invoice);

    const workflow = await this.createOrGetWorkflow(invoiceId);
    workflow.currentStatus = newStatus;
    workflow.currentApproverRoleName = this.getApproverForStatus(newStatus);
    if (action === "reject") {
      workflow.isRejected = true;
    }
    workflow.remarks = remarks || "";
    await this.workflowRepository.save(workflow);

    await this.logHistory({
      customerId: invoice.customerId,
      supplierId: invoice.supplierId,
      invoiceId: invoice.id,
      caseWorkflowId: workflow.id,
      status: newStatus,
      previousStatus,
      changedBy: userId,
      remarks: remarks || `MD ${action}d the invoice`,
    });

    return { invoice, workflow };
  }

  // STEP 8: OPS Head - Approval
  async getOPSHeadPendingInvoices() {
    return this.invoiceRepository.find({
      where: { status: "PENDING_OPS_HEAD_APPROVAL" as any },
      relations: ["customer", "supplier", "loanAccount"],
    });
  }

  async opsHeadApproval(
    invoiceId: number,
    userId: number,
    action: "approve" | "reject",
    remarks?: string,
  ) {
    const invoice = await this.invoiceRepository.findOne({
      where: { id: invoiceId },
      relations: ["customer", "supplier"],
    });
    if (!invoice) throw new Error("Invoice not found");
    if (invoice.status !== "PENDING_OPS_HEAD_APPROVAL") {
      throw new Error("Invoice is not pending OPS Head approval");
    }

    const previousStatus = invoice.status;
    const newStatus =
      action === "approve" ? "DISBURSEMENT_DATA_ENTRY" : "REJECTED";
    invoice.status = newStatus;
    await this.invoiceRepository.save(invoice);

    const workflow = await this.createOrGetWorkflow(invoiceId);
    workflow.currentStatus = newStatus;
    workflow.currentApproverRoleName = this.getApproverForStatus(newStatus);
    if (action === "reject") {
      workflow.isRejected = true;
    }
    workflow.remarks = remarks || "";
    await this.workflowRepository.save(workflow);

    await this.logHistory({
      customerId: invoice.customerId,
      supplierId: invoice.supplierId,
      invoiceId: invoice.id,
      caseWorkflowId: workflow.id,
      status: newStatus,
      previousStatus,
      changedBy: userId,
      remarks: remarks || `OPS Head ${action}d the invoice`,
    });

    return { invoice, workflow };
  }

  // STEP 9: OPS L1 - Disbursement Data Entry
  async getDisbursementEntryInvoices() {
    console.log(
      "[Disbursement Entry] Fetching invoices with status: DISBURSEMENT_DATA_ENTRY",
    );
    const invoices = await this.invoiceRepository.find({
      where: { status: "DISBURSEMENT_DATA_ENTRY" as any },
      relations: ["customer", "supplier", "loanAccount"],
    });
    console.log(`[Disbursement Entry] Found ${invoices.length} invoices`);
    if (invoices.length > 0) {
      console.log(
        "[Disbursement Entry] Invoice IDs:",
        invoices.map((i) => i.id),
      );
    }
    return invoices;
  }

  async getROIPercentage(loanAccountId: number): Promise<number> {
    try {
      const loanAccount = await this.loanAccountRepository.findOne({
        where: { id: loanAccountId },
        relations: ["partner"],
      });
      if (!loanAccount) {
        throw new Error(
          `Loan Account ${loanAccountId} not found while fetching ROI`,
        );
      }

      // Try to get partner code from partner relation first, then fall back to lender
      let partnerCode: string | null = null;
      if (loanAccount.partner?.code) {
        partnerCode = loanAccount.partner.code;
      } else if (loanAccount.lender) {
        // Fallback to deprecated lender field
        partnerCode = loanAccount.lender;
      }

      if (!partnerCode) {
        throw new Error(
          `No partner code found for Loan Account ${loanAccountId} while fetching ROI`,
        );
      }

      // Step 1: Find ROI from existing invoices for this loan account
      const latestInvoiceWithRoi = await this.invoiceRepository
        .createQueryBuilder("invoice")
        .where("invoice.loanAccountId = :loanAccountId", {
          loanAccountId: loanAccount.id,
        })
        .andWhere("invoice.roiPercentage IS NOT NULL")
        .orderBy("invoice.createdAt", "DESC")
        .getOne();

      if (
        latestInvoiceWithRoi?.roiPercentage !== null &&
        latestInvoiceWithRoi?.roiPercentage !== undefined
      ) {
        console.log(
          `ROI ${latestInvoiceWithRoi.roiPercentage}% found from invoice ${latestInvoiceWithRoi.id} for loan account ${loanAccountId}`,
        );
        return Number(latestInvoiceWithRoi.roiPercentage);
      }

      // Step 2: Fallback to credit sanction for this customer and partner
      const creditSanction = await this.creditSanctionRepository.findOne({
        where: {
          customerId: loanAccount.customerId,
          partner: partnerCode,
          status: "approved",
        },
        order: { createdAt: "DESC" },
      });

      if (
        creditSanction?.interestRate !== null &&
        creditSanction?.interestRate !== undefined
      ) {
        console.log(
          `ROI ${creditSanction.interestRate}% found from credit sanction for customer ${loanAccount.customerId} and partner ${partnerCode}`,
        );
        return Number(creditSanction.interestRate);
      }

      throw new Error(
        `No ROI found for loan account ${loanAccountId} (customer ${loanAccount.customerId}, partner ${partnerCode})`,
      );
    } catch (error) {
      console.error("Error fetching ROI percentage:", error);
      throw error;
    }
  }

  async getPenalCharges(loanAccountId: number): Promise<number> {
    try {
      const loanAccount = await this.loanAccountRepository.findOne({
        where: { id: loanAccountId },
        relations: ["partner"],
      });
      if (!loanAccount) {
        throw new Error(
          `Loan Account ${loanAccountId} not found while fetching penal charges`,
        );
      }

      // Try to get partner code from partner relation first, then fall back to lender
      let partnerCode: string | null = null;
      if (loanAccount.partner?.code) {
        partnerCode = loanAccount.partner.code;
      } else if (loanAccount.lender) {
        partnerCode = loanAccount.lender;
      }

      if (!partnerCode) {
        throw new Error(
          `No partner code found for Loan Account ${loanAccountId} while fetching penal charges`,
        );
      }

      // Step 1: Find penal charges from existing invoices for this loan account
      const latestInvoiceWithPenal = await this.invoiceRepository
        .createQueryBuilder("invoice")
        .where("invoice.loanAccountId = :loanAccountId", {
          loanAccountId: loanAccount.id,
        })
        .andWhere("invoice.penalCharges IS NOT NULL")
        .orderBy("invoice.createdAt", "DESC")
        .getOne();

      if (
        latestInvoiceWithPenal?.penalCharges !== null &&
        latestInvoiceWithPenal?.penalCharges !== undefined
      ) {
        console.log(
          `Penal charges ${latestInvoiceWithPenal.penalCharges}% found from invoice ${latestInvoiceWithPenal.id} for loan account ${loanAccountId}`,
        );
        return Number(latestInvoiceWithPenal.penalCharges);
      }

      // Step 2: Fallback to credit sanction for this customer and partner
      const creditSanction = await this.creditSanctionRepository.findOne({
        where: {
          customerId: loanAccount.customerId,
          partner: partnerCode,
          status: "approved",
        },
        order: { createdAt: "DESC" },
      });

      if (
        creditSanction?.penalCharges !== null &&
        creditSanction?.penalCharges !== undefined
      ) {
        console.log(
          `Penal charges ${creditSanction.penalCharges}% found from credit sanction for customer ${loanAccount.customerId} and partner ${partnerCode}`,
        );
        return Number(creditSanction.penalCharges);
      }

      throw new Error(
        `No penal charges found for loan account ${loanAccountId} (customer ${loanAccount.customerId}, partner ${partnerCode})`,
      );
    } catch (error) {
      console.error("Error fetching penal charges:", error);
      throw error;
    }
  }

  async disburseInvoice(
    invoiceId: number,
    userId: number,
    data: {
      disbursementUtr: string;
      disbursementDate: string;
    },
  ) {
    const invoice = await this.invoiceRepository.findOne({
      where: { id: invoiceId },
      relations: ["loanAccount"],
    });
    if (!invoice) throw new Error("Invoice not found");
    if (invoice.status !== "DISBURSEMENT_DATA_ENTRY") {
      throw new Error("Invoice is not in disbursement data entry stage");
    }
    //console.log(invoice.disbursementAmount, invoice.invoiceAmount);
    // Validate disbursement amount doesn't exceed invoice amount (compare as numbers)
    if (Number(invoice.disbursementAmount) > Number(invoice.invoiceAmount)) {
      throw new Error("Disbursement amount cannot exceed invoice amount");
    }

    const disbursementDate = new Date(data.disbursementDate);
    const invoiceDueDate = new Date(disbursementDate);
    invoiceDueDate.setDate(invoiceDueDate.getDate() + 90);

    const roiPercentage = invoice.roiPercentage ?? await this.getROIPercentage(invoice.loanAccountId!);
    const penalCharges = invoice.penalCharges ?? await this.getPenalCharges(invoice.loanAccountId!);
    const totalRoiAmount =
      (invoice.disbursementAmount! * roiPercentage * 90) / 365;
    const emiAmount = invoice.disbursementAmount! + totalRoiAmount;

    const previousStatus = invoice.status;

    invoice.disbursementUtr = data.disbursementUtr;
    invoice.disbursementDate = disbursementDate;
    invoice.invoiceDueDate = invoiceDueDate;
    invoice.roiPercentage = roiPercentage;
    invoice.penalCharges = penalCharges;
    invoice.roiAmount = totalRoiAmount;
    invoice.emiAmount = emiAmount;
    invoice.status = "PENDING_FINAL_OPS_L2_APPROVAL";
    await this.invoiceRepository.save(invoice);

    const workflow = await this.createOrGetWorkflow(invoiceId);
    workflow.currentStatus = "PENDING_FINAL_OPS_L2_APPROVAL";
    workflow.currentApproverRoleName = "OPS_L2";
    await this.workflowRepository.save(workflow);

    await this.logHistory({
      customerId: invoice.customerId,
      supplierId: invoice.supplierId,
      invoiceId: invoice.id,
      caseWorkflowId: workflow.id,
      status: "PENDING_FINAL_OPS_L2_APPROVAL",
      previousStatus,
      changedBy: userId,
      remarks: `Disbursement entry: UTR=${data.disbursementUtr}, ROI=${roiPercentage}%, Penal=${penalCharges}%, EMI=${emiAmount}`,
    });

    return { invoice, workflow };
  }

  // STEP 10: OPS L2 - Final Verification
  async getFinalOPSL2PendingInvoices() {
    return this.invoiceRepository.find({
      where: { status: "PENDING_FINAL_OPS_L2_APPROVAL" as any },
      relations: ["customer", "supplier", "loanAccount"],
    });
  }

  // async opsL2FinalVerification(
  //   invoiceId: number,
  //   userId: number,
  //   action: "approve" | "reject",
  //   remarks?: string,
  // ) {
  //   const invoice = await this.invoiceRepository.findOne({
  //     where: { id: invoiceId },
  //     relations: ["customer", "supplier"],
  //   });
  //   if (!invoice) throw new Error("Invoice not found");
  //   if (invoice.status !== "PENDING_FINAL_OPS_L2_APPROVAL") {
  //     throw new Error("Invoice is not pending final OPS L2 approval");
  //   }

  //   const previousStatus = invoice.status;
  //   let lmsResult: { success: boolean; lmsResponse?: any; error?: string } | null = null;
    
  //   if (action === "approve") {
  //     invoice.status = "ACTIVE";
  //     if (invoice.loanAccountId) {
  //       const loanAccount = await this.loanAccountRepository.findOne({
  //         where: { id: invoice.loanAccountId },
  //       });
  //       if (loanAccount) {
  //         loanAccount.disbursedAmount =
  //           (loanAccount.disbursedAmount || 0) + invoice.disbursementAmount!;
  //         await this.loanAccountRepository.save(loanAccount);
  //       }
  //     }
      
  //     // Automatically send to LMS after successful disbursement
  //     try {
  //       console.log(`[Auto-LMS] Sending invoice ${invoiceId} to LMS after disbursement...`);
  //       lmsResult = await this.sendSingleToLMS(invoiceId);
  //       if (lmsResult.success) {
  //         console.log(`[Auto-LMS] Invoice ${invoiceId} sent to LMS successfully`);
  //       } else {
  //         console.error(`[Auto-LMS] Failed to send invoice ${invoiceId} to LMS:`, lmsResult.error);
  //       }
  //     } catch (lmsError: any) {
  //       console.error(`[Auto-LMS] Error sending invoice ${invoiceId} to LMS:`, lmsError.message);
  //       lmsResult = { success: false, error: lmsError.message };
  //     }
  //   } else {
  //     invoice.status = "REJECTED";
  //   }
  //   await this.invoiceRepository.save(invoice);

  //   const workflow = await this.createOrGetWorkflow(invoiceId);
  //   workflow.currentStatus = invoice.status;
  //   workflow.currentApproverRoleName = this.getApproverForStatus(
  //     invoice.status,
  //   );
  //   workflow.isCompleted = action === "approve";
  //   if (action === "approve") {
  //     workflow.completedDate = new Date();
  //   }
  //   if (action === "reject") {
  //     workflow.isRejected = true;
  //   }
  //   workflow.remarks = remarks || "";
  //   await this.workflowRepository.save(workflow);

  //   await this.logHistory({
  //     customerId: invoice.customerId,
  //     supplierId: invoice.supplierId,
  //     invoiceId: invoice.id,
  //     caseWorkflowId: workflow.id,
  //     status: invoice.status,
  //     previousStatus,
  //     changedBy: userId,
  //     remarks: remarks || `OPS L2 final verification: ${action}d`,
  //   });

  //   return { invoice, workflow, lmsResult };
  // }

  async opsL2FinalVerification(
  invoiceId: number,
  userId: number,
  action: "approve" | "reject",
  remarks?: string,
) {
  const invoice = await this.invoiceRepository.findOne({
    where: { id: invoiceId },
    relations: ["customer", "supplier"],
  });

  if (!invoice) throw new Error("Invoice not found");

  if (invoice.status !== "PENDING_FINAL_OPS_L2_APPROVAL") {
    throw new Error("Invoice is not pending final OPS L2 approval");
  }

  const previousStatus = invoice.status;
  let lmsResult: { success: boolean; lmsResponse?: any; error?: string } | null = null;

  if (action === "approve") {

    // 🔴 FIRST send to LMS before making ANY DB updates
    try {
      console.log(`[Auto-LMS] Sending invoice ${invoiceId} to LMS after disbursement...`);

      lmsResult = await this.sendSingleToLMS(invoiceId);

      if (!lmsResult.success) {
        throw new Error(lmsResult.error || "LMS send failed");
      }

      console.log(`[Auto-LMS] Invoice ${invoiceId} sent to LMS successfully`);
    } catch (error: any) {
      console.error(`[Auto-LMS] Error sending invoice ${invoiceId} to LMS:`, error.message);

      // ⛔ STOP EXECUTION — nothing should change
      throw new Error(`LMS sync failed. Approval halted. Reason: ${error.message}`);
    }

    // ✅ Only update AFTER LMS success
    invoice.status = "ACTIVE";

    if (invoice.loanAccountId) {
      const loanAccount = await this.loanAccountRepository.findOne({
        where: { id: invoice.loanAccountId },
      });

      if (loanAccount) {
        loanAccount.disbursedAmount =
          (loanAccount.disbursedAmount || 0) + invoice.disbursementAmount!;

        await this.loanAccountRepository.save(loanAccount);
      }
    }

  } else {
    invoice.status = "REJECTED";
  }

  await this.invoiceRepository.save(invoice);

  const workflow = await this.createOrGetWorkflow(invoiceId);

  workflow.currentStatus = invoice.status;
  workflow.currentApproverRoleName = this.getApproverForStatus(invoice.status);
  workflow.isCompleted = action === "approve";

  if (action === "approve") {
    workflow.completedDate = new Date();
  }

  if (action === "reject") {
    workflow.isRejected = true;
  }

  workflow.remarks = remarks || "";

  await this.workflowRepository.save(workflow);

  await this.logHistory({
    customerId: invoice.customerId,
    supplierId: invoice.supplierId,
    invoiceId: invoice.id,
    caseWorkflowId: workflow.id,
    status: invoice.status,
    previousStatus,
    changedBy: userId,
    remarks: remarks || `OPS L2 final verification: ${action}d`,
  });

  return { invoice, workflow, lmsResult };
}

  // Dashboard and Retrieval Methods
  async getInvoiceById(invoiceId: number) {
    return this.invoiceRepository.findOne({
      where: { id: invoiceId },
     // relations: ["customer", "supplier", "supplier.bankDetail", "loanAccount"],
    });
  }

  async getRMInvoices(rmId: number) {
    return this.invoiceRepository.find({
      where: { createdByUserId: rmId },
      relations: ["customer", "supplier", "loanAccount"],
      order: { createdAt: "DESC" },
    });
  }

  async getAllInvoicesByStatus(status: string) {
    return this.invoiceRepository.find({
      where: { status: status as any },
      relations: ["customer", "supplier", "loanAccount"],
    });
  }

  async getActiveInvoices() {
    return this.invoiceRepository.find({
      where: { status: "ACTIVE" as any },
      relations: ["customer", "supplier", "loanAccount"],
    });
  }

  // Legacy methods for backward compatibility
  async getRMInvoiceDashboard(rmId: number) {
    const invoices = await this.getRMInvoices(rmId);
    const totalDisbursed = invoices
      .filter((i) => i.status === "ACTIVE")
      .reduce((sum, i) => sum + (i.disbursementAmount || 0), 0);

    return {
      totalInvoices: invoices.length,
      draft: invoices.filter((i) => i.status === "DRAFT").length,
      pending: invoices.filter((i) => i.status === "PENDING_CUSTOMER_APPROVAL")
        .length,
      active: invoices.filter((i) => i.status === "ACTIVE").length,
      rejected: invoices.filter((i) => i.status === "REJECTED").length,
      totalAmount: invoices.reduce((sum, i) => sum + i.invoiceAmount, 0),
      totalDisbursed,
      invoices,
    };
  }

  async getInvoiceDetails(invoiceId: number) {
    return this.getInvoiceById(invoiceId);
  }

  async getPendingInvoices(role: string) {
    const statusMap: { [key: string]: string } = {
      OPS_L1: "PENDING_OPS_L1_APPROVAL",
      OPS_L2: "PENDING_OPS_L2_APPROVAL",
      OPS_HEAD: "PENDING_OPS_HEAD_APPROVAL",
      MD: "PENDING_MD_APPROVAL",
    };
    const status = statusMap[role];
    if (!status) {
      return [];
    }
    return this.invoiceRepository.find({
      where: { status: status as any },
      relations: ["customer", "supplier", "loanAccount"],
    });
  }

  // ============================================
  // ADDITIONAL METHODS FOR ROUTES
  // ============================================

  // Get all approved customers for RM (without rmId filter)
  // Uses getCustomersByRM internally - just returns all completed customers
  async getCustomersForRM() {
    return this.customerRepository.find({
      where: { status: "completed" },
    });
  }

  // Alias methods for route compatibility
  async getOPS1PendingInvoices() {
    return this.getOPSL1PendingInvoices();
  }

  async getOPS2PendingInvoices() {
    return this.getOPSL2PendingInvoices();
  }

  async getFinalVerificationInvoices() {
    return this.getFinalOPSL2PendingInvoices();
  }

  async enterDisbursementData(
    invoiceId: number,
    userId: number,
    data: {
      disbursementUtr: string;
      disbursementDate: string;
      invoiceDueDate?: string;
      loanAccountId?: number;
    },
  ) {
    return this.disburseInvoice(invoiceId, userId, data);
  }

  async finalOPS2Verification(
    invoiceId: number,
    userId: number,
    approved: boolean,
    remarks: string,
  ) {
    return this.opsL2FinalVerification(
      invoiceId,
      userId,
      approved ? "approve" : "reject",
      remarks,
    );
  }

  // ============================================
  // LMS INTEGRATION METHODS
  // ============================================

  /**
   * Format date to YYYY-MM-DD
   */
  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Calculate total ROI amount
   * Formula: (disbursement_amount × roi_percentage × 90) / 365
   */
  private calculateTotalRoiAmount(
    disbursementAmount: number,
    roiPercentage: number,
    tenureDays: number
  ): number {
    const roiAmount = (disbursementAmount * roiPercentage * tenureDays) / 365;
    return Number(roiAmount.toFixed(2));
  }

  /**
   * Calculate EMI amount
   * Formula: disbursement_amount + total_roi_amount
   */
  private calculateEmiAmount(disbursementAmount: number, totalRoiAmount: number): number {
    const emi = disbursementAmount + totalRoiAmount;
    return Number(emi.toFixed(2));
  }

  /**
   * Transform single invoice to LMS payload format
   */
  async transformInvoiceToLMSPayload(invoiceId: number): Promise<{
    success: boolean;
    data?: InvoiceDisbursementPayload;
    error?: string;
    validationErrors?: { field: string; message: string }[];
  }> {
    const invoice = await this.invoiceRepository.findOne({
      where: { id: invoiceId },
      relations: ["loanAccount", "supplier", "supplier.bankDetail", "customer"],
    });

    if (!invoice) {
      return { success: false, error: `Invoice not found with ID: ${invoiceId}` };
    }

    const validationResult = await this.validateForLMS(invoice);
    
    if (!validationResult.valid) {
      return { success: false, validationErrors: validationResult.errors };
    }

    return { success: true, data: validationResult.payload };
  }

  /**
   * Transform multiple invoices to LMS payload format
   */
  async transformMultipleInvoicesToLMSPayload(invoiceIds: number[]): Promise<{
    success: boolean;
    data?: InvoiceDisbursementPayload[];
    errors?: { invoiceId: number; error: string }[];
  }> {
    const payloads: InvoiceDisbursementPayload[] = [];
    const errors: { invoiceId: number; error: string }[] = [];

    for (const invoiceId of invoiceIds) {
      const result = await this.transformInvoiceToLMSPayload(invoiceId);
      
      if (result.success && result.data) {
        payloads.push(result.data);
      } else {
        errors.push({
          invoiceId,
          error: result.error || result.validationErrors?.map(e => e.message).join(', ') || 'Unknown error'
        });
      }
    }

    if (errors.length > 0 && payloads.length === 0) {
      return { success: false, errors };
    }

    return { success: true, data: payloads };
  }

  /**
   * Validate invoice data according to LMS requirements
   */
  private async validateForLMS(invoice: Invoice): Promise<{
    valid: boolean;
    payload?: InvoiceDisbursementPayload;
    errors: { field: string; message: string }[];
  }> {
    const errors: { field: string; message: string }[] = [];
    console.log(invoice)
    // Check required fields
    if (!invoice.loanAccountId) {
      errors.push({ field: "loanAccountId", message: "Invoice is not linked to a Loan Account" });
    }
    if (!invoice.invoiceNumber) {
      errors.push({ field: "invoiceNumber", message: "Invoice number is missing" });
    }
    if (!invoice.invoiceDate) {
      errors.push({ field: "invoiceDate", message: "Invoice date is missing" });
    }
    if (!invoice.invoiceAmount) {
      errors.push({ field: "invoiceAmount", message: "Invoice amount is missing" });
    }
    if (!invoice.disbursementAmount) {
      errors.push({ field: "disbursementAmount", message: "Disbursement amount is missing" });
    }
    if (!invoice.disbursementDate) {
      errors.push({ field: "disbursementDate", message: "Disbursement date is missing" });
    }
    if (!invoice.disbursementUtr) {
      errors.push({ field: "disbursementUtr", message: "Disbursement UTR is missing" });
    }
    if (!invoice.supplier?.supplierName) {
      errors.push({ field: "supplier_name", message: "Supplier name is missing" });
    }
    if (!invoice.supplier?.bankDetail) {
      errors.push({ field: "supplier_bank_details", message: "Supplier bank details are missing" });
    }

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    // Get Loan Account
    const loanAccount = await this.loanAccountRepository.findOne({
      where: { id: invoice.loanAccountId },
    });

    if (!loanAccount) {
      errors.push({ field: "loanAccount", message: "Loan Account not found" });
      return { valid: false, errors };
    }

    // Get Supplier Bank Details
    const supplierBankDetail = await this.supplierBankDetailRepository.findOne({
      where: { supplierId: invoice.supplierId },
    });

    if (!supplierBankDetail) {
      errors.push({ field: "supplier_bank_details", message: "Supplier bank details not found" });
      return { valid: false, errors };
    }

    // Tenure must be exactly 90 days
    const tenureDays = 90;

    // Disbursement amount <= Invoice amount (compare as numbers, not strings)
    if (Number(invoice.disbursementAmount) > Number(invoice.invoiceAmount)) {
      errors.push({ 
        field: "disbursement_amount", 
        message: `Disbursement amount (${invoice.disbursementAmount}) cannot exceed invoice amount (${invoice.invoiceAmount})` 
      });
    }

    // Get ROI from CreditSanction
    // const creditSanction = await this.creditSanctionRepository.findOne({
    //   where: { 
    //     customerId: invoice.customerId,
    //     status: 'approved'
    //   },
    //   order: { createdAt: "DESC" as any },
    // });

    
    
    const roiPercentage = invoice.roiPercentage ?? 12.0;
    const penalCharges = invoice.penalCharges ?? 0;

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    // Calculate dates
    const disbursementDate = new Date(invoice.disbursementDate);
    const expectedDueDate = new Date(disbursementDate);
    expectedDueDate.setDate(expectedDueDate.getDate() + 90);
    const expectedDueDateStr = this.formatDate(expectedDueDate);

    const invoiceDueDateStr = invoice.invoiceDueDate 
      ? this.formatDate(new Date(invoice.invoiceDueDate)) 
      : expectedDueDateStr;

    // Calculate ROI and EMI
    const disbursementAmount = Number(invoice.disbursementAmount);
    const totalRoiAmount = this.calculateTotalRoiAmount(disbursementAmount, roiPercentage, tenureDays);
    const emiAmount = this.calculateEmiAmount(disbursementAmount, totalRoiAmount);

    // Build Payload
    const payload: InvoiceDisbursementPayload = {
      partner_loan_id: String(invoice.customerId),
      lan: loanAccount.lanId,
      invoice_number: invoice.invoiceNumber,
      invoice_date: this.formatDate(new Date(invoice.invoiceDate)),
      invoice_amount: Number(invoice.invoiceAmount),
      tenure_days: tenureDays,
      supplier_name: invoice.supplier!.supplierName,
      supplier_bank_details: {
        bank_account_number: supplierBankDetail.bankAccountNumber,
        ifsc_code: supplierBankDetail.ifscCode,
        bank_name: supplierBankDetail.bankName,
        account_holder_name: supplierBankDetail.accountHolderName,
      },
      disbursement_amount: disbursementAmount,
      disbursement_date: this.formatDate(disbursementDate),
      invoice_due_date: invoiceDueDateStr,
      disbursement_utr: invoice.disbursementUtr,
      roi_percentage: roiPercentage,
      penal_charges: penalCharges,
      total_roi_amount: totalRoiAmount,
      emi_amount: emiAmount,
   service_fee:
    invoice.serviceFee !== null && invoice.serviceFee !== undefined
      ? Number(invoice.serviceFee)
      : 0, // Added THIS
    };

    return { valid: true, payload, errors: [] };
  }

  /**
   * Send invoice disbursement data to LMS
   */
  // async sendToLMS(invoiceIds: number[]): Promise<{
  //   success: boolean;
  //   lmsResponse?: LMSResponse;
  //   losValidationErrors?: { invoiceId: number; error: string }[];
  //   error?: string;
  // }> {
  //   try {
  //     // Transform invoices to LMS payload
  //     const transformResult = await this.transformMultipleInvoicesToLMSPayload(invoiceIds);
      
  //     if (!transformResult.success || !transformResult.data || transformResult.data.length === 0) {
  //       return {
  //         success: false,
  //         losValidationErrors: transformResult.errors,
  //         error: 'Failed to transform invoice data'
  //       };
  //     }

  //     // Send to LMS API
  //     const lmsResponse = await this.sendToLMSApi(transformResult.data);

  //     // Check if there are failed invoices and extract error messages
  //     const failedResults = lmsResponse.results?.filter(r => r.status === 'failed') || [];
  //     const errorMessages = failedResults.map(r => `${r.invoice_number}: ${r.message}`).join('; ');

  //     return {
  //       success: lmsResponse.failed_count === 0,
  //       lmsResponse,
  //       error: lmsResponse.failed_count > 0 ? errorMessages : undefined,
  //       losValidationErrors: failedResults.map(r => ({
  //         invoiceId: transformResult.data?.find(d => d.invoice_number === r.invoice_number)?.partner_loan_id ? parseInt(transformResult.data.find(d => d.invoice_number === r.invoice_number)?.partner_loan_id || '0') : 0,
  //         error: r.message
  //       }))
  //     };
  //   } catch (error: any) {
  //     return {
  //       success: false,
  //       error: error.message || 'Failed to send to LMS'
  //     };
  //   }
  // }

  /**
   * Send single invoice to LMS
   */
  async sendSingleToLMS(invoiceId: number): Promise<{
    success: boolean;
    lmsResponse?: LMSResponse;
    losValidationErrors?: { field: string; message: string }[];
    error?: string;
  }> {
    try {
      // Transform invoice to LMS payload
      const transformResult = await this.transformInvoiceToLMSPayload(invoiceId);
      console.log("transformResult",transformResult)
      if (!transformResult.success || !transformResult.data) {
        return {
          success: false,
          losValidationErrors: transformResult.validationErrors,
          error: transformResult.error || 'Failed to transform invoice data'
        };
      }

      // Send to LMS API
      const lmsResponse = await this.sendToLMSApi([transformResult.data]);

      // Check if there are failed invoices and extract error messages
      const failedResults = lmsResponse.results?.filter(r => r.status === 'failed') || [];
      const errorMessages = failedResults.map(r => `${r.invoice_number}: ${r.message}`).join('; ');

      return {
        success: lmsResponse.failed_count === 0,
        lmsResponse,
        error: lmsResponse.failed_count > 0 ? errorMessages : undefined,
        losValidationErrors: failedResults.map(r => ({
          field: r.invoice_number,
          message: r.message
        }))
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to send to LMS'
      };
    }
  }

  /**
   * Send data to LMS API
   */
  private async sendToLMSApi(payload: InvoiceDisbursementPayload[]): Promise<LMSResponse> {
    const baseUrl = process.env.LMS_API_BASE_URL;
    const apiKey = process.env.LMS_API_KEY;

    if (!baseUrl || !apiKey) {
      throw new Error('LMS API configuration missing. Set LMS_API_BASE_URL and LMS_API_KEY in environment.');
    }

    console.log(baseUrl)
   console.log("payload",payload)
    try {
      const response = await axios.post<LMSResponse>(
        `${baseUrl}loan-booking/v1/invoice-disbursement/validate`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
          },
          timeout: 30000,
        }
      );

      console.log(response);
      return response.data;
    } catch (error: any) {
      if (error.response) {
        throw new Error(`LMS API Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      } else if (error.request) {
        throw new Error('LMS API unreachable - no response received');
      } else {
        throw new Error(`Failed to send to LMS: ${error.message}`);
      }
    }
  }
}

export const invoiceDiscountingService = new InvoiceDiscountingService();
