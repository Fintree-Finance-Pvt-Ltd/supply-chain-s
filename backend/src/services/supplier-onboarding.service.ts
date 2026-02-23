import { AppDataSource } from '../config/database';
import { Supplier } from '../entities/Supplier';
import { Customer } from '../entities/Customer';
import { Invoice } from '../entities/Invoice';
import { CaseWorkflow } from '../entities/CaseWorkflow';
import { CaseStatusHistory } from '../entities/CaseStatusHistory';

export class SupplierOnboardingService {
  private supplierRepository = AppDataSource.getRepository(Supplier);
  private customerRepository = AppDataSource.getRepository(Customer);
  private workflowRepository = AppDataSource.getRepository(CaseWorkflow);
  private historyRepository = AppDataSource.getRepository(CaseStatusHistory);

  private async getOrCreateWorkflow(supplierId: number, workflowType: string = 'SUPPLIER_ONBOARDING'): Promise<CaseWorkflow> {
    let workflow = await this.workflowRepository.findOne({
      where: { supplierId, workflowType: workflowType as any },
    });

    if (!workflow) {
      const supplier = await this.supplierRepository.findOne({ where: { id: supplierId } });
      if (!supplier) throw new Error('Supplier not found');

      const status = (supplier.status || 'draft').toLowerCase();
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
    switch (status) {
      case 'draft': return 'RM';
      case 'submitted': return 'OPERATIONS_L1';
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

  MAX_SUPPLIERS_PER_LAN = 20;
  MIN_SUPPLIERS_PER_LAN = 10;

  async createSupplier(data: any, rmId: number) {
    const customer = await this.customerRepository.findOne({
      where: { id: data.customerId },
    });
    if (!customer || !customer.lanId) throw new Error('Customer must be approved with LAN ID');

    const count = await this.getSupplierCountForLan(data.customerId);
    if ((count || 0) >= this.MAX_SUPPLIERS_PER_LAN) {
      throw new Error(`Maximum ${this.MAX_SUPPLIERS_PER_LAN} suppliers already added to this LAN`);
    }

    // Clean up empty strings for unique fields
    const cleanedData = { ...data };
    if (cleanedData.supplierCode === '') cleanedData.supplierCode = undefined;

    const supplier = this.supplierRepository.create({
      ...cleanedData,
      createdByUserId: rmId,
      status: 'draft',
    });
    const savedSupplier = (await this.supplierRepository.save(supplier)) as unknown as Supplier;

    const workflow = this.workflowRepository.create({
      workflowType: 'SUPPLIER_ONBOARDING',
      supplierId: savedSupplier.id,
      customerId: data.customerId,
      currentStatus: 'draft',
      currentApproverRoleName: 'RM',
    });
    const savedWorkflow = await this.workflowRepository.save(workflow);

    await this.logHistory({
      customerId: data.customerId,
      supplierId: savedSupplier.id,
      caseWorkflowId: savedWorkflow.id,
      status: 'draft',
      previousStatus: 'None',
      changedBy: rmId,
      remarks: 'Supplier created in Draft state',
    });

    return { supplier: savedSupplier, workflow: savedWorkflow };
  }

  async submitSupplier(supplierId: number, userId: number, remarks: string) {
    const supplier = await this.supplierRepository.findOne({ where: { id: supplierId } });
    if (!supplier) throw new Error('Supplier not found');

    const workflow = await this.getOrCreateWorkflow(supplierId);
    if (workflow.currentStatus !== 'draft') throw new Error('Can only submit from Draft status');

    const previousStatus = workflow.currentStatus;
    supplier.status = 'submitted';
    await this.supplierRepository.save(supplier);

    workflow.currentStatus = 'submitted';
    workflow.currentApproverRoleName = 'OPERATIONS_L1';
    workflow.remarks = remarks;
    await this.workflowRepository.save(workflow);

    await this.logHistory({
      customerId: supplier.customerId,
      supplierId: supplier.id,
      caseWorkflowId: workflow.id,
      status: 'submitted',
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
    if (workflow.currentStatus !== 'submitted') throw new Error('Cannot approve: Pending at Operations L1');

    const previousStatus = workflow.currentStatus;
    supplier.status = approved ? 'ops_l1_approved' : 'rejected';
    await this.supplierRepository.save(supplier);

    workflow.currentStatus = approved ? 'ops_l1_approved' : 'rejected';
    workflow.currentApproverRoleName = approved ? 'OPERATIONS_HEAD' : 'RM';
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

  async opsHeadApprove(supplierId: number, userId: number, remarks: string) {
    const supplier = await this.supplierRepository.findOne({ where: { id: supplierId } });
    if (!supplier) throw new Error('Supplier not found');

    const workflow = await this.getOrCreateWorkflow(supplierId);
    if (workflow.currentStatus !== 'ops_l1_approved') throw new Error('Cannot approve: Pending at Operations Head');

    const previousStatus = workflow.currentStatus;
    supplier.status = 'completed';
    await this.supplierRepository.save(supplier);

    workflow.currentStatus = 'completed';
    workflow.currentApproverRoleName = 'None';
    workflow.isCompleted = true;
    workflow.completedDate = new Date();
    workflow.remarks = remarks;
    await this.workflowRepository.save(workflow);

    await this.logHistory({
      customerId: supplier.customerId,
      supplierId: supplier.id,
      caseWorkflowId: workflow.id,
      status: 'completed',
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
      draft: suppliers?.filter((s) => s.status === 'draft').length || 0,
      submitted: suppliers?.filter((s) => s.status === 'submitted').length || 0,
      completed: suppliers?.filter((s) => s.status === 'completed').length || 0,
      rejected: suppliers?.filter((s) => s.status === 'rejected').length || 0,
      lanWiseSuppliers,
      suppliers,
    };
  }

  async getOperationsPending(role: string) {
    const statusFilter = role === 'OPERATIONS_HEAD' ? 'ops_l1_approved' : 'submitted';
    const suppliers = await this.supplierRepository.find({
      where: { status: statusFilter as any },
      relations: ['customer'],
    });
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
      where: { customerId, status: 'completed' },
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
}
