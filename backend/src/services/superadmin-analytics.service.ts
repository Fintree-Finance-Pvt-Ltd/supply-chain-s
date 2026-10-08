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
import { DISBURSEMENT_STATUS, LoanAccountSnapshot, LoanDisbursement } from '../entities/LoanManagement';
import { ObjectLiteral, Repository } from 'typeorm';
import { taskTimeTrackingService } from './task-time-tracking.service';
import { userPerformanceService } from './user-performance.service';
import type { PerformanceFilters, UserPerformanceSummary } from './user-performance.service';

type DashboardPeriod = number | 'all';

const CREDIT_PERFORMER_ROLES = new Set([
  'credit_team_l1',
  'credit_team_l2',
  'credit_head',
]);

const OPS_PERFORMER_ROLES = new Set([
  'operations_team_l1',
  'operations_team_l2',
  'operations_head',
]);

const TOP_PERFORMER_ROLES = new Set([
  ...CREDIT_PERFORMER_ROLES,
  ...OPS_PERFORMER_ROLES,
]);

const TOP_PERFORMER_EXCLUDED_ROLES = new Set([
  'relationship_manager',
  'ceo',
  'md',
  'admin',
  'superadmin',
]);

// Booked invoices move to ACTIVE once the loan is posted; DISBURSED is the legacy status for the same state.
const FINANCED_INVOICE_STATUSES = ['ACTIVE', 'DISBURSED'];
const REJECTED_INVOICE_STATUSES = ['REJECTED', 'REJECTED_BY_CUSTOMER'];
const NON_PIPELINE_INVOICE_STATUSES = ['DRAFT', ...FINANCED_INVOICE_STATUSES, ...REJECTED_INVOICE_STATUSES];

const PARTNER_PAGE_MAX = 50;

// Team-efficiency panels are derived from case_status_history: task_time_tracking rows are never
// closed (completion is looked up by the assignee, but another team member usually acts on the case).
const MIN_ACTIONS_FOR_CLOSER_RANKING = 3;
// An open case with no status movement for this long is reported as stuck.
const STALE_CASE_DAYS = 3;

// currentApproverRoleName uses a few short aliases that differ from roles.name.
const APPROVER_ROLE_ALIASES: Record<string, string> = {
  ops_l1: 'operations_team_l1',
  ops_l2: 'operations_team_l2',
  ops_head: 'operations_head',
  credit_l1: 'credit_team_l1',
  credit_l2: 'credit_team_l2',
  rm: 'relationship_manager',
};

// Departments shown in the "where are the cases" pipeline, in the order a case normally travels.
const CASE_DEPARTMENTS = [
  { key: 'rm', label: 'Relationship Manager' },
  { key: 'credit', label: 'Credit' },
  { key: 'management', label: 'MD' },
  { key: 'customer', label: 'Customer' },
  { key: 'operations', label: 'Operations' },
  { key: 'on_hold', label: 'On Hold' },
  { key: 'other', label: 'Other' },
] as const;

type CaseDepartment = typeof CASE_DEPARTMENTS[number]['key'];

// currentApproverRoleName values that mean the case is no longer waiting on anyone.
const CLOSED_APPROVER_ROLES = new Set(['', 'NONE', 'ARCHIVED']);

const getApproverDepartment = (role: string): CaseDepartment => {
  if (role === 'RM' || role === 'RELATIONSHIP_MANAGER') return 'rm';
  if (role.startsWith('CREDIT')) return 'credit';
  if (role.startsWith('OPERATIONS') || role.startsWith('OPS')) return 'operations';
  if (['MD', 'CEO', 'CFO', 'CREDIT_SANCTION_CUSTOMER_APPROVAL'].includes(role)) return 'management';
  if (role === 'CUSTOMER') return 'customer';
  if (role === 'ON_HOLD') return 'on_hold';
  return 'other';
};

const L1_ROLES = new Set(['credit_team_l1', 'operations_team_l1']);
const L2_ROLES = new Set(['credit_team_l2', 'operations_team_l2']);

interface ActivityUser {
  userId: number;
  userName: string;
  roles: string[];
  buckets: string[];
  actions: number;
  totalMinutes: number;
}

interface WorkflowActivity {
  users: ActivityUser[];
  bucketNames: string[];
  bucketUserCounts: Map<string, number>;
  bucketRoles: Map<string, string[]>;
  openByBucket: Map<string, number>;
  openCases: number;
  openWithTeams: number;
  staleCases: number;
}

const isTopPerformerUser =(roles: string[]): boolean =>
  roles.some(role => TOP_PERFORMER_ROLES.has(role)) &&
  !roles.some(role => TOP_PERFORMER_EXCLUDED_ROLES.has(role));

const hasAnyRole = (roles: string[], expectedRoles: ReadonlySet<string>): boolean =>
  roles.some(role => expectedRoles.has(role));

interface DashboardPerformer {
  userId: number;
  userName: string;
  email: string;
  totalPoints: number;
  rmPoints: number;
  tasksCompleted: number;
  avgCompletionTime: number | null;
  roles: string[];
}

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

