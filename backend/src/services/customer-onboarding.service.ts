import { AppDataSource } from '../config/database';
import { Customer } from '../entities/Customer';
import { CaseWorkflow } from '../entities/CaseWorkflow';
import { CaseStatusHistory } from '../entities/CaseStatusHistory';
import { CreditSanction } from '../entities/CreditSanction';
import { SanctionLimitHistory } from '../entities/SanctionLimitHistory';

export class CustomerOnboardingService {
  private customerRepository = AppDataSource.getRepository(Customer);
  private workflowRepository = AppDataSource.getRepository(CaseWorkflow);
  private historyRepository = AppDataSource.getRepository(CaseStatusHistory);
  private sanctionRepository = AppDataSource.getRepository(CreditSanction);
  private sanctionHistoryRepository = AppDataSource.getRepository(SanctionLimitHistory);

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
      case 'ops_l1_review': return 'OPERATIONS_L1';
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

  async submitCustomer(customerId: number, userId: number, remarks: string) {
    const customer = await this.customerRepository.findOne({ where: { id: customerId } });
    if (!customer) throw new Error('Customer not found');

    const workflow = await this.getOrCreateWorkflow(customerId);
    if (workflow.currentStatus !== 'draft') throw new Error('Can only submit from draft status');

    const previousStatus = workflow.currentStatus;
    workflow.currentStatus = 'submitted';
    workflow.currentApproverRoleName = 'CREDIT_TEAM_L1';
    workflow.remarks = remarks;
    await this.workflowRepository.save(workflow);

    // Sync customer status
    await this.customerRepository.update(customerId, { status: 'submitted' as any });

    await this.logHistory({
      customerId,
      caseWorkflowId: workflow.id,
      status: 'submitted',
      previousStatus,
      changedBy: userId,
      remarks,
    });

    return workflow;
  }

  async creditL1Approve(customerId: number, userId: number, remarks: string, approved: boolean) {
    const workflow = await this.getOrCreateWorkflow(customerId);
    if (workflow.currentStatus.toLowerCase() !== 'submitted') throw new Error('Cannot approve: Pending at Credit Team L1');

    const previousStatus = workflow.currentStatus;
    workflow.currentStatus = approved ? 'credit_l1_approved' : 'rejected';
    workflow.currentApproverRoleName = approved ? 'CREDIT_TEAM_L2' : 'RM';
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
    });

    return workflow;
  }

  async mdApprove(customerId: number, userId: number, remarks: string, approved: boolean, sanctionData?: any) {
    const workflow = await this.getOrCreateWorkflow(customerId);
    if (workflow.currentStatus.toLowerCase() !== 'ceo_approved') throw new Error('Cannot approve: Pending at Managing Director');

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

    workflow.currentStatus = approved ? 'md_approved' : 'rejected';
    // After MD approval, it returns to RM bucket (RM role)
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
    });

    return workflow;
  }

  async submitForOperationsApproval(customerId: number, rmId: number, remarks: string) {
    const workflow = await this.getOrCreateWorkflow(customerId);
    if (workflow.currentStatus.toLowerCase() !== 'md_approved') throw new Error('Can only submit to Operations after MD Approval');

    const previousStatus = workflow.currentStatus;
    workflow.currentStatus = 'ops_l1_review';
    workflow.currentApproverRoleName = 'OPERATIONS_L1';
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
    const customers = await this.customerRepository.find({ where: { rmId } });
    return {
      totalCustomers: customers?.length || 0,
      draft: customers?.filter((c) => (c.status as string).toLowerCase() === 'draft').length || 0,
      submitted: customers?.filter((c) => (c.status as string).toLowerCase() === 'submitted').length || 0,
      approved: customers?.filter((c) => (c.status as string).toLowerCase() === 'completed').length || 0,
      rejected: customers?.filter((c) => c.rejectionReason !== null).length || 0,
      customers,
    };
  }

  async getCreditTeamPending(role: string) {
    const r = role.toUpperCase();
    const statusFilter = r === 'CREDIT_TEAM_L2' ? 'credit_l1_approved' : 'submitted';
    const workflows = await this.workflowRepository.find({
      where: { workflowType: 'CUSTOMER_ONBOARDING', currentStatus: statusFilter as any },
      relations: ['customer'],
    });
    return workflows;
  }

  async getExecutivePending(role: string) {
    const r = role.toUpperCase();
    const statusFilter = r === 'MD' ? 'ceo_approved' : 'credit_l2_approved';
    const workflows = await this.workflowRepository.find({
      where: { workflowType: 'CUSTOMER_ONBOARDING', currentStatus: statusFilter as any },
      relations: ['customer'],
    });
    return workflows;
  }

  async getOperationsPending(role: string) {
    const r = role.toUpperCase();
    const statusFilter = r === 'OPERATIONS_HEAD' ? 'ops_l1_approved' : 'ops_l1_review';
    const workflows = await this.workflowRepository.find({
      where: { workflowType: 'CUSTOMER_ONBOARDING', currentStatus: statusFilter as any },
      relations: ['customer'],
    });
    return workflows;
  }

  async updateBankDetails(customerId: number, data: any) {
    const customer = await this.customerRepository.findOne({ where: { id: customerId } });
    if (!customer) throw new Error('Customer not found');

    const { bankAccountNo, bankIfscCode, bankName, bankBranch, eNachStatus, eSignStatus } = data;

    if (bankAccountNo) customer.bankAccountNo = bankAccountNo;
    if (bankIfscCode) customer.bankIfscCode = bankIfscCode;
    if (bankName) customer.bankName = bankName;
    if (bankBranch) customer.bankBranch = bankBranch;
    if (eNachStatus) customer.eNachStatus = eNachStatus;
    if (eSignStatus) customer.eSignStatus = eSignStatus;

    return await this.customerRepository.save(customer);
  }
}
