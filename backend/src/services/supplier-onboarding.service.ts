import { AppDataSource } from '../config/database';
import { Supplier } from '../entities/Supplier';
import { Customer } from '../entities/Customer';
import { CaseWorkflow } from '../entities/CaseWorkflow';
import { CaseStatusHistory } from '../entities/CaseStatusHistory';
import { SupplierBankDetail } from '../entities/SupplierBankDetail';
import { SupplierDocument } from '../entities/SupplierDocument';
import { ChequeParserService } from './cheque-parser.service';

export class SupplierOnboardingService {
  private supplierRepository = AppDataSource.getRepository(Supplier);
  private customerRepository = AppDataSource.getRepository(Customer);
  private workflowRepository = AppDataSource.getRepository(CaseWorkflow);
  private historyRepository = AppDataSource.getRepository(CaseStatusHistory);
  private supplierDocRepository = AppDataSource.getRepository(SupplierDocument);
  private supplierBankRepository = AppDataSource.getRepository(SupplierBankDetail);
  private chequeParser = new ChequeParserService();

  MAX_SUPPLIERS_PER_LAN = 20;
  MIN_SUPPLIERS_PER_LAN = 10;

  private async getOrCreateWorkflow(supplierId: number, workflowType: string = 'SUPPLIER_ONBOARDING'): Promise<CaseWorkflow> {
    let workflow = await this.workflowRepository.findOne({
      where: { supplierId, workflowType: workflowType as any },
    });

    if (!workflow) {
      const supplier = await this.supplierRepository.findOne({ where: { id: supplierId } });
      if (!supplier) throw new Error('Supplier not found');

      const status = (supplier.status || 'DRAFT').toUpperCase();
      workflow = this.workflowRepository.create({
        workflowType: workflowType as any,
        supplierId: supplier.id,
        customerId: supplier.customerId,
        currentStatus: status,
        currentApproverRoleName: this.getApproverForStatus(status),
      });
      workflow = await this.workflowRepository.save(workflow);
    }

    return workflow;
  }

