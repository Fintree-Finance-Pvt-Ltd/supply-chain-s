import { AppDataSource } from '../config/database';
import { OperationsCheck, Customer } from '../entities';
import { Repository } from 'typeorm';
import { ApprovalService } from './approval.service';
import { CASE_STATUS } from '../config/constants';

export class OperationsService {
  private operationsCheckRepository: Repository<OperationsCheck>;
  private customerRepository: Repository<Customer>;
  private approvalService: ApprovalService;

  constructor() {
    this.operationsCheckRepository = AppDataSource.getRepository(OperationsCheck);
    this.customerRepository = AppDataSource.getRepository(Customer);
    this.approvalService = new ApprovalService();
  }

  /**
   * Submit post-sanction completion and trigger operations approval
   */
  async submitPostSanction(
    customerId: string,
    userId: number,
    data?: {
      documentsVerified?: boolean;
      esignVerified?: boolean;
      enachVerified?: boolean;
      remarks?: string;
    }
  ): Promise<OperationsCheck> {
    // Verify customer exists and is in POST_SANCTION_PENDING status
    const customer = await this.customerRepository.findOne({
      where: { id: customerId },
    });

    if (!customer) {
      throw new Error('Customer not found');
    }

    if (customer.status !== CASE_STATUS.POST_SANCTION_PENDING) {
      throw new Error('Customer is not in post-sanction pending status');
    }

    // Create operations check
    const operationsCheck = this.operationsCheckRepository.create({
      customerId,
      opsUserId: userId.toString(),
      documentsVerified: data?.documentsVerified ?? false,
      esignVerified: data?.esignVerified ?? false,
      enachVerified: data?.enachVerified ?? false,
      opsRemarks: data?.remarks ?? undefined,
      status: 'pending',
    });

    const savedOpsCheck = await this.operationsCheckRepository.save(operationsCheck);

    // Update customer status to POST_SANCTION_COMPLETED
    customer.status = CASE_STATUS.POST_SANCTION_COMPLETED;
    await this.customerRepository.save(customer);

    // Create operations approval instance
    await this.approvalService.createOperationsApproval(savedOpsCheck.id);

    return savedOpsCheck;
  }

  /**
   * Get pending operations checks
   */
  async getPendingChecks(): Promise<OperationsCheck[]> {
    return await this.operationsCheckRepository.find({
      where: { status: 'pending' },
      relations: ['customer', 'customer.rm', 'opsUser'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get operations check by ID
   */
  async getCheckById(id: string): Promise<OperationsCheck | null> {
    return await this.operationsCheckRepository.findOne({
      where: { id },
      relations: [
        'customer',
        'customer.rm',
        'customer.documents',
        'opsUser',
        'approvalInstances',
        'approvalInstances.approvalFlow',
        'approvalInstances.actions',
        'approvalInstances.actions.approver',
      ],
    });
  }

  /**
   * Update operations check
   */
  async updateCheck(
    id: string,
    data: Partial<OperationsCheck>
  ): Promise<OperationsCheck> {
    const opsCheck = await this.operationsCheckRepository.findOne({ where: { id } });

    if (!opsCheck) {
      throw new Error('Operations check not found');
    }

    Object.assign(opsCheck, data);

    return await this.operationsCheckRepository.save(opsCheck);
  }
}
