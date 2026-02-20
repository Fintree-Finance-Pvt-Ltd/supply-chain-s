import { In } from 'typeorm';
import { AppDataSource } from '../config/database';
import { Customer } from '../entities/Customer';
import { CaseWorkflow } from '../entities/CaseWorkflow';
import { CaseStatusHistory } from '../entities/CaseStatusHistory';
import { CreditSanction } from '../entities/CreditSanction';
import { SanctionLimitHistory } from '../entities/SanctionLimitHistory';
import { KycOwnerType } from '../entities/KycVerificationStatus';
import { CoApplicant } from '../entities/CoApplicant';
import { OnboardingIntegrationService } from './onboarding-integration.service';

export class CustomerOnboardingService {
  private customerRepository = AppDataSource.getRepository(Customer);
  private workflowRepository = AppDataSource.getRepository(CaseWorkflow);
  private historyRepository = AppDataSource.getRepository(CaseStatusHistory);
  private sanctionRepository = AppDataSource.getRepository(CreditSanction);
  private sanctionHistoryRepository = AppDataSource.getRepository(SanctionLimitHistory);
  private coApplicantRepository = AppDataSource.getRepository(CoApplicant);

  private onboardingService: OnboardingIntegrationService;

  constructor() {
    this.onboardingService = new OnboardingIntegrationService();
  }

  private async getOrCreateWorkflow(customerId: number, workflowType: string = 'CUSTOMER_ONBOARDING'): Promise<CaseWorkflow> {
    let workflow = await this.workflowRepository.findOne({
      where: { customerId, workflowType: workflowType as any },
    });

    if (!workflow) {
      const customer = await this.customerRepository.findOne({ where: { id: customerId } });
      if (!customer) throw new Error('Customer not found');

      const status = (customer.status || 'draft').toLowerCase();
      workflow = this.workflowRepository.create({
        workflowType: workflowType as any,
        customerId: customer.id,
        currentStatus: status,
        currentApproverRoleName: this.getApproverForStatus(status),
      });
      workflow = await this.workflowRepository.save(workflow);
    }

    return workflow;
  }

  private getApproverForStatus(status: string): string {
    switch (status) {
      case 'draft': return 'RM';
      case 'submitted': return 'CREDIT_TEAM_L1';
      case 'credit_l1_approved': return 'CREDIT_TEAM_L2';
      case 'credit_l2_approved': return 'CEO';
      case 'ceo_approved': return 'MD';
      case 'md_approved': return 'RM';
      case 'ops_l1_review': return 'OPERATIONS_TEAM_L1';
      case 'ops_l1_approved': return 'OPERATIONS_HEAD';
      case 'completed': return 'None';
      default: return 'RM';
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
    sanctionData?: any;
  }) {
    const history = this.historyRepository.create({
      ...data,
      status: data.status,
      previousStatus: data.previousStatus,
      changedBy: data.changedBy,
      remarks: data.remarks,
      ...(data.sanctionData || {})
    });
    return await this.historyRepository.save(history);
  }


  async runAllBureausForCustomer(customerId: number) {
  // Applicant
  await this.onboardingService.checkBureau(
    customerId,
    KycOwnerType.APPLICANT
  );

  // Co-applicants
  const coApplicants = await this.coApplicantRepository.find({
    where: { customerId },
  });

  for (const coApp of coApplicants) {
    await this.onboardingService.checkBureau(
      customerId,
      KycOwnerType.CO_APPLICANT,
      undefined,
      coApp.id
    );
  }
}


  async createCustomer(data: any, rmId: number) {
    // Clean up empty strings for unique/nullable fields to prevent duplicate entry error
    const cleanedData = { ...data };
    if (cleanedData.gstNumber === '') cleanedData.gstNumber = undefined;
    if (cleanedData.customerCode === '') cleanedData.customerCode = undefined;

    const customer = this.customerRepository.create({
      ...cleanedData,
      rmId,
      status: 'draft',
    });
    const savedCustomer = (await this.customerRepository.save(customer)) as unknown as Customer;

    const workflow = this.workflowRepository.create({
      workflowType: 'CUSTOMER_ONBOARDING',
      customerId: savedCustomer.id,
      currentStatus: 'draft',
      currentApproverRoleName: 'RM',
    });
    const savedWorkflow = await this.workflowRepository.save(workflow);

    // Sync customer status
    await this.customerRepository.update(savedCustomer.id, { status: 'draft' as any });

    await this.logHistory({
      customerId: savedCustomer.id,
      caseWorkflowId: savedWorkflow.id,
      status: 'draft',
      previousStatus: 'None',
      changedBy: rmId,
      remarks: 'Customer created in draft state',
    });

    return { customer: savedCustomer, workflow: savedWorkflow };
  }

