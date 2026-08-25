import { AppDataSource } from '../config/database';
import {
  CaseReminderLog,
  CaseRenewalCycle,
  CaseStatusHistory,
  CaseWorkflow,
  CreditSanction,
  Customer,
  Document,
  Invoice,
  LoanAccount,
  Partner,
  User,
} from '../entities';
import { CASE_STATUS } from '../config/constants';
import { sendMail } from '../utils/emailService';

const CARRY_FORWARD_DOCUMENT_TYPES = new Set([
  'gst_certificate',
  'applicant_gst',
  'signed_gst_certificate',
  'msme_certificate',
  'signed_msme_certificate',
  'pan',
  'aadhaar',
  'applicant_pan',
  'coapplicant_pan',
  'company_pan',
  'signed_pan',
  'signed_aadhaar',
  'cheque',
  'company_cheques',
  'personal_cheques',
  'nach',
  'enach_document',
]);

export const POST_SANCTION_LENDER_CHECKLISTS = {
  FFPL: {
    lender: 'FFPL',
    label: 'Fintree',
    documents: [
      { key: 'application_form', label: 'Application Form', mandatory: true },
      { key: 'unsigned_sanction_letter', label: 'Unsigned Sanction Letter', mandatory: true },
      { key: 'recommendation_mail_pdf', label: 'Recommendation Mail PDF', mandatory: true },
      { key: 'signed_sanction_letter', label: 'Signed Sanction Letter', mandatory: true },
      { key: 'signed_loan_agreement', label: 'Signed Loan Agreement', mandatory: true },
      { key: 'audit_trail', label: 'Audit Trail', mandatory: false },
      { key: 'signed_gst_certificate', label: 'Signed GST Certificate', mandatory: true },
      { key: 'signed_msme_certificate', label: 'Signed MSME Certificate', mandatory: true },
      { key: 'signed_aadhaar', label: 'Signed Aadhaar', mandatory: true },
      { key: 'signed_pan', label: 'Signed PAN', mandatory: true },
      { key: 'signed_residence_proof', label: 'Signed Residence Proof', mandatory: true },
      { key: 'signed_ckyc', label: 'Signed C-KYC', mandatory: true },
      { key: 'company_cheques', label: 'Company Cheques', mandatory: true },
      { key: 'personal_cheques', label: 'Personal Cheques', mandatory: true },
      { key: 'nach', label: 'NACH', mandatory: true },
      { key: 'challan', label: 'Challan', mandatory: true },
      { key: 'others', label: 'Others', mandatory: false },
      { key: 'field_visit_astute_report', label: 'Field Visit / Astute Report', mandatory: true },
      { key: 'letterhead_documents', label: 'Letterhead Documents', mandatory: true },
    ],
  },
  KITE: {
    lender: 'KITE',
    label: 'Kite',
    documents: [
      { key: 'application_form', label: 'Application Form', mandatory: true },
      { key: 'unsigned_sanction_letter', label: 'Unsigned Sanction Letter', mandatory: true },
      { key: 'recommendation_mail_pdf', label: 'Recommendation Mail PDF', mandatory: false },
      { key: 'signed_sanction_letter', label: 'Signed Sanction Letter', mandatory: true },
      { key: 'signed_loan_agreement', label: 'Signed Loan Agreement', mandatory: true },
      { key: 'audit_trail', label: 'Audit Trail', mandatory: false },
      { key: 'signed_gst_certificate', label: 'Signed GST Certificate', mandatory: true },
      { key: 'signed_msme_certificate', label: 'Signed MSME Certificate', mandatory: true },
      { key: 'signed_aadhaar', label: 'Signed Aadhaar', mandatory: true },
      { key: 'signed_pan', label: 'Signed PAN', mandatory: true },
      { key: 'signed_residence_proof', label: 'Signed Residence Proof', mandatory: true },
      { key: 'signed_ckyc', label: 'Signed C-KYC', mandatory: true },
      { key: 'company_cheques', label: 'Company Cheques', mandatory: true },
      { key: 'personal_cheques', label: 'Personal Cheques', mandatory: true },
      { key: 'nach', label: 'NACH', mandatory: true },
      { key: 'challan', label: 'Challan', mandatory: true },
      { key: 'others', label: 'Others', mandatory: false },
      { key: 'demand_promissory_note', label: 'Demand Promissory Note', mandatory: true },
    ],
  },
  MFL: {
    lender: 'MFL',
    label: 'Muthoot',
    documents: [
      { key: 'application_form', label: 'Application Form', mandatory: true },
      { key: 'unsigned_sanction_letter', label: 'Unsigned Sanction Letter', mandatory: true },
      { key: 'recommendation_mail_pdf', label: 'Recommendation Mail PDF', mandatory: false },
      { key: 'signed_sanction_letter', label: 'Signed Sanction Letter', mandatory: true },
      { key: 'signed_loan_agreement', label: 'Signed Loan Agreement', mandatory: true },
      { key: 'audit_trail', label: 'Audit Trail', mandatory: false },
      { key: 'signed_gst_certificate', label: 'Signed GST Certificate', mandatory: true },
      { key: 'signed_msme_certificate', label: 'Signed MSME Certificate', mandatory: true },
      { key: 'signed_aadhaar', label: 'Signed Aadhaar', mandatory: true },
      { key: 'signed_pan', label: 'Signed PAN', mandatory: true },
      { key: 'signed_residence_proof', label: 'Signed Residence Proof', mandatory: true },
      { key: 'signed_ckyc', label: 'Signed C-KYC', mandatory: true },
      { key: 'company_cheques', label: 'Company Cheques', mandatory: true },
      { key: 'personal_cheques', label: 'Personal Cheques', mandatory: true },
      { key: 'nach', label: 'NACH', mandatory: true },
      { key: 'challan', label: 'Challan', mandatory: true },
      { key: 'others', label: 'Others', mandatory: false },
      { key: 'field_visit_astute_report', label: 'Field Visit / Astute Report', mandatory: true },
      { key: 'letterhead_documents', label: 'Letterhead Documents', mandatory: true },
    ],
  },
};

