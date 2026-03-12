import { AppDataSource } from '../config/database';
import { Invoice } from '../entities/Invoice';
import { Customer } from '../entities/Customer';
import { Supplier } from '../entities/Supplier';
import { SupplierBankDetail } from '../entities/SupplierBankDetail';
import { CaseWorkflow } from '../entities/CaseWorkflow';
import { CaseStatusHistory } from '../entities/CaseStatusHistory';
import { LoanAccount } from '../entities/LoanAccount';
import { CreditSanction } from '../entities/CreditSanction';
import { Notification } from '../entities/Notification';

export class InvoiceDiscountingService {
  private invoiceRepository = AppDataSource.getRepository(Invoice);
  private customerRepository = AppDataSource.getRepository(Customer);
  private supplierRepository = AppDataSource.getRepository(Supplier);
  private supplierBankDetailRepository = AppDataSource.getRepository(SupplierBankDetail);
  private workflowRepository = AppDataSource.getRepository(CaseWorkflow);
  private historyRepository = AppDataSource.getRepository(CaseStatusHistory);
  private loanAccountRepository = AppDataSource.getRepository(LoanAccount);
  private creditSanctionRepository = AppDataSource.getRepository(CreditSanction);
  private notificationRepository = AppDataSource.getRepository(Notification);

  private getApproverForStatus(status: string): string {
    switch (status) {
      case 'DRAFT': return 'RM';
      case 'PENDING_CUSTOMER_APPROVAL': return 'CUSTOMER';
      case 'REJECTED_BY_CUSTOMER': return 'RM';
      case 'PENDING_OPS_L1_APPROVAL': return 'OPS_L1';
      case 'PENDING_OPS_L2_APPROVAL': return 'OPS_L2';
      case 'PENDING_MD_APPROVAL': return 'MD';
      case 'PENDING_OPS_HEAD_APPROVAL': return 'OPS_HEAD';
      case 'DISBURSEMENT_DATA_ENTRY': return 'OPS_L1';
      case 'PENDING_FINAL_OPS_L2_APPROVAL': return 'OPS_L2';
      case 'ACTIVE': return 'None';
      case 'REJECTED': return 'RM';
      default: return 'RM';
    }
  }

