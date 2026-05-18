import { AppDataSource } from '../config/database';
import { User } from '../entities/User';
import { TaskTimeTracking } from '../entities/TaskTimeTracking';
import { TaskBucketMapping } from '../entities/TaskBucketMapping';
import { RewardPoint } from '../entities/RewardPoint';
import { UserRole } from '../entities/UserRole';
import { Role } from '../entities/Role';
import { Customer } from '../entities/Customer';
import { Supplier } from '../entities/Supplier';
import { Invoice } from '../entities/Invoice';
import { CreditSanction } from '../entities/CreditSanction';
import { LoanAccount } from '../entities/LoanAccount';
import { CaseWorkflow } from '../entities/CaseWorkflow';
import { ObjectLiteral, Repository } from 'typeorm';
import { taskTimeTrackingService } from './task-time-tracking.service';
import { rewardService } from './reward.service';

const toNumber = (value: string | number | null | undefined): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatLabel = (value: string | null | undefined): string => {
  if (!value) return 'Unknown';
  return value
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const getMonthKey = (date: Date): string => {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}`;
};

const getMonthLabel = (date: Date): string => {
  return date.toLocaleString('en-US', { month: 'short', year: '2-digit' });
};

/**
 * SUPERADMIN Analytics Dashboard Service
 * Provides comprehensive analytics for SUPERADMIN visibility
 */
export class SuperAdminAnalyticsService {
  private userRepository: Repository<User>;
  private taskTrackingRepository: Repository<TaskTimeTracking>;
  private bucketMappingRepository: Repository<TaskBucketMapping>;
  private rewardPointRepository: Repository<RewardPoint>;
  private userRoleRepository: Repository<UserRole>;
  private roleRepository: Repository<Role>;
  private customerRepository: Repository<Customer>;
  private supplierRepository: Repository<Supplier>;
  private invoiceRepository: Repository<Invoice>;
  private creditSanctionRepository: Repository<CreditSanction>;
  private loanAccountRepository: Repository<LoanAccount>;
  private caseWorkflowRepository: Repository<CaseWorkflow>;

  constructor() {
    this.userRepository = AppDataSource.getRepository(User);
    this.taskTrackingRepository = AppDataSource.getRepository(TaskTimeTracking);
    this.bucketMappingRepository = AppDataSource.getRepository(TaskBucketMapping);
    this.rewardPointRepository = AppDataSource.getRepository(RewardPoint);
    this.userRoleRepository = AppDataSource.getRepository(UserRole);
    this.roleRepository = AppDataSource.getRepository(Role);
    this.customerRepository = AppDataSource.getRepository(Customer);
    this.supplierRepository = AppDataSource.getRepository(Supplier);
    this.invoiceRepository = AppDataSource.getRepository(Invoice);
    this.creditSanctionRepository = AppDataSource.getRepository(CreditSanction);
    this.loanAccountRepository = AppDataSource.getRepository(LoanAccount);
    this.caseWorkflowRepository = AppDataSource.getRepository(CaseWorkflow);
  }

  /**
   * Get complete dashboard overview
   */
  async getDashboardOverview(): Promise<{
    totalUsers: number;
    activeTasks: number;
    completedTasks: number;
    pendingTasks: number;
    averageCompletionTime: number | null;
    overdueTasks: number;
  }> {
    const userCount = await this.userRepository.count({
      where: { isActive: true },
    });

    const taskStats = await this.taskTrackingRepository
      .createQueryBuilder('tracking')
      .select('COUNT(*)', 'total')
      .addSelect('SUM(CASE WHEN tracking.status = \'completed\' THEN 1 ELSE 0 END)', 'completed')
      .addSelect('SUM(CASE WHEN tracking.status = \'pending\' THEN 1 ELSE 0 END)', 'pending')
      .addSelect('SUM(CASE WHEN tracking.status = \'in_progress\' THEN 1 ELSE 0 END)', 'active')
      .addSelect('SUM(CASE WHEN tracking.isOverdue = true THEN 1 ELSE 0 END)', 'overdue')
      .addSelect('AVG(tracking.totalCompletionTimeMinutes)', 'avgTime')
      .getRawOne();

    return {
      totalUsers: userCount,
      activeTasks: parseInt(taskStats?.active) || 0,
      completedTasks: parseInt(taskStats?.completed) || 0,
      pendingTasks: parseInt(taskStats?.pending) || 0,
      averageCompletionTime: taskStats?.avgTime ? parseFloat(taskStats.avgTime) : null,
      overdueTasks: parseInt(taskStats?.overdue) || 0,
    };
  }

  /**
   * Get top 10 performers
   */
  async getTopPerformers(limit: number = 10): Promise<Array<{
    userId: number;
    userName: string;
    email: string;
    totalPoints: number;
    tasksCompleted: number;
    avgCompletionTime: number | null;
  }>> {
    const topUsers = await rewardService.getTopPerformers(limit);

    // Get additional info
    const results = [];
    for (const user of topUsers) {
      const dbUser = await this.userRepository.findOne({
        where: { id: user.userId },
      });

      const stats = await taskTimeTrackingService.getUserTaskStats(user.userId);

      results.push({
        userId: user.userId,
        userName: user.userName,
        email: dbUser?.email || '',
        totalPoints: user.totalPoints,
        tasksCompleted: user.tasksCompleted,
        avgCompletionTime: stats.avgCompletionTime,
      });
    }

    return results;
  }

  /**
   * Get lowest 10 performers
   */
  async getLowestPerformers(limit: number = 10): Promise<Array<{
    userId: number;
    userName: string;
    email: string;
    totalPoints: number;
    tasksCompleted: number;
    avgCompletionTime: number | null;
  }>> {
    const bottomUsers = await this.rewardPointRepository
      .createQueryBuilder('reward')
      .select('reward.userId', 'userId')
      .addSelect('user.name', 'userName')
      .addSelect('user.email', 'email')
      .addSelect('SUM(reward.points)', 'totalPoints')
      .addSelect('COUNT(*)', 'tasksCompleted')
      .leftJoin('reward.user', 'user')
      .groupBy('reward.userId')
      .addGroupBy('user.name')
      .addGroupBy('user.email')
      .orderBy('totalPoints', 'ASC')
      .limit(limit)
      .getRawMany();

    const results = [];
    for (const user of bottomUsers) {
      const stats = await taskTimeTrackingService.getUserTaskStats(parseInt(user.userId));

      results.push({
        userId: parseInt(user.userId),
        userName: user.userName || 'Unknown',
        email: user.email || '',
        totalPoints: parseInt(user.totalPoints) || 0,
        tasksCompleted: parseInt(user.tasksCompleted) || 0,
        avgCompletionTime: stats.avgCompletionTime,
      });
    }

    return results;
  }

  /**
   * Get bucket performance stats
   */
  async getBucketPerformanceStats(): Promise<Array<{
    bucketName: string;
    totalTasks: number;
    completedTasks: number;
    pendingTasks: number;
    avgCompletionTime: number | null;
    userCount: number;
  }>> {
    const bucketMappings = await this.bucketMappingRepository.find({
      relations: ['role'],
    });

    const results = [];

    for (const mapping of bucketMappings) {
      const tasks = await this.taskTrackingRepository.find({
        where: { bucket: mapping.bucketName },
      });

      const completedTasks = tasks.filter(t => t.status === 'completed');
      const pendingTasks = tasks.filter(t => t.status === 'pending');

      const totalTimes = completedTasks
        .map(t => t.totalCompletionTimeMinutes)
        .filter(t => t !== null) as number[];

      const avgTime = totalTimes.length > 0
        ? totalTimes.reduce((a, b) => a + b, 0) / totalTimes.length
        : null;

      // Count users in this bucket
      const userCount = await this.userRoleRepository
        .createQueryBuilder('ur')
        .select('COUNT(DISTINCT ur.userId)', 'count')
        .where('ur.roleId = :roleId', { roleId: mapping.roleId })
        .andWhere('ur.isActive = true')
        .getRawOne();

      results.push({
        bucketName: mapping.bucketName,
        totalTasks: tasks.length,
        completedTasks: completedTasks.length,
        pendingTasks: pendingTasks.length,
        avgCompletionTime: avgTime,
        userCount: parseInt(userCount?.count) || 0,
      });
    }

    return results;
  }

  /**
   * Get L1 vs L2 processing comparison
   */
  async getL1L2ProcessingComparison(): Promise<{
    l1Stats: {
      avgTime: number | null;
      taskCount: number;
    };
    l2Stats: {
      avgTime: number | null;
      taskCount: number;
    };
  }> {
    const result = await this.taskTrackingRepository
      .createQueryBuilder('tracking')
      .select('AVG(tracking.l1ProcessingTimeMinutes)', 'avgL1Time')
      .addSelect('COUNT(CASE WHEN tracking.l1ProcessingTimeMinutes IS NOT NULL THEN 1 END)', 'l1Tasks')
      .addSelect('AVG(tracking.l2ProcessingTimeMinutes)', 'avgL2Time')
      .addSelect('COUNT(CASE WHEN tracking.l2ProcessingTimeMinutes IS NOT NULL THEN 1 END)', 'l2Tasks')
      .getRawOne();

    return {
      l1Stats: {
        avgTime: result.avgL1Time ? parseFloat(result.avgL1Time) : null,
        taskCount: parseInt(result.l1Tasks) || 0,
      },
      l2Stats: {
        avgTime: result.avgL2Time ? parseFloat(result.avgL2Time) : null,
        taskCount: parseInt(result.l2Tasks) || 0,
      },
    };
  }

  /**
   * Get user task timing analytics
   */
  async getUserTaskTimingAnalytics(userId?: number): Promise<Array<{
    userId: number;
    userName: string;
    tasksCompleted: number;
    avgCompletionTime: number | null;
    l1Time: number | null;
    l2Time: number | null;
    pendingTasks: number;
    overdueTasks: number;
  }>> {
    let query = this.taskTrackingRepository
      .createQueryBuilder('tracking')
      .select('tracking.userId', 'userId')
      .addSelect('user.name', 'userName')
      .addSelect('SUM(CASE WHEN tracking.status = \'completed\' THEN 1 ELSE 0 END)', 'tasksCompleted')
      .addSelect('AVG(tracking.totalCompletionTimeMinutes)', 'avgCompletionTime')
      .addSelect('AVG(tracking.l1ProcessingTimeMinutes)', 'l1Time')
      .addSelect('AVG(tracking.l2ProcessingTimeMinutes)', 'l2Time')
      .addSelect('SUM(CASE WHEN tracking.status = \'pending\' THEN 1 ELSE 0 END)', 'pendingTasks')
      .addSelect('SUM(CASE WHEN tracking.isOverdue = true THEN 1 ELSE 0 END)', 'overdueTasks')
      .leftJoin('tracking.user', 'user')
      .groupBy('tracking.userId')
      .addGroupBy('user.name');

    if (userId) {
      query = query.where('tracking.userId = :userId', { userId });
    }

    const results = await query.orderBy('tasksCompleted', 'DESC').getRawMany();

    return results.map(r => ({
      userId: parseInt(r.userId),
      userName: r.userName || 'Unknown',
      tasksCompleted: parseInt(r.tasksCompleted) || 0,
      avgCompletionTime: r.avgCompletionTime ? parseFloat(r.avgCompletionTime) : null,
      l1Time: r.l1Time ? parseFloat(r.l1Time) : null,
      l2Time: r.l2Time ? parseFloat(r.l2Time) : null,
      pendingTasks: parseInt(r.pendingTasks) || 0,
      overdueTasks: parseInt(r.overdueTasks) || 0,
    }));
  }

  /**
   * Get ranking: Fastest Closers
   */
  async getFastestClosersRanking(limit: number = 10): Promise<Array<{
    rank: number;
    userId: number;
    userName: string;
    avgCompletionTime: number;
    tasksCompleted: number;
  }>> {
    const fastest = await taskTimeTrackingService.getFastestClosers(limit);
    return fastest.map((item, index) => ({
      rank: index + 1,
      userId: item.userId,
      userName: item.userName,
      avgCompletionTime: item.avgCompletionTime,
      tasksCompleted: item.completedTasks,
    }));
  }

  /**
   * Get ranking: Slowest Closers
   */
  async getSlowestClosersRanking(limit: number = 10): Promise<Array<{
    rank: number;
    userId: number;
    userName: string;
    avgCompletionTime: number;
    tasksCompleted: number;
  }>> {
    const slowest = await taskTimeTrackingService.getSlowestClosers(limit);
    return slowest.map((item, index) => ({
      rank: index + 1,
      userId: item.userId,
      userName: item.userName,
      avgCompletionTime: item.avgCompletionTime,
      tasksCompleted: item.completedTasks,
    }));
  }

  /**
   * Get ranking: Highest Productivity Users
   */
  async getHighestProductivityRanking(limit: number = 10): Promise<Array<{
    rank: number;
    userId: number;
    userName: string;
    tasksCompleted: number;
    totalPoints: number;
  }>> {
    const results = await this.rewardPointRepository
      .createQueryBuilder('reward')
      .select('reward.userId', 'userId')
      .addSelect('user.name', 'userName')
      .addSelect('COUNT(*)', 'tasksCompleted')
      .addSelect('SUM(reward.points)', 'totalPoints')
      .leftJoin('reward.user', 'user')
      .groupBy('reward.userId')
      .addGroupBy('user.name')
      .orderBy('tasksCompleted', 'DESC')
      .limit(limit)
      .getRawMany();

    return results.map((r, index) => ({
      rank: index + 1,
      userId: parseInt(r.userId),
      userName: r.userName || 'Unknown',
      tasksCompleted: parseInt(r.tasksCompleted) || 0,
      totalPoints: parseInt(r.totalPoints) || 0,
    }));
  }

  /**
   * Get role distribution
   */
  async getRoleDistribution(): Promise<Array<{
    roleName: string;
    userCount: number;
  }>> {
    const results = await this.userRoleRepository
      .createQueryBuilder('ur')
      .select('role.name', 'roleName')
      .addSelect('COUNT(*)', 'userCount')
      .leftJoin('ur.role', 'role')
      .where('ur.isActive = true')
      .groupBy('role.name')
      .orderBy('userCount', 'DESC')
      .getRawMany();

    return results.map(r => ({
      roleName: r.roleName || 'Unknown',
      userCount: parseInt(r.userCount) || 0,
    }));
  }

  /**
   * Get operating metrics from the core supply-chain finance database tables.
   */
  async getBusinessOverview(): Promise<{
    totalCustomers: number;
    activeCustomers: number;
    kycVerifiedCustomers: number;
    completedCustomers: number;
    totalSuppliers: number;
    activeSuppliers: number;
    completedSuppliers: number;
    totalInvoices: number;
    activeInvoices: number;
    disbursedInvoices: number;
    totalLoanAccounts: number;
    completedWorkflows: number;
    activeWorkflows: number;
    rejectedWorkflows: number;
  }> {
    const [
      totalCustomers,
      kycVerifiedCustomers,
      completedCustomersRaw,
      activeCustomersRaw,
      totalSuppliers,
      completedSuppliersRaw,
      activeSuppliersRaw,
      totalInvoices,
      activeInvoicesRaw,
      disbursedInvoicesRaw,
      totalLoanAccounts,
      workflowRaw,
    ] = await Promise.all([
      this.customerRepository.count(),
      this.customerRepository.count({ where: { kycVerified: true } }),
      this.customerRepository
        .createQueryBuilder('customer')
        .select('COUNT(*)', 'count')
        .where('LOWER(customer.status) IN (:...statuses)', { statuses: ['completed', 'disbursed'] })
        .getRawOne(),
      this.customerRepository
        .createQueryBuilder('customer')
        .select('COUNT(*)', 'count')
        .where('LOWER(customer.status) NOT IN (:...statuses)', { statuses: ['draft', 'completed', 'disbursed', 'rejected'] })
        .getRawOne(),
      this.supplierRepository.count(),
      this.supplierRepository
        .createQueryBuilder('supplier')
        .select('COUNT(*)', 'count')
        .where('supplier.status = :status', { status: 'COMPLETED' })
        .getRawOne(),
      this.supplierRepository
        .createQueryBuilder('supplier')
        .select('COUNT(*)', 'count')
        .where('supplier.isActive = true')
        .andWhere('supplier.status NOT IN (:...statuses)', { statuses: ['DRAFT', 'COMPLETED', 'REJECTED'] })
        .getRawOne(),
      this.invoiceRepository.count(),
      this.invoiceRepository
        .createQueryBuilder('invoice')
        .select('COUNT(*)', 'count')
        .where('invoice.isActive = true')
        .andWhere('invoice.status NOT IN (:...statuses)', {
          statuses: ['DRAFT', 'DISBURSED', 'REJECTED', 'REJECTED_BY_CUSTOMER'],
        })
        .getRawOne(),
      this.invoiceRepository
        .createQueryBuilder('invoice')
        .select('COUNT(*)', 'count')
        .where('invoice.status = :status', { status: 'DISBURSED' })
        .getRawOne(),
      this.loanAccountRepository.count(),
      this.caseWorkflowRepository
        .createQueryBuilder('workflow')
        .select('SUM(CASE WHEN workflow.isCompleted = true THEN 1 ELSE 0 END)', 'completed')
        .addSelect('SUM(CASE WHEN workflow.isRejected = true THEN 1 ELSE 0 END)', 'rejected')
        .addSelect('SUM(CASE WHEN workflow.isCompleted = false AND workflow.isRejected = false THEN 1 ELSE 0 END)', 'active')
        .getRawOne(),
    ]);

    return {
      totalCustomers,
      activeCustomers: toNumber(activeCustomersRaw?.count),
      kycVerifiedCustomers,
      completedCustomers: toNumber(completedCustomersRaw?.count),
      totalSuppliers,
      activeSuppliers: toNumber(activeSuppliersRaw?.count),
      completedSuppliers: toNumber(completedSuppliersRaw?.count),
      totalInvoices,
      activeInvoices: toNumber(activeInvoicesRaw?.count),
      disbursedInvoices: toNumber(disbursedInvoicesRaw?.count),
      totalLoanAccounts,
      completedWorkflows: toNumber(workflowRaw?.completed),
      activeWorkflows: toNumber(workflowRaw?.active),
      rejectedWorkflows: toNumber(workflowRaw?.rejected),
    };
  }

  /**
   * Get financial exposure, utilization, and invoice book metrics.
   */
  async getFinancialSnapshot(): Promise<{
    sanctionCount: number;
    approvedSanctionCount: number;
    approvedSanctionAmount: number;
    loanAccounts: number;
    sanctionedBook: number;
    disbursedBook: number;
    utilizedLimit: number;
    unutilizedLimit: number;
    utilizationRate: number;
    totalInvoiceAmount: number;
    disbursedInvoiceAmount: number;
    outstandingInvoiceAmount: number;
    averageInvoiceAmount: number;
    averageInterestRate: number;
  }> {
    const [sanctionRaw, loanRaw, invoiceRaw] = await Promise.all([
      this.creditSanctionRepository
        .createQueryBuilder('sanction')
        .select('COUNT(*)', 'sanctionCount')
        .addSelect("SUM(CASE WHEN LOWER(sanction.status) = 'approved' THEN 1 ELSE 0 END)", 'approvedSanctionCount')
        .addSelect("SUM(CASE WHEN LOWER(sanction.status) = 'approved' THEN sanction.sanctionAmount ELSE 0 END)", 'approvedSanctionAmount')
        .addSelect('AVG(sanction.interestRate)', 'averageInterestRate')
        .getRawOne(),
      this.loanAccountRepository
        .createQueryBuilder('loan')
        .select('COUNT(*)', 'loanAccounts')
        .addSelect('SUM(COALESCE(loan.sanctionedAmount, 0))', 'sanctionedBook')
        .addSelect('SUM(COALESCE(loan.disbursedAmount, 0))', 'disbursedBook')
        .addSelect('SUM(COALESCE(loan.utilizedLimit, 0))', 'utilizedLimit')
        .addSelect('SUM(COALESCE(loan.unutilizedLimit, 0))', 'unutilizedLimit')
        .getRawOne(),
      this.invoiceRepository
        .createQueryBuilder('invoice')
        .select('SUM(COALESCE(invoice.invoiceAmount, 0))', 'totalInvoiceAmount')
        .addSelect('SUM(COALESCE(invoice.disbursedAmount, invoice.disbursementAmount, 0))', 'disbursedInvoiceAmount')
        .addSelect("SUM(CASE WHEN invoice.status NOT IN ('DISBURSED', 'REJECTED', 'REJECTED_BY_CUSTOMER') THEN COALESCE(invoice.invoiceAmount, 0) ELSE 0 END)", 'outstandingInvoiceAmount')
        .addSelect('AVG(invoice.invoiceAmount)', 'averageInvoiceAmount')
        .getRawOne(),
    ]);

    const sanctionedBook = toNumber(loanRaw?.sanctionedBook) || toNumber(sanctionRaw?.approvedSanctionAmount);
    const utilizedLimit = toNumber(loanRaw?.utilizedLimit) || toNumber(loanRaw?.disbursedBook);

    return {
      sanctionCount: toNumber(sanctionRaw?.sanctionCount),
      approvedSanctionCount: toNumber(sanctionRaw?.approvedSanctionCount),
      approvedSanctionAmount: toNumber(sanctionRaw?.approvedSanctionAmount),
      loanAccounts: toNumber(loanRaw?.loanAccounts),
      sanctionedBook,
      disbursedBook: toNumber(loanRaw?.disbursedBook),
      utilizedLimit,
      unutilizedLimit: toNumber(loanRaw?.unutilizedLimit),
      utilizationRate: sanctionedBook > 0 ? Math.round((utilizedLimit / sanctionedBook) * 100) : 0,
      totalInvoiceAmount: toNumber(invoiceRaw?.totalInvoiceAmount),
      disbursedInvoiceAmount: toNumber(invoiceRaw?.disbursedInvoiceAmount),
      outstandingInvoiceAmount: toNumber(invoiceRaw?.outstandingInvoiceAmount),
      averageInvoiceAmount: toNumber(invoiceRaw?.averageInvoiceAmount),
      averageInterestRate: toNumber(sanctionRaw?.averageInterestRate),
    };
  }

  /**
   * Get partner-wise sanction book from loan accounts.
   */
  async getPartnerSanctionStats(limit: number = 8): Promise<Array<{
    partnerId: number | null;
    partnerName: string;
    partnerCode: string;
    sanctionCount: number;
    activeAccounts: number;
    sanctionedAmount: number;
    disbursedAmount: number;
    utilizedLimit: number;
    unutilizedLimit: number;
    utilizationRate: number;
    lastCreatedAt: Date | null;
  }>> {
    const normalizedLimit = Math.max(1, Math.min(limit, 20));

    const rows = await this.loanAccountRepository
      .createQueryBuilder('loan')
      .leftJoin('loan.partner', 'partner')
      .select('partner.id', 'partnerId')
      .addSelect("COALESCE(partner.name, loan.lender, 'Unassigned Partner')", 'partnerName')
      .addSelect("COALESCE(partner.code, loan.lender, 'NA')", 'partnerCode')
      .addSelect('COUNT(loan.id)', 'sanctionCount')
      .addSelect("SUM(CASE WHEN LOWER(loan.status) = 'active' THEN 1 ELSE 0 END)", 'activeAccounts')
      .addSelect('SUM(COALESCE(loan.sanctionedAmount, 0))', 'sanctionedAmount')
      .addSelect('SUM(COALESCE(loan.disbursedAmount, 0))', 'disbursedAmount')
      .addSelect('SUM(COALESCE(loan.utilizedLimit, 0))', 'utilizedLimit')
      .addSelect('SUM(COALESCE(loan.unutilizedLimit, 0))', 'unutilizedLimit')
      .addSelect('MAX(loan.createdAt)', 'lastCreatedAt')
      .groupBy('partner.id')
      .addGroupBy('partner.name')
      .addGroupBy('partner.code')
      .addGroupBy('loan.lender')
      .orderBy('sanctionedAmount', 'DESC')
      .limit(normalizedLimit)
      .getRawMany();

    return rows.map(row => {
      const sanctionedAmount = toNumber(row.sanctionedAmount);
      const utilizedLimit = toNumber(row.utilizedLimit) || toNumber(row.disbursedAmount);

      return {
        partnerId: row.partnerId ? toNumber(row.partnerId) : null,
        partnerName: row.partnerName || 'Unassigned Partner',
        partnerCode: row.partnerCode || 'NA',
        sanctionCount: toNumber(row.sanctionCount),
        activeAccounts: toNumber(row.activeAccounts),
        sanctionedAmount,
        disbursedAmount: toNumber(row.disbursedAmount),
        utilizedLimit,
        unutilizedLimit: toNumber(row.unutilizedLimit),
        utilizationRate: sanctionedAmount > 0 ? Math.round((utilizedLimit / sanctionedAmount) * 100) : 0,
        lastCreatedAt: row.lastCreatedAt || null,
      };
    });
  }

  /**
   * Get workflow mix across customer onboarding, supplier onboarding, and invoice discounting.
   */
  async getWorkflowPipeline(): Promise<Array<{
    workflowType: string;
    label: string;
    total: number;
    active: number;
    completed: number;
    rejected: number;
    completionRate: number;
  }>> {
    const rows = await this.caseWorkflowRepository
      .createQueryBuilder('workflow')
      .select('workflow.workflowType', 'workflowType')
      .addSelect('COUNT(*)', 'total')
      .addSelect('SUM(CASE WHEN workflow.isCompleted = true THEN 1 ELSE 0 END)', 'completed')
      .addSelect('SUM(CASE WHEN workflow.isRejected = true THEN 1 ELSE 0 END)', 'rejected')
      .addSelect('SUM(CASE WHEN workflow.isCompleted = false AND workflow.isRejected = false THEN 1 ELSE 0 END)', 'active')
      .groupBy('workflow.workflowType')
      .orderBy('total', 'DESC')
      .getRawMany();

    return rows.map(row => {
      const total = toNumber(row.total);
      const completed = toNumber(row.completed);

      return {
        workflowType: row.workflowType || 'UNKNOWN',
        label: formatLabel(row.workflowType),
        total,
        active: toNumber(row.active),
        completed,
        rejected: toNumber(row.rejected),
        completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      };
    });
  }

  private async getStatusBreakdown<T extends ObjectLiteral>(
    repository: Repository<T>,
    alias: string,
    amountColumn?: string
  ): Promise<Array<{
    status: string;
    label: string;
    count: number;
    amount?: number;
  }>> {
    const query = repository
      .createQueryBuilder(alias)
      .select(`${alias}.status`, 'status')
      .addSelect('COUNT(*)', 'count');

    if (amountColumn) {
      query.addSelect(`SUM(COALESCE(${alias}.${amountColumn}, 0))`, 'amount');
    }

    const rows = await query
      .groupBy(`${alias}.status`)
      .orderBy('count', 'DESC')
      .getRawMany();

    return rows.map(row => ({
      status: row.status || 'UNKNOWN',
      label: formatLabel(row.status),
      count: toNumber(row.count),
      amount: amountColumn ? toNumber(row.amount) : undefined,
    }));
  }

  /**
   * Get current status splits for the major case types.
   */
  async getStatusBreakdowns(): Promise<{
    customers: Array<{ status: string; label: string; count: number }>;
    suppliers: Array<{ status: string; label: string; count: number }>;
    invoices: Array<{ status: string; label: string; count: number; amount?: number }>;
  }> {
    const [customers, suppliers, invoices] = await Promise.all([
      this.getStatusBreakdown(this.customerRepository, 'customer'),
      this.getStatusBreakdown(this.supplierRepository, 'supplier'),
      this.getStatusBreakdown(this.invoiceRepository, 'invoice', 'invoiceAmount'),
    ]);

    return {
      customers,
      suppliers,
      invoices,
    };
  }

  /**
   * Get recently updated workflow cases for the dashboard activity table.
   */
  async getRecentCases(limit: number = 8): Promise<Array<{
    id: number;
    workflowType: string;
    title: string;
    reference: string;
    status: string;
    assignedStage: string;
    assignedTo: string | null;
    amount: number | null;
    updatedAt: Date;
    isCompleted: boolean;
    isRejected: boolean;
  }>> {
    const workflows = await this.caseWorkflowRepository.find({
      relations: ['customer', 'supplier', 'invoice', 'assignedUser'],
      order: { updatedAt: 'DESC' },
      take: limit,
    });

    return workflows.map(workflow => {
      const customerTitle =
        workflow.customer?.companyName ||
        workflow.customer?.customerName ||
        workflow.customer?.name;
      const supplierTitle = workflow.supplier?.supplierName;
      const invoiceTitle = workflow.invoice?.invoiceNumber
        ? `Invoice ${workflow.invoice.invoiceNumber}`
        : undefined;

      return {
        id: workflow.id,
        workflowType: workflow.workflowType,
        title: customerTitle || supplierTitle || invoiceTitle || `Case ${workflow.id}`,
        reference: workflow.invoice?.invoiceNumber || workflow.supplier?.supplierCode || workflow.customer?.customerCode || `WF-${workflow.id}`,
        status: workflow.currentStatus,
        assignedStage: workflow.assignedStage || workflow.currentApproverRoleName || 'Unassigned',
        assignedTo: workflow.assignedUser?.name || null,
        amount: workflow.invoice?.invoiceAmount ? toNumber(workflow.invoice.invoiceAmount) : null,
        updatedAt: workflow.updatedAt,
        isCompleted: workflow.isCompleted,
        isRejected: workflow.isRejected,
      };
    });
  }

  /**
   * Get a compact month-by-month trend for origination and invoice volume.
   */
  async getMonthlyTrend(months: number = 6): Promise<Array<{
    period: string;
    label: string;
    customers: number;
    suppliers: number;
    invoices: number;
    invoiceAmount: number;
  }>> {
    const monthCount = Math.max(1, Math.min(months, 12));
    const trend = new Map<string, {
      period: string;
      label: string;
      customers: number;
      suppliers: number;
      invoices: number;
      invoiceAmount: number;
    }>();

    const since = new Date();
    since.setDate(1);
    since.setHours(0, 0, 0, 0);
    since.setMonth(since.getMonth() - (monthCount - 1));

    for (let index = monthCount - 1; index >= 0; index -= 1) {
      const date = new Date();
      date.setDate(1);
      date.setHours(0, 0, 0, 0);
      date.setMonth(date.getMonth() - index);
      const period = getMonthKey(date);

      trend.set(period, {
        period,
        label: getMonthLabel(date),
        customers: 0,
        suppliers: 0,
        invoices: 0,
        invoiceAmount: 0,
      });
    }

    const [customerRows, supplierRows, invoiceRows] = await Promise.all([
      this.customerRepository
        .createQueryBuilder('customer')
        .select("DATE_FORMAT(customer.createdAt, '%Y-%m')", 'period')
        .addSelect('COUNT(*)', 'count')
        .where('customer.createdAt >= :since', { since })
        .groupBy("DATE_FORMAT(customer.createdAt, '%Y-%m')")
        .getRawMany(),
      this.supplierRepository
        .createQueryBuilder('supplier')
        .select("DATE_FORMAT(supplier.createdAt, '%Y-%m')", 'period')
        .addSelect('COUNT(*)', 'count')
        .where('supplier.createdAt >= :since', { since })
        .groupBy("DATE_FORMAT(supplier.createdAt, '%Y-%m')")
        .getRawMany(),
      this.invoiceRepository
        .createQueryBuilder('invoice')
        .select("DATE_FORMAT(invoice.createdAt, '%Y-%m')", 'period')
        .addSelect('COUNT(*)', 'count')
        .addSelect('SUM(COALESCE(invoice.invoiceAmount, 0))', 'amount')
        .where('invoice.createdAt >= :since', { since })
        .groupBy("DATE_FORMAT(invoice.createdAt, '%Y-%m')")
        .getRawMany(),
    ]);

    customerRows.forEach(row => {
      const item = trend.get(row.period);
      if (item) item.customers = toNumber(row.count);
    });

    supplierRows.forEach(row => {
      const item = trend.get(row.period);
      if (item) item.suppliers = toNumber(row.count);
    });

    invoiceRows.forEach(row => {
      const item = trend.get(row.period);
      if (item) {
        item.invoices = toNumber(row.count);
        item.invoiceAmount = toNumber(row.amount);
      }
    });

    return Array.from(trend.values());
  }

  /**
   * Get new activity for the selected analytics period.
   */
  async getPeriodActivity(days: number = 30): Promise<{
    days: number;
    newCustomers: number;
    newSuppliers: number;
    newInvoices: number;
    invoiceAmount: number;
    disbursedAmount: number;
    completedWorkflows: number;
    rejectedWorkflows: number;
  }> {
    const normalizedDays = Math.max(1, Math.min(days, 365));
    const since = new Date();
    since.setDate(since.getDate() - normalizedDays);

    const [
      newCustomersRaw,
      newSuppliersRaw,
      invoiceRaw,
      workflowRaw,
    ] = await Promise.all([
      this.customerRepository
        .createQueryBuilder('customer')
        .select('COUNT(*)', 'count')
        .where('customer.createdAt >= :since', { since })
        .getRawOne(),
      this.supplierRepository
        .createQueryBuilder('supplier')
        .select('COUNT(*)', 'count')
        .where('supplier.createdAt >= :since', { since })
        .getRawOne(),
      this.invoiceRepository
        .createQueryBuilder('invoice')
        .select('COUNT(*)', 'count')
        .addSelect('SUM(COALESCE(invoice.invoiceAmount, 0))', 'invoiceAmount')
        .addSelect('SUM(COALESCE(invoice.disbursedAmount, invoice.disbursementAmount, 0))', 'disbursedAmount')
        .where('invoice.createdAt >= :since', { since })
        .getRawOne(),
      this.caseWorkflowRepository
        .createQueryBuilder('workflow')
        .select('SUM(CASE WHEN workflow.isCompleted = true THEN 1 ELSE 0 END)', 'completed')
        .addSelect('SUM(CASE WHEN workflow.isRejected = true THEN 1 ELSE 0 END)', 'rejected')
        .where('workflow.updatedAt >= :since', { since })
        .getRawOne(),
    ]);

    return {
      days: normalizedDays,
      newCustomers: toNumber(newCustomersRaw?.count),
      newSuppliers: toNumber(newSuppliersRaw?.count),
      newInvoices: toNumber(invoiceRaw?.count),
      invoiceAmount: toNumber(invoiceRaw?.invoiceAmount),
      disbursedAmount: toNumber(invoiceRaw?.disbursedAmount),
      completedWorkflows: toNumber(workflowRaw?.completed),
      rejectedWorkflows: toNumber(workflowRaw?.rejected),
    };
  }

  /**
   * Get complete analytics for SUPERADMIN dashboard
   */
  async getCompleteAnalytics(days: number = 30): Promise<{
    overview: {
      totalUsers: number;
      activeTasks: number;
      completedTasks: number;
      pendingTasks: number;
      averageCompletionTime: number | null;
      overdueTasks: number;
    };
    topPerformers: Array<{
      userId: number;
      userName: string;
      totalPoints: number;
      tasksCompleted: number;
    }>;
    lowestPerformers: Array<{
      userId: number;
      userName: string;
      totalPoints: number;
      tasksCompleted: number;
    }>;
    bucketStats: Array<{
      bucketName: string;
      totalTasks: number;
      completedTasks: number;
      pendingTasks: number;
      avgCompletionTime: number | null;
    }>;
    l1L2Comparison: {
      l1Stats: { avgTime: number | null; taskCount: number };
      l2Stats: { avgTime: number | null; taskCount: number };
    };
    fastestClosers: Array<{
      rank: number;
      userId: number;
      userName: string;
      avgCompletionTime: number;
    }>;
    slowestClosers: Array<{
      rank: number;
      userId: number;
      userName: string;
      avgCompletionTime: number;
    }>;
    productivityRanking: Array<{
      rank: number;
      userId: number;
      userName: string;
      tasksCompleted: number;
    }>;
    businessOverview: Awaited<ReturnType<SuperAdminAnalyticsService['getBusinessOverview']>>;
    financialSnapshot: Awaited<ReturnType<SuperAdminAnalyticsService['getFinancialSnapshot']>>;
    workflowPipeline: Awaited<ReturnType<SuperAdminAnalyticsService['getWorkflowPipeline']>>;
    statusBreakdowns: Awaited<ReturnType<SuperAdminAnalyticsService['getStatusBreakdowns']>>;
    recentCases: Awaited<ReturnType<SuperAdminAnalyticsService['getRecentCases']>>;
    monthlyTrend: Awaited<ReturnType<SuperAdminAnalyticsService['getMonthlyTrend']>>;
    periodActivity: Awaited<ReturnType<SuperAdminAnalyticsService['getPeriodActivity']>>;
    roleDistribution: Awaited<ReturnType<SuperAdminAnalyticsService['getRoleDistribution']>>;
    partnerSanctionStats: Awaited<ReturnType<SuperAdminAnalyticsService['getPartnerSanctionStats']>>;
  }> {
    const [
      overview,
      topPerformers,
      lowestPerformers,
      bucketStats,
      l1L2Comparison,
      fastestClosers,
      slowestClosers,
      productivityRanking,
      businessOverview,
      financialSnapshot,
      workflowPipeline,
      statusBreakdowns,
      recentCases,
      monthlyTrend,
      periodActivity,
      roleDistribution,
      partnerSanctionStats,
    ] = await Promise.all([
      this.getDashboardOverview(),
      this.getTopPerformers(10),
      this.getLowestPerformers(10),
      this.getBucketPerformanceStats(),
      this.getL1L2ProcessingComparison(),
      this.getFastestClosersRanking(10),
      this.getSlowestClosersRanking(10),
      this.getHighestProductivityRanking(10),
      this.getBusinessOverview(),
      this.getFinancialSnapshot(),
      this.getWorkflowPipeline(),
      this.getStatusBreakdowns(),
      this.getRecentCases(8),
      this.getMonthlyTrend(6),
      this.getPeriodActivity(days),
      this.getRoleDistribution(),
      this.getPartnerSanctionStats(8),
    ]);

    return {
      overview,
      topPerformers,
      lowestPerformers,
      bucketStats,
      l1L2Comparison,
      fastestClosers,
      slowestClosers,
      productivityRanking,
      businessOverview,
      financialSnapshot,
      workflowPipeline,
      statusBreakdowns,
      recentCases,
      monthlyTrend,
      periodActivity,
      roleDistribution,
      partnerSanctionStats,
    };
  }
}

// Export singleton instance
export const superAdminAnalyticsService = new SuperAdminAnalyticsService();