type CalendarFilters = {
  startDate?: Date;
  endDate?: Date;
  rmId?: number;
  groupCollectionEvents?: boolean;
};

type CalendarEvent = {
  id: string;
  type: 'SANCTION_EXPIRY' | 'COLLECTION_DUE';
  title: string;
  date: Date;
  daysUntil: number;
  customerId: number;
  customerName: string | undefined;
  rmId: number | undefined;
  rmName: string | null;
  lender: string | null;
  lenderCode: string | null;
  referenceId: number;
  invoiceId?: number;
  invoiceNumber?: string;
  supplierName?: string | null;
  amount?: number;
  invoiceCount?: number;
  dueDateCount?: number;
  sanctionCount?: number;
};

type CollectionEventGroup = CalendarEvent & {
  invoiceNumbers: string[];
  supplierNames: string[];
  dueDates: string[];
};

type LenderInfo = {
  key: string | null;
  code: string | null;
  label: string | null;
};

export class CaseLifecycleService {
  private customerRepository = AppDataSource.getRepository(Customer);
  private workflowRepository = AppDataSource.getRepository(CaseWorkflow);
  private historyRepository = AppDataSource.getRepository(CaseStatusHistory);
  private documentRepository = AppDataSource.getRepository(Document);
  private renewalRepository = AppDataSource.getRepository(CaseRenewalCycle);
  private sanctionRepository = AppDataSource.getRepository(CreditSanction);
  private reminderRepository = AppDataSource.getRepository(CaseReminderLog);
  private invoiceRepository = AppDataSource.getRepository(Invoice);
  private userRepository = AppDataSource.getRepository(User);
  private partnerRepository = AppDataSource.getRepository(Partner);

  getPostSanctionChecklists() {
    return Object.values(POST_SANCTION_LENDER_CHECKLISTS);
  }

