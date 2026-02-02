import { AppDataSource } from '../config/database';
import { OperationsCheck, Customer } from '../entities';
import { ApprovalService } from './approval.service';
import { CustomerService } from './customer.service';
import { CASE_STATUS, APPROVAL_FLOW_TYPES } from '../config/constants';
import { Repository } from 'typeorm';

export class OperationsService {
  private operationsCheckRepository: Repository<OperationsCheck>;
  private approvalService: ApprovalService;
  private customerService: CustomerService;

  constructor() {
    this.operationsCheckRepository = AppDataSource.getRepository(OperationsCheck);
    this.approvalService = new ApprovalService();
    this.customerService = new CustomerService();
  }

  async createOperationsCheck(data: {
    customerId: string;
    opsUserId: string;
    documentsVerified?: boolean;
    esignVerified?: boolean;
    enachVerified?: boolean;
    opsRemarks?: string;
  }): Promise<OperationsCheck> {
    const customer = await AppDataSource.getRepository(Customer).findOne({
      where: { id: data.customerId },
    });

    if (!customer) {
      throw new Error('Customer not found');
    }

    const opsCheck = this.operationsCheckRepository.create({
      ...data,
      status: 'pending',
    });

    const savedCheck = await this.operationsCheckRepository.save(opsCheck);

    // Create approval instance
    await this.approvalService.createOperationsApproval(savedCheck.id);

    return savedCheck;
  }

  async getPendingChecks(): Promise<OperationsCheck[]> {
    return await this.operationsCheckRepository.find({
      where: { status: 'pending' },
      relations: ['customer', 'customer.rm', 'opsUser'],
      order: { createdAt: 'DESC' },
    });
  }

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

  async updateCheck(
    id: string,
    data: Partial<OperationsCheck>
  ): Promise<OperationsCheck> {
    const opsCheck = await this.operationsCheckRepository.findOne({ where: { id } });

    if (!opsCheck) {
      throw new Error('Operations check not found');
    }

    Object.assign(opsCheck, data);

    // If all verifications are complete and approved, update customer status
    if (
      opsCheck.status === 'approved' &&
      opsCheck.documentsVerified &&
      opsCheck.esignVerified &&
      opsCheck.enachVerified
    ) {
      await this.customerService.updateStatus(
        opsCheck.customerId,
        CASE_STATUS.FULLY_ONBOARDED,
        data.opsUserId || opsCheck.opsUserId || '',
        'Operations verification completed'
      );
    }

    return await this.operationsCheckRepository.save(opsCheck);
  }
}