  async submitCustomer(customerId: number, userId: number, remarks: string, pushedTo?: string) {
    const customer = await this.customerRepository.findOne({ where: { id: customerId } });
    if (!customer) throw new Error('Customer not found');

    const workflow = await this.getOrCreateWorkflow(customerId);
    if (workflow.currentStatus !== 'draft') throw new Error('Can only submit from draft status');

    /* ----------------------------------------
     🔁 SILENT BUREAU (NON-BLOCKING)
  ---------------------------------------- */
  this.runAllBureausForCustomer(customerId)
    .catch(err => {
      console.error(
        `❌ Bureau failed silently for customer=${customerId}`,
        err,
      );
    });

    const previousStatus = workflow.currentStatus;
    workflow.currentStatus = 'submitted';
    workflow.currentApproverRoleName = 'CREDIT_TEAM_L1';
    workflow.remarks = remarks;
    await this.workflowRepository.save(workflow);

    // Sync customer status and pushedTo
    const updateData: any = { status: 'submitted' };
    if (pushedTo) updateData.pushedTo = pushedTo;

    await this.customerRepository.update(customerId, updateData);

    await this.logHistory({
      customerId,
      caseWorkflowId: workflow.id,
      status: 'submitted',
      previousStatus,
      changedBy: userId,
      remarks: remarks + (pushedTo ? ` (Submitted to: ${pushedTo})` : ''),
    });

    return workflow;
  }

  async creditL1Approve(customerId: number, userId: number, remarks: string, approved: boolean, sanctionData?: any) {
    const customer = await this.customerRepository.findOne({ where: { id: customerId } });
    if (!customer) throw new Error('Customer not found');

    const workflow = await this.getOrCreateWorkflow(customerId);
    if (workflow.currentStatus.toLowerCase() !== 'submitted') throw new Error('Cannot approve: Pending at Credit Team L1');

    const previousStatus = workflow.currentStatus;
    workflow.currentStatus = approved ? 'credit_l1_approved' : 'rejected';
    workflow.currentApproverRoleName = approved ? 'CREDIT_TEAM_L2' : 'RM';
    if (!approved) workflow.isRejected = true;
    workflow.remarks = remarks;
    await this.workflowRepository.save(workflow);

    if (approved && sanctionData) {
      // Save or update sanction limit
      let sanction = await this.sanctionRepository.findOne({ where: { customerId } });
      if (!sanction) {
        const newSanction = this.sanctionRepository.create({
          customerId,
          creditOfficerId: userId,
          ...sanctionData,
          status: 'pending' // Pending full approval
        });
        await this.sanctionRepository.save(newSanction);
      } else {
        await this.sanctionRepository.update(sanction.id, {
          ...sanctionData,
          creditOfficerId: userId
        });
      }

      // Record history
      await this.sanctionHistoryRepository.save(this.sanctionHistoryRepository.create({
        customerId,
        changedByUserId: userId,
        changedByRole: 'CREDIT_L1',
        remarks,
        ...sanctionData
      }));
    }

    // Sync customer status
    await this.customerRepository.update(customerId, { status: workflow.currentStatus as any });

    await this.logHistory({
      customerId,
      caseWorkflowId: workflow.id,
      status: workflow.currentStatus,
      previousStatus,
      changedBy: userId,
      remarks,
      sanctionData
    });

    return workflow;
  }