  async getRelationshipManagers() {
    const users = await this.userRepository
      .createQueryBuilder('user')
      .leftJoin('user.userRoles', 'userRole', 'userRole.isActive = :active', { active: true })
      .leftJoin('userRole.role', 'role', 'role.isActive = :active', { active: true })
      .where('user.isActive = :active', { active: true })
      .andWhere('(user.defaultRole = :rmRole OR role.name = :rmRole)', {
        rmRole: 'relationship_manager',
      })
      .select([
        'user.id',
        'user.name',
        'user.email',
        'user.defaultRole',
      ])
      .orderBy('user.name', 'ASC')
      .getMany();

    return users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      defaultRole: user.defaultRole,
    }));
  }

  private toDateOnly(value: Date | string): Date {
    const date = value instanceof Date ? value : new Date(value);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private formatDateOnly(value: Date | string): string {
    const date = this.toDateOnly(value);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private addMonths(date: Date, months: number): Date {
    const result = new Date(date);
    const originalDay = result.getDate();
    result.setMonth(result.getMonth() + months);
    if (result.getDate() < originalDay) {
      result.setDate(0);
    }
    return this.toDateOnly(result);
  }

  private daysUntil(date: Date | string, today = new Date()): number {
    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.round((this.toDateOnly(date).getTime() - this.toDateOnly(today).getTime()) / msPerDay);
  }

  private toNumber(value: unknown): number {
    if (value === null || value === undefined || value === '') return 0;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private normalizeLenderLookupValue(value?: string | null): string | null {
    const normalized = String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    return normalized || null;
  }

  private lenderFromPartner(partner: Partner): LenderInfo {
    const code = String(partner.code || partner.lanPrefix || partner.name || '').trim();
    const label = code || String(partner.name || partner.lanPrefix || '').trim();

    return {
      key: this.normalizeLenderLookupValue(code || label),
      code: code || null,
      label: label || null,
    };
  }

  private async getLenderLookup(): Promise<Map<string, LenderInfo>> {
    const partners = await this.partnerRepository.find();
    const lookup = new Map<string, LenderInfo>();

    for (const partner of partners) {
      const lender = this.lenderFromPartner(partner);
      [partner.code, partner.name, partner.lanPrefix].forEach((value) => {
        const key = this.normalizeLenderLookupValue(value);
        if (key) lookup.set(key, lender);
      });
    }

    return lookup;
  }

  private resolveLender(value: string | null | undefined, lookup: Map<string, LenderInfo>): LenderInfo {
    const key = this.normalizeLenderLookupValue(value);
    if (!key) return { key: null, code: null, label: null };

    const matched = lookup.get(key);
    if (matched) return matched;

    const fallback = String(value || '').trim();
    return {
      key,
      code: fallback || null,
      label: fallback || null,
    };
  }

  private getLoanAccountLender(
    loanAccount: LoanAccount | null | undefined,
    lookup: Map<string, LenderInfo>,
  ): LenderInfo {
    if (loanAccount?.partner) return this.lenderFromPartner(loanAccount.partner);
    return this.resolveLender(loanAccount?.lender, lookup);
  }

  private formatCollectionReference(invoiceNumbers: string[]): string {
    const uniqueNumbers = Array.from(new Set(invoiceNumbers.filter(Boolean)));
    if (uniqueNumbers.length === 0) return '-';
    if (uniqueNumbers.length === 1) return uniqueNumbers[0];
    return `${uniqueNumbers[0]} +${uniqueNumbers.length - 1} more`;
  }

  private getApproverForStatus(status: string): string {
    switch ((status || '').toLowerCase()) {
      case 'draft':
      case 'returned_to_rm':
        return 'RELATIONSHIP_MANAGER';
      case 'submitted':
        return 'CREDIT_TEAM_L1';
      case 'credit_l1_approved':
        return 'CREDIT_TEAM_L2';
      case 'credit_l2_approved':
        return 'RELATIONSHIP_MANAGER';
      case 'md_terms_submitted':
        return 'MD';
      case 'md_approved':
        return 'RELATIONSHIP_MANAGER';
      case 'ops_l1_review':
        return 'OPERATIONS_TEAM_L1';
      case 'ops_l1_approved':
      case 'ops_l2_verified':
        return 'OPERATIONS_HEAD';
      case 'completed':
        return 'None';
      case 'on_hold':
        return 'ON_HOLD';
      case 'archived':
        return 'ARCHIVED';
      default:
        return 'RELATIONSHIP_MANAGER';
    }
  }

  private async getOrCreateWorkflow(customerId: number): Promise<CaseWorkflow> {
    let workflow = await this.workflowRepository.findOne({
      where: { customerId, workflowType: 'CUSTOMER_ONBOARDING' as any },
    });

    if (workflow) return workflow;

    const customer = await this.customerRepository.findOne({ where: { id: customerId } });
    if (!customer) throw new Error('Customer not found');

    workflow = this.workflowRepository.create({
      workflowType: 'CUSTOMER_ONBOARDING' as any,
      customerId,
      currentStatus: customer.status || CASE_STATUS.DRAFT,
      currentApproverRoleName: this.getApproverForStatus(customer.status || CASE_STATUS.DRAFT),
    });
    return await this.workflowRepository.save(workflow);
  }

  private async logHistory(data: {
    customerId: number;
    caseWorkflowId?: number;
    status: string;
    previousStatus: string;
    changedBy: number;
    remarks?: string;
  }) {
    return await this.historyRepository.save(this.historyRepository.create({
      customerId: data.customerId,
      caseWorkflowId: data.caseWorkflowId,
      status: data.status as any,
      previousStatus: data.previousStatus as any,
      changedBy: data.changedBy,
      remarks: data.remarks,
    }));
  }

  async applySanctionDatesAfterMdApproval(customerId: number, sanctionDate: Date = new Date()) {
    const customer = await this.customerRepository.findOne({ where: { id: customerId } });
    if (!customer) throw new Error('Customer not found');

    const activeCycle = await this.renewalRepository.findOne({
      where: { customerId, status: 'active' },
      order: { cycleNumber: 'DESC' },
    });

    const approvedSanctions = await this.sanctionRepository.find({
      where: { customerId, status: 'approved' },
    });

    const normalizedSanctionDate = this.toDateOnly(sanctionDate);
    for (const sanction of approvedSanctions) {
      sanction.sanctionDate = normalizedSanctionDate;
      sanction.sanctionExpiryDate = this.addMonths(normalizedSanctionDate, Number(sanction.tenure || 0));
      sanction.renewalCycleId = activeCycle?.id || sanction.renewalCycleId || null;
      await this.sanctionRepository.save(sanction);
    }

    if (activeCycle) {
      activeCycle.status = 'completed';
      activeCycle.completedAt = new Date();
      await this.renewalRepository.save(activeCycle);

      customer.currentRenewalCycleId = null;
      await this.customerRepository.save(customer);
    }

    return approvedSanctions;
  }

  private async getNextCycleNumber(customerId: number): Promise<number> {
    const row = await this.renewalRepository
      .createQueryBuilder('cycle')
      .select('MAX(cycle.cycleNumber)', 'maxCycle')
      .where('cycle.customerId = :customerId', { customerId })
      .getRawOne();

    return Number(row?.maxCycle || 0) + 1;
  }

  private async getNearestSanctionExpiry(customerId: number): Promise<Date | null> {
    const sanction = await this.sanctionRepository
      .createQueryBuilder('sanction')
      .where('sanction.customerId = :customerId', { customerId })
      .andWhere('sanction.status = :status', { status: 'approved' })
      .andWhere('sanction.sanctionExpiryDate IS NOT NULL')
      .orderBy('sanction.sanctionExpiryDate', 'ASC')
      .getOne();

    return sanction?.sanctionExpiryDate || null;
  }

  private async carryForwardRenewalDocuments(customerId: number, renewalCycleId: number, userId: number) {
    const existingForCycle = await this.documentRepository.find({
      where: { customerId, renewalCycleId },
    });
    const existingKeys = new Set(existingForCycle.map((document) =>
      `${document.documentType}:${document.lender || ''}:${document.applicantId || ''}:${document.coApplicantId || ''}:${document.carriedForwardFromDocumentId || ''}`,
    ));

    const documents = await this.documentRepository.find({
      where: { customerId },
      order: { createdAt: 'DESC' },
    });

    const latestByKey = new Map<string, Document>();

    for (const document of documents) {
      if (!CARRY_FORWARD_DOCUMENT_TYPES.has(document.documentType)) continue;
      if (document.renewalCycleId === renewalCycleId) continue;

      const key = `${document.documentType}:${document.lender || ''}:${document.applicantId || ''}:${document.coApplicantId || ''}`;
      if (!latestByKey.has(key)) {
        latestByKey.set(key, document);
      }
    }

    const carriedForward: Document[] = [];
    for (const sourceDocument of latestByKey.values()) {
      const duplicateKey = `${sourceDocument.documentType}:${sourceDocument.lender || ''}:${sourceDocument.applicantId || ''}:${sourceDocument.coApplicantId || ''}:${sourceDocument.id}`;
      if (existingKeys.has(duplicateKey)) continue;

      const document = this.documentRepository.create({
        customerId,
        applicantId: sourceDocument.applicantId,
        coApplicantId: sourceDocument.coApplicantId,
        documentType: sourceDocument.documentType,
        fileName: sourceDocument.fileName,
        filePath: sourceDocument.filePath,
        mimeType: sourceDocument.mimeType,
        fileSize: sourceDocument.fileSize,
        uploadedBy: userId,
        verified: sourceDocument.verified,
        status: sourceDocument.status,
        verifiedBy: sourceDocument.verifiedBy,
        verifiedAt: sourceDocument.verifiedAt,
        remarks: sourceDocument.remarks,
        rmRemarks: sourceDocument.rmRemarks,
        issueDate: sourceDocument.issueDate,
        expiryDate: sourceDocument.expiryDate,
        lender: sourceDocument.lender,
        renewalCycleId,
        isCarriedForward: true,
        carriedForwardFromDocumentId: sourceDocument.id,
        documentLabel: sourceDocument.documentLabel,
      });
      carriedForward.push(await this.documentRepository.save(document));
    }

    return carriedForward;
  }

  async startRenewal(customerId: number, userId: number, remarks?: string) {
    const customer = await this.customerRepository.findOne({ where: { id: customerId } });
    if (!customer) throw new Error('Customer not found');
    if (customer.lifecycleStatus === 'archived') {
      throw new Error('Archived cases cannot be renewed');
    }

    const activeCycle = await this.renewalRepository.findOne({
      where: { customerId, status: 'active' },
      order: { cycleNumber: 'DESC' },
    });
    if (activeCycle) {
      throw new Error(`Renewal cycle ${activeCycle.cycleNumber} is already active`);
    }

    const workflow = await this.getOrCreateWorkflow(customerId);
    const previousStatus = workflow.currentStatus;
    const cycleNumber = await this.getNextCycleNumber(customerId);
    const cycle = await this.renewalRepository.save(this.renewalRepository.create({
      customerId,
      cycleNumber,
      status: 'active',
      sourceExpiryDate: await this.getNearestSanctionExpiry(customerId),
      previousWorkflowStatus: previousStatus,
      initiatedByUserId: userId,
      initiatedAt: new Date(),
      remarks: remarks || 'Renewal initiated',
    }));

    const carriedForwardDocuments = await this.carryForwardRenewalDocuments(customerId, cycle.id, userId);

    workflow.currentStatus = CASE_STATUS.RETURNED_TO_RM;
    workflow.currentApproverRoleName = 'RELATIONSHIP_MANAGER';
    workflow.assignedUserId = customer.rmId;
    workflow.assignedStage = 'rm';
    workflow.remarks = remarks || 'Renewal initiated and sent to RM';
    await this.workflowRepository.save(workflow);

    customer.status = CASE_STATUS.RETURNED_TO_RM;
    customer.lifecycleStatus = 'active';
    customer.previousWorkflowStatus = previousStatus;
    customer.currentRenewalCycleId = cycle.id;
    customer.assignedUserId = customer.rmId;
    customer.assignedStage = 'rm';
    customer.lifecycleReason = remarks || 'Renewal initiated';
    await this.customerRepository.save(customer);

    await this.logHistory({
      customerId,
      caseWorkflowId: workflow.id,
      status: CASE_STATUS.RENEWAL_INITIATED,
      previousStatus,
      changedBy: userId,
      remarks: remarks || `Renewal cycle ${cycleNumber} initiated`,
    });

    return { renewalCycle: cycle, workflow, carriedForwardDocuments };
  }

  async holdCase(customerId: number, userId: number, reason?: string) {
    const customer = await this.customerRepository.findOne({ where: { id: customerId } });
    if (!customer) throw new Error('Customer not found');
    if (customer.lifecycleStatus === 'archived') throw new Error('Archived cases cannot be put on hold');

    const workflow = await this.getOrCreateWorkflow(customerId);
    const previousStatus = workflow.currentStatus;

    customer.lifecycleStatus = 'on_hold';
    customer.previousWorkflowStatus = previousStatus;
    customer.lifecycleReason = reason || 'Case placed on hold';
    customer.heldByUserId = userId;
    customer.heldAt = new Date();
    customer.status = CASE_STATUS.ON_HOLD;
    await this.customerRepository.save(customer);

    workflow.currentStatus = CASE_STATUS.ON_HOLD;
    workflow.currentApproverRoleName = 'ON_HOLD';
    workflow.remarks = reason || 'Case placed on hold';
    await this.workflowRepository.save(workflow);

    await this.logHistory({
      customerId,
      caseWorkflowId: workflow.id,
      status: CASE_STATUS.ON_HOLD,
      previousStatus,
      changedBy: userId,
      remarks: reason || 'Case placed on hold',
    });

    return { customer, workflow };
  }

  async resumeCase(customerId: number, userId: number, remarks?: string) {
    const customer = await this.customerRepository.findOne({ where: { id: customerId } });
    if (!customer) throw new Error('Customer not found');
    if (customer.lifecycleStatus !== 'on_hold') throw new Error('Only on-hold cases can be resumed');

    const workflow = await this.getOrCreateWorkflow(customerId);
    const previousStatus = workflow.currentStatus;
    const restoredStatus = customer.previousWorkflowStatus || CASE_STATUS.DRAFT;

    customer.lifecycleStatus = 'active';
    customer.status = restoredStatus as any;
    customer.lifecycleReason = remarks || 'Case resumed';
    customer.heldByUserId = null;
    customer.heldAt = null;
    await this.customerRepository.save(customer);

    workflow.currentStatus = restoredStatus;
    workflow.currentApproverRoleName = this.getApproverForStatus(restoredStatus);
    workflow.remarks = remarks || 'Case resumed';
    await this.workflowRepository.save(workflow);

    await this.logHistory({
      customerId,
      caseWorkflowId: workflow.id,
      status: restoredStatus,
      previousStatus,
      changedBy: userId,
      remarks: remarks || 'Case resumed from hold',
    });

    return { customer, workflow };
  }

  async archiveCase(customerId: number, userId: number, reason?: string) {
    const customer = await this.customerRepository.findOne({ where: { id: customerId } });
    if (!customer) throw new Error('Customer not found');

    const workflow = await this.getOrCreateWorkflow(customerId);
    const previousStatus = workflow.currentStatus;

    customer.lifecycleStatus = 'archived';
    customer.previousWorkflowStatus = previousStatus;
    customer.lifecycleReason = reason || 'Case archived';
    customer.archivedByUserId = userId;
    customer.archivedAt = new Date();
    customer.status = CASE_STATUS.ARCHIVED;
    await this.customerRepository.save(customer);

    workflow.currentStatus = CASE_STATUS.ARCHIVED;
    workflow.currentApproverRoleName = 'ARCHIVED';
    workflow.remarks = reason || 'Case archived';
    await this.workflowRepository.save(workflow);

    await this.logHistory({
      customerId,
      caseWorkflowId: workflow.id,
      status: CASE_STATUS.ARCHIVED,
      previousStatus,
      changedBy: userId,
      remarks: reason || 'Case archived',
    });

    return { customer, workflow };
  }

  async reassignRM(customerId: number, newRmId: number, userId: number, remarks?: string) {
    const customer = await this.customerRepository.findOne({
      where: { id: customerId },
      relations: ['rm'],
    });
    if (!customer) throw new Error('Customer not found');

    const newRm = await this.userRepository.findOne({ where: { id: newRmId } });
    if (!newRm) throw new Error('New RM not found');

    const workflow = await this.getOrCreateWorkflow(customerId);
    const status = workflow.currentStatus.toLowerCase();
    const allowedStatuses = [
      'credit_l2_approved',
      'md_terms_submitted',
      'md_approved',
      'returned_to_rm',
      'ops_l1_review',
      'ops_l1_approved',
      'ops_l2_verified',
      'ops_head_approved',
      'completed',
    ];
    if (!allowedStatuses.includes(status)) {
      throw new Error('RM reassignment is allowed only after the credit process');
    }

    const oldRmId = customer.rmId;
    const oldRmName = customer.rm?.name || `User ${oldRmId}`;

    customer.rmId = newRmId;
    if (workflow.currentApproverRoleName === 'RELATIONSHIP_MANAGER' || workflow.assignedStage === 'rm') {
      customer.assignedUserId = newRmId;
      workflow.assignedUserId = newRmId;
    }
    await this.customerRepository.save(customer);
    await this.workflowRepository.save(workflow);

    await this.logHistory({
      customerId,
      caseWorkflowId: workflow.id,
      status: CASE_STATUS.RM_REASSIGNED,
      previousStatus: workflow.currentStatus,
      changedBy: userId,
      remarks: remarks || `RM reassigned from ${oldRmName} (${oldRmId}) to ${newRm.name || `User ${newRmId}`} (${newRmId})`,
    });

    return { customer, workflow, oldRmId, newRmId };
  }

  async getRenewalSummary(customerId: number) {
    const [cycles, sanctions, carriedForwardDocuments] = await Promise.all([
      this.renewalRepository.find({
        where: { customerId },
        order: { cycleNumber: 'DESC' },
      }),
      this.sanctionRepository.find({
        where: { customerId },
        order: { sanctionExpiryDate: 'ASC' as any },
      }),
      this.documentRepository.find({
        where: { customerId, isCarriedForward: true },
        order: { createdAt: 'DESC' },
      }),
    ]);

    return {
      cycles,
      activeCycle: cycles.find((cycle) => cycle.status === 'active') || null,
      sanctions,
      carriedForwardDocuments,
      checklists: this.getPostSanctionChecklists(),
    };
  }

  async getCalendarEvents(filters: CalendarFilters = {}) {
    const today = new Date();
    const sanctionQuery = this.sanctionRepository
      .createQueryBuilder('sanction')
      .leftJoinAndSelect('sanction.customer', 'customer')
      .leftJoinAndSelect('customer.rm', 'rm')
      .where('sanction.sanctionExpiryDate IS NOT NULL')
      .andWhere('sanction.status = :sanctionStatus', { sanctionStatus: 'approved' });

    if (filters.startDate) {
      sanctionQuery.andWhere('sanction.sanctionExpiryDate >= :startDate', {
        startDate: this.formatDateOnly(filters.startDate),
      });
    }
    if (filters.endDate) {
      sanctionQuery.andWhere('sanction.sanctionExpiryDate <= :endDate', {
        endDate: this.formatDateOnly(filters.endDate),
      });
    }
    if (filters.rmId) {
      sanctionQuery.andWhere('customer.rmId = :rmId', { rmId: filters.rmId });
    }

    const sanctions = await sanctionQuery.orderBy('sanction.sanctionExpiryDate', 'ASC').getMany();

    const invoiceQuery = this.invoiceRepository
      .createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice.customer', 'customer')
      .leftJoinAndSelect('customer.rm', 'rm')
      .leftJoinAndSelect('invoice.supplier', 'supplier')
      .leftJoinAndSelect('invoice.loanAccount', 'loanAccount')
      .leftJoinAndSelect('loanAccount.partner', 'partner')
      .where('invoice.invoiceDueDate IS NOT NULL')
      .andWhere('invoice.isActive = :isActive', { isActive: true })
      .andWhere('invoice.status IN (:...statuses)', {
        statuses: ['ACTIVE', 'PENDING_FINAL_OPS_L2_APPROVAL', 'DISBURSEMENT_DATA_ENTRY'],
      });

    if (filters.startDate) {
      invoiceQuery.andWhere('invoice.invoiceDueDate >= :startDate', {
        startDate: this.formatDateOnly(filters.startDate),
      });
    }
    if (filters.endDate) {
      invoiceQuery.andWhere('invoice.invoiceDueDate <= :endDate', {
        endDate: this.formatDateOnly(filters.endDate),
      });
    }
    if (filters.rmId) {
      invoiceQuery.andWhere('customer.rmId = :rmId', { rmId: filters.rmId });
    }

    const invoices = await invoiceQuery.orderBy('invoice.invoiceDueDate', 'ASC').getMany();
    const lenderLookup = await this.getLenderLookup();

    const sanctionEventsByKey = new Map<string, CalendarEvent>();

    for (const sanction of sanctions) {
      const days = this.daysUntil(sanction.sanctionExpiryDate!, today);
      const lender = this.resolveLender(sanction.partner, lenderLookup);
      const lenderKey = lender.key || 'NO_LENDER';
      const key = `${sanction.customerId}:${lenderKey}`;
      const existing = sanctionEventsByKey.get(key);

      if (existing) {
        existing.sanctionCount = (existing.sanctionCount || 1) + 1;

        if (new Date(sanction.sanctionExpiryDate as any).getTime() < new Date(existing.date as any).getTime()) {
          existing.date = sanction.sanctionExpiryDate!;
          existing.daysUntil = days;
          existing.referenceId = sanction.id;
        }

        continue;
      }

      sanctionEventsByKey.set(key, {
        id: `sanction-${sanction.customerId}-${lenderKey}`,
        type: 'SANCTION_EXPIRY',
        title: 'Sanction Expiry',
        date: sanction.sanctionExpiryDate!,
        daysUntil: days,
        customerId: sanction.customerId,
        customerName: sanction.customer?.companyName || sanction.customer?.customerName || sanction.customer?.name,
        rmId: sanction.customer?.rmId,
        rmName: sanction.customer?.rm?.name || null,
        lender: lender.label,
        lenderCode: lender.code,
        referenceId: sanction.id,
        sanctionCount: 1,
      });
    }

    const sanctionEvents = Array.from(sanctionEventsByKey.values());

    const collectionEventsByKey = new Map<string, CollectionEventGroup>();
    const groupCollectionEvents = filters.groupCollectionEvents !== false;

    for (const invoice of invoices) {
      const days = this.daysUntil(invoice.invoiceDueDate!, today);
      const dueDate = this.formatDateOnly(invoice.invoiceDueDate!);
      const lender = this.getLoanAccountLender(invoice.loanAccount, lenderLookup);
      const lenderKey = lender.key || 'NO_LENDER';
      const key = groupCollectionEvents
        ? `${invoice.customerId}:${lenderKey}`
        : `${invoice.customerId}:${dueDate}:${lenderKey}`;
      const invoiceNumber = invoice.invoiceNumber || `#${invoice.id}`;
      const supplierName = invoice.supplier?.supplierName || null;
      const amount = this.toNumber(invoice.disbursementAmount || invoice.invoiceAmount);
      const existing = collectionEventsByKey.get(key);

      if (existing) {
        existing.invoiceNumbers.push(invoiceNumber);
        if (supplierName && !existing.supplierNames.includes(supplierName)) {
          existing.supplierNames.push(supplierName);
        }
        existing.amount = (existing.amount || 0) + amount;
        existing.invoiceCount = (existing.invoiceCount || 1) + 1;
        if (!existing.dueDates.includes(dueDate)) {
          existing.dueDates.push(dueDate);
          existing.dueDateCount = existing.dueDates.length;
        }
        existing.invoiceNumber = this.formatCollectionReference(existing.invoiceNumbers);
        existing.supplierName = existing.supplierNames.join(', ') || null;
        if (new Date(invoice.invoiceDueDate as any).getTime() < new Date(existing.date as any).getTime()) {
          existing.date = invoice.invoiceDueDate!;
          existing.daysUntil = days;
          existing.invoiceId = invoice.id;
          existing.referenceId = invoice.id;
        }
        continue;
      }

      collectionEventsByKey.set(key, {
        id: `collection-${invoice.customerId}-${dueDate}-${lenderKey}`,
        type: 'COLLECTION_DUE',
        title: 'Collection Due',
        date: invoice.invoiceDueDate!,
        daysUntil: days,
        customerId: invoice.customerId,
        customerName: invoice.customer?.companyName || invoice.customer?.customerName || invoice.customer?.name,
        rmId: invoice.customer?.rmId,
        rmName: invoice.customer?.rm?.name || null,
        lender: lender.label,
        lenderCode: lender.code,
        invoiceId: invoice.id,
        invoiceNumber,
        invoiceNumbers: [invoiceNumber],
        supplierName,
        supplierNames: supplierName ? [supplierName] : [],
        amount,
        invoiceCount: 1,
        dueDates: [dueDate],
        dueDateCount: 1,
        referenceId: invoice.id,
      });
    }

    const collectionEvents = Array.from(collectionEventsByKey.values()).map((event) => {
      const { invoiceNumbers, supplierNames, dueDates, ...calendarEvent } = event;
      return calendarEvent;
    });

    return [...sanctionEvents, ...collectionEvents]
      .sort((a, b) => new Date(a.date as any).getTime() - new Date(b.date as any).getTime());
  }

  private getReminderRecipients(): string[] {
    const raw =
      process.env.RENEWAL_REMINDER_RECIPIENTS ||
      process.env.DEVELOPER_EMAIL ||
      process.env.SMTP_USER ||
      '';

    return raw
      .split(',')
      .map((email) => email.trim())
      .filter(Boolean);
  }

  private async logReminder(params: {
    customerId: number;
    referenceType: string;
    referenceId: number;
    reminderType: string;
    reminderDate: Date;
    scheduledFor: Date;
    sentTo: string[];
    status: string;
    errorMessage?: string;
  }) {
    const existing = await this.reminderRepository.findOne({
      where: {
        customerId: params.customerId,
        referenceType: params.referenceType,
        referenceId: params.referenceId,
        reminderType: params.reminderType,
        reminderDate: params.reminderDate,
      },
    });

    if (existing) return existing;

    return await this.reminderRepository.save(this.reminderRepository.create({
      customerId: params.customerId,
      referenceType: params.referenceType,
      referenceId: params.referenceId,
      reminderType: params.reminderType,
      reminderDate: params.reminderDate,
      scheduledFor: params.scheduledFor,
      sentTo: params.sentTo.join(','),
      sentAt: params.status === 'sent' ? new Date() : null,
      status: params.status,
      errorMessage: params.errorMessage || null,
    }));
  }

  async sendDueReminders(today: Date = new Date()) {
    const recipients = this.getReminderRecipients();
    if (recipients.length === 0) {
      return { sent: 0, skipped: 0, errors: ['No reminder recipients configured'] };
    }

    const events = await this.getCalendarEvents({ groupCollectionEvents: false });
    const reminderDate = this.toDateOnly(today);
    const dueEvents = events
      .map((event) => ({
        event,
        daysUntil: this.daysUntil(event.date as any, today),
      }))
      .filter(({ event, daysUntil }) => {
        if (event.type === 'SANCTION_EXPIRY') return [30, 15].includes(daysUntil);
        if (event.type === 'COLLECTION_DUE') return daysUntil === 15;
        return false;
      });

    let sent = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const { event, daysUntil } of dueEvents) {
      const reminderType = event.type === 'SANCTION_EXPIRY'
        ? `SANCTION_EXPIRY_${daysUntil}D`
        : 'COLLECTION_DUE_15D';

      const existing = await this.reminderRepository.findOne({
        where: {
          customerId: event.customerId,
          referenceType: event.type,
          referenceId: event.referenceId,
          reminderType,
          reminderDate,
        },
      });
      if (existing) {
        skipped += 1;
        continue;
      }

      const collectionEvent = event as any;
      const collectionInvoiceLabel = event.type === 'COLLECTION_DUE'
        ? collectionEvent.invoiceNumber || collectionEvent.invoiceId
        : null;

      const subject = event.type === 'SANCTION_EXPIRY'
        ? `Sanction expiry reminder - ${event.customerName || event.customerId}`
        : `Collection due reminder - ${event.customerName || event.customerId}`;
      const text = event.type === 'SANCTION_EXPIRY'
        ? `Sanction expiry is due in ${daysUntil} days.\n\nCustomer: ${event.customerName || event.customerId}\nCase ID: ${event.customerId}\nLender: ${event.lender || 'N/A'}\nExpiry Date: ${this.formatDateOnly(event.date as any)}`
        : `Collection is due in 15 days.\n\nCustomer: ${event.customerName || event.customerId}\nCase ID: ${event.customerId}\nInvoice: ${collectionInvoiceLabel}\nDue Date: ${this.formatDateOnly(event.date as any)}`;

      try {
        for (const recipient of recipients) {
          await sendMail({ to: recipient, subject, text });
        }
        await this.logReminder({
          customerId: event.customerId,
          referenceType: event.type,
          referenceId: event.referenceId,
          reminderType,
          reminderDate,
          scheduledFor: this.toDateOnly(event.date as any),
          sentTo: recipients,
          status: 'sent',
        });
        sent += 1;
      } catch (error: any) {
        errors.push(error.message || String(error));
        await this.logReminder({
          customerId: event.customerId,
          referenceType: event.type,
          referenceId: event.referenceId,
          reminderType,
          reminderDate,
          scheduledFor: this.toDateOnly(event.date as any),
          sentTo: recipients,
          status: 'failed',
          errorMessage: error.message || String(error),
        });
      }
    }

    return { sent, skipped, errors };
  }
}

export const caseLifecycleService = new CaseLifecycleService();