const toDateKey = (date: Date): string => {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

/** Start of the window covering the last `days` calendar days, today included. */
const getPeriodStart = (days: number): Date => {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - (days - 1));
  return since;
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
  private disbursementRepository: Repository<LoanDisbursement>;

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
    this.disbursementRepository = AppDataSource.getRepository(LoanDisbursement);
  }

  private getPerformancePeriodFilters(period: DashboardPeriod): PerformanceFilters {
    if (period === 'all') return {};

    const normalizedDays = Math.max(1, Math.min(period, 365));
    return { startDate: getPeriodStart(normalizedDays) };
  }

  private async getPerformanceRanking(period: DashboardPeriod): Promise<UserPerformanceSummary[]> {
    const ranking = await userPerformanceService.getUserPerformanceList({
      ...this.getPerformancePeriodFilters(period),
      limit: 10000,
      offset: 0,
      sortBy: 'totalRewards',
      sortOrder: 'DESC',
    });

    return ranking.data;
  }

  private hasPerformerActivity(user: UserPerformanceSummary): boolean {
    return user.totalRewards > 0 || user.completedCases > 0 || user.rewardedTasks > 0;
  }

  private toDashboardPerformer(user: UserPerformanceSummary): DashboardPerformer {
    return {
      userId: user.userId,
      userName: user.userName,
      email: user.email,
      totalPoints: user.totalRewards,
      rmPoints: user.rmPoints,
      tasksCompleted: Math.max(user.completedCases, user.rewardedTasks),
      avgCompletionTime: user.avgCompletionTime,
      roles: user.roles,
    };
  }

  private buildTopPerformers(ranking: UserPerformanceSummary[], limit: number): DashboardPerformer[] {
    const normalizedLimit = Math.max(1, Math.min(limit, 50));

    return ranking
      .filter(user => isTopPerformerUser(user.roles))
      .filter(user => user.totalRewards > 0)
      .slice(0, normalizedLimit)
      .map(user => this.toDashboardPerformer(user));
  }

  private buildDepartmentPerformers(
    ranking: UserPerformanceSummary[],
    departmentRoles: ReadonlySet<string>,
    limit: number
  ): DashboardPerformer[] {
    const normalizedLimit = Math.max(1, Math.min(limit, 50));

    return ranking
      .filter(user => isTopPerformerUser(user.roles))
      .filter(user => hasAnyRole(user.roles, departmentRoles))
      .filter(user => this.hasPerformerActivity(user))
      .slice(0, normalizedLimit)
      .map(user => this.toDashboardPerformer(user));
  }

  private buildRelationshipManagerPerformers(ranking: UserPerformanceSummary[], limit: number): DashboardPerformer[] {
    const normalizedLimit = Math.max(1, Math.min(limit, 50));

    return ranking
      .filter(user => user.roles.includes('relationship_manager'))
      .filter(user => user.rmPoints > 0)
      .sort((a, b) => b.rmPoints - a.rmPoints || b.totalRewards - a.totalRewards || a.userName.localeCompare(b.userName))
      .slice(0, normalizedLimit)
      .map(user => this.toDashboardPerformer(user));
  }

  /**
   * Who handled which case steps and how long each took, plus where open cases are waiting.
   *
   * A step's handling time is the gap between the previous status change on the same case and the
   * user's own change, i.e. how long the case sat with them. Re-saves of an unchanged status are ignored.
   * Only users in a work bucket (credit / ops / finance queues) are counted as team members.
   */
  async getWorkflowActivity(): Promise<WorkflowActivity> {
    const staleBefore = new Date();
    staleBefore.setDate(staleBefore.getDate() - STALE_CASE_DAYS);

    const [stepRows, memberRows, bucketMappings, openRows] = await Promise.all([
      AppDataSource.query(`
        SELECT step.changedBy AS userId,
               COUNT(*) AS actions,
               SUM(TIMESTAMPDIFF(MINUTE, step.previousAt, step.createdAt)) AS totalMinutes
        FROM (
          SELECT history.changedBy,
                 history.status,
                 history.createdAt,
                 LAG(history.createdAt) OVER (PARTITION BY history.caseWorkflowId ORDER BY history.createdAt, history.id) AS previousAt,
                 LAG(history.status) OVER (PARTITION BY history.caseWorkflowId ORDER BY history.createdAt, history.id) AS previousStatus
          FROM case_status_history history
          WHERE history.caseWorkflowId IS NOT NULL
        ) step
        WHERE step.previousAt IS NOT NULL
          AND step.changedBy IS NOT NULL
          AND step.status <> step.previousStatus
        GROUP BY step.changedBy
      `),
      AppDataSource.query(`
        SELECT member.id AS userId, member.name AS userName, LOWER(role.name) AS roleName, mapping.bucketName
        FROM user_roles userRole
        INNER JOIN users member ON member.id = userRole.userId
        INNER JOIN roles role ON role.id = userRole.roleId
        LEFT JOIN task_bucket_mapping mapping ON mapping.roleId = userRole.roleId
        WHERE userRole.isActive = 1
      `),
      this.bucketMappingRepository.find({ relations: ['role'], order: { priority: 'ASC', id: 'ASC' } }),
      AppDataSource.query(
        `
        SELECT LOWER(workflow.currentApproverRoleName) AS approverRole,
               COUNT(*) AS openCases,
               SUM(CASE WHEN COALESCE(lastMove.lastAt, workflow.updatedAt) < ? THEN 1 ELSE 0 END) AS staleCases
        FROM case_workflows workflow
        LEFT JOIN (
          SELECT caseWorkflowId, MAX(createdAt) AS lastAt
          FROM case_status_history
          GROUP BY caseWorkflowId
        ) lastMove ON lastMove.caseWorkflowId = workflow.id
        WHERE workflow.isCompleted = 0 AND workflow.isRejected = 0
        GROUP BY LOWER(workflow.currentApproverRoleName)
        `,
        [staleBefore]
      ),
    ]);

    const bucketNames = Array.from(new Set(bucketMappings.map(mapping => mapping.bucketName)));
    const bucketByRole = new Map<string, string>();
    const bucketRoles = new Map<string, string[]>();
    bucketMappings.forEach(mapping => {
      const roleName = mapping.role?.name?.toLowerCase();
      if (roleName && !bucketByRole.has(roleName)) bucketByRole.set(roleName, mapping.bucketName);
      if (roleName) bucketRoles.set(mapping.bucketName, [...(bucketRoles.get(mapping.bucketName) || []), roleName]);
    });

    const members = new Map<number, { userName: string; roles: Set<string>; buckets: Set<string> }>();
    memberRows.forEach((row: any) => {
      const userId = toNumber(row.userId);
      const member = members.get(userId) || { userName: row.userName || 'Unknown', roles: new Set(), buckets: new Set() };
      member.roles.add(row.roleName);
      if (row.bucketName) member.buckets.add(row.bucketName);
      members.set(userId, member);
    });

    const bucketUserCounts = new Map<string, number>();
    members.forEach(member => {
      member.buckets.forEach(bucket => bucketUserCounts.set(bucket, (bucketUserCounts.get(bucket) || 0) + 1));
    });

    const users: ActivityUser[] = stepRows
      .map((row: any) => {
        const userId = toNumber(row.userId);
        const member = members.get(userId);
        return {
          userId,
          userName: member?.userName || 'Unknown',
          roles: Array.from(member?.roles || []),
          buckets: Array.from(member?.buckets || []),
          actions: toNumber(row.actions),
          totalMinutes: toNumber(row.totalMinutes),
        };
      })
      .filter((user: ActivityUser) => user.buckets.length > 0);

    const openByBucket = new Map<string, number>();
    let openCases = 0;
    let openWithTeams = 0;
    let staleCases = 0;
    openRows.forEach((row: any) => {
      const count = toNumber(row.openCases);
      openCases += count;
      staleCases += toNumber(row.staleCases);
      const approverRole = String(row.approverRole || '');
      const bucket = bucketByRole.get(APPROVER_ROLE_ALIASES[approverRole] || approverRole);
      if (bucket) {
        openWithTeams += count;
        openByBucket.set(bucket, (openByBucket.get(bucket) || 0) + count);
      }
    });

    return { users, bucketNames, bucketUserCounts, bucketRoles, openByBucket, openCases, openWithTeams, staleCases };
  }

  /**
   * Get complete dashboard overview
   */
  async getDashboardOverview(activity?: WorkflowActivity): Promise<{
    totalUsers: number;
    activeTasks: number;
    completedTasks: number;
    pendingTasks: number;
    averageCompletionTime: number | null;
    overdueTasks: number;
  }> {
    const [userCount, data] = await Promise.all([
      this.userRepository.count({ where: { isActive: true } }),
      activity ? Promise.resolve(activity) : this.getWorkflowActivity(),
    ]);

    const completedSteps = data.users.reduce((sum, user) => sum + user.actions, 0);
    const totalMinutes = data.users.reduce((sum, user) => sum + user.totalMinutes, 0);

    return {
      totalUsers: userCount,
      // Open cases sitting in a credit / ops / finance queue.
      activeTasks: data.openWithTeams,
      // Open cases waiting on someone outside those queues (RM, MD, customer…).
      pendingTasks: data.openCases - data.openWithTeams,
      // Case steps closed by team members.
      completedTasks: completedSteps,
      averageCompletionTime: completedSteps > 0 ? totalMinutes / completedSteps : null,
      // Open cases with no movement for STALE_CASE_DAYS.
      overdueTasks: data.staleCases,
    };
  }

  /**
   * Get top 10 performers
   */
  async getTopPerformers(limit: number = 10, period: DashboardPeriod = 'all'): Promise<DashboardPerformer[]> {
    const ranking = await this.getPerformanceRanking(period);
    return this.buildTopPerformers(ranking, limit);
  }

  /**
   * Get department-specific performer ranking for the dashboard card.
   */
  async getDepartmentPerformers(
    departmentRoles: ReadonlySet<string>,
    limit: number = 5,
    period: DashboardPeriod = 'all'
  ): Promise<DashboardPerformer[]> {
    const ranking = await this.getPerformanceRanking(period);
    return this.buildDepartmentPerformers(ranking, departmentRoles, limit);
  }

  /**
   * Get relationship-manager-only points ranking.
   */
  async getRelationshipManagerPerformers(limit: number = 10, period: DashboardPeriod = 'all'): Promise<DashboardPerformer[]> {
    const ranking = await this.getPerformanceRanking(period);
    return this.buildRelationshipManagerPerformers(ranking, limit);
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
  async getBucketPerformanceStats(activity?: WorkflowActivity): Promise<Array<{
    bucketName: string;
    totalTasks: number;
    completedTasks: number;
    pendingTasks: number;
    avgCompletionTime: number | null;
    userCount: number;
    roles: string[];
  }>> {
    const data = activity || (await this.getWorkflowActivity());

    const closed = new Map<string, { actions: number; minutes: number }>();
    data.users.forEach(user => {
      // A user in several buckets is counted once, under the first bucket in priority order.
      const bucket = data.bucketNames.find(name => user.buckets.includes(name));
      if (!bucket) return;
      const current = closed.get(bucket) || { actions: 0, minutes: 0 };
      current.actions += user.actions;
      current.minutes += user.totalMinutes;
      closed.set(bucket, current);
    });

    return data.bucketNames.map(bucketName => {
      const completedTasks = closed.get(bucketName)?.actions || 0;
      const pendingTasks = data.openByBucket.get(bucketName) || 0;

      return {
        bucketName,
        totalTasks: completedTasks + pendingTasks,
        completedTasks,
        pendingTasks,
        avgCompletionTime: completedTasks > 0 ? (closed.get(bucketName)?.minutes || 0) / completedTasks : null,
        userCount: data.bucketUserCounts.get(bucketName) || 0,
        roles: data.bucketRoles.get(bucketName) || [],
      };
    });
  }

  /**
   * Get L1 vs L2 processing comparison
   */
  async getL1L2ProcessingComparison(activity?: WorkflowActivity): Promise<{
    l1Stats: {
      avgTime: number | null;
      taskCount: number;
    };
    l2Stats: {
      avgTime: number | null;
      taskCount: number;
    };
  }> {
    const data = activity || (await this.getWorkflowActivity());
    const totals = { l1: { actions: 0, minutes: 0 }, l2: { actions: 0, minutes: 0 } };

    data.users.forEach(user => {
      // Anyone holding an L2 role acts as the L2 checker; otherwise an L1 role makes them L1.
      const level = user.roles.some(role => L2_ROLES.has(role))
        ? 'l2'
        : user.roles.some(role => L1_ROLES.has(role)) ? 'l1' : null;
      if (!level) return;
      totals[level].actions += user.actions;
      totals[level].minutes += user.totalMinutes;
    });

    const toStats = ({ actions, minutes }: { actions: number; minutes: number }) => ({
      avgTime: actions > 0 ? minutes / actions : null,
      taskCount: actions,
    });

    return { l1Stats: toStats(totals.l1), l2Stats: toStats(totals.l2) };
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
  async getFastestClosersRanking(limit: number = 10, activity?: WorkflowActivity) {
    return this.getCloserRanking('fastest', limit, activity);
  }

  /**
   * Get ranking: Slowest Closers
   */
  async getSlowestClosersRanking(limit: number = 10, activity?: WorkflowActivity) {
    return this.getCloserRanking('slowest', limit, activity);
  }

  /** Team members ranked by average handling time per case step (needs a minimum number of steps). */
  private async getCloserRanking(
    order: 'fastest' | 'slowest',
    limit: number,
    activity?: WorkflowActivity
  ): Promise<Array<{
    rank: number;
    userId: number;
    userName: string;
    avgCompletionTime: number;
    tasksCompleted: number;
  }>> {
    const data = activity || (await this.getWorkflowActivity());
    const direction = order === 'fastest' ? 1 : -1;

    return data.users
      .filter(user => user.actions >= MIN_ACTIONS_FOR_CLOSER_RANKING)
      .map(user => ({
        userId: user.userId,
        userName: user.userName,
        avgCompletionTime: user.totalMinutes / user.actions,
        tasksCompleted: user.actions,
      }))
      .sort((a, b) => direction * (a.avgCompletionTime - b.avgCompletionTime) || b.tasksCompleted - a.tasksCompleted)
      .slice(0, Math.max(1, limit))
      .map((user, index) => ({ rank: index + 1, ...user }));
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
    rmPoints: number;
  }>> {
    const normalizedLimit = Math.max(1, Math.min(limit, 50));
    const ranking = await userPerformanceService.getUserPerformanceList({
      limit: normalizedLimit,
      offset: 0,
      sortBy: 'totalRewards',
      sortOrder: 'DESC',
    });

    return ranking.data.map((user, index) => ({
      rank: index + 1,
      userId: user.userId,
      userName: user.userName || 'Unknown',
      // Same definition as the dashboard performer cards so the two never disagree.
      tasksCompleted: Math.max(user.completedCases, user.rewardedTasks),
      totalPoints: user.totalRewards,
      rmPoints: user.rmPoints,
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
        .andWhere('invoice.status NOT IN (:...statuses)', { statuses: NON_PIPELINE_INVOICE_STATUSES })
        .getRawOne(),
      this.invoiceRepository
        .createQueryBuilder('invoice')
        .select('COUNT(*)', 'count')
        .where('invoice.status IN (:...statuses)', { statuses: FINANCED_INVOICE_STATUSES })
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
    financedInvoiceAmount: number;
    disbursedInvoiceAmount: number;
    outstandingInvoiceAmount: number;
    averageInvoiceAmount: number;
    averageInterestRate: number;
  }> {
    const [sanctionRaw, loanRaw, disbursedRaw, invoiceRaw] = await Promise.all([
      this.creditSanctionRepository
        .createQueryBuilder('sanction')
        .select('COUNT(*)', 'sanctionCount')
        .addSelect("SUM(CASE WHEN LOWER(sanction.status) = 'approved' THEN 1 ELSE 0 END)", 'approvedSanctionCount')
        .addSelect("SUM(CASE WHEN LOWER(sanction.status) = 'approved' THEN sanction.sanctionAmount ELSE 0 END)", 'approvedSanctionAmount')
        .addSelect("AVG(CASE WHEN LOWER(sanction.status) = 'approved' THEN sanction.interestRate END)", 'averageInterestRate')
        .getRawOne(),
      // Utilization = principal still outstanding, taken from the LMS snapshot rather than the
      // cached loan_accounts columns, which can drift from the postings.
      this.loanAccountRepository
        .createQueryBuilder('loan')
        .leftJoin(LoanAccountSnapshot, 'snapshot', 'snapshot.loanAccountId = loan.id')
        .select('COUNT(loan.id)', 'loanAccounts')
        .addSelect('SUM(COALESCE(loan.sanctionedAmount, 0))', 'sanctionedBook')
        .addSelect('SUM(COALESCE(snapshot.principalOutstanding, 0))', 'utilizedLimit')
        .addSelect(
          'SUM(GREATEST(COALESCE(loan.sanctionedAmount, 0) - COALESCE(snapshot.principalOutstanding, 0), 0))',
          'unutilizedLimit'
        )
        .getRawOne(),
      this.disbursementRepository
        .createQueryBuilder('disbursement')
        .select('SUM(disbursement.disbursementAmount)', 'disbursedBook')
        .where('disbursement.status = :status', { status: DISBURSEMENT_STATUS.POSTED })
        .getRawOne(),
      this.invoiceRepository
        .createQueryBuilder('invoice')
        .select('SUM(COALESCE(invoice.invoiceAmount, 0))', 'totalInvoiceAmount')
        .addSelect(
          'SUM(CASE WHEN invoice.status IN (:...financed) THEN COALESCE(invoice.invoiceAmount, 0) ELSE 0 END)',
          'financedInvoiceAmount'
        )
        .addSelect(
          'SUM(CASE WHEN invoice.status NOT IN (:...nonPipeline) THEN COALESCE(invoice.invoiceAmount, 0) ELSE 0 END)',
          'outstandingInvoiceAmount'
        )
        .addSelect('AVG(invoice.invoiceAmount)', 'averageInvoiceAmount')
        .where("invoice.status <> 'DRAFT'")
        .setParameters({ financed: FINANCED_INVOICE_STATUSES, nonPipeline: NON_PIPELINE_INVOICE_STATUSES })
        .getRawOne(),
    ]);

    const loanSanctionedBook = toNumber(loanRaw?.sanctionedBook);
    const sanctionedBook = loanSanctionedBook || toNumber(sanctionRaw?.approvedSanctionAmount);
    const utilizedLimit = toNumber(loanRaw?.utilizedLimit);
    const disbursedBook = toNumber(disbursedRaw?.disbursedBook);

    return {
      sanctionCount: toNumber(sanctionRaw?.sanctionCount),
      approvedSanctionCount: toNumber(sanctionRaw?.approvedSanctionCount),
      approvedSanctionAmount: toNumber(sanctionRaw?.approvedSanctionAmount),
      loanAccounts: toNumber(loanRaw?.loanAccounts),
      sanctionedBook,
      disbursedBook,
      utilizedLimit,
      unutilizedLimit: loanSanctionedBook ? toNumber(loanRaw?.unutilizedLimit) : Math.max(sanctionedBook - utilizedLimit, 0),
      utilizationRate: sanctionedBook > 0 ? Math.round((utilizedLimit / sanctionedBook) * 100) : 0,
      totalInvoiceAmount: toNumber(invoiceRaw?.totalInvoiceAmount),
      financedInvoiceAmount: toNumber(invoiceRaw?.financedInvoiceAmount),
      disbursedInvoiceAmount: disbursedBook,
      outstandingInvoiceAmount: toNumber(invoiceRaw?.outstandingInvoiceAmount),
      averageInvoiceAmount: toNumber(invoiceRaw?.averageInvoiceAmount),
      averageInterestRate: toNumber(sanctionRaw?.averageInterestRate),
    };
  }

  /**
   * Get partner-wise sanction book from loan accounts.
   */
  async getPartnerSanctionStats(limit: number = 8) {
    const result = await this.getPartnerSanctionPage(1, limit);
    return result.rows;
  }

  /**
   * Partner-wise sanction book, one row per partner (or per legacy lender code when no partner is linked),
   * largest book first.
   */
  async getPartnerSanctionPage(page: number = 1, limit: number = 10): Promise<{
    rows: Array<{
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
    }>;
    totals: { sanctionedAmount: number };
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const normalizedLimit = Math.max(1, Math.min(Math.floor(limit) || 10, PARTNER_PAGE_MAX));
    const normalizedPage = Math.max(1, Math.floor(page) || 1);
    const groupKey = "COALESCE(CONCAT('partner:', partner.id), CONCAT('lender:', loan.lender), 'unassigned')";

    const baseQuery = () =>
      this.loanAccountRepository
        .createQueryBuilder('loan')
        .leftJoin('loan.partner', 'partner');

    const [rows, totalsRaw] = await Promise.all([
      baseQuery()
        .leftJoin(LoanAccountSnapshot, 'snapshot', 'snapshot.loanAccountId = loan.id')
        .leftJoin(
          subQuery => subQuery
            .select('d.loanAccountId', 'loanAccountId')
            .addSelect('SUM(d.disbursementAmount)', 'amount')
            .from(LoanDisbursement, 'd')
            .where('d.status = :postedStatus')
            .groupBy('d.loanAccountId'),
          'disbursed',
          'disbursed.loanAccountId = loan.id'
        )
        .setParameter('postedStatus', DISBURSEMENT_STATUS.POSTED)
        .select(groupKey, 'groupKey')
        .addSelect('MAX(partner.id)', 'partnerId')
        .addSelect("COALESCE(MAX(partner.name), MAX(loan.lender), 'Unassigned Partner')", 'partnerName')
        .addSelect("COALESCE(MAX(partner.code), MAX(loan.lender), 'NA')", 'partnerCode')
        .addSelect('COUNT(loan.id)', 'sanctionCount')
        .addSelect("SUM(CASE WHEN LOWER(loan.status) = 'active' THEN 1 ELSE 0 END)", 'activeAccounts')
        .addSelect('SUM(COALESCE(loan.sanctionedAmount, 0))', 'sanctionedAmount')
        .addSelect('SUM(COALESCE(disbursed.amount, 0))', 'disbursedAmount')
        .addSelect('SUM(COALESCE(snapshot.principalOutstanding, 0))', 'utilizedLimit')
        .addSelect(
          'SUM(GREATEST(COALESCE(loan.sanctionedAmount, 0) - COALESCE(snapshot.principalOutstanding, 0), 0))',
          'unutilizedLimit'
        )
        .addSelect('MAX(loan.createdAt)', 'lastCreatedAt')
        .groupBy(groupKey)
        .orderBy('sanctionedAmount', 'DESC')
        .addOrderBy('partnerName', 'ASC')
        .offset((normalizedPage - 1) * normalizedLimit)
        .limit(normalizedLimit)
        .getRawMany(),
      baseQuery()
        .select(`COUNT(DISTINCT ${groupKey})`, 'total')
        .addSelect('SUM(COALESCE(loan.sanctionedAmount, 0))', 'sanctionedAmount')
        .getRawOne(),
    ]);

    const total = toNumber(totalsRaw?.total);

    return {
      rows: rows.map(row => {
        const sanctionedAmount = toNumber(row.sanctionedAmount);
        const utilizedLimit = toNumber(row.utilizedLimit);

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
      }),
      totals: { sanctionedAmount: toNumber(totalsRaw?.sanctionedAmount) },
      pagination: {
        page: normalizedPage,
        limit: normalizedLimit,
        total,
        totalPages: Math.max(1, Math.ceil(total / normalizedLimit)),
      },
    };
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

  /**
   * Where open cases are sitting right now: counts per department (RM / Credit / Ops / ...).
   */
  async getCasePipeline(): Promise<{
    totalOpen: number;
    totalStale: number;
    staleAfterDays: number;
    departments: Array<{ key: CaseDepartment; label: string; openCases: number; staleCases: number }>;
  }> {
    const staleBefore = new Date();
    staleBefore.setDate(staleBefore.getDate() - STALE_CASE_DAYS);

    const rows = await AppDataSource.query(
      `
      SELECT UPPER(TRIM(COALESCE(workflow.currentApproverRoleName, ''))) AS approverRole,
             LOWER(TRIM(COALESCE(workflow.currentStatus, ''))) AS currentStatus,
             UPPER(TRIM(COALESCE(workflow.workflowType, ''))) AS workflowType,
             COUNT(*) AS openCases,
             SUM(CASE WHEN COALESCE(lastMove.lastAt, workflow.updatedAt) < ? THEN 1 ELSE 0 END) AS staleCases
      FROM case_workflows workflow
      LEFT JOIN (
        SELECT caseWorkflowId, MAX(createdAt) AS lastAt
        FROM case_status_history
        GROUP BY caseWorkflowId
      ) lastMove ON lastMove.caseWorkflowId = workflow.id
      WHERE workflow.isCompleted = 0 AND workflow.isRejected = 0
      GROUP BY approverRole, currentStatus, workflowType
      `,
      [staleBefore]
    );

    const totals = new Map(CASE_DEPARTMENTS.map(dept => [dept.key, { openCases: 0, staleCases: 0 }]));
    rows.forEach((row: any) => {
      // Some writers store several roles comma-separated; the first one is the current approver.
      const role = String(row.approverRole || '').split(',')[0].trim();
      if (CLOSED_APPROVER_ROLES.has(role)) return;

      const department = getApproverDepartment(role);
      const status = String(row.currentStatus || '');
      const workflowType = String(row.workflowType || '');
      if (department === 'rm' && ['credit_l2_approved', 'md_approved'].includes(status)) return;
      if (department === 'operations' && workflowType !== 'CUSTOMER_ONBOARDING') return;

      const total = totals.get(department)!;
      total.openCases += toNumber(row.openCases);
      total.staleCases += toNumber(row.staleCases);
    });

    const departments = CASE_DEPARTMENTS
      .map(({ key, label }) => ({ key, label, ...totals.get(key)! }))
      .filter(dept => dept.openCases > 0 || !['on_hold', 'other', 'customer'].includes(dept.key));

    return {
      totalOpen: departments.reduce((sum, dept) => sum + dept.openCases, 0),
      totalStale: departments.reduce((sum, dept) => sum + dept.staleCases, 0),
      staleAfterDays: STALE_CASE_DAYS,
      departments,
    };
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
        .andWhere("invoice.status <> 'DRAFT'")
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
  async getPeriodActivity(period: DashboardPeriod = 30): Promise<{
    days: number | null;
    period: 'all_time' | 'last_n_days';
    label: string;
    newCustomers: number;
    newSuppliers: number;
    newInvoices: number;
    invoiceAmount: number;
    disbursedAmount: number;
    completedWorkflows: number;
    rejectedWorkflows: number;
  }> {
    const isAllTime = period === 'all';
    const normalizedDays = isAllTime ? null : Math.max(1, Math.min(period, 365));
    const since = normalizedDays ? getPeriodStart(normalizedDays) : null;
    const sinceDate = since ? toDateKey(since) : null;

    const customerQuery = this.customerRepository
      .createQueryBuilder('customer')
      .select('COUNT(*)', 'count');

    const supplierQuery = this.supplierRepository
      .createQueryBuilder('supplier')
      .select('COUNT(*)', 'count');

    const invoiceQuery = this.invoiceRepository
      .createQueryBuilder('invoice')
      .select('COUNT(*)', 'count')
      .addSelect('SUM(COALESCE(invoice.invoiceAmount, 0))', 'invoiceAmount')
      .where("invoice.status <> 'DRAFT'");

    // Money actually paid out in the window, by disbursement date — not invoices created in the window.
    const disbursementQuery = this.disbursementRepository
      .createQueryBuilder('disbursement')
      .select('SUM(disbursement.disbursementAmount)', 'amount')
      .where('disbursement.status = :status', { status: DISBURSEMENT_STATUS.POSTED });

    // Outcomes are dated by when the decision happened; updatedAt moves on any later edit.
    const completedOn = 'COALESCE(workflow.completedDate, DATE(workflow.updatedAt))';
    const rejectedOn = 'COALESCE(workflow.rejectedDate, DATE(workflow.updatedAt))';
    const workflowQuery = this.caseWorkflowRepository
      .createQueryBuilder('workflow')
      .select(
        sinceDate
          ? `SUM(CASE WHEN workflow.isCompleted = true AND ${completedOn} >= :sinceDate THEN 1 ELSE 0 END)`
          : 'SUM(CASE WHEN workflow.isCompleted = true THEN 1 ELSE 0 END)',
        'completed'
      )
      .addSelect(
        sinceDate
          ? `SUM(CASE WHEN workflow.isRejected = true AND ${rejectedOn} >= :sinceDate THEN 1 ELSE 0 END)`
          : 'SUM(CASE WHEN workflow.isRejected = true THEN 1 ELSE 0 END)',
        'rejected'
      );

    if (since && sinceDate) {
      customerQuery.where('customer.createdAt >= :since', { since });
      supplierQuery.where('supplier.createdAt >= :since', { since });
      invoiceQuery.andWhere('invoice.createdAt >= :since', { since });
      disbursementQuery.andWhere('disbursement.disbursementDate >= :sinceDate', { sinceDate });
      workflowQuery.setParameter('sinceDate', sinceDate);
    }

    const [
      newCustomersRaw,
      newSuppliersRaw,
      invoiceRaw,
      disbursementRaw,
      workflowRaw,
    ] = await Promise.all([
      customerQuery.getRawOne(),
      supplierQuery.getRawOne(),
      invoiceQuery.getRawOne(),
      disbursementQuery.getRawOne(),
      workflowQuery.getRawOne(),
    ]);

    return {
      days: normalizedDays,
      period: isAllTime ? 'all_time' : 'last_n_days',
      label: isAllTime ? 'All time' : `Last ${normalizedDays} days`,
      newCustomers: toNumber(newCustomersRaw?.count),
      newSuppliers: toNumber(newSuppliersRaw?.count),
      newInvoices: toNumber(invoiceRaw?.count),
      invoiceAmount: toNumber(invoiceRaw?.invoiceAmount),
      disbursedAmount: toNumber(disbursementRaw?.amount),
      completedWorkflows: toNumber(workflowRaw?.completed),
      rejectedWorkflows: toNumber(workflowRaw?.rejected),
    };
  }

  /**
   * Get complete analytics for SUPERADMIN dashboard
   */
  async getCompleteAnalytics(period: DashboardPeriod = 30): Promise<{
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
      rmPoints: number;
      tasksCompleted: number;
      roles: string[];
    }>;
    creditPerformers: Array<{
      userId: number;
      userName: string;
      totalPoints: number;
      rmPoints: number;
      tasksCompleted: number;
      roles: string[];
    }>;
    opsPerformers: Array<{
      userId: number;
      userName: string;
      totalPoints: number;
      rmPoints: number;
      tasksCompleted: number;
      roles: string[];
    }>;
    rmPerformers: Array<{
      userId: number;
      userName: string;
      totalPoints: number;
      rmPoints: number;
      tasksCompleted: number;
      roles: string[];
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
      totalPoints: number;
      rmPoints: number;
    }>;
    businessOverview: Awaited<ReturnType<SuperAdminAnalyticsService['getBusinessOverview']>>;
    financialSnapshot: Awaited<ReturnType<SuperAdminAnalyticsService['getFinancialSnapshot']>>;
    workflowPipeline: Awaited<ReturnType<SuperAdminAnalyticsService['getWorkflowPipeline']>>;
    casePipeline: Awaited<ReturnType<SuperAdminAnalyticsService['getCasePipeline']>>;
    statusBreakdowns: Awaited<ReturnType<SuperAdminAnalyticsService['getStatusBreakdowns']>>;
    recentCases: Awaited<ReturnType<SuperAdminAnalyticsService['getRecentCases']>>;
    monthlyTrend: Awaited<ReturnType<SuperAdminAnalyticsService['getMonthlyTrend']>>;
    periodActivity: Awaited<ReturnType<SuperAdminAnalyticsService['getPeriodActivity']>>;
    roleDistribution: Awaited<ReturnType<SuperAdminAnalyticsService['getRoleDistribution']>>;
    partnerSanctionStats: Awaited<ReturnType<SuperAdminAnalyticsService['getPartnerSanctionStats']>>;
  }> {
    // One pass over case history feeds every team-efficiency panel.
    const activityPromise = this.getWorkflowActivity();

    const [
      overview,
      performanceRanking,
      lowestPerformers,
      bucketStats,
      l1L2Comparison,
      fastestClosers,
      slowestClosers,
      productivityRanking,
      businessOverview,
      financialSnapshot,
      workflowPipeline,
      casePipeline,
      statusBreakdowns,
      recentCases,
      monthlyTrend,
      periodActivity,
      roleDistribution,
      partnerSanctionStats,
    ] = await Promise.all([
      activityPromise.then(activity => this.getDashboardOverview(activity)),
      this.getPerformanceRanking(period),
      this.getLowestPerformers(10),
      activityPromise.then(activity => this.getBucketPerformanceStats(activity)),
      activityPromise.then(activity => this.getL1L2ProcessingComparison(activity)),
      activityPromise.then(activity => this.getFastestClosersRanking(10, activity)),
      activityPromise.then(activity => this.getSlowestClosersRanking(10, activity)),
      this.getHighestProductivityRanking(10),
      this.getBusinessOverview(),
      this.getFinancialSnapshot(),
      this.getWorkflowPipeline(),
      this.getCasePipeline(),
      this.getStatusBreakdowns(),
      this.getRecentCases(8),
      this.getMonthlyTrend(6),
      this.getPeriodActivity(period),
      this.getRoleDistribution(),
      this.getPartnerSanctionStats(8),
    ]);

    const topPerformers = this.buildTopPerformers(performanceRanking, 10);
    const creditPerformers = this.buildDepartmentPerformers(performanceRanking, CREDIT_PERFORMER_ROLES, 5);
    const opsPerformers = this.buildDepartmentPerformers(performanceRanking, OPS_PERFORMER_ROLES, 5);
    const rmPerformers = this.buildRelationshipManagerPerformers(performanceRanking, 10);

    return {
      overview,
      topPerformers,
      creditPerformers,
      opsPerformers,
      rmPerformers,
      lowestPerformers,
      bucketStats,
      l1L2Comparison,
      fastestClosers,
      slowestClosers,
      productivityRanking,
      businessOverview,
      financialSnapshot,
      workflowPipeline,
      casePipeline,
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
