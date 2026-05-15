import { AppDataSource } from '../config/database';
import { OperationsCheck, Customer, RepaymentUpload, REPAYMENT_UPLOAD_STATUS, LoanAccount, Partner } from '../entities';
import { Repository } from 'typeorm';
import { ApprovalService } from './approval.service';
import { CASE_STATUS } from '../config/constants';
import axios from 'axios';

export interface RepaymentRecord {
  lan: string;
  collection_date: string;
  collection_utr: string;
  collection_amount: number;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface UploadResult {
  success: boolean;
  message: string;
  results?: {
    lan: string;
    collectionUtr: string;
    status: string;
    errorMessage?: string;
  }[];
}

export class OperationsService {
  private operationsCheckRepository: Repository<OperationsCheck>;
  private customerRepository: Repository<Customer>;
  private repaymentUploadRepository: Repository<RepaymentUpload>;
  private loanAccountRepository: Repository<LoanAccount>;
  private partnerRepository: Repository<Partner>;
  private approvalService: ApprovalService;

  constructor() {
    this.operationsCheckRepository = AppDataSource.getRepository(OperationsCheck);
    this.customerRepository = AppDataSource.getRepository(Customer);
    this.repaymentUploadRepository = AppDataSource.getRepository(RepaymentUpload);
    this.loanAccountRepository = AppDataSource.getRepository(LoanAccount);
    this.partnerRepository = AppDataSource.getRepository(Partner);
    this.approvalService = new ApprovalService();
  }

  /**
   * Get all active partners as lenders
   */
  async getLenders(): Promise<{ id: number; name: string; code: string; lenderName: string }[]> {
    const partners = await this.partnerRepository.find({
      where: { status: 'ACTIVE' as any },
      order: { name: 'ASC' },
    });
    console.log("partners", partners);
    // Return partner name as lenderName (used to query loan_accounts table)
    return partners.map(p => ({ 
      id: p.id, 
      name: p.name, 
      code: p.code,
      lenderName: p.name // Use partner name for lender field in loan_accounts
    }));
  }

  /**
   * Get LANs by partner ID
   * Uses partnerId to directly join with loan_accounts table
   */
  async getLansByLender(partnerId: number): Promise<{ lanId: string; customerId: number }[]> {
    const loanAccounts = await this.loanAccountRepository.find({
      select: ['lanId', 'customerId'],
      where: { partnerId: partnerId, status: 'active' },
      order: { createdAt: 'DESC' },
    });
    
    return loanAccounts.map(la => ({ lanId: la.lanId, customerId: la.customerId }));
  }

  /**
   * Validate repayment records
   */
  private validateRepayments(repayments: RepaymentRecord[]): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!repayments || repayments.length === 0) {
      errors.push({ field: 'repayments', message: 'Repayments array must not be empty' });
      return errors;
    }

    const utrSet = new Set<string>();

    for (let i = 0; i < repayments.length; i++) {
      const repayment = repayments[i];
      const index = i;

      // Validate lan
      if (!repayment.lan || repayment.lan.trim() === '') {
        errors.push({ field: `repayments[${index}].lan`, message: 'LAN must not be null or empty' });
      }

      // Validate collection_date format (YYYY-MM-DD)
      if (!repayment.collection_date) {
        errors.push({ field: `repayments[${index}].collection_date`, message: 'Collection date is required' });
      } else {
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(repayment.collection_date)) {
          errors.push({ field: `repayments[${index}].collection_date`, message: 'Collection date must be in YYYY-MM-DD format' });
        } else {
          const date = new Date(repayment.collection_date);
          if (isNaN(date.getTime())) {
            errors.push({ field: `repayments[${index}].collection_date`, message: 'Collection date must be a valid date' });
          }
        }
      }

      // Validate collection_utr
      if (!repayment.collection_utr || repayment.collection_utr.trim() === '') {
        errors.push({ field: `repayments[${index}].collection_utr`, message: 'Collection UTR must not be null or empty' });
      } else if (utrSet.has(repayment.collection_utr)) {
        errors.push({ field: `repayments[${index}].collection_utr`, message: `Duplicate UTR: ${repayment.collection_utr}` });
      } else {
        utrSet.add(repayment.collection_utr);
      }

