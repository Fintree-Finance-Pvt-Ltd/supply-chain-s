import { Repository } from 'typeorm';
import { AppDataSource } from '../config/database';
import { CaseStatusHistory } from '../entities';
import { normalizePagination, PaginationOptions } from '../utils/pagination';

export interface PaginatedHistory {
  data: CaseStatusHistory[];
  total: number;
  page: number;
  limit: number;
}

export class HistoryService {
  private historyRepository: Repository<CaseStatusHistory>;

  constructor() {
    this.historyRepository = AppDataSource.getRepository(CaseStatusHistory);
  }

  async getStatusHistoryByCustomer(
    customerId: number,
    pagination?: PaginationOptions,
  ): Promise<PaginatedHistory> {
    const { page, limit, skip } = normalizePagination(pagination);
    const queryBuilder = this.historyRepository
      .createQueryBuilder('history')
      .leftJoin('history.changedByUser', 'changedByUser')
      .select([
        'history.id',
        'history.customerId',
        'history.status',
        'history.previousStatus',
        'history.changedBy',
        'history.remarks',
        'history.sanctionAmount',
        'history.tenure',
        'history.interestRate',
        'history.penalCharges',
        'history.processingFees',
        'history.conditions',
        'history.createdAt',
        'changedByUser.id',
        'changedByUser.name',
        'changedByUser.email',
        'changedByUser.mobile',
        'changedByUser.defaultRole',
      ])
      .where('history.customerId = :customerId', { customerId })
      .orderBy('history.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    return { data, total, page, limit };
  }
}