  private getApproverForStatus(status: string): string {
    const s = status.toUpperCase();
    switch (s) {
      case 'DRAFT': return 'OPERATIONS_TEAM_L1';
      case 'SUBMITTED': return 'OPERATIONS_HEAD';
      case 'OPS_L1_APPROVED': return 'OPERATIONS_HEAD';
      case 'COMPLETED': return 'None';
      default: return 'OPERATIONS_TEAM_L1';
    }
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
      status: data.status,
      previousStatus: data.previousStatus,
      changedBy: data.changedBy,
      remarks: data.remarks,
    });
    return await this.historyRepository.save(history);
  }

  // Ops L1 creates supplier in DRAFT status
  async createSupplierByOpsL1(data: any, opsL1UserId: number) {
    const customer = await this.customerRepository.findOne({ where: { id: data.customerId } });
    if (!customer || !customer.lanId) throw new Error('Customer must be approved with LAN ID');

    const supplier = this.supplierRepository.create({
      customerId: data.customerId,
      supplierName: data.supplierName,
      contactNumber: data.mobileNumber,
      supplierCode: data.supplierCode || `SUP-${Date.now()}`,
      email: data.email || '',
      address: data.address || null,
      gstNumber: data.gstNumber || null,
      panNumber: data.panNumber || null,
      createdByUserId: opsL1UserId,
      status: 'DRAFT',
    });

    const savedSupplier = await this.supplierRepository.save(supplier);

    // Save bank details if provided
    if (data.bankAccountNumber || data.ifscCode || data.bankName) {
      const bankDetail = this.supplierBankRepository.create({
        supplierId: savedSupplier.id,
        bankAccountNumber: data.bankAccountNumber || '',
        ifscCode: data.ifscCode || '',
        bankName: data.bankName || '',
        accountHolderName: data.accountHolderName || '',
      });
      await this.supplierBankRepository.save(bankDetail);
    }

    const workflow = this.workflowRepository.create({
      workflowType: 'SUPPLIER_ONBOARDING',
      supplierId: savedSupplier.id,
      customerId: savedSupplier.customerId,
      currentStatus: 'DRAFT',
      currentApproverRoleName: 'OPERATIONS_TEAM_L1',
      remarks: 'Created by Operations L1',
    });
    const savedWorkflow = await this.workflowRepository.save(workflow);

    await this.logHistory({
      customerId: savedSupplier.customerId,
      supplierId: savedSupplier.id,
      caseWorkflowId: savedWorkflow.id,
      status: 'DRAFT',
      previousStatus: 'None',
      changedBy: opsL1UserId,
      remarks: 'Supplier created by Operations L1',
    });

    return { supplier: savedSupplier, workflow: savedWorkflow };
  }

  // Ops L1 submits supplier to Ops Head (changes status to OPS_L1_APPROVED)
  async opsL1SubmitToOpsHead(supplierId: number, userId: number, remarks: string) {
    const supplier = await this.supplierRepository.findOne({ where: { id: supplierId } });
    if (!supplier) throw new Error('Supplier not found');

    const workflow = await this.getOrCreateWorkflow(supplierId);
    if (workflow.currentStatus !== 'DRAFT') {
      throw new Error('Can only submit from Draft status');
    }

    const previousStatus = workflow.currentStatus;
    supplier.status = 'OPS_L1_APPROVED';
    await this.supplierRepository.save(supplier);

    workflow.currentStatus = 'OPS_L1_APPROVED';
    workflow.currentApproverRoleName = 'OPERATIONS_HEAD';
    workflow.remarks = remarks;
    await this.workflowRepository.save(workflow);

    await this.logHistory({
      customerId: supplier.customerId,
      supplierId: supplier.id,
      caseWorkflowId: workflow.id,
      status: 'OPS_L1_APPROVED',
      previousStatus,
      changedBy: userId,
      remarks,
    });

    return workflow;
  }

  // Ops Head approves supplier (changes status to COMPLETED)
  async opsHeadApprove(supplierId: number, userId: number, remarks: string, approved: boolean) {
    const supplier = await this.supplierRepository.findOne({ where: { id: supplierId } });
    if (!supplier) throw new Error('Supplier not found');

    const workflow = await this.getOrCreateWorkflow(supplierId);
    
    // Allow both SUBMITTED and OPS_L1_APPROVED statuses for Ops Head approval
    if (workflow.currentStatus !== 'OPS_L1_APPROVED' && workflow.currentStatus !== 'SUBMITTED') {
      throw new Error('Cannot decide: Supplier must be submitted to Operations Head');
    }

    const previousStatus = workflow.currentStatus;

    if (approved) {
      supplier.status = 'COMPLETED';
      workflow.currentStatus = 'COMPLETED';
      workflow.currentApproverRoleName = 'None';
      workflow.isCompleted = true;
      workflow.completedDate = new Date();
    } else {
      supplier.status = 'REJECTED';
      supplier.rejectionReason = remarks || 'Rejected by Operations Head';
      workflow.currentStatus = 'REJECTED';
      workflow.currentApproverRoleName = 'OPERATIONS_TEAM_L1';
      workflow.isRejected = true;
    }

    workflow.remarks = remarks;
    await this.supplierRepository.save(supplier);
    await this.workflowRepository.save(workflow);

    await this.logHistory({
      customerId: supplier.customerId,
      supplierId: supplier.id,
      caseWorkflowId: workflow.id,
      status: workflow.currentStatus,
      previousStatus,
      changedBy: userId,
      remarks,
    });

    return workflow;
  }

  async submitSupplier(supplierId: number, userId: number, remarks: string) {
    const supplier = await this.supplierRepository.findOne({ where: { id: supplierId } });
    if (!supplier) throw new Error('Supplier not found');

    const workflow = await this.getOrCreateWorkflow(supplierId);
    if (workflow.currentStatus !== 'DRAFT') throw new Error('Can only submit from Draft status');

    const previousStatus = workflow.currentStatus;
    supplier.status = 'SUBMITTED';
    await this.supplierRepository.save(supplier);

    workflow.currentStatus = 'SUBMITTED';
    workflow.currentApproverRoleName = 'OPERATIONS_HEAD';
    workflow.remarks = remarks;
    await this.workflowRepository.save(workflow);

    await this.logHistory({
      customerId: supplier.customerId,
      supplierId: supplier.id,
      caseWorkflowId: workflow.id,
      status: 'SUBMITTED',
      previousStatus,
      changedBy: userId,
      remarks,
    });

    return workflow;
  }

  async opsL1Approve(supplierId: number, userId: number, remarks: string, approved: boolean) {
    const supplier = await this.supplierRepository.findOne({ where: { id: supplierId } });
    if (!supplier) throw new Error('Supplier not found');

    const workflow = await this.getOrCreateWorkflow(supplierId);
    if (workflow.currentStatus !== 'SUBMITTED') throw new Error('Cannot approve: Pending at Operations L1');

    const previousStatus = workflow.currentStatus;
    supplier.status = approved ? 'OPS_L1_APPROVED' : 'REJECTED';
    await this.supplierRepository.save(supplier);

    workflow.currentStatus = approved ? 'OPS_L1_APPROVED' : 'REJECTED';
    workflow.currentApproverRoleName = approved ? 'OPERATIONS_HEAD' : 'OPERATIONS_TEAM_L1';
    if (!approved) workflow.isRejected = true;
    workflow.remarks = remarks;
    await this.workflowRepository.save(workflow);

    await this.logHistory({
      customerId: supplier.customerId,
      supplierId: supplier.id,
      caseWorkflowId: workflow.id,
      status: workflow.currentStatus,
      previousStatus,
      changedBy: userId,
      remarks,
    });

    return workflow;
  }

  async getRMSupplierDashboard(rmId: number) {
    const suppliers = await this.supplierRepository.find({
      where: { createdByUserId: rmId },
      relations: ['customer'],
    });

    const lanWiseSuppliers: { [key: string]: any } = {};
    (suppliers || []).forEach((supplier) => {
      const lanId = supplier.customer?.lanId || 'UNKNOWN';
      if (!lanWiseSuppliers[lanId]) {
        lanWiseSuppliers[lanId] = {
          customerId: supplier.customerId,
          customerName: supplier.customer?.customerName,
          suppliers: [],
        };
      }
      lanWiseSuppliers[lanId].suppliers.push(supplier);
    });

    return {
      totalSuppliers: suppliers?.length || 0,
      draft: suppliers?.filter((s) => s.status === 'DRAFT').length || 0,
      submitted: suppliers?.filter((s) => s.status === 'SUBMITTED').length || 0,
      opsL1Approved: suppliers?.filter((s) => s.status === 'OPS_L1_APPROVED').length || 0,
      completed: suppliers?.filter((s) => s.status === 'COMPLETED').length || 0,
      rejected: suppliers?.filter((s) => s.status === 'REJECTED').length || 0,
      lanWiseSuppliers,
      suppliers,
    };
  }

  async getOperationsPending(role: string) {
    const r = (role || '').toLowerCase();
    // Operations L1 sees DRAFT suppliers, Operations Head sees OPS_L1_APPROVED or SUBMITTED
    let suppliers;
    if (r === 'operations_head') {
      suppliers = await this.supplierRepository.find({
        where: [
          { status: 'OPS_L1_APPROVED' as any },
          { status: 'SUBMITTED' as any }
        ],
        relations: ['customer'],
      });
    } else {
      // Ops L1 sees DRAFT suppliers they created
      suppliers = await this.supplierRepository.find({
        where: { status: 'DRAFT' as any },
        relations: ['customer'],
      });
    }
    return suppliers;
  }

  async getSuppliersByCustomerLan(customerId: number) {
    return this.supplierRepository.find({
      where: { customerId },
      relations: ['customer'],
    });
  }

  async getApprovedSuppliersByCustomerLan(customerId: number) {
    return this.supplierRepository.find({
      where: { customerId, status: 'COMPLETED' },
      relations: ['customer'],
    });
  }

  async getSupplierCountForLan(customerId: number) {
    return this.supplierRepository.count({ where: { customerId } });
  }

  async canAddMoreSuppliers(customerId: number) {
    const count = await this.getSupplierCountForLan(customerId);
    return count < this.MAX_SUPPLIERS_PER_LAN;
  }

  async uploadSupplierChequeAndAutofill(supplierId: number, file: Express.Multer.File, userId: number) {
    const supplier = await this.supplierRepository.findOne({ where: { id: supplierId } });
    if (!supplier) throw new Error('Supplier not found');

    // Convert absolute path to relative path for Windows compatibility
    // file.path is like "C:\Users\...\uploads\filename.ext"
    // We want to store just "uploads/filename.ext"
    let relativePath = file.path;
    if (file.path.includes('\\')) {
      // Windows path - extract the relative part after 'uploads'
      const pathParts = file.path.split('\\');
      const uploadsIndex = pathParts.indexOf('uploads');
      if (uploadsIndex !== -1) {
        relativePath = pathParts.slice(uploadsIndex).join('/');
      } else {
        // Fallback: just use the filename
        relativePath = `uploads/${file.filename}`;
      }
    } else {
      // Unix/Mac path
      relativePath = file.path.replace(/.*\/uploads\//, 'uploads/');
    }

    const doc = this.supplierDocRepository.create({
      supplierId,
      documentType: 'CHEQUE',
      fileName: file.originalname,
      filePath: relativePath,
      mimeType: file.mimetype,
      fileSize: file.size,
      uploadedBy: userId,
    });
    const savedDoc = await this.supplierDocRepository.save(doc);

    // Call OCR API to extract bank details
    // Pass supplier name as account holder name since API requires it
    const extracted = await this.chequeParser.extractBankDetailsFromCheque(file, supplier.supplierName);

    // Check if image quality is acceptable
    const isCompleteImage = extracted.quality_check?.is_complete_image === 'yes';
    
    // If quality check failed, return warning but still save document
    let warningMessage: string | undefined;
    if (!isCompleteImage) {
      warningMessage = extracted.quality_check?.message || 'Please upload a clear cheque image';
    }

    // If OCR failed to extract data (empty fields), return appropriate message
    if (!extracted.bank_account_number && !extracted.bank_name && !extracted.account_holder_name) {
      // Still save the document but return warning about manual entry needed
      return {
        chequeDocument: savedDoc,
        bankDetails: null,
        extracted: extracted.raw_response,
        warning: warningMessage || 'Unable to read cheque. Please enter details manually.',
        ocrSuccess: false,
      };
    }

    let bank = await this.supplierBankRepository.findOne({ where: { supplierId } });
    if (!bank) {
      bank = this.supplierBankRepository.create({
        supplierId,
        bankAccountNumber: extracted.bank_account_number,
        ifscCode: extracted.ifsc_code,
        bankName: extracted.bank_name,
        accountHolderName: extracted.account_holder_name,
        micrCode: extracted.micr_code || '',
        chequeNumber: extracted.cheque_number || '',
        chequeDocumentId: savedDoc.id,
      });
    } else {
      bank.bankAccountNumber = extracted.bank_account_number;
      bank.ifscCode = extracted.ifsc_code;
      bank.bankName = extracted.bank_name;
      bank.accountHolderName = extracted.account_holder_name;
      bank.micrCode = extracted.micr_code || '';
      bank.chequeNumber = extracted.cheque_number || '';
      bank.chequeDocumentId = savedDoc.id;
    }
    const savedBank = await this.supplierBankRepository.save(bank);

    return {
      chequeDocument: savedDoc,
      bankDetails: savedBank,
      extracted,
      ocrSuccess: true,
      warning: warningMessage,
    };
  }

  // Update bank details manually
  async updateBankDetails(
    supplierId: number,
    data: {
      bankAccountNumber: string;
      ifscCode: string;
      bankName: string;
      accountHolderName: string;
      micrCode?: string;
      chequeNumber?: string;
    },
    userId: number
  ) {
    const supplier = await this.supplierRepository.findOne({ where: { id: supplierId } });
    if (!supplier) throw new Error('Supplier not found');

    let bank = await this.supplierBankRepository.findOne({ where: { supplierId } });
    if (!bank) {
      bank = this.supplierBankRepository.create({
        supplierId,
        bankAccountNumber: data.bankAccountNumber,
        ifscCode: data.ifscCode,
        bankName: data.bankName,
        accountHolderName: data.accountHolderName,
        micrCode: data.micrCode || '',
        chequeNumber: data.chequeNumber || '',
      });
    } else {
      bank.bankAccountNumber = data.bankAccountNumber;
      bank.ifscCode = data.ifscCode;
      bank.bankName = data.bankName;
      bank.accountHolderName = data.accountHolderName;
      bank.micrCode = data.micrCode || '';
      bank.chequeNumber = data.chequeNumber || '';
    }

    const savedBank = await this.supplierBankRepository.save(bank);
    return savedBank;
  }

  // Delete cheque document and associated bank details
  async deleteChequeDocument(supplierId: number) {
    const supplier = await this.supplierRepository.findOne({ where: { id: supplierId } });
    if (!supplier) throw new Error('Supplier not found');

    // Delete bank details first
    await this.supplierBankRepository.delete({ supplierId });

    // Delete cheque document
    await this.supplierDocRepository.delete({ supplierId, documentType: 'CHEQUE' });

    return { success: true };
  }

  // Ops Head decision (approve/reject)
  async opsHeadDecision(supplierId: number, userId: number, remarks: string, approved: boolean) {
    const supplier = await this.supplierRepository.findOne({ where: { id: supplierId } });
    if (!supplier) throw new Error('Supplier not found');

    const workflow = await this.getOrCreateWorkflow(supplierId);
    if (workflow.currentStatus !== 'OPS_L1_APPROVED' && workflow.currentStatus !== 'SUBMITTED') {
      throw new Error('Cannot decide: Pending at Operations Head only');
    }

    const previousStatus = workflow.currentStatus;

    if (approved) {
      supplier.status = 'COMPLETED';
      workflow.currentStatus = 'COMPLETED';
      workflow.currentApproverRoleName = 'None';
      workflow.isCompleted = true;
      workflow.completedDate = new Date();
    } else {
      supplier.status = 'REJECTED';
      supplier.rejectionReason = remarks || 'Rejected by Operations Head';
      workflow.currentStatus = 'REJECTED';
      workflow.currentApproverRoleName = 'OPERATIONS_TEAM_L1';
      workflow.isRejected = true;
    }

    workflow.remarks = remarks;

    await this.supplierRepository.save(supplier);
    await this.workflowRepository.save(workflow);

    await this.logHistory({
      customerId: supplier.customerId,
      supplierId: supplier.id,
      caseWorkflowId: workflow.id,
      status: workflow.currentStatus,
      previousStatus,
      changedBy: userId,
      remarks,
    });

    return workflow;
  }

  async getApprovedCustomers() {
    // Get customers with status 'completed' or 'fully_onboarded' or 'operations_approved'
    return this.customerRepository.find({
      where: [
        { status: 'completed' },
        { status: 'fully_onboarded' },
        { status: 'operations_approved' }
      ],
      select: ['id', 'name', 'companyName', 'lanId', 'email', 'mobile'],
      order: { name: 'ASC' },
    });
  }

  async getSupplierById(supplierId: number) {
    const supplier = await this.supplierRepository.findOne({
      where: { id: supplierId },
      relations: ['customer', 'bankDetail', 'documents'],
    });

    if (!supplier) {
      throw new Error('Supplier not found');
    }

    const workflow = await this.workflowRepository.findOne({
      where: { supplierId },
      order: { createdAt: 'DESC' },
    });

    const history = await this.historyRepository.find({
      where: { supplierId },
      order: { createdAt: 'DESC' },
    });

    // Get cheque document if exists
    const chequeDocument = supplier.documents?.find(d => d.documentType === 'CHEQUE');

    return {
      supplier,
      workflow,
      history,
      chequeDocument,
    };
  }

  async createSupplierByRM(data: any, rmUserId: number) {
    const customer = await this.customerRepository.findOne({
      where: { id: data.customerId },
    });

    if (!customer) {
      throw new Error('Customer not found');
    }

    if (customer.status !== 'completed') {
      throw new Error('Customer must be completed before supplier onboarding');
    }

    const count = await this.getSupplierCountForLan(data.customerId);
    if ((count || 0) >= this.MAX_SUPPLIERS_PER_LAN) {
      throw new Error(`Maximum ${this.MAX_SUPPLIERS_PER_LAN} suppliers already added to this LAN`);
    }

    const supplierCode = data.supplierCode || `SUP-${Date.now()}`;

    const supplier = this.supplierRepository.create({
      customerId: data.customerId,
      supplierName: data.supplierName,
      supplierCode,
      email: data.email || '',
      contactNumber: data.contactNumber || data.mobileNumber || '',
      address: data.address || null,
      gstNumber: data.gstNumber || null,
      panNumber: data.panNumber || null,
      createdByUserId: rmUserId,
      status: 'DRAFT',
    });

    const savedSupplier = await this.supplierRepository.save(supplier);

    const workflow = this.workflowRepository.create({
      workflowType: 'SUPPLIER_ONBOARDING',
      supplierId: savedSupplier.id,
      customerId: data.customerId,
      currentStatus: 'DRAFT',
      currentApproverRoleName: 'OPERATIONS_TEAM_L1',
      remarks: 'Supplier created by RM',
    });

    const savedWorkflow = await this.workflowRepository.save(workflow);

    await this.logHistory({
      customerId: data.customerId,
      supplierId: savedSupplier.id,
      caseWorkflowId: savedWorkflow.id,
      status: 'DRAFT',
      previousStatus: 'None',
      changedBy: rmUserId,
      remarks: 'Supplier created by RM',
    });

    return { supplier: savedSupplier, workflow: savedWorkflow };
  }

  // Get all suppliers (for Completed/Rejected tab)
  async getAllSuppliers() {
    return this.supplierRepository.find({
      relations: ['customer'],
      order: { createdAt: 'DESC' },
    });
  }
}