  async creditL2Approve(customerId: number, userId: number, remarks: string, approved: boolean, sanctionData?: any) {
    const customer = await this.customerRepository.findOne({ where: { id: customerId } });
    if (!customer) throw new Error('Customer not found');

    const workflow = await this.getOrCreateWorkflow(customerId);
    if (workflow.currentStatus.toLowerCase() !== 'credit_l1_approved') throw new Error('Cannot approve: Pending at Credit Team L2');

    const previousStatus = workflow.currentStatus;

    if (approved && sanctionData) {
      // Save or update sanction limit
      let sanction = await this.sanctionRepository.findOne({ where: { customerId } });
      if (!sanction) {
        const newSanction = this.sanctionRepository.create({
          customerId,
          creditOfficerId: userId,
          ...sanctionData,
          status: 'approved'
        });
        await this.sanctionRepository.save(newSanction);
      } else {
        await this.sanctionRepository.update(sanction.id, {
          ...sanctionData,
          creditOfficerId: userId,
          status: 'approved'
        });
      }

      // Record history
      await this.sanctionHistoryRepository.save(this.sanctionHistoryRepository.create({
        customerId,
        changedByUserId: userId,
        changedByRole: 'CREDIT_L2',
        remarks,
        ...sanctionData
      }));

      const lanId = `LAN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`.toUpperCase();
      customer.lanId = lanId;
      await this.customerRepository.save(customer);
    }

    workflow.currentStatus = approved ? 'credit_l2_approved' : 'rejected';
    workflow.currentApproverRoleName = approved ? 'CEO' : 'RM';
    if (!approved) workflow.isRejected = true;
    workflow.remarks = remarks;
    await this.workflowRepository.save(workflow);

    // Sync customer status
    await this.customerRepository.update(customerId, { status: workflow.currentStatus as any });

    await this.logHistory({
      customerId,
      caseWorkflowId: workflow.id,
      status: workflow.currentStatus,
      previousStatus,
      changedBy: userId,
      remarks,
      sanctionData
    });

    return workflow;
  }

  async ceoApprove(customerId: number, userId: number, remarks: string, approved: boolean, sanctionData?: any) {
    const workflow = await this.getOrCreateWorkflow(customerId);
    if (workflow.currentStatus.toLowerCase() !== 'credit_l2_approved') throw new Error('Cannot approve: Pending at CEO');

    const previousStatus = workflow.currentStatus;

    if (approved && sanctionData) {
      await this.sanctionRepository.update({ customerId }, sanctionData);

      // Record history
      await this.sanctionHistoryRepository.save(this.sanctionHistoryRepository.create({
        customerId,
        changedByUserId: userId,
        changedByRole: 'CEO',
        remarks,
        ...sanctionData
      }));
    }

    workflow.currentStatus = approved ? 'ceo_approved' : 'rejected';
    workflow.currentApproverRoleName = approved ? 'MD' : 'RM';
    if (!approved) workflow.isRejected = true;
    workflow.remarks = remarks;
    await this.workflowRepository.save(workflow);

    // Sync customer status
    await this.customerRepository.update(customerId, { status: workflow.currentStatus as any });

    await this.logHistory({
      customerId,
      caseWorkflowId: workflow.id,
      status: workflow.currentStatus,
      previousStatus,
      changedBy: userId,
      remarks,
      sanctionData
    });

    return workflow;
  }

  async rmSubmitToMD(customerId: number, rmId: number, remarks: string, sanctionData?: any) {
    const workflow = await this.getOrCreateWorkflow(customerId);
    if (workflow.currentStatus.toLowerCase() !== 'md_pending_terms') throw new Error('Case must be MD pending terms before submitting back to MD');

    const previousStatus = workflow.currentStatus;

    if (sanctionData) {
      await this.sanctionRepository.update({ customerId }, sanctionData);
      // Record history
      await this.sanctionHistoryRepository.save(this.sanctionHistoryRepository.create({
        customerId,
        changedByUserId: rmId,
        changedByRole: 'RM',
        remarks: remarks || 'Final terms submitted by RM',
        ...sanctionData
      }));
    }

    workflow.currentStatus = 'md_terms_submitted';
    workflow.currentApproverRoleName = 'MD';
    workflow.remarks = remarks;
    await this.workflowRepository.save(workflow);

    // Sync customer status
    await this.customerRepository.update(customerId, { status: workflow.currentStatus as any });

    await this.logHistory({
      customerId,
      caseWorkflowId: workflow.id,
      status: workflow.currentStatus,
      previousStatus,
      changedBy: rmId,
      remarks,
      sanctionData
    });

    return workflow;
  }

