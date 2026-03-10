import { AppDataSource } from '../config/database';
import { CaseStatusHistory } from '../entities/CaseStatusHistory';
import { ApprovalAction } from '../entities/ApprovalAction';
import { SanctionLimitHistory } from '../entities/SanctionLimitHistory';

/**
 * Audit Service
 * Provides append-only operations for audit tables
 * 
 * Tables protected:
 * - case_status_history
 * - approval_actions
 * - sanction_limit_history
 * 
 * This service prevents UPDATE and DELETE operations on these tables
 */
export class AuditService {
  private historyRepository = AppDataSource.getRepository(CaseStatusHistory);
  private approvalActionRepository = AppDataSource.getRepository(ApprovalAction);
  private sanctionHistoryRepository = AppDataSource.getRepository(SanctionLimitHistory);

  /**
   * Append-only: Create case status history entry
   * This is the ONLY allowed operation on case_status_history
   */
  async createStatusHistory(data: {
    customerId: number;
    supplierId?: number;
    invoiceId?: number;
    caseWorkflowId?: number;
    status: string;
    previousStatus: string;
    changedBy: number;
    remarks?: string;
    sanctionAmount?: number;
    tenure?: number;
    interestRate?: number;
    penalCharges?: number;
    processingFees?: number;
    conditions?: string;
  }): Promise<CaseStatusHistory> {
    const history = this.historyRepository.create(data);
    return await this.historyRepository.save(history);
  }

  /**
   * Append-only: Create approval action entry
   * This is the ONLY allowed operation on approval_actions
   */
  async createApprovalAction(data: {
    approvalInstanceId: number;
    approverId: number;
    action: string;
    stepOrder: number;
    comments?: string;
  }): Promise<ApprovalAction> {
    const action = this.approvalActionRepository.create(data);
    return await this.approvalActionRepository.save(action);
  }

  /**
   * Append-only: Create sanction limit history entry
   * This is the ONLY allowed operation on sanction_limit_history
   */
  async createSanctionHistory(data: {
    customerId: number;
    sanctionAmount: number;
    tenure: number;
    interestRate: number;
    penalCharges?: number;
    processingFees?: number;
    conditions?: string;
    remarks?: string;
    changedByRole: string;
    changedByUserId: number;
  }): Promise<SanctionLimitHistory> {
    const history = this.sanctionHistoryRepository.create(data);
    return await this.sanctionHistoryRepository.save(history);
  }

  /**
   * Read-only: Get status history for a customer
   */
  async getStatusHistory(customerId: number): Promise<CaseStatusHistory[]> {
    return await this.historyRepository.find({
      where: { customerId },
      order: { createdAt: 'ASC' },
      relations: ['changedByUser'],
    });
  }

  /**
   * Read-only: Get approval actions for an instance
   */
  async getApprovalHistory(approvalInstanceId: number): Promise<ApprovalAction[]> {
    return await this.approvalActionRepository.find({
      where: { approvalInstanceId },
      order: { createdAt: 'ASC' },
      relations: ['approver'],
    });
  }

  /**
   * Read-only: Get sanction history for a customer
   */
  async getSanctionHistory(customerId: number): Promise<SanctionLimitHistory[]> {
    return await this.sanctionHistoryRepository.find({
      where: { customerId },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * SECURITY: Prevent updates to audit tables
   * These methods throw errors to prevent modification
   */
  async updateStatusHistory(id: number, data: any): Promise<void> {
    throw new Error('SECURITY VIOLATION: Updating case_status_history is not allowed. This table is append-only.');
  }

  async deleteStatusHistory(id: number): Promise<void> {
    throw new Error('SECURITY VIOLATION: Deleting from case_status_history is not allowed. This table is append-only.');
  }

  async updateApprovalAction(id: number, data: any): Promise<void> {
    throw new Error('SECURITY VIOLATION: Updating approval_actions is not allowed. This table is append-only.');
  }

  async deleteApprovalAction(id: number): Promise<void> {
    throw new Error('SECURITY VIOLATION: Deleting from approval_actions is not allowed. This table is append-only.');
  }

  async updateSanctionHistory(id: number, data: any): Promise<void> {
    throw new Error('SECURITY VIOLATION: Updating sanction_limit_history is not allowed. This table is append-only.');
  }

  async deleteSanctionHistory(id: number): Promise<void> {
    throw new Error('SECURITY VIOLATION: Deleting from sanction_limit_history is not allowed. This table is append-only.');
  }
}
