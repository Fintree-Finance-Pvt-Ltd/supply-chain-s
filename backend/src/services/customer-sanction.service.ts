import { Repository } from 'typeorm';
import { AppDataSource } from '../config/database';
import {
  CreditSanction,
  Customer,
  OperationsCheck,
  PostSanction,
  SanctionLimitHistory,
} from '../entities';
import { normalizeMonthlyPenalRate } from '../utils/penalCharges';

export class CustomerSanctionService {
  private customerRepository: Repository<Customer>;
  private creditSanctionRepository: Repository<CreditSanction>;
  private postSanctionRepository: Repository<PostSanction>;
  private operationsCheckRepository: Repository<OperationsCheck>;
  private sanctionLimitHistoryRepository: Repository<SanctionLimitHistory>;

  constructor() {
    this.customerRepository = AppDataSource.getRepository(Customer);
    this.creditSanctionRepository = AppDataSource.getRepository(CreditSanction);
    this.postSanctionRepository = AppDataSource.getRepository(PostSanction);
    this.operationsCheckRepository = AppDataSource.getRepository(OperationsCheck);
    this.sanctionLimitHistoryRepository = AppDataSource.getRepository(SanctionLimitHistory);
  }

  async getSanctionsByCustomer(customerId: number) {
    const [customerWorkflow, creditSanctions, postSanctions, operationsChecks, sanctionLimitHistory] =
      await Promise.all([
        this.customerRepository.findOne({
          where: { id: customerId },
          select: {
            id: true,
            customerCode: true,
            customerName: true,
            bankAccountNo: true,
            bankIfscCode: true,
            bankName: true,
            bankBranch: true,
            bankType: true,
            eNachStatus: true,
            eSignStatus: true,
          },
        }),
        this.creditSanctionRepository.find({
          where: { customerId },
          select: {
            id: true,
            customerId: true,
            partner: true,
            sanctionAmount: true,
            tenure: true,
            interestRate: true,
            conditions: true,
            creditRemarks: true,
            penalCharges: true,
            processingFees: true,
            legalCharges: true,
            cashCollateral: true,
            serviceFee: true,
            creditOfficerId: true,
            status: true,
            renewalCycleId: true,
            createdAt: true,
            updatedAt: true,
          },
          order: { createdAt: 'DESC' },
        }),
        this.postSanctionRepository.find({
          where: { customerId },
          select: {
            id: true,
            customerId: true,
            esignStatus: true,
            enachStatus: true,
            remarks: true,
            isReadyForOps: true,
            createdAt: true,
            updatedAt: true,
          },
          order: { createdAt: 'DESC' },
        }),
        this.operationsCheckRepository.find({
          where: { customerId },
          select: {
            id: true,
            customerId: true,
            documentsVerified: true,
            esignVerified: true,
            enachVerified: true,
            opsRemarks: true,
            opsUserId: true,
            status: true,
            createdAt: true,
            updatedAt: true,
          },
          order: { createdAt: 'DESC' },
        }),
        this.sanctionLimitHistoryRepository.find({
          where: { customerId },
          select: {
            id: true,
            customerId: true,
            partner: true,
            sanctionAmount: true,
            tenure: true,
            interestRate: true,
            penalCharges: true,
            processingFees: true,
            legalCharges: true,
            cashCollateral: true,
            serviceFee: true,
            conditions: true,
            remarks: true,
            changedByRole: true,
            changedByUserId: true,
            createdAt: true,
          },
          order: { createdAt: 'DESC' },
        }),
      ]);

    return {
      customerWorkflow,
      creditSanctions: creditSanctions.map((sanction) => ({
        ...sanction,
        penalCharges: normalizeMonthlyPenalRate(sanction.penalCharges),
      })),
      postSanctions,
      operationsChecks,
      sanctionLimitHistory: sanctionLimitHistory.map((history) => ({
        ...history,
        penalCharges: normalizeMonthlyPenalRate(history.penalCharges),
      })),
    };
  }
}
