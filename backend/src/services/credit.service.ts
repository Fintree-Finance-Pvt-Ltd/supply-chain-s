import { AppDataSource } from '../config/database';
import { CreditSanction, Customer, SanctionLimitHistory } from '../entities';
import { ApprovalService } from './approval.service';
import { CustomerService } from './customer.service';
import { CASE_STATUS, APPROVAL_FLOW_TYPES } from '../config/constants';
import { Repository } from 'typeorm';

export class CreditService {
  private creditSanctionRepository: Repository<CreditSanction>;
  private sanctionHistoryRepository: Repository<SanctionLimitHistory>;
  private approvalService: ApprovalService;
  private customerService: CustomerService;

  constructor() {
    this.creditSanctionRepository = AppDataSource.getRepository(CreditSanction);
    this.sanctionHistoryRepository = AppDataSource.getRepository(SanctionLimitHistory);
    this.approvalService = new ApprovalService();
    this.customerService = new CustomerService();
  }

  async createSanction(data: {
    customerId: number;
    sanctionAmount: number;
    tenure: number;
    interestRate: number;
    conditions?: string;
    creditRemarks?: string;
    creditOfficerId: number;
  }): Promise<CreditSanction> {
    // Check if customer exists
    const customer = await AppDataSource.getRepository(Customer).findOne({
      where: { id: data.customerId },
    });

    if (!customer) {
      throw new Error('Customer not found');
    }

    // Create credit sanction
    const sanction = this.creditSanctionRepository.create({
      ...data,
      status: 'pending',
    });

    const savedSanction = await this.creditSanctionRepository.save(sanction);

    // Update customer status
    await this.customerService.updateStatus(
      data.customerId,
      CASE_STATUS.CREDIT_APPROVED,
      data.creditOfficerId,
      'Credit sanction created'
    );

    // Create approval instance
    await this.approvalService.createCreditSanctionApproval(
      savedSanction.id,
      APPROVAL_FLOW_TYPES.CREDIT_SANCTION
    );

    return savedSanction;
  }

  async getPendingSanctions(): Promise<CreditSanction[]> {
    return await this.creditSanctionRepository.find({
      where: { status: 'pending' },
      relations: ['customer', 'customer.rm', 'creditOfficer'],
      order: { createdAt: 'DESC' },
    });
  }

  async getSanctionById(id: number): Promise<CreditSanction | null> {
    return await this.creditSanctionRepository.findOne({
      where: { id },
      relations: [
        'customer',
        'customer.rm',
        'customer.documents',
        'creditOfficer',
        'approvalInstances',
        'approvalInstances.approvalFlow',
        'approvalInstances.actions',
        'approvalInstances.actions.approver',
      ],
    });
  }

  async updateSanction(
    id: number,
    data: Partial<CreditSanction>
  ): Promise<CreditSanction> {
    const sanction = await this.creditSanctionRepository.findOne({ where: { id } });

    if (!sanction) {
      throw new Error('Credit sanction not found');
    }

    Object.assign(sanction, data);
    return await this.creditSanctionRepository.save(sanction);
  }

  /**
   * Get all sanction limits for a customer based on customerId
   * Returns all available partner sanctions from sanction_limit_history
   * Partner information is now dynamically loaded from the partners table
   */
  async getSanctionLimitsByCustomerId(customerId: number): Promise<SanctionLimitHistory[]> {
    return await this.sanctionHistoryRepository.find({
      where: { customerId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get all credit sanctions for a customer by customerId
   * Returns partner-specific sanctions from credit_sanctions table
   */
  async getSanctionsByCustomerId(customerId: number): Promise<CreditSanction[]> {
    return await this.creditSanctionRepository.find({
      where: { customerId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get all credit sanctions for a customer by customerId (simple version for non-CREDIT_L1 roles)
   * Returns all sanctions without filtering by partner active status
   */
  async getSanctionsByCustomerIdSimple(customerId: number): Promise<CreditSanction[]> {
    return await this.creditSanctionRepository.find({
      where: { customerId },
      order: { createdAt: 'DESC' },
    });
  }
}