  private async createOrGetWorkflow(invoiceId: number): Promise<CaseWorkflow> {
    let workflow = await this.workflowRepository.findOne({
      where: { invoiceId, workflowType: 'INVOICE_DISCOUNTING' as any },
    });

    if (!workflow) {
      const invoice = await this.invoiceRepository.findOne({ where: { id: invoiceId } });
      if (!invoice) throw new Error('Invoice not found');

      workflow = this.workflowRepository.create({
        workflowType: 'INVOICE_DISCOUNTING' as any,
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
      where: { rmId, status: 'completed' },
      select: ['id', 'name', 'companyName', 'mobile', 'email'],
    });
  }

  async getLANsByCustomer(customerId: number) {
    return this.loanAccountRepository.find({
      where: { customerId, status: 'active' },
      select: ['id', 'lanId', 'sanctionedAmount', 'disbursedAmount', 'partnerId', 'lender'],
    });
  }

  async getCustomerById(customerId: number) {
    return this.customerRepository.findOne({
      where: { id: customerId },
      select: ['id', 'name', 'companyName', 'mobile', 'email'],
    });
  }

  // STEP 2: RM - Supplier Selection
  async getSuppliersByCustomer(customerId: number) {
    return this.supplierRepository.find({
      where: { customerId, isActive: true, status: 'COMPLETED' },
      select: ['id', 'supplierName', 'supplierCode', 'email', 'contactNumber'],
    });
  }

  async getSupplierBankDetails(supplierId: number) {
    return this.supplierBankDetailRepository.findOne({
      where: { supplierId },
      select: ['id', 'bankAccountNumber', 'bankName', 'ifscCode', 'accountHolderName', 'micrCode'],
    });
  }

  // STEP 3: RM - Invoice Entry
  async createInvoice(data: {
    customerId: number;
    loanAccountId: number;
    supplierId: number;
    invoiceNumber: string;
    invoiceDate: string;
    invoiceAmount: number;
    disbursementAmount: number;
  }, rmId: number) {
    const customer = await this.customerRepository.findOne({
      where: { id: data.customerId, status: 'completed' },
    });
    if (!customer) {
      throw new Error('Customer must be fully approved (COMPLETED status)');
    }

    const supplier = await this.supplierRepository.findOne({
      where: { id: data.supplierId, status: 'COMPLETED', isActive: true },
    });
    if (!supplier) {
      throw new Error('Supplier must be fully approved and active');
    }

    const loanAccount = await this.loanAccountRepository.findOne({
      where: { id: data.loanAccountId, customerId: data.customerId },
    });
    if (!loanAccount) {
      throw new Error('Invalid Loan Account Number (LAN) for this customer');
    }

    const existingInvoice = await this.invoiceRepository.findOne({
      where: { invoiceNumber: data.invoiceNumber },
    });
    if (existingInvoice) {
      throw new Error('Invoice number already exists');
    }

    const invoice = this.invoiceRepository.create({
      ...data,
      invoiceDate: new Date(data.invoiceDate),
      createdByUserId: rmId,
      status: 'DRAFT',
    });
    const savedInvoice = await this.invoiceRepository.save(invoice);

    const workflow = this.workflowRepository.create({
      workflowType: 'INVOICE_DISCOUNTING' as any,
      invoiceId: savedInvoice.id,
      customerId: data.customerId,
      supplierId: data.supplierId,
      currentStatus: 'DRAFT',
      currentApproverRoleName: 'RM',
    });
    const savedWorkflow = await this.workflowRepository.save(workflow);

    await this.logHistory({
      customerId: data.customerId,
      supplierId: data.supplierId,
      invoiceId: savedInvoice.id,
      caseWorkflowId: savedWorkflow.id,
      status: 'DRAFT',
      previousStatus: 'None',
      changedBy: rmId,
      remarks: 'Invoice created in Draft state',
    });

    return { invoice: savedInvoice, workflow: savedWorkflow };
  }

  async saveInvoice(invoiceId: number, data: {
    invoiceNumber?: string;
    invoiceDate?: string;
    invoiceAmount?: number;
    disbursementAmount?: number;
  }, userId: number) {
    const invoice = await this.invoiceRepository.findOne({ where: { id: invoiceId } });
    if (!invoice) throw new Error('Invoice not found');
    if (invoice.status !== 'DRAFT') {
      throw new Error('Can only save draft invoices');
    }
    Object.assign(invoice, data);
    if (data.invoiceDate) {
      invoice.invoiceDate = new Date(data.invoiceDate);
    }
    return await this.invoiceRepository.save(invoice);
  }

  async submitInvoice(invoiceId: number, userId: number, remarks?: string) {
    const invoice = await this.invoiceRepository.findOne({ where: { id: invoiceId } });
    if (!invoice) throw new Error('Invoice not found');
    if (invoice.status !== 'DRAFT') {
      throw new Error('Can only submit draft invoices');
    }

    const previousStatus = invoice.status;
    invoice.status = 'PENDING_CUSTOMER_APPROVAL';
    await this.invoiceRepository.save(invoice);

    const workflow = await this.createOrGetWorkflow(invoiceId);
    workflow.currentStatus = 'PENDING_CUSTOMER_APPROVAL';
    workflow.currentApproverRoleName = 'CUSTOMER';
    workflow.remarks = remarks || '';
    await this.workflowRepository.save(workflow);

    await this.logHistory({
      customerId: invoice.customerId,
      supplierId: invoice.supplierId,
      invoiceId: invoice.id,
      caseWorkflowId: workflow.id,
      status: 'PENDING_CUSTOMER_APPROVAL',
      previousStatus,
      changedBy: userId,
      remarks: remarks || 'Invoice submitted for customer approval',
    });

    await this.sendCustomerNotification(invoice.customerId, invoice.id);
    return { invoice, workflow };
  }

  private async sendCustomerNotification(customerId: number, invoiceId: number) {
    const notification = this.notificationRepository.create({
      customerId,
      title: 'Invoice Approval Required',
      message: `Your invoice #${invoiceId} requires approval. Please review and approve/reject in the mobile app.`,
      type: 'INVOICE' as any,
      readStatus: 'UNREAD',
      referenceType: 'INVOICE',
      referenceId: invoiceId,
    });
    await this.notificationRepository.save(notification);
  }

  // STEP 4: Customer - Review and Approval (Mobile App)
  async getCustomerInvoiceDetails(invoiceId: number, customerId: number) {
    const invoice = await this.invoiceRepository.findOne({
      where: { id: invoiceId, customerId },
      relations: ['customer', 'loanAccount', 'supplier'],
    });
    if (!invoice) {
      throw new Error('Invoice not found');
    }
    const supplierBankDetail = await this.supplierBankDetailRepository.findOne({
      where: { supplierId: invoice.supplierId },
    });
    return { ...invoice, supplierBankDetail };
  }

  async customerApproval(invoiceId: number, customerId: number | null, action: 'approve' | 'reject', remarks?: string) {
    // Build query - if customerId is provided, filter by it; otherwise just find by invoiceId
    const queryOptions: any = { where: { id: invoiceId } };
    if (customerId) {
      queryOptions.where.customerId = customerId;
    }
    
    const invoice = await this.invoiceRepository.findOne(queryOptions);
    if (!invoice) {
      throw new Error('Invoice not found');
    }
    if (invoice.status !== 'PENDING_CUSTOMER_APPROVAL') {
      throw new Error('Invoice is not pending customer approval');
    }

    const previousStatus = invoice.status;
    if (action === 'approve') {
      invoice.status = 'PENDING_OPS_L1_APPROVAL';
      invoice.customerApprovalStatus = 'approved';
      invoice.customerApprovedAt = new Date();
    } else {
      invoice.status = 'REJECTED_BY_CUSTOMER';
      invoice.customerApprovalStatus = 'rejected';
    }
    invoice.customerRemarks = remarks || '';
    await this.invoiceRepository.save(invoice);

    const workflow = await this.createOrGetWorkflow(invoiceId);
    workflow.currentStatus = invoice.status;
    workflow.currentApproverRoleName = this.getApproverForStatus(invoice.status);
    if (action === 'reject') {
      workflow.isRejected = true;
    }
    workflow.remarks = remarks || '';
    await this.workflowRepository.save(workflow);

    await this.logHistory({
      customerId: invoice.customerId,
      supplierId: invoice.supplierId,
      invoiceId: invoice.id,
      caseWorkflowId: workflow.id,
      status: invoice.status,
      previousStatus,
      changedBy: invoice.customerId, // Use invoice's customerId for audit trail
      remarks: remarks || `Invoice ${action}d by customer`,
    });

    return { invoice, workflow };
  }

  async getCustomerPendingInvoices(customerId?: number) {
    return this.invoiceRepository.find({
      where: { customerId, status: 'PENDING_CUSTOMER_APPROVAL' as any },
      relations: ['supplier', 'loanAccount'],
    });
  }

  // STEP 5: OPS L1 - Verification
  async getOPSL1PendingInvoices() {
    console.log('[OPS L1] Fetching pending invoices with status: PENDING_OPS_L1_APPROVAL');
    const invoices = await this.invoiceRepository.find({
      where: { status: 'PENDING_OPS_L1_APPROVAL' as any },
      relations: ['customer', 'supplier', 'loanAccount'],
    });
    console.log(`[OPS L1] Found ${invoices.length} pending invoices`);
    if (invoices.length > 0) {
      console.log('[OPS L1] Invoice IDs:', invoices.map(i => i.id));
    }
    return invoices;
  }

  async opsL1Verification(invoiceId: number, userId: number, action: 'approve' | 'reject', remarks?: string) {
    const invoice = await this.invoiceRepository.findOne({ 
      where: { id: invoiceId },
      relations: ['customer', 'supplier'],
    });
    if (!invoice) throw new Error('Invoice not found');
    if (invoice.status !== 'PENDING_OPS_L1_APPROVAL') {
      throw new Error('Invoice is not pending OPS L1 approval');
    }

    const previousStatus = invoice.status;
    const newStatus = action === 'approve' ? 'PENDING_OPS_L2_APPROVAL' : 'REJECTED';
    invoice.status = newStatus;
    await this.invoiceRepository.save(invoice);

    const workflow = await this.createOrGetWorkflow(invoiceId);
    workflow.currentStatus = newStatus;
    workflow.currentApproverRoleName = this.getApproverForStatus(newStatus);
    if (action === 'reject') {
      workflow.isRejected = true;
    }
    workflow.remarks = remarks || '';
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
      where: { status: 'PENDING_OPS_L2_APPROVAL' as any },
      relations: ['customer', 'supplier', 'loanAccount'],
    });
  }

  async opsL2Verification(invoiceId: number, userId: number, action: 'approve' | 'reject', remarks?: string) {
    const invoice = await this.invoiceRepository.findOne({ 
      where: { id: invoiceId },
      relations: ['customer', 'supplier'],
    });
    if (!invoice) throw new Error('Invoice not found');
    if (invoice.status !== 'PENDING_OPS_L2_APPROVAL') {
      throw new Error('Invoice is not pending OPS L2 approval');
    }

    const previousStatus = invoice.status;
    const newStatus = action === 'approve' ? 'PENDING_MD_APPROVAL' : 'REJECTED';
    invoice.status = newStatus;
    await this.invoiceRepository.save(invoice);

    const workflow = await this.createOrGetWorkflow(invoiceId);
    workflow.currentStatus = newStatus;
    workflow.currentApproverRoleName = this.getApproverForStatus(newStatus);
    if (action === 'reject') {
      workflow.isRejected = true;
    }
    workflow.remarks = remarks || '';
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
      where: { status: 'PENDING_MD_APPROVAL' as any },
      relations: ['customer', 'supplier', 'loanAccount'],
    });
  }

  async mdApproval(invoiceId: number, userId: number, action: 'approve' | 'reject', remarks?: string) {
    const invoice = await this.invoiceRepository.findOne({ 
      where: { id: invoiceId },
      relations: ['customer', 'supplier'],
    });
    if (!invoice) throw new Error('Invoice not found');
    if (invoice.status !== 'PENDING_MD_APPROVAL') {
      throw new Error('Invoice is not pending MD approval');
    }

    const previousStatus = invoice.status;
    const newStatus = action === 'approve' ? 'PENDING_OPS_HEAD_APPROVAL' : 'REJECTED';
    invoice.status = newStatus;
    await this.invoiceRepository.save(invoice);

    const workflow = await this.createOrGetWorkflow(invoiceId);
    workflow.currentStatus = newStatus;
    workflow.currentApproverRoleName = this.getApproverForStatus(newStatus);
    if (action === 'reject') {
      workflow.isRejected = true;
    }
    workflow.remarks = remarks || '';
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
      where: { status: 'PENDING_OPS_HEAD_APPROVAL' as any },
      relations: ['customer', 'supplier', 'loanAccount'],
    });
  }

  async opsHeadApproval(invoiceId: number, userId: number, action: 'approve' | 'reject', remarks?: string) {
    const invoice = await this.invoiceRepository.findOne({ 
      where: { id: invoiceId },
      relations: ['customer', 'supplier'],
    });
    if (!invoice) throw new Error('Invoice not found');
    if (invoice.status !== 'PENDING_OPS_HEAD_APPROVAL') {
      throw new Error('Invoice is not pending OPS Head approval');
    }

    const previousStatus = invoice.status;
    const newStatus = action === 'approve' ? 'DISBURSEMENT_DATA_ENTRY' : 'REJECTED';
    invoice.status = newStatus;
    await this.invoiceRepository.save(invoice);

    const workflow = await this.createOrGetWorkflow(invoiceId);
    workflow.currentStatus = newStatus;
    workflow.currentApproverRoleName = this.getApproverForStatus(newStatus);
    if (action === 'reject') {
      workflow.isRejected = true;
    }
    workflow.remarks = remarks || '';
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
    console.log('[Disbursement Entry] Fetching invoices with status: DISBURSEMENT_DATA_ENTRY');
    const invoices = await this.invoiceRepository.find({
      where: { status: 'DISBURSEMENT_DATA_ENTRY' as any },
      relations: ['customer', 'supplier', 'loanAccount'],
    });
    console.log(`[Disbursement Entry] Found ${invoices.length} invoices`);
    if (invoices.length > 0) {
      console.log('[Disbursement Entry] Invoice IDs:', invoices.map(i => i.id));
    }
    return invoices;
  }

  async getROIPercentage(loanAccountId: number): Promise<number> {
    try {
      const loanAccount = await this.loanAccountRepository.findOne({
        where: { id: loanAccountId },
        relations: ['partner'],
      });
      if (!loanAccount) {
        console.warn(`Loan Account ${loanAccountId} not found, using default ROI`);
        return 12.0;
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
        console.warn(`No partner code found for Loan Account ${loanAccountId}, using default ROI`);
        return 12.0;
      }

      // Find the credit sanction for this customer and partner
      const creditSanction = await this.creditSanctionRepository.findOne({
        where: { 
          customerId: loanAccount.customerId,
          partner: partnerCode,
          status: 'approved',
        },
        order: { createdAt: 'DESC' },
      });

      if (creditSanction && creditSanction.interestRate) {
        return Number(creditSanction.interestRate);
      }

      console.warn(`No approved credit sanction found for customer ${loanAccount.customerId} and partner ${partnerCode}, using default ROI`);
      return 12.0;
    } catch (error) {
      console.error('Error fetching ROI percentage:', error);
      return 12.0; // Default ROI in case of errors
    }
  }

  async disburseInvoice(invoiceId: number, userId: number, data: {
    disbursementUtr: string;
    disbursementDate: string;
  }) {
    const invoice = await this.invoiceRepository.findOne({ 
      where: { id: invoiceId },
      relations: ['loanAccount'],
    });
    if (!invoice) throw new Error('Invoice not found');
    if (invoice.status !== 'DISBURSEMENT_DATA_ENTRY') {
      throw new Error('Invoice is not in disbursement data entry stage');
    }

    // Validate disbursement amount doesn't exceed invoice amount
    if (invoice.disbursementAmount! > invoice.invoiceAmount) {
      throw new Error('Disbursement amount cannot exceed invoice amount');
    }

    const disbursementDate = new Date(data.disbursementDate);
    const invoiceDueDate = new Date(disbursementDate);
    invoiceDueDate.setDate(invoiceDueDate.getDate() + 90);

    const roiPercentage = await this.getROIPercentage(invoice.loanAccountId!);
    const totalRoiAmount = (invoice.disbursementAmount! * roiPercentage * 90) / 365;
    const emiAmount = invoice.disbursementAmount! + totalRoiAmount;

    const previousStatus = invoice.status;

    invoice.disbursementUtr = data.disbursementUtr;
    invoice.disbursementDate = disbursementDate;
    invoice.invoiceDueDate = invoiceDueDate;
    invoice.roiPercentage = roiPercentage;
    invoice.roiAmount = totalRoiAmount;
    invoice.emiAmount = emiAmount;
    invoice.status = 'PENDING_FINAL_OPS_L2_APPROVAL';
    await this.invoiceRepository.save(invoice);

    const workflow = await this.createOrGetWorkflow(invoiceId);
    workflow.currentStatus = 'PENDING_FINAL_OPS_L2_APPROVAL';
    workflow.currentApproverRoleName = 'OPS_L2';
    await this.workflowRepository.save(workflow);

    await this.logHistory({
      customerId: invoice.customerId,
      supplierId: invoice.supplierId,
      invoiceId: invoice.id,
      caseWorkflowId: workflow.id,
      status: 'PENDING_FINAL_OPS_L2_APPROVAL',
      previousStatus,
      changedBy: userId,
      remarks: `Disbursement entry: UTR=${data.disbursementUtr}, ROI=${roiPercentage}%, EMI=${emiAmount}`,
    });

    return { invoice, workflow };
  }

  // STEP 10: OPS L2 - Final Verification
  async getFinalOPSL2PendingInvoices() {
    return this.invoiceRepository.find({
      where: { status: 'PENDING_FINAL_OPS_L2_APPROVAL' as any },
      relations: ['customer', 'supplier', 'loanAccount'],
    });
  }

  async opsL2FinalVerification(invoiceId: number, userId: number, action: 'approve' | 'reject', remarks?: string) {
    const invoice = await this.invoiceRepository.findOne({ 
      where: { id: invoiceId },
      relations: ['customer', 'supplier'],
    });
    if (!invoice) throw new Error('Invoice not found');
    if (invoice.status !== 'PENDING_FINAL_OPS_L2_APPROVAL') {
      throw new Error('Invoice is not pending final OPS L2 approval');
    }

    const previousStatus = invoice.status;
    if (action === 'approve') {
      invoice.status = 'ACTIVE';
      if (invoice.loanAccountId) {
        const loanAccount = await this.loanAccountRepository.findOne({
          where: { id: invoice.loanAccountId },
        });
        if (loanAccount) {
          loanAccount.disbursedAmount = (loanAccount.disbursedAmount || 0) + invoice.disbursementAmount!;
          await this.loanAccountRepository.save(loanAccount);
        }
      }
    } else {
      invoice.status = 'REJECTED';
    }
    await this.invoiceRepository.save(invoice);

    const workflow = await this.createOrGetWorkflow(invoiceId);
    workflow.currentStatus = invoice.status;
    workflow.currentApproverRoleName = this.getApproverForStatus(invoice.status);
    workflow.isCompleted = action === 'approve';
    if (action === 'approve') {
      workflow.completedDate = new Date();
    }
    if (action === 'reject') {
      workflow.isRejected = true;
    }
    workflow.remarks = remarks || '';
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

    return { invoice, workflow };
  }

  // Dashboard and Retrieval Methods
  async getInvoiceById(invoiceId: number) {
    return this.invoiceRepository.findOne({
      where: { id: invoiceId },
      relations: ['customer', 'supplier', 'supplier.bankDetail', 'loanAccount'],
    });
  }

  async getRMInvoices(rmId: number) {
    return this.invoiceRepository.find({
      where: { createdByUserId: rmId },
      relations: ['customer', 'supplier', 'loanAccount'],
      order: { createdAt: 'DESC' },
    });
  }

  async getAllInvoicesByStatus(status: string) {
    return this.invoiceRepository.find({
      where: { status: status as any },
      relations: ['customer', 'supplier', 'loanAccount'],
    });
  }

  async getActiveInvoices() {
    return this.invoiceRepository.find({
      where: { status: 'ACTIVE' as any },
      relations: ['customer', 'supplier', 'loanAccount'],
    });
  }

  // Legacy methods for backward compatibility
  async getRMInvoiceDashboard(rmId: number) {
    const invoices = await this.getRMInvoices(rmId);
    const totalDisbursed = invoices
      .filter((i) => i.status === 'ACTIVE')
      .reduce((sum, i) => sum + (i.disbursementAmount || 0), 0);

    return {
      totalInvoices: invoices.length,
      draft: invoices.filter((i) => i.status === 'DRAFT').length,
      pending: invoices.filter((i) => i.status === 'PENDING_CUSTOMER_APPROVAL').length,
      active: invoices.filter((i) => i.status === 'ACTIVE').length,
      rejected: invoices.filter((i) => i.status === 'REJECTED').length,
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
      'OPS_L1': 'PENDING_OPS_L1_APPROVAL',
      'OPS_L2': 'PENDING_OPS_L2_APPROVAL',
      'OPS_HEAD': 'PENDING_OPS_HEAD_APPROVAL',
      'MD': 'PENDING_MD_APPROVAL',
    };
    const status = statusMap[role];
    if (!status) {
      return [];
    }
    return this.invoiceRepository.find({
      where: { status: status as any },
      relations: ['customer', 'supplier', 'loanAccount'],
    });
  }

  // ============================================
  // ADDITIONAL METHODS FOR ROUTES
  // ============================================

  // Get all approved customers for RM (without rmId filter)
  // Uses getCustomersByRM internally - just returns all completed customers
  async getCustomersForRM() {
    return this.customerRepository.find({
      where: { status: 'completed' },
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

  async enterDisbursementData(invoiceId: number, userId: number, data: {
    disbursementUtr: string;
    disbursementDate: string;
    invoiceDueDate?: string;
    loanAccountId?: number;
  }) {
    return this.disburseInvoice(invoiceId, userId, data);
  }

  async finalOPS2Verification(invoiceId: number, userId: number, approved: boolean, remarks: string) {
    return this.opsL2FinalVerification(invoiceId, userId, approved ? 'approve' : 'reject', remarks);
  }
}