      // Validate collection_amount
      if (repayment.collection_amount === undefined || repayment.collection_amount === null) {
        errors.push({ field: `repayments[${index}].collection_amount`, message: 'Collection amount is required' });
      } else if (repayment.collection_amount <= 0) {
        errors.push({ field: `repayments[${index}].collection_amount`, message: 'Collection amount must be greater than 0' });
      }
    }

    return errors;
  }

  /**
   * Check for duplicate UTR in database
   */
  private async checkDuplicateUtr(lan: string, collectionUtr: string): Promise<boolean> {
    const existing = await this.repaymentUploadRepository.findOne({
      where: { lan, collectionUtr },
    });
    return !!existing;
  }

  /**
   * Send repayment data to LMS API
   */
  private async sendToLMSApi(repayments: RepaymentRecord[]): Promise<any> {
    const baseUrl = process.env.LMS_API_BASE_URL;
    const apiKey = process.env.LMS_API_KEY;

    if (!baseUrl || !apiKey) {
      throw new Error('LMS API configuration missing. Set LMS_API_BASE_URL and LMS_API_KEY in environment.');
    }

    const payload = { repayments };

    console.log('[Repayment Upload] Sending to LMS:', JSON.stringify(payload, null, 2));

    try {
      const response = await axios.post(
        `${baseUrl}loan-booking/v1/supplychain/repayment-upload`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'x-api-key': apiKey,
          },
          timeout: 30000,
        }
      );

      console.log('[Repayment Upload] LMS response:', response.status, response.data);
      return response.data;
    } catch (error: any) {
      if (error.response) {
        console.error('[Repayment Upload] LMS API Error:', error.response.status, error.response.data);
        throw new Error(`LMS API Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      } else if (error.request) {
        console.error('[Repayment Upload] LMS API unreachable - no response received');
        throw new Error('LMS API unreachable - network timeout');
      } else {
        console.error('[Repayment Upload] Failed to send to LMS:', error.message);
        throw new Error(`Failed to send to LMS: ${error.message}`);
      }
    }
  }

  /**
   * Upload repayment collections to LMS
   */
  async uploadRepayments(
    repayments: RepaymentRecord[],
    userId: number
  ): Promise<UploadResult> {
    // Step 1: Validate input
    const validationErrors = this.validateRepayments(repayments);
    if (validationErrors.length > 0) {
      return {
        success: false,
        message: 'Validation failed',
        results: validationErrors.map(err => ({
          lan: err.field.includes('[') ? repayments[parseInt(err.field.match(/\d+/)?.[0] || '0')]?.lan || 'unknown' : 'unknown',
          collectionUtr: err.field.includes('[') ? repayments[parseInt(err.field.match(/\d+/)?.[0] || '0')]?.collection_utr || 'unknown' : 'unknown',
          status: 'FAILED',
          errorMessage: err.message,
        })),
      };
    }

    // Step 2: Check for duplicate UTRs in database
    const duplicateChecks = await Promise.all(
      repayments.map(async (r) => {
        const isDuplicate = await this.checkDuplicateUtr(r.lan, r.collection_utr);
        return isDuplicate ? r : null;
      })
    );

    const duplicates = duplicateChecks.filter(r => r !== null);
    if (duplicates.length > 0) {
      return {
        success: false,
        message: 'Duplicate UTR submission detected',
        results: duplicates.map(r => ({
          lan: r.lan,
          collectionUtr: r.collection_utr,
          status: 'FAILED',
          errorMessage: `Duplicate UTR: ${r.collection_utr} for LAN ${r.lan}`,
        })),
      };
    }

    // Step 3: Save records to database (pending status)
    const savedRecords: RepaymentUpload[] = [];
    for (const repayment of repayments) {
      const record = this.repaymentUploadRepository.create({
        lan: repayment.lan,
        collectionDate: new Date(repayment.collection_date),
        collectionUtr: repayment.collection_utr,
        collectionAmount: repayment.collection_amount,
        status: REPAYMENT_UPLOAD_STATUS.PENDING,
        uploadedBy: userId,
        retryCount: 0,
      });
      savedRecords.push(await this.repaymentUploadRepository.save(record));
    }

    // Step 4: Call LMS API
    let lmsResponse: any;
    let lmsSuccess = false;
    try {
      lmsResponse = await this.sendToLMSApi(repayments);
      lmsSuccess = true;
    } catch (error: any) {
      console.error('[Repayment Upload] LMS API call failed:', error.message);
      lmsResponse = { message: error.message };
    }

    // Step 5: Update records based on LMS response
    const results: UploadResult['results'] = [];
    const timestamp = new Date().toISOString();

    for (const record of savedRecords) {
      if (lmsSuccess) {
        record.status = REPAYMENT_UPLOAD_STATUS.UPLOADED;
        record.uploadedAt = new Date();
        record.lmsResponse = JSON.stringify(lmsResponse);
        await this.repaymentUploadRepository.save(record);

await AppDataSource.query(
  `
  UPDATE loan_accounts
  SET

    utilizedLimit =
      GREATEST(
        COALESCE(utilizedLimit, 0) - ?,
        0
      )

  WHERE lanId = ?
  `,
  [
    Number(record.collectionAmount || 0),
    record.lan,
  ]
);

// ✅ second query
await AppDataSource.query(
  `
  UPDATE loan_accounts
  SET
    unutilizedLimit =
      COALESCE(sanctionedAmount, 0) -
      COALESCE(utilizedLimit, 0)

  WHERE lanId = ?
  `,
  [record.lan]
);


        console.log(`[Repayment Upload] Success - LAN: ${record.lan}, UTR: ${record.collectionUtr}, Timestamp: ${timestamp}`);

        results.push({
          lan: record.lan,
          collectionUtr: record.collectionUtr,
          status: 'UPLOADED',
        });
      } else {
        record.status = REPAYMENT_UPLOAD_STATUS.FAILED;
        record.errorMessage = lmsResponse.message;
        record.lmsResponse = JSON.stringify(lmsResponse);
        await this.repaymentUploadRepository.save(record);

        console.error(`[Repayment Upload] Failure - LAN: ${record.lan}, UTR: ${record.collectionUtr}, Error: ${lmsResponse.message}, Timestamp: ${timestamp}`);

        results.push({
          lan: record.lan,
          collectionUtr: record.collectionUtr,
          status: 'FAILED',
          errorMessage: lmsResponse.message,
        });
      }
    }

    return {
      success: lmsSuccess,
      message: lmsSuccess ? 'Repayments uploaded successfully' : 'Failed to upload repayments',
      results,
    };
  }

  /**
   * Retry failed repayment uploads
   */
  async retryRepaymentUpload(id: number): Promise<UploadResult> {
    const record = await this.repaymentUploadRepository.findOne({ where: { id } });

    if (!record) {
      return { success: false, message: 'Repayment record not found' };
    }

    if (record.status === REPAYMENT_UPLOAD_STATUS.UPLOADED) {
      return { success: false, message: 'Repayment already uploaded successfully' };
    }

    // Prepare repayment record for LMS call
    const repayment: RepaymentRecord = {
      lan: record.lan,
      collection_date: record.collectionDate.toISOString().split('T')[0],
      collection_utr: record.collectionUtr,
      collection_amount: Number(record.collectionAmount),
    };

    // Increment retry count
    record.retryCount += 1;
    await this.repaymentUploadRepository.save(record);

    // Call LMS API
    let lmsResponse: any;
    let lmsSuccess = false;
    try {
      lmsResponse = await this.sendToLMSApi([repayment]);
      lmsSuccess = true;
    } catch (error: any) {
      console.error(`[Repayment Upload] Retry failed for ID ${id}:`, error.message);
      lmsResponse = { message: error.message };
    }

    // Update record based on LMS response
    const timestamp = new Date().toISOString();

    if (lmsSuccess) {
      record.status = REPAYMENT_UPLOAD_STATUS.UPLOADED;
      record.uploadedAt = new Date();
      record.lmsResponse = JSON.stringify(lmsResponse);
      await this.repaymentUploadRepository.save(record);

      console.log(`[Repayment Upload] Retry Success - LAN: ${record.lan}, UTR: ${record.collectionUtr}, Timestamp: ${timestamp}`);

      return {
        success: true,
        message: 'Repayment uploaded successfully on retry',
        results: [{
          lan: record.lan,
          collectionUtr: record.collectionUtr,
          status: 'UPLOADED',
        }],
      };
    } else {
      record.status = REPAYMENT_UPLOAD_STATUS.FAILED;
      record.errorMessage = lmsResponse.message;
      record.lmsResponse = JSON.stringify(lmsResponse);
      await this.repaymentUploadRepository.save(record);

      console.error(`[Repayment Upload] Retry Failure - LAN: ${record.lan}, UTR: ${record.collectionUtr}, Error: ${lmsResponse.message}, Timestamp: ${timestamp}`);

      return {
        success: false,
        message: 'Retry failed',
        results: [{
          lan: record.lan,
          collectionUtr: record.collectionUtr,
          status: 'FAILED',
          errorMessage: lmsResponse.message,
        }],
      };
    }
  }

  /**
   * Get all repayment uploads with filters
   */
  async getRepaymentUploads(filters?: {
    status?: REPAYMENT_UPLOAD_STATUS;
    lan?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{ data: RepaymentUpload[]; total: number }> {
    const where: any = {};

    if (filters?.status) {
      where.status = filters.status;
    }
    if (filters?.lan) {
      where.lan = filters.lan;
    }
    if (filters?.startDate || filters?.endDate) {
      where.collectionDate = {};
      if (filters?.startDate) {
        where.collectionDate.gte = filters.startDate;
      }
      if (filters?.endDate) {
        where.collectionDate.lte = filters.endDate;
      }
    }

    const [data, total] = await this.repaymentUploadRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      take: filters?.limit || 20,
      skip: filters?.offset || 0,
    });

    return { data, total };
  }

  /**
   * Get repayment upload by ID
   */
  async getRepaymentUploadById(id: number): Promise<RepaymentUpload | null> {
    return await this.repaymentUploadRepository.findOne({ where: { id } });
  }

  /**
   * Submit post-sanction completion and trigger operations approval
   */
  async submitPostSanction(
    customerId: number,
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
      opsUserId: userId,
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
  async getCheckById(id: number): Promise<OperationsCheck | null> {
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
    id: number,
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


