import { AppDataSource } from '../config/database';
import { Invoice } from '../entities/Invoice';
import { Customer } from '../entities/Customer';
import { Supplier } from '../entities/Supplier';
import { CaseWorkflow } from '../entities/CaseWorkflow';
import { CaseStatusHistory } from '../entities/CaseStatusHistory';

export class InvoiceDiscountingService {
  private invoiceRepository = AppDataSource.getRepository(Invoice);
  private customerRepository = AppDataSource.getRepository(Customer);
  private supplierRepository = AppDataSource.getRepository(Supplier);
  private workflowRepository = AppDataSource.getRepository(CaseWorkflow);
  private historyRepository = AppDataSource.getRepository(CaseStatusHistory);

  private async getOrCreateWorkflow(invoiceId: number, workflowType: string = 'INVOICE_DISCOUNTING'): Promise<CaseWorkflow> {
    let workflow = await this.workflowRepository.findOne({
      where: { invoiceId, workflowType: workflowType as any },
    });

    if (!workflow) {
      const invoice = await this.invoiceRepository.findOne({ where: { id: invoiceId } });
      if (!invoice) throw new Error('Invoice not found');

      const status = (invoice.status || 'draft').toLowerCase();
      workflow = this.workflowRepository.create({
        workflowType: workflowType as any,
        invoiceId: invoice.id,
        customerId: invoice.customerId,
        supplierId: invoice.supplierId,
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
      case 'ops_l1_verified': return 'OPERATIONS_L2';
      case 'ops_l2_verified': return 'OPERATIONS_HEAD';
      case 'ops_head_approved': return 'CEO';
      case 'ceo_approved': return 'MD';
      case 'disbursed': return 'None';
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

  async createInvoice(data: any, rmId: number, filePath?: string) {
    const customer = await this.customerRepository.findOne({
      where: { id: data.customerId },
    });
    if (!customer || customer.status !== 'completed') {
      throw new Error('Customer must be fully approved (COMPLETED status)');
    }

    const supplier = await this.supplierRepository.findOne({
      where: { id: data.supplierId },
    });
    if (!supplier || supplier.status !== 'completed') {
      throw new Error('Supplier must be fully approved (COMPLETED status)');
    }

    const invoice = this.invoiceRepository.create({
      ...data,
      createdByUserId: rmId,
      invoiceFilePath: filePath,
      status: 'draft',
    });
    const savedInvoice = (await this.invoiceRepository.save(invoice)) as unknown as Invoice;

    const workflow = this.workflowRepository.create({
      workflowType: 'INVOICE_DISCOUNTING',
      invoiceId: savedInvoice.id,
      customerId: data.customerId,
      supplierId: data.supplierId,
      currentStatus: 'draft',
      currentApproverRoleName: 'RM',
    });
    const savedWorkflow = await this.workflowRepository.save(workflow);

    await this.logHistory({
      customerId: data.customerId,
      supplierId: data.supplierId,
      invoiceId: savedInvoice.id,
      caseWorkflowId: savedWorkflow.id,
      status: 'draft',
      previousStatus: 'None',
      changedBy: rmId,
      remarks: 'Invoice created in Draft state',
    });

    return { invoice: savedInvoice, workflow: savedWorkflow };
  }

  async submitInvoice(invoiceId: number, userId: number, remarks: string) {
    const invoice = await this.invoiceRepository.findOne({ where: { id: invoiceId } });
    if (!invoice) throw new Error('Invoice not found');

    const workflow = await this.getOrCreateWorkflow(invoiceId);
    if (workflow.currentStatus !== 'draft') throw new Error('Can only submit from Draft status');

    const previousStatus = workflow.currentStatus;
    invoice.status = 'submitted';
    await this.invoiceRepository.save(invoice);

    workflow.currentStatus = 'submitted';
    workflow.currentApproverRoleName = 'OPERATIONS_L1';
    workflow.remarks = remarks;
    await this.workflowRepository.save(workflow);

    await this.logHistory({
      customerId: invoice.customerId,
      supplierId: invoice.supplierId,
      invoiceId: invoice.id,
      caseWorkflowId: workflow.id,
      status: 'submitted',
      previousStatus,
      changedBy: userId,
      remarks,
    });

    return workflow;
  }

  async opsL1Verify(invoiceId: number, userId: number, remarks: string, approved: boolean) {
    const invoice = await this.invoiceRepository.findOne({ where: { id: invoiceId } });
    if (!invoice) throw new Error('Invoice not found');

    const workflow = await this.getOrCreateWorkflow(invoiceId);
    if (workflow.currentStatus !== 'submitted') throw new Error('Cannot verify: Pending at Operations L1');

    const previousStatus = workflow.currentStatus;
    invoice.status = approved ? 'ops_l1_verified' : 'rejected';
    await this.invoiceRepository.save(invoice);

    workflow.currentStatus = approved ? 'ops_l1_verified' : 'rejected';
    workflow.currentApproverRoleName = approved ? 'OPERATIONS_L2' : 'RM';
    if (!approved) workflow.isRejected = true;
    workflow.remarks = remarks;
    await this.workflowRepository.save(workflow);

    await this.logHistory({
      customerId: invoice.customerId,
      supplierId: invoice.supplierId,
      invoiceId: invoice.id,
      caseWorkflowId: workflow.id,
      status: workflow.currentStatus,
      previousStatus,
      changedBy: userId,
      remarks,
    });

    return workflow;
  }

  async opsL2Validate(invoiceId: number, userId: number, remarks: string, approved: boolean) {
    const invoice = await this.invoiceRepository.findOne({ where: { id: invoiceId } });
    if (!invoice) throw new Error('Invoice not found');

    const workflow = await this.getOrCreateWorkflow(invoiceId);
    if (workflow.currentStatus !== 'ops_l1_verified') throw new Error('Cannot validate: Pending at Operations L2');

    const previousStatus = workflow.currentStatus;
    invoice.status = approved ? 'ops_l2_verified' : 'rejected';
    await this.invoiceRepository.save(invoice);

    workflow.currentStatus = approved ? 'ops_l2_verified' : 'rejected';
    workflow.currentApproverRoleName = approved ? 'OPERATIONS_HEAD' : 'RM';
    if (!approved) workflow.isRejected = true;
    workflow.remarks = remarks;
    await this.workflowRepository.save(workflow);

    await this.logHistory({
      customerId: invoice.customerId,
      supplierId: invoice.supplierId,
      invoiceId: invoice.id,
      caseWorkflowId: workflow.id,
      status: workflow.currentStatus,
      previousStatus,
      changedBy: userId,
      remarks,
    });

    return workflow;
  }

  async opsHeadApprove(invoiceId: number, userId: number, remarks: string) {
    const invoice = await this.invoiceRepository.findOne({ where: { id: invoiceId } });
    if (!invoice) throw new Error('Invoice not found');

    const workflow = await this.getOrCreateWorkflow(invoiceId);
    if (workflow.currentStatus !== 'ops_l2_verified') throw new Error('Cannot approve: Pending at Operations Head');

    const previousStatus = workflow.currentStatus;
    invoice.status = 'ops_head_approved';
    await this.invoiceRepository.save(invoice);

    workflow.currentStatus = 'ops_head_approved';
    workflow.currentApproverRoleName = 'CEO';
    workflow.remarks = remarks;
    await this.workflowRepository.save(workflow);

    await this.logHistory({
      customerId: invoice.customerId,
      supplierId: invoice.supplierId,
      invoiceId: invoice.id,
      caseWorkflowId: workflow.id,
      status: 'ops_head_approved',
      previousStatus,
      changedBy: userId,
      remarks,
    });

    return workflow;
  }

  async ceoReview(invoiceId: number, userId: number, remarks: string, approved: boolean) {
    const invoice = await this.invoiceRepository.findOne({ where: { id: invoiceId } });
    if (!invoice) throw new Error('Invoice not found');

    const workflow = await this.getOrCreateWorkflow(invoiceId);
    if (workflow.currentStatus !== 'ops_head_approved') throw new Error('Cannot review: Pending at CEO');

    const previousStatus = workflow.currentStatus;
    invoice.status = approved ? 'ceo_approved' : 'rejected';
    await this.invoiceRepository.save(invoice);

    workflow.currentStatus = approved ? 'ceo_approved' : 'rejected';
    workflow.currentApproverRoleName = approved ? 'MD' : 'RM';
    if (!approved) workflow.isRejected = true;
    workflow.remarks = remarks;
    await this.workflowRepository.save(workflow);

    await this.logHistory({
      customerId: invoice.customerId,
      supplierId: invoice.supplierId,
      invoiceId: invoice.id,
      caseWorkflowId: workflow.id,
      status: workflow.currentStatus,
      previousStatus,
      changedBy: userId,
      remarks,
    });

    return workflow;
  }

  async mdFinalApprove(
    invoiceId: number,
    userId: number,
    remarks: string,
    approved: boolean,
    disbursedAmount: number,
  ) {
    const invoice = await this.invoiceRepository.findOne({ where: { id: invoiceId } });
    if (!invoice) throw new Error('Invoice not found');

    const workflow = await this.getOrCreateWorkflow(invoiceId);
    if (workflow.currentStatus !== 'ceo_approved') throw new Error('Cannot approve: Pending at Managing Director');

    const previousStatus = workflow.currentStatus;
    if (approved) {
      invoice.status = 'disbursed';
      invoice.disbursedAmount = disbursedAmount;
      invoice.disbursedDate = new Date();
    } else {
      invoice.status = 'rejected';
    }
    await this.invoiceRepository.save(invoice);

    workflow.currentStatus = approved ? 'disbursed' : 'rejected';
    workflow.currentApproverRoleName = 'None';
    workflow.isCompleted = approved;
    workflow.completedDate = approved ? new Date() : workflow.completedDate;
    if (!approved) workflow.isRejected = true;
    workflow.remarks = remarks;
    await this.workflowRepository.save(workflow);

    await this.logHistory({
      customerId: invoice.customerId,
      supplierId: invoice.supplierId,
      invoiceId: invoice.id,
      caseWorkflowId: workflow.id,
      status: workflow.currentStatus,
      previousStatus,
      changedBy: userId,
      remarks,
    });

    return workflow;
  }

  async getRMInvoiceDashboard(rmId: number) {
    const invoices = await this.invoiceRepository.find({
      where: { createdByUserId: rmId },
    });

    const totalDisbursed = (invoices || [])
      .filter((i) => i.status === 'disbursed')
      .reduce((sum, i) => sum + (i.disbursedAmount || 0), 0);

    return {
      totalInvoices: invoices?.length || 0,
      draft: invoices?.filter((i) => i.status === 'draft').length || 0,
      submitted: invoices?.filter((i) => i.status === 'submitted').length || 0,
      disbursed: invoices?.filter((i) => i.status === 'disbursed').length || 0,
      rejected: invoices?.filter((i) => i.status === 'rejected').length || 0,
      totalAmount: invoices?.reduce((sum, i) => sum + i.invoiceAmount, 0) || 0,
      totalDisbursed,
      invoices,
    };
  }

  async getPendingInvoices(role: string) {
    let statusFilter = 'submitted';
    if (role === 'OPERATIONS_L1') statusFilter = 'submitted';
    else if (role === 'OPERATIONS_L2') statusFilter = 'ops_l1_verified';
    else if (role === 'OPERATIONS_HEAD') statusFilter = 'ops_l2_verified';
    else if (role === 'CEO') statusFilter = 'ops_head_approved';
    else if (role === 'MD') statusFilter = 'ceo_approved';

    return this.invoiceRepository.find({
      where: { status: statusFilter as any },
      relations: ['customer', 'supplier'],
    });
  }

  async getInvoiceDetails(invoiceId: number) {
    return this.invoiceRepository.findOne({
      where: { id: invoiceId },
      relations: ['customer', 'supplier', 'createdBy', 'statusHistory'],
    });
  }
}