  async mdApprove(customerId: number, userId: number, remarks: string, approved: boolean, sanctionData?: any) {
    const workflow = await this.getOrCreateWorkflow(customerId);
    const status = workflow.currentStatus.toLowerCase();
    if (status !== 'ceo_approved' && status !== 'md_terms_submitted') {
      throw new Error('Case not pending at MD for review or final terms');
    }

    const previousStatus = workflow.currentStatus;

    if (approved && sanctionData) {
      await this.sanctionRepository.update({ customerId }, sanctionData);

      // Record history
      await this.sanctionHistoryRepository.save(this.sanctionHistoryRepository.create({
        customerId,
        changedByUserId: userId,
        changedByRole: 'MD',
        remarks,
        ...sanctionData
      }));
    }

    if (status === 'ceo_approved') {
      workflow.currentStatus = approved ? 'md_pending_terms' : 'rejected';
    } else {
      workflow.currentStatus = approved ? 'md_approved' : 'rejected';
    }

    // After MD approval (either 1st or 2nd), it returns to RM bucket (RM role)
    workflow.currentApproverRoleName = 'RM';
    if (!approved) workflow.isRejected = true;
    workflow.remarks = remarks;
    await this.workflowRepository.save(workflow);

    // Sync customer status
    await this.customerRepository.update(customerId, { status: workflow.currentStatus as any });

    await this.logHistory({
      customerId,
      caseWorkflowId: workflow.id,
      status: workflow.currentStatus,
      previousStatus,
      changedBy: userId,
      remarks,
      sanctionData
    });

    return workflow;
  }

  async submitForOperationsApproval(customerId: number, rmId: number, remarks: string) {
    const workflow = await this.getOrCreateWorkflow(customerId);
    if (workflow.currentStatus.toLowerCase() !== 'md_approved') throw new Error('Can only submit to Operations after MD Approval');

    const previousStatus = workflow.currentStatus;
    workflow.currentStatus = 'ops_l1_review';
    workflow.currentApproverRoleName = 'OPERATIONS_TEAM_L1';
    workflow.remarks = remarks;
    await this.workflowRepository.save(workflow);

    // Sync customer status
    await this.customerRepository.update(customerId, { status: 'ops_l1_review' as any });

    await this.logHistory({
      customerId,
      caseWorkflowId: workflow.id,
      status: 'ops_l1_review',
      previousStatus,
      changedBy: rmId,
      remarks,
    });

    return workflow;
  }

  async opsL1Approve(customerId: number, userId: number, remarks: string, approved: boolean) {
    const workflow = await this.getOrCreateWorkflow(customerId);
    if (workflow.currentStatus.toLowerCase() !== 'ops_l1_review') throw new Error('Cannot approve: Pending at Operations L1');

    const previousStatus = workflow.currentStatus;
    workflow.currentStatus = approved ? 'ops_l1_approved' : 'rejected';
    workflow.currentApproverRoleName = approved ? 'OPERATIONS_HEAD' : 'RM';
    if (!approved) workflow.isRejected = true;
    workflow.remarks = remarks;
    await this.workflowRepository.save(workflow);

    // Sync customer status
    await this.customerRepository.update(customerId, { status: workflow.currentStatus as any });

    await this.logHistory({
      customerId,
      caseWorkflowId: workflow.id,
      status: workflow.currentStatus,
      previousStatus,
      changedBy: userId,
      remarks,
    });

    return workflow;
  }

  async opsHeadApprove(customerId: number, userId: number, remarks: string) {
    const workflow = await this.getOrCreateWorkflow(customerId);
    if (workflow.currentStatus.toLowerCase() !== 'ops_l1_approved') throw new Error('Cannot approve: Pending at Operations Head');

    const previousStatus = workflow.currentStatus;
    workflow.currentStatus = 'completed';
    workflow.currentApproverRoleName = 'None';
    workflow.isCompleted = true;
    workflow.completedDate = new Date();
    workflow.remarks = remarks;
    await this.workflowRepository.save(workflow);

    // Update customer status to COMPLETED
    const customer = await this.customerRepository.findOne({ where: { id: customerId } });
    if (customer) {
      customer.status = 'completed';
      await this.customerRepository.save(customer);
    }

    await this.logHistory({
      customerId,
      caseWorkflowId: workflow.id,
      status: 'completed',
      previousStatus,
      changedBy: userId,
      remarks,
    });

    return workflow;
  }

  async getRMDashboard(rmId: number) {
    const customers = await this.customerRepository.find({
      where: { rmId },
      relations: ['workflows']
    });

    return {
      totalCustomers: customers?.length || 0,
      draft: customers?.filter((c) => (c.status as string).toLowerCase() === 'draft').length || 0,
      submitted: customers?.filter((c) => !['draft', 'completed', 'rejected'].includes((c.status as string).toLowerCase())).length || 0,
      approved: customers?.filter((c) => (c.status as string).toLowerCase() === 'completed').length || 0,
      rejected: customers?.filter((c) => c.rejectionReason !== null).length || 0,
      customers,
    };
  }

