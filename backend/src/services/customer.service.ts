import { AppDataSource } from '../config/database';
import { Customer, CaseStatusHistory, User } from '../entities';
import { CASE_STATUS, CaseStatus } from '../config/constants';
import { Repository } from 'typeorm';

export class CustomerService {
  private customerRepository: Repository<Customer>;
  private statusHistoryRepository: Repository<CaseStatusHistory>;

  constructor() {
    this.customerRepository = AppDataSource.getRepository(Customer);
    this.statusHistoryRepository = AppDataSource.getRepository(CaseStatusHistory);
  }

  async createCustomer(data: {
    name: string;
    mobile: string;
    email?: string;
    companyType?: string;
    companyName?: string;
    gstNumber?: string;
    electricityBillNo?: string;
    rmId: number;
    customerCode?: string;
  }): Promise<Customer> {
    // Clean up empty strings
    const cleanedData = { ...data };
    if (cleanedData.gstNumber === '') cleanedData.gstNumber = undefined;
    if (cleanedData.customerCode === '') cleanedData.customerCode = undefined;

    // Check if GST already exists (if provided)
    if (cleanedData.gstNumber) {
      const existing = await this.customerRepository.findOne({
        where: { gstNumber: cleanedData.gstNumber },
      });

      if (existing) {
        throw new Error('Customer with this GST number already exists');
      }
    }

    const customer = this.customerRepository.create({
      ...cleanedData,
      status: CASE_STATUS.DRAFT,
    });

    const savedCustomer = await this.customerRepository.save(customer);

    // Create status history
    await this.createStatusHistory(savedCustomer.id, CASE_STATUS.DRAFT, data.rmId);

    return savedCustomer;
  }

  async updateCustomer(id: number, data: Partial<Customer>): Promise<Customer> {
    const customer = await this.customerRepository.findOne({ where: { id } });

    if (!customer) {
      throw new Error('Customer not found');
    }

    // Clean up empty strings
    const cleanedData = { ...data };
    if (cleanedData.gstNumber === '') cleanedData.gstNumber = undefined;
    if (cleanedData.customerCode === '') cleanedData.customerCode = undefined;

    Object.assign(customer, cleanedData);
    return await this.customerRepository.save(customer);
  }

  async getCustomerById(id: number): Promise<Customer | null> {
    return await this.customerRepository.findOne({
      where: { id },
      relations: [
        'rm',
        'documents',
        'documents.uploadedByUser',
        'kycDetails',
        'creditSanctions',
        'postSanctions',
        'operationsChecks',
        'coApplicants',
        'coApplicants.kycDetails',
        'contactPersons',
        'addresses',
        'statusHistory',
        'statusHistory.changedByUser',
      ],
    });
  }

  async getCustomers(filters: {
    status?: string;
    rmId?: number;
  }): Promise<Customer[]> {
    const queryBuilder = this.customerRepository.createQueryBuilder('customer');

    if (filters.status) {
      queryBuilder.where('customer.status = :status', { status: filters.status });
    }

    if (filters.rmId) {
      queryBuilder.andWhere('customer.rmId = :rmId', { rmId: filters.rmId });
    }

    queryBuilder
      .leftJoinAndSelect('customer.rm', 'rm')
      .orderBy('customer.createdAt', 'DESC');

    return await queryBuilder.getMany();
  }

  async updateStatus(
    customerId: number,
    newStatus: string,
    changedBy: number,
    remarks?: string
  ): Promise<Customer> {
    const customer = await this.customerRepository.findOne({
      where: { id: customerId },
    });

    if (!customer) {
      throw new Error('Customer not found');
    }

    const previousStatus = customer.status;
    customer.status = newStatus as CaseStatus;

    const savedCustomer = await this.customerRepository.save(customer);

    // Create status history
    await this.createStatusHistory(
      customerId,
      newStatus as CaseStatus,
      changedBy,
      previousStatus,
      remarks
    );

    return savedCustomer;
  }

  private async createStatusHistory(
    customerId: number,
    status: CaseStatus,
    changedBy: number,
    previousStatus?: string,
    remarks?: string
  ): Promise<CaseStatusHistory> {
    const history = this.statusHistoryRepository.create({
      customerId,
      status,
      previousStatus: previousStatus as CaseStatus,
      changedBy,
      remarks,
    });

    return await this.statusHistoryRepository.save(history);
  }
}