  async getCreditTeamPending(role: string, userId?: number) {
    const r = role.toUpperCase();
    const statusFilter = r === 'CREDIT_TEAM_L2' ? 'credit_l1_approved' : 'submitted';

    // Pending cases
    const pendingWorkflows = await this.workflowRepository.find({
      where: {
        workflowType: 'CUSTOMER_ONBOARDING',
        currentStatus: statusFilter as any,
        currentApproverRoleName: r
      },
      relations: ['customer'],
    });

    // Handled cases (read-only)
    let handledWorkflows: any[] = [];
    if (userId) {
      const history = await this.historyRepository.find({
        where: { changedBy: userId },
        relations: ['customer', 'caseWorkflow'],
      });
      const handledIds = Array.from(new Set(history.map(h => h.caseWorkflowId).filter(Boolean)));

      handledWorkflows = await this.workflowRepository.find({
        where: { id: handledIds.length > 0 ? In(handledIds) : -1 },
        relations: ['customer'],
      });

      // Filter out those already in pending
      const pendingIds = pendingWorkflows.map(w => w.id);
      handledWorkflows = handledWorkflows.filter(w => !pendingIds.includes(w.id));
    }

    return { pending: pendingWorkflows, handled: handledWorkflows };
  }

  async getExecutivePending(role: string, userId?: number) {
    const r = role.toUpperCase();
    let statusFilter: any = r === 'MD' ? In(['ceo_approved', 'md_terms_submitted']) : 'credit_l2_approved';

    // Pending cases
    const pendingWorkflows = await this.workflowRepository.find({
      where: {
        workflowType: 'CUSTOMER_ONBOARDING',
        currentStatus: statusFilter,
        currentApproverRoleName: r
      },
      relations: ['customer'],
    });

    // Handled cases
    let handledWorkflows: any[] = [];
    if (userId) {
      const history = await this.historyRepository.find({
        where: { changedBy: userId },
        relations: ['customer', 'caseWorkflow'],
      });
      const handledIds = Array.from(new Set(history.map(h => h.caseWorkflowId).filter(Boolean)));

      handledWorkflows = await this.workflowRepository.find({
        where: { id: handledIds.length > 0 ? In(handledIds) : -1 },
        relations: ['customer'],
      });

      const pendingIds = pendingWorkflows.map(w => w.id);
      handledWorkflows = handledWorkflows.filter(w => !pendingIds.includes(w.id));
    }

    return { pending: pendingWorkflows, handled: handledWorkflows };
  }

  async getOperationsPending(role: string, userId?: number) {
    const r = role.toUpperCase();
    const statusFilter = r === 'OPERATIONS_HEAD' ? 'ops_l1_approved' : 'ops_l1_review';

    // Pending cases
    const pendingWorkflows = await this.workflowRepository.find({
      where: {
        workflowType: 'CUSTOMER_ONBOARDING',
        currentStatus: statusFilter as any,
        currentApproverRoleName: r
      },
      relations: ['customer'],
    });

    // Handled cases
    let handledWorkflows: any[] = [];
    if (userId) {
      const history = await this.historyRepository.find({
        where: { changedBy: userId },
        relations: ['customer', 'caseWorkflow'],
      });
      const handledIds = Array.from(new Set(history.map(h => h.caseWorkflowId).filter(Boolean)));

      handledWorkflows = await this.workflowRepository.find({
        where: { id: handledIds.length > 0 ? In(handledIds) : -1 },
        relations: ['customer'],
      });

      const pendingIds = pendingWorkflows.map(w => w.id);
      handledWorkflows = handledWorkflows.filter(w => !pendingIds.includes(w.id));
    }

    return { pending: pendingWorkflows, handled: handledWorkflows };
  }

  async updateBankDetails(customerId: number, data: any) {
    const customer = await this.customerRepository.findOne({ where: { id: customerId } });
    if (!customer) throw new Error('Customer not found');

    const { bankAccountNo, bankIfscCode, bankName, bankBranch, eNachStatus, eSignStatus, sanctionData } = data;

    if (bankAccountNo) customer.bankAccountNo = bankAccountNo;
    if (bankIfscCode) customer.bankIfscCode = bankIfscCode;
    if (bankName) customer.bankName = bankName;
    if (bankBranch) customer.bankBranch = bankBranch;
    if (data.bankType) customer.bankType = data.bankType;
    if (eNachStatus) customer.eNachStatus = eNachStatus;
    if (eSignStatus) customer.eSignStatus = eSignStatus;

    if (sanctionData) {
      await this.sanctionRepository.update({ customerId }, sanctionData);
    }

    return await this.customerRepository.save(customer);
  }
}
