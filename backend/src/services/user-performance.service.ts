import { AppDataSource } from '../config/database';
import { TaskTimeTracking } from '../entities/TaskTimeTracking';
import { RewardPoint } from '../entities/RewardPoint';
import { User } from '../entities/User';
import { UserRole } from '../entities/UserRole';
import { Role } from '../entities/Role';
import { CaseWorkflow } from '../entities/CaseWorkflow';
import { Customer } from '../entities/Customer';
import { LoanAccount } from '../entities/LoanAccount';
import { Repository } from 'typeorm';

// Stage/steps mapping based on bucket field
const STAGE_MAPPING: Record<string, string> = {
  'credit_l1': 'credit_l1',
  'credit_l2': 'credit_l2',
  'ps_l1': 'ps_l1',
  'ps_l2': 'ps_l2',
  'ops_l1': 'ops_l1',
  'ops_l2': 'ops_l2',
  'ops_head': 'ops_head',
  'rm': 'rm',
};

const PERFORMANCE_STAGES = Object.keys(STAGE_MAPPING);

const REPORT_REWARD_POINTS = {
  FAST: 5,
  MEDIUM: 3,
  SLOW: 1,
};

const toNumber = (value: string | number | null | undefined): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

// Performance score calculation weights
const SCORE_WEIGHTS = {
  COMPLETION_RATE: 40,    // Weight for completion rate
  AVG_TIME: 35,           // Weight for average completion time (faster = better)
  REWARD_POINTS: 25,      // Weight for reward points earned
};

// Valid roles for performance tracking (ops, credit, rm)
// Updated: Include all operational roles EXCEPT Admin and SuperAdmin
const VALID_ROLES = [
  'operations_team_l1',
  'operations_team_l2', 
  'operations_head',
  'credit_team_l1',
  'credit_team_l2',
  'credit_head',
  'relationship_manager',
  'ceo',
  'md',
];

const TOP_PERFORMER_ROLES = new Set([
  'operations_team_l1',
  'operations_team_l2',
  'operations_head',
  'credit_team_l1',
  'credit_team_l2',
  'credit_head',
]);

const TOP_PERFORMER_EXCLUDED_ROLES = new Set([
  'relationship_manager',
  'ceo',
  'md',
  'admin',
  'superadmin',
]);

// Roles EXCLUDED from time tracking
const EXCLUDED_ROLES = ['admin', 'superadmin'];

const LEGACY_TASK_STATUSES = new Set(['pending', 'in_progress', 'completed', 'overdue', 'rejected']);

/**
 * Check if timing should be calculated for a role
 * @param roleName - The role name to check
 * @returns true if timing should be calculated
 */
function shouldCalculateTimingForRole(roleName: string): boolean {
  const normalizedRole = roleName.toLowerCase();
  // Don't calculate timing for Admin or SuperAdmin
  if (EXCLUDED_ROLES.includes(normalizedRole)) {
    return false;
  }
  // Calculate timing for all operational roles
  return true;
}

export interface PerformanceFilters {
  startDate?: Date;
  endDate?: Date;
  stage?: string;
  userId?: number;
}

export interface StagePerformance {
  stage: string;
  stageLabel: string;
  totalAssigned: number;
  completedCases: number;
  pendingCases: number;
  avgCompletionTime: number | null;
  totalCompletionTime: number | null;
  rewardsEarned: number;
}

export interface UserPerformanceSummary {
  userId: number;
  userName: string;
  email: string;
  roles: string[];
  primaryRole: string;
  totalCases: number;
  completedCases: number;
  pendingCases: number;
  inProgressCases: number;
  rejectedCases: number;
  totalRewards: number;
  rewardedTasks: number;
  rmPoints: number;
  avgCompletionTime: number | null;
  totalCompletionTime: number | null;
  efficiencyScore: number;
  stagePerformance: StagePerformance[];
}

export interface OverallPerformanceSummary {
  totalUsersTracked: number;
  totalCompletedCases: number;
  totalRewardsDistributed: number;
  avgCompletionTime: number | null;
  topPerformers: Array<{
    userId: number;
    userName: string;
    efficiencyScore: number;
    totalRewards: number;
    completedCases: number;
    rewardedTasks: number;
    rmPoints: number;
    roles: string[];
  }>;
}

const hasTopPerformerRole = (roles: string[]): boolean =>
  roles.some(role => TOP_PERFORMER_ROLES.has(role)) &&
  !roles.some(role => TOP_PERFORMER_EXCLUDED_ROLES.has(role));

/**
 * User Performance Service
 * Calculates and aggregates user performance metrics
 */
export class UserPerformanceService {
  private taskTimeTrackingRepository: Repository<TaskTimeTracking>;
  private rewardPointRepository: Repository<RewardPoint>;
  private userRepository: Repository<User>;
  private userRoleRepository: Repository<UserRole>;
  private roleRepository: Repository<Role>;
  private caseWorkflowRepository: Repository<CaseWorkflow>;
  private customerRepository: Repository<Customer>;
  private loanAccountRepository: Repository<LoanAccount>;

  constructor() {
    this.taskTimeTrackingRepository = AppDataSource.getRepository(TaskTimeTracking);
    this.rewardPointRepository = AppDataSource.getRepository(RewardPoint);
    this.userRepository = AppDataSource.getRepository(User);
    this.userRoleRepository = AppDataSource.getRepository(UserRole);
    this.roleRepository = AppDataSource.getRepository(Role);
    this.caseWorkflowRepository = AppDataSource.getRepository(CaseWorkflow);
    this.customerRepository = AppDataSource.getRepository(Customer);
    this.loanAccountRepository = AppDataSource.getRepository(LoanAccount);
  }

  /**
   * Get overall performance summary for superadmin dashboard
   */
   async getOverallSummary(): Promise<OverallPerformanceSummary> {
    // Count eligible active users first, even if they do not have tracking rows yet.
    const userStats = await this.userRepository
      .createQueryBuilder('user')
      .innerJoin('user.userRoles', 'ur')
      .innerJoin('ur.role', 'role')
      .where('role.name IN (:...validRoles)', { validRoles: VALID_ROLES })
      .andWhere('ur.isActive = :isActive', { isActive: true })
      .andWhere('user.isActive = :userActive', { userActive: true })
      .select('COUNT(DISTINCT user.id)', 'totalUsers')
      .getRawOne();

    // Workflows are the canonical case lifecycle; task tracking is optional timing metadata.
    const workflowCompletionStats = await this.caseWorkflowRepository
      .createQueryBuilder('workflow')
      .select('COUNT(*)', 'totalCompleted')
      .addSelect(
        'AVG(GREATEST(1, TIMESTAMPDIFF(MINUTE, workflow.createdAt, COALESCE(workflow.completedDate, workflow.updatedAt))))',
        'avgTime'
      )
      .where('(workflow.isCompleted = true OR LOWER(workflow.currentStatus) IN (:...completedStatuses))', {
        completedStatuses: ['completed', 'disbursed'],
      })
      .andWhere('workflow.createdAt IS NOT NULL')
      .getRawOne();

    // Keep timing rows as a fallback for older records without workflow completion dates.
    const trackingCompletionStats = await this.taskTimeTrackingRepository
      .createQueryBuilder('tracking')
      .innerJoin('tracking.user', 'user')
      .innerJoin('user.userRoles', 'ur')
      .innerJoin('ur.role', 'role')
      .where('role.name IN (:...validRoles)', { validRoles: VALID_ROLES })
      .andWhere('ur.isActive = :isActive', { isActive: true })
      .andWhere('tracking.status = :status', { status: 'completed' })
      .andWhere('tracking.totalCompletionTimeMinutes IS NOT NULL')
      .select('COUNT(*)', 'totalCompleted')
      .addSelect('AVG(tracking.totalCompletionTimeMinutes)', 'avgTime')
      .getRawOne();

    const performanceUsers = await this.getUserPerformanceList({
      limit: 10000,
      offset: 0,
      sortBy: 'efficiencyScore',
      sortOrder: 'DESC',
    });

    const totalRewardsDistributed = performanceUsers.data.reduce(
      (sum, user) => sum + user.totalRewards,
      0
    );

    const topPerformers = performanceUsers.data
      .filter(user => hasTopPerformerRole(user.roles))
      .filter(user => user.totalRewards > 0)
      .slice(0, 5)
      .map(user => ({
        userId: user.userId,
        userName: user.userName,
        efficiencyScore: user.efficiencyScore,
        totalRewards: user.totalRewards,
        completedCases: Math.max(user.completedCases, user.rewardedTasks),
        rewardedTasks: user.rewardedTasks,
        rmPoints: 0,
        roles: user.roles,
      }));

    return {
      totalUsersTracked: parseInt(userStats?.totalUsers) || 0,
      totalCompletedCases:
        parseInt(workflowCompletionStats?.totalCompleted) ||
        parseInt(trackingCompletionStats?.totalCompleted) ||
        0,
      totalRewardsDistributed,
      avgCompletionTime:
        workflowCompletionStats?.avgTime
          ? parseFloat(workflowCompletionStats.avgTime)
          : trackingCompletionStats?.avgTime
          ? parseFloat(trackingCompletionStats.avgTime)
          : null,
      topPerformers,
    };
  }

  /**
   * Get user performance list with filters
   */
  async getUserPerformanceList(filters: PerformanceFilters & {
    limit?: number;
    offset?: number;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
  }): Promise<{
    data: UserPerformanceSummary[];
    total: number;
  }> {
    const { startDate, endDate, stage, userId, limit = 20, offset = 0, sortBy = 'efficiencyScore', sortOrder = 'DESC' } = filters;

    // Start with active users who have performance roles. Tracking rows are optional.
    const eligibleUsersQuery = this.userRepository
      .createQueryBuilder('user')
      .innerJoin('user.userRoles', 'ur')
      .innerJoin('ur.role', 'role')
      .select('user.id', 'userId')
      .addSelect('user.name', 'userName')
      .addSelect('user.email', 'email')
      .where('role.name IN (:...validRoles)', { validRoles: VALID_ROLES })
      .andWhere('ur.isActive = :isActive', { isActive: true })
      .andWhere('user.isActive = :userActive', { userActive: true });

    if (userId) {
      eligibleUsersQuery.andWhere('user.id = :userId', { userId });
    }

    const eligibleUsers = await eligibleUsersQuery
      .groupBy('user.id')
      .addGroupBy('user.name')
      .addGroupBy('user.email')
      .getRawMany();

    const userIds = eligibleUsers.map(u => parseInt(u.userId));

    if (userIds.length === 0) {
      return { data: [], total: 0 };
    }

    const relationshipManagerRows = await this.userRoleRepository
      .createQueryBuilder('ur')
      .select('ur.userId', 'userId')
      .innerJoin('ur.role', 'role')
      .where('ur.userId IN (:...userIds)', { userIds })
      .andWhere('ur.isActive = :isActive', { isActive: true })
      .andWhere('role.name = :roleName', { roleName: 'relationship_manager' })
      .getRawMany();

    const relationshipManagerUserIds = new Set(
      relationshipManagerRows.map(row => parseInt(row.userId))
    );

    const trackingStatsQuery = this.taskTimeTrackingRepository
      .createQueryBuilder('tracking')
      .select('tracking.userId', 'userId')
      .addSelect('COUNT(*)', 'totalCases')
      .addSelect('SUM(CASE WHEN tracking.status = \'completed\' THEN 1 ELSE 0 END)', 'completedCases')
      .addSelect('SUM(CASE WHEN tracking.status = \'pending\' THEN 1 ELSE 0 END)', 'pendingCases')
      .addSelect('SUM(CASE WHEN tracking.status = \'in_progress\' THEN 1 ELSE 0 END)', 'inProgressCases')
      .addSelect('SUM(CASE WHEN tracking.status = \'rejected\' THEN 1 ELSE 0 END)', 'rejectedCases')
      .addSelect('AVG(tracking.totalCompletionTimeMinutes)', 'avgCompletionTime')
      .addSelect('SUM(tracking.totalCompletionTimeMinutes)', 'totalCompletionTime')
      .where('tracking.userId IN (:...userIds)', { userIds });

    if (startDate) {
      trackingStatsQuery.andWhere('tracking.assignedAt >= :startDate', { startDate });
    }
    if (endDate) {
      trackingStatsQuery.andWhere('tracking.assignedAt <= :endDate', { endDate });
    }
    if (stage) {
      trackingStatsQuery.andWhere('tracking.bucket = :stage', { stage });
    }

    const userStats = await trackingStatsQuery
      .groupBy('tracking.userId')
      .getRawMany();

    const statsMap: Record<number, any> = {};
    userStats.forEach(stat => {
      statsMap[parseInt(stat.userId)] = stat;
    });

    const workflowRows = await this.caseWorkflowRepository
      .createQueryBuilder('workflow')
      .select('workflow.id', 'id')
      .addSelect('workflow.assignedUserId', 'assignedUserId')
      .addSelect('workflow.currentStatus', 'currentStatus')
      .addSelect('workflow.currentApproverRoleName', 'currentApproverRoleName')
      .addSelect('workflow.assignedStage', 'assignedStage')
      .addSelect('workflow.isCompleted', 'isCompleted')
      .addSelect('workflow.isRejected', 'isRejected')
      .addSelect('workflow.createdAt', 'createdAt')
      .addSelect('workflow.updatedAt', 'updatedAt')
      .addSelect('workflow.completedDate', 'completedDate')
      .addSelect('customer.rmId', 'customerRmId')
      .addSelect('supplier.createdByUserId', 'supplierCreatedByUserId')
      .addSelect('invoice.createdByUserId', 'invoiceCreatedByUserId')
      .leftJoin('workflow.customer', 'customer')
      .leftJoin('workflow.supplier', 'supplier')
      .leftJoin('workflow.invoice', 'invoice')
      .where(
        '(workflow.assignedUserId IN (:...userIds) OR customer.rmId IN (:...userIds) OR supplier.createdByUserId IN (:...userIds) OR invoice.createdByUserId IN (:...userIds))',
        { userIds }
      )
      .getRawMany();

    const workflowStatsMap: Record<number, {
      totalCases: number;
      completedCases: number;
      pendingCases: number;
      inProgressCases: number;
      rejectedCases: number;
      totalCompletionTime: number;
      completedWithTime: number;
      rmPoints: number;
    }> = {};

    const seenWorkflowCredits = new Set<string>();

    const addWorkflowStats = (row: any, currentUserId: number, creditStage: string, isRmCredit = false) => {
      const createdAt = row.createdAt ? new Date(row.createdAt) : null;

      if (!currentUserId || !userIds.includes(currentUserId)) return;
      if (stage && creditStage !== stage) return;
      if (startDate && createdAt && createdAt.getTime() < startDate.getTime()) return;
      if (endDate && createdAt && createdAt.getTime() > endDate.getTime()) return;

      const isCompleted = this.isWorkflowCompleted(row.currentStatus, Boolean(row.isCompleted));
      const isRejected = this.isWorkflowRejected(row.currentStatus, Boolean(row.isRejected));
      const duration = isCompleted
        ? this.getWorkflowDurationMinutes(row.createdAt, row.completedDate, row.updatedAt)
        : null;

      if (!workflowStatsMap[currentUserId]) {
        workflowStatsMap[currentUserId] = {
          totalCases: 0,
          completedCases: 0,
          pendingCases: 0,
          inProgressCases: 0,
          rejectedCases: 0,
          totalCompletionTime: 0,
          completedWithTime: 0,
          rmPoints: 0,
        };
      }

      const dedupeKey = `${currentUserId}:${row.id}:${creditStage}`;
      if (seenWorkflowCredits.has(dedupeKey)) {
        if (isRmCredit && isCompleted) {
          workflowStatsMap[currentUserId].rmPoints += this.getReportPointsForCompletionTime(duration);
        }
        return;
      }
      seenWorkflowCredits.add(dedupeKey);

      workflowStatsMap[currentUserId].totalCases += 1;
      if (isCompleted) workflowStatsMap[currentUserId].completedCases += 1;
      else if (isRejected) workflowStatsMap[currentUserId].rejectedCases += 1;
      else workflowStatsMap[currentUserId].pendingCases += 1;

      if (!isCompleted && !isRejected) {
        workflowStatsMap[currentUserId].inProgressCases += 1;
      }

      if (duration !== null) {
        workflowStatsMap[currentUserId].totalCompletionTime += duration;
        workflowStatsMap[currentUserId].completedWithTime += 1;
      }

      if (isRmCredit && isCompleted) {
        workflowStatsMap[currentUserId].rmPoints += this.getReportPointsForCompletionTime(duration);
      }
    };

    workflowRows.forEach(row => {
      const assignedUserId = parseInt(row.assignedUserId);
      const workflowStage = this.getStageFromWorkflowStatus(row.currentStatus, row.currentApproverRoleName) || row.assignedStage || 'unknown';
      const rmOwnerUserId =
        toNumber(row.customerRmId) ||
        toNumber(row.supplierCreatedByUserId) ||
        toNumber(row.invoiceCreatedByUserId);

      addWorkflowStats(row, assignedUserId, workflowStage);
      if (relationshipManagerUserIds.has(rmOwnerUserId)) {
        addWorkflowStats(row, rmOwnerUserId, 'rm', true);
      }
    });

    let rewardMap: Record<number, number> = {};
    let rmRewardMap: Record<number, number> = {};
    let rewardTaskMap: Record<number, number> = {};
    const rewardQuery = this.rewardPointRepository
      .createQueryBuilder('reward')
      .select('reward.userId', 'userId')
      .addSelect('SUM(reward.points)', 'totalRewards')
      .addSelect("SUM(CASE WHEN reward.bucket = 'rm' THEN reward.points ELSE 0 END)", 'rmRewards')
      .addSelect('COUNT(*)', 'rewardedTasks')
      .where('reward.userId IN (:...userIds)', { userIds });

    const rewardTaskQuery = this.rewardPointRepository
      .createQueryBuilder('reward')
      .select('reward.userId', 'userId')
      .addSelect('reward.taskId', 'taskId')
      .where('reward.userId IN (:...userIds)', { userIds });

    const trackingRewardQuery = this.taskTimeTrackingRepository
      .createQueryBuilder('tracking')
      .select('tracking.userId', 'userId')
      .addSelect('tracking.taskId', 'taskId')
      .addSelect('tracking.bucket', 'bucket')
      .addSelect('tracking.totalCompletionTimeMinutes', 'completionTimeMinutes')
      .where('tracking.userId IN (:...userIds)', { userIds })
      .andWhere('tracking.status = :completedStatus', { completedStatus: 'completed' });

    if (startDate) {
      rewardQuery.andWhere('reward.awardedAt >= :startDate', { startDate });
      rewardTaskQuery.andWhere('reward.awardedAt >= :startDate', { startDate });
      trackingRewardQuery.andWhere('tracking.assignedAt >= :startDate', { startDate });
    }
    if (endDate) {
      rewardQuery.andWhere('reward.awardedAt <= :endDate', { endDate });
      rewardTaskQuery.andWhere('reward.awardedAt <= :endDate', { endDate });
      trackingRewardQuery.andWhere('tracking.assignedAt <= :endDate', { endDate });
    }
    if (stage) {
      rewardQuery.andWhere('reward.bucket = :stage', { stage });
      rewardTaskQuery.andWhere('reward.bucket = :stage', { stage });
      trackingRewardQuery.andWhere('tracking.bucket = :stage', { stage });
    }

    const [
      rewards,
      rewardTaskRows,
      trackingRewardRows,
    ] = await Promise.all([
      rewardQuery
        .groupBy('reward.userId')
        .getRawMany(),
      rewardTaskQuery.getRawMany(),
      trackingRewardQuery.getRawMany(),
    ]);

    rewards.forEach(r => {
      rewardMap[parseInt(r.userId)] = parseInt(r.totalRewards) || 0;
      rmRewardMap[parseInt(r.userId)] = parseInt(r.rmRewards) || 0;
      rewardTaskMap[parseInt(r.userId)] = parseInt(r.rewardedTasks) || 0;
    });

    const rewardedTaskKeys = new Set<string>();
    rewardTaskRows.forEach(r => {
      const currentUserId = parseInt(r.userId);
      if (!currentUserId || !r.taskId) return;
      rewardedTaskKeys.add(`${currentUserId}:${r.taskId}`);
    });

    const derivedTrackingRewardMap: Record<number, number> = {};
    const derivedTrackingRewardTaskMap: Record<number, number> = {};
    const seenTrackingRewardKeys = new Set<string>();

    trackingRewardRows.forEach(r => {
      const currentUserId = parseInt(r.userId);
      if (!currentUserId || !r.taskId || relationshipManagerUserIds.has(currentUserId)) return;

      const rewardKey = `${currentUserId}:${r.taskId}`;
      if (rewardedTaskKeys.has(rewardKey) || seenTrackingRewardKeys.has(rewardKey)) return;
      seenTrackingRewardKeys.add(rewardKey);

      const points = this.getReportPointsForCompletionTime(toNumber(r.completionTimeMinutes) || null);
      derivedTrackingRewardMap[currentUserId] = (derivedTrackingRewardMap[currentUserId] || 0) + points;
      derivedTrackingRewardTaskMap[currentUserId] = (derivedTrackingRewardTaskMap[currentUserId] || 0) + 1;
    });

    // Get user roles
    let rolesMap: Record<number, string[]> = {};
    const userRoles = await this.userRoleRepository
      .createQueryBuilder('ur')
      .select('ur.userId', 'userId')
      .addSelect('r.name', 'roleName')
      .innerJoin('ur.role', 'r')
      .where('ur.userId IN (:...userIds)', { userIds })
      .andWhere('ur.isActive = :isActive', { isActive: true })
      .getRawMany();

    userRoles.forEach(ur => {
      if (!rolesMap[parseInt(ur.userId)]) {
        rolesMap[parseInt(ur.userId)] = [];
      }
      rolesMap[parseInt(ur.userId)].push(ur.roleName);
    });

    // Build final results with performance scores
    const results: UserPerformanceSummary[] = eligibleUsers.map(user => {
      const currentUserId = parseInt(user.userId);
      const stat = statsMap[currentUserId] || {};
      const workflowStats = workflowStatsMap[currentUserId];
      const trackingCompletedCases = parseInt(stat.completedCases) || 0;
      const trackingTotalCases = parseInt(stat.totalCases) || 0;
      const trackingPendingCases = parseInt(stat.pendingCases) || 0;
      const trackingInProgressCases = parseInt(stat.inProgressCases) || 0;
      const trackingRejectedCases = parseInt(stat.rejectedCases) || 0;
      const trackingTotalCompletionTime = stat.totalCompletionTime ? parseFloat(stat.totalCompletionTime) : 0;
      const trackingAvgTime = stat.avgCompletionTime ? parseFloat(stat.avgCompletionTime) : null;
      const workflowCompletedCases = workflowStats?.completedCases || 0;
      const workflowTotalCases = workflowStats?.totalCases || 0;
      const workflowTotalCompletionTime = workflowStats?.totalCompletionTime || 0;
      const workflowCompletedWithTime = workflowStats?.completedWithTime || 0;
      const completedCases = workflowCompletedCases || trackingCompletedCases;
      const totalCases = workflowTotalCases || trackingTotalCases;
      const totalCompletionTime = workflowTotalCompletionTime || trackingTotalCompletionTime || null;
      const avgTime = workflowCompletedWithTime > 0
        ? workflowTotalCompletionTime / workflowCompletedWithTime
        : trackingAvgTime;
      const derivedRmPoints = workflowStats?.rmPoints || 0;
      const storedRewards = rewardMap[currentUserId] || 0;
      const derivedTrackingRewards = derivedTrackingRewardMap[currentUserId] || 0;
      const rewards = storedRewards + derivedTrackingRewards + derivedRmPoints;
      const rewardedTasks = (rewardTaskMap[currentUserId] || 0) + (derivedTrackingRewardTaskMap[currentUserId] || 0);
      const isRelationshipManager = relationshipManagerUserIds.has(currentUserId);
      const rmPoints = isRelationshipManager
        ? (rmRewardMap[currentUserId] || 0) + derivedRmPoints
        : 0;
      
      return {
        userId: currentUserId,
        userName: user.userName || 'Unknown',
        email: user.email || '',
        roles: rolesMap[currentUserId] || [],
        primaryRole: (rolesMap[currentUserId]?.[0]) || 'unknown',
        totalCases,
        completedCases,
        pendingCases: workflowStats?.pendingCases ?? trackingPendingCases,
        inProgressCases: workflowStats?.inProgressCases ?? trackingInProgressCases,
        rejectedCases: workflowStats?.rejectedCases ?? trackingRejectedCases,
        totalRewards: rewards,
        rewardedTasks,
        rmPoints,
        avgCompletionTime: avgTime,
        totalCompletionTime,
        efficiencyScore: this.calculatePerformanceScore(completedCases, totalCases, avgTime, rewards),
        stagePerformance: [],
      };
    });

    const validSortColumns = ['completedCases', 'totalCases', 'totalRewards', 'avgCompletionTime', 'efficiencyScore', 'userName'];
    const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'efficiencyScore';
    const direction = sortOrder === 'ASC' ? 1 : -1;

    results.sort((a, b) => {
      const aValue = sortColumn === 'userName'
        ? a.userName.toLowerCase()
        : (a as any)[sortColumn] ?? -1;
      const bValue = sortColumn === 'userName'
        ? b.userName.toLowerCase()
        : (b as any)[sortColumn] ?? -1;

      if (aValue < bValue) return -1 * direction;
      if (aValue > bValue) return 1 * direction;
      return a.userName.localeCompare(b.userName);
    });

    return {
      data: results.slice(offset, offset + limit),
      total: results.length,
    };
  }

  /**
   * Get detailed performance for a specific user
   */
  async getUserPerformanceDetail(userId: number, filters?: PerformanceFilters): Promise<UserPerformanceSummary | null> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) return null;

    const aggregateResult = await this.getUserPerformanceList({
      ...(filters || {}),
      userId,
      limit: 1,
      offset: 0,
      sortBy: 'efficiencyScore',
      sortOrder: 'DESC',
    });
    const aggregateSummary = aggregateResult.data[0];

    // Get user roles
    const userRoles = await this.userRoleRepository
      .createQueryBuilder('ur')
      .select('r.name', 'roleName')
      .innerJoin('ur.role', 'r')
      .where('ur.userId = :userId', { userId })
      .andWhere('ur.isActive = :isActive', { isActive: true })
      .getRawMany();

    const roles = userRoles.map(ur => ur.roleName);

    // Build task tracking query
    const baseQuery = this.taskTimeTrackingRepository
      .createQueryBuilder('tracking')
      .where('tracking.userId = :userId', { userId });

    if (filters?.startDate) {
      baseQuery.andWhere('tracking.assignedAt >= :startDate', { startDate: filters.startDate });
    }
    if (filters?.endDate) {
      baseQuery.andWhere('tracking.assignedAt <= :endDate', { endDate: filters.endDate });
    }

    // Overall stats
    const overallStats = await baseQuery
      .clone()
      .select('COUNT(*)', 'totalCases')
      .addSelect('SUM(CASE WHEN tracking.status = \'completed\' THEN 1 ELSE 0 END)', 'completedCases')
      .addSelect('SUM(CASE WHEN tracking.status = \'pending\' THEN 1 ELSE 0 END)', 'pendingCases')
      .addSelect('SUM(CASE WHEN tracking.status = \'in_progress\' THEN 1 ELSE 0 END)', 'inProgressCases')
      .addSelect('SUM(CASE WHEN tracking.status = \'rejected\' THEN 1 ELSE 0 END)', 'rejectedCases')
      .addSelect('AVG(tracking.totalCompletionTimeMinutes)', 'avgCompletionTime')
      .addSelect('SUM(tracking.totalCompletionTimeMinutes)', 'totalCompletionTime')
      .getRawOne();

    // Get rewards
    const rewardStats = await this.rewardPointRepository
      .createQueryBuilder('reward')
      .select('SUM(reward.points)', 'totalRewards')
      .where('reward.userId = :userId', { userId })
      .getRawOne();

    // Stage-wise performance
    const stages = filters?.stage ? [filters.stage] : PERFORMANCE_STAGES;
    const stagePerformance: StagePerformance[] = [];

    for (const stage of stages) {
      const stageStats = await baseQuery
        .clone()
        .andWhere('tracking.bucket = :stage', { stage })
        .select('COUNT(*)', 'totalAssigned')
        .addSelect('SUM(CASE WHEN tracking.status = \'completed\' THEN 1 ELSE 0 END)', 'completedCases')
        .addSelect('SUM(CASE WHEN tracking.status = \'pending\' THEN 1 ELSE 0 END)', 'pendingCases')
        .addSelect('AVG(tracking.totalCompletionTimeMinutes)', 'avgCompletionTime')
        .addSelect('SUM(tracking.totalCompletionTimeMinutes)', 'totalCompletionTime')
        .getRawOne();

      // Get rewards for this stage
      const stageRewardStats = await this.rewardPointRepository
        .createQueryBuilder('reward')
        .select('SUM(reward.points)', 'rewardsEarned')
        .where('reward.userId = :userId', { userId })
        .andWhere('reward.bucket = :stage', { stage })
        .getRawOne();

      if (parseInt(stageStats.totalAssigned) > 0 || parseInt(stageRewardStats.rewardsEarned) > 0) {
        stagePerformance.push({
          stage,
          stageLabel: this.getStageLabel(stage),
          totalAssigned: parseInt(stageStats.totalAssigned) || 0,
          completedCases: parseInt(stageStats.completedCases) || 0,
          pendingCases: parseInt(stageStats.pendingCases) || 0,
          avgCompletionTime: stageStats.avgCompletionTime ? parseFloat(stageStats.avgCompletionTime) : null,
          totalCompletionTime: stageStats.totalCompletionTime ? parseFloat(stageStats.totalCompletionTime) : null,
          rewardsEarned: parseInt(stageRewardStats.rewardsEarned) || 0,
        });
      }
    }

    const completedCases = aggregateSummary?.completedCases ?? (parseInt(overallStats.completedCases) || 0);
    const totalCases = aggregateSummary?.totalCases ?? (parseInt(overallStats.totalCases) || 0);
    const avgTime = aggregateSummary?.avgCompletionTime ?? (overallStats.avgCompletionTime ? parseFloat(overallStats.avgCompletionTime) : null);
    const rewards = aggregateSummary?.totalRewards ?? (parseInt(rewardStats?.totalRewards) || 0);
    const rewardedTasks = aggregateSummary?.rewardedTasks ?? 0;
    const rmPoints = aggregateSummary?.rmPoints ?? 0;

    return {
      userId,
      userName: user.name,
      email: user.email,
      roles,
      primaryRole: roles[0] || 'unknown',
      totalCases,
      completedCases,
      pendingCases: aggregateSummary?.pendingCases ?? (parseInt(overallStats.pendingCases) || 0),
      inProgressCases: aggregateSummary?.inProgressCases ?? (parseInt(overallStats.inProgressCases) || 0),
      rejectedCases: aggregateSummary?.rejectedCases ?? (parseInt(overallStats.rejectedCases) || 0),
      totalRewards: rewards,
      rewardedTasks,
      rmPoints,
      avgCompletionTime: avgTime,
      totalCompletionTime: aggregateSummary?.totalCompletionTime ?? (overallStats.totalCompletionTime ? parseFloat(overallStats.totalCompletionTime) : null),
      efficiencyScore: this.calculatePerformanceScore(completedCases, totalCases, avgTime, rewards),
      stagePerformance,
    };
  }

  /**
   * Get recent completed cases for a user
   */
  async getUserRecentCompletedCases(userId: number, limit: number = 10): Promise<Array<{
    taskId: string;
    taskType: string;
    bucket: string | null;
    completedAt: Date | null;
    completionTimeMinutes: number | null;
    rewardsEarned: number;
  }>> {
    const tasks = await this.taskTimeTrackingRepository
      .createQueryBuilder('tracking')
      .select('tracking.taskId', 'taskId')
      .addSelect('tracking.taskType', 'taskType')
      .addSelect('tracking.bucket', 'bucket')
      .addSelect('tracking.completedAt', 'completedAt')
      .addSelect('tracking.totalCompletionTimeMinutes', 'completionTimeMinutes')
      .where('tracking.userId = :userId', { userId })
      .andWhere('tracking.status = :status', { status: 'completed' })
      .orderBy('tracking.completedAt', 'DESC')
      .limit(limit)
      .getRawMany();

    // Get rewards for these tasks
    const taskIds = tasks.map(t => t.taskId);
let rewardMap: Record<string, number> = {};
    
    if (taskIds.length > 0) {
      const rewards = await this.rewardPointRepository
        .createQueryBuilder('reward')
        .select('reward.taskId', 'taskId')
        .addSelect('SUM(reward.points)', 'points')
        .where('reward.taskId IN (:...taskIds)', { taskIds })
        .groupBy('reward.taskId')
        .getRawMany();
      
      rewards.forEach(r => {
        rewardMap[r.taskId] = parseInt(r.points) || 0;
      });
    }

    return tasks.map(task => ({
      taskId: task.taskId,
      taskType: task.taskType,
      bucket: task.bucket,
      completedAt: task.completedAt,
      completionTimeMinutes: task.completionTimeMinutes ? parseFloat(task.completionTimeMinutes) : null,
      rewardsEarned: rewardMap[task.taskId] || 0,
    }));
  }

  /**
   * Get all users for filtering dropdown
   * Only returns users with ops, credit, and rm roles for All Cases view
   */
  async getAllUsersForFilter(): Promise<Array<{ id: number; name: string; email: string }>> {
    const users = await this.userRepository
      .createQueryBuilder('user')
      .innerJoin('user.userRoles', 'ur')
      .innerJoin('ur.role', 'role')
      .select('user.id', 'id')
      .addSelect('user.name', 'name')
      .addSelect('user.email', 'email')
      .where('role.name IN (:...validRoles)', { validRoles: VALID_ROLES })
      .andWhere('ur.isActive = :isActive', { isActive: true })
      .andWhere('user.isActive = :userActive', { userActive: true })
      .orderBy('user.name', 'ASC')
      .distinct()
      .getRawMany();

    return users.map(u => ({
      id: parseInt(u.id),
      name: u.name || 'Unknown',
      email: u.email || '',
    }));
  }

  async getCompanyNameSuggestions(search: string, limit = 8): Promise<Array<{
    customerId: number;
    companyName: string;
    customerCode: string | null;
    status: string | null;
  }>> {
    const searchTerm = (search || '').trim();
    if (!searchTerm) return [];

    const take = Math.min(Math.max(limit, 1), 20);
    const likeSearch = `%${searchTerm}%`;

    const rows = await this.customerRepository
      .createQueryBuilder('customer')
      .select('customer.id', 'customerId')
      .addSelect('COALESCE(NULLIF(customer.companyName, \'\'), customer.customerName)', 'companyName')
      .addSelect('customer.customerCode', 'customerCode')
      .addSelect('customer.status', 'status')
      .where('(customer.companyName LIKE :search OR customer.customerName LIKE :search OR customer.customerCode LIKE :search)', {
        search: likeSearch,
      })
      .andWhere('(customer.companyName IS NOT NULL OR customer.customerName IS NOT NULL)')
      .orderBy('COALESCE(NULLIF(customer.companyName, \'\'), customer.customerName)', 'ASC')
      .limit(take)
      .getRawMany();

    return rows.map((row: any) => ({
      customerId: parseInt(row.customerId),
      companyName: row.companyName || 'Unknown',
      customerCode: row.customerCode || null,
      status: row.status || null,
    }));
  }

/**
   * Get all cases across all users for SUPERADMIN view
   * Supports filtering by status, stage/bucket, and date range
   * Combines TaskTimeTracking AND CaseWorkflow data for complete case view
   */
  async getAllCasesByUsers(filters?: {
    status?: string;
    stage?: string;
    companyName?: string;
    userId?: number;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
    includeSanctions?: boolean;
  }): Promise<{
    cases: Array<{
      id: number;
      customerId?: number | null;
      taskId: string;
      companyName: string;
      bucket: string | null;
      status: string;
      caseStatus?: string;
      trackingStatus?: string | null;
      isOverdue: boolean;
      userId: number;
      userName: string;
      userEmail: string;
      assignedTo?: number | null;
      assignedToName?: string | null;
      assignedToEmail?: string | null;
      assignedAt: Date | null;
      startedAt: Date | null;
      completedAt: Date | null;
      totalCompletionTimeMinutes: number | null;
      l1ProcessingTimeMinutes: number | null;
      l2ProcessingTimeMinutes: number | null;
      createdAt: Date;
      sanctionCount?: number;
      sanctionedAmount?: number;
      disbursedAmount?: number;
      utilizedLimit?: number;
      unutilizedLimit?: number;
      partnerNames?: string[];
    }>;
    total: number;
  }> {
    const { status, stage, companyName, userId, startDate, endDate, limit = 50, offset = 0, includeSanctions = false } = filters || {};

    const toNumber = (value: any): number | null => {
      if (value === null || value === undefined || value === '') return null;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    };

    const toDate = (value: any): Date | null => {
      if (!value) return null;
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    };

    const isNewerTracking = (candidate: any, current?: any): boolean => {
      if (!current) return true;
      const candidateDate =
        toDate(candidate.completedAt) ||
        toDate(candidate.startedAt) ||
        toDate(candidate.assignedAt) ||
        toDate(candidate.createdAt);
      const currentDate =
        toDate(current.completedAt) ||
        toDate(current.startedAt) ||
        toDate(current.assignedAt) ||
        toDate(current.createdAt);

      return (candidateDate?.getTime() || 0) > (currentDate?.getTime() || 0);
    };

    const normalizeText = (value?: string | null): string => (value || '').toLowerCase();
    type CustomerSanctionStats = {
      sanctionCount: number;
      sanctionedAmount: number;
      disbursedAmount: number;
      utilizedLimit: number;
      unutilizedLimit: number;
      partnerNames: string[];
    };

    const emptySanctionStats: CustomerSanctionStats = {
      sanctionCount: 0,
      sanctionedAmount: 0,
      disbursedAmount: 0,
      utilizedLimit: 0,
      unutilizedLimit: 0,
      partnerNames: [],
    };

    // Workflow is the canonical case list. Task tracking is optional timing/user metadata.
    const workflowRows = await this.caseWorkflowRepository
      .createQueryBuilder('workflow')
      .select('workflow.id', 'id')
      .addSelect('workflow.workflowType', 'workflowType')
      .addSelect('workflow.customerId', 'customerId')
      .addSelect('workflow.currentStatus', 'currentStatus')
      .addSelect('workflow.currentApproverRoleName', 'currentApproverRoleName')
      .addSelect('workflow.assignedStage', 'assignedStage')
      .addSelect('workflow.assignedUserId', 'workflowAssignedUserId')
      .addSelect('workflow.isRejected', 'isRejected')
      .addSelect('workflow.isCompleted', 'isCompleted')
      .addSelect('workflow.completedDate', 'completedDate')
      .addSelect('workflow.createdAt', 'createdAt')
      .addSelect('workflow.updatedAt', 'updatedAt')
      .addSelect('customer.companyName', 'companyName')
      .addSelect('customer.customerName', 'customerName')
      .addSelect('customer.customerCode', 'customerCode')
      .addSelect('customer.assignedUserId', 'customerAssignedUserId')
      .addSelect('customer.assignedStage', 'customerAssignedStage')
      .addSelect('assignedUser.name', 'workflowAssignedUserName')
      .addSelect('assignedUser.email', 'workflowAssignedUserEmail')
      .addSelect('customerAssignedUser.name', 'customerAssignedUserName')
      .addSelect('customerAssignedUser.email', 'customerAssignedUserEmail')
      .leftJoin('workflow.customer', 'customer')
      .leftJoin('workflow.assignedUser', 'assignedUser')
      .leftJoin('customer.assignedUser', 'customerAssignedUser')
      .where('workflow.workflowType = :type', { type: 'CUSTOMER_ONBOARDING' })
      .getRawMany();

    const customerRows = await this.customerRepository
      .createQueryBuilder('customer')
      .select('customer.id', 'customerId')
      .addSelect('customer.companyName', 'companyName')
      .addSelect('customer.customerName', 'customerName')
      .addSelect('customer.customerCode', 'customerCode')
      .addSelect('customer.status', 'status')
      .addSelect('customer.assignedUserId', 'assignedUserId')
      .addSelect('customer.assignedStage', 'assignedStage')
      .addSelect('customer.createdAt', 'createdAt')
      .addSelect('customer.updatedAt', 'updatedAt')
      .addSelect('assignedUser.name', 'assignedUserName')
      .addSelect('assignedUser.email', 'assignedUserEmail')
      .leftJoin('customer.assignedUser', 'assignedUser')
      .getRawMany();

    // Also get task tracking rows so older tracked tasks without workflow rows are not lost.
    const trackingQuery = this.taskTimeTrackingRepository
      .createQueryBuilder('tracking')
      .select('tracking.id', 'id')
      .addSelect('tracking.taskId', 'taskId')
      .addSelect('tracking.taskType', 'taskType')
      .addSelect('tracking.bucket', 'bucket')
      .addSelect('tracking.status', 'status')
      .addSelect('tracking.isOverdue', 'isOverdue')
      .addSelect('tracking.userId', 'userId')
      .addSelect('user.name', 'userName')
      .addSelect('user.email', 'userEmail')
      .addSelect('tracking.assignedAt', 'assignedAt')
      .addSelect('tracking.startedAt', 'startedAt')
      .addSelect('tracking.completedAt', 'completedAt')
      .addSelect('tracking.totalCompletionTimeMinutes', 'totalCompletionTimeMinutes')
      .addSelect('tracking.l1ProcessingTimeMinutes', 'l1ProcessingTimeMinutes')
      .addSelect('tracking.l2ProcessingTimeMinutes', 'l2ProcessingTimeMinutes')
      .addSelect('tracking.createdAt', 'createdAt')
      .addSelect('workflow.id', 'workflowId')
      .addSelect('workflow.customerId', 'workflowCustomerId')
      .addSelect('taskCustomer.id', 'taskCustomerId')
      .addSelect('COALESCE(workflowCustomer.companyName, taskCustomer.companyName)', 'customerName')
      .leftJoin('tracking.user', 'user')
      .leftJoin('tracking.caseWorkflow', 'workflow')
      .leftJoin('workflow.customer', 'workflowCustomer')
      .leftJoin(Customer, 'taskCustomer', 'taskCustomer.id = tracking.taskId');

    const trackingCases = await trackingQuery
      .orderBy('tracking.createdAt', 'DESC')
      .getRawMany();

    const mappedTrackingCases = trackingCases.map((c: any) => {
      const taskId = String(c.taskId || '');
      const numericTaskId = /^\d+$/.test(taskId) ? parseInt(taskId) : null;
      const workflowId = toNumber(c.workflowId);
      const customerId = toNumber(c.workflowCustomerId) || toNumber(c.taskCustomerId) || numericTaskId;

      return {
        id: parseInt(c.id),
        taskId: c.taskId,
        taskType: c.taskType,
        workflowId,
        customerId,
        companyName: c.customerName || '',
        bucket: c.bucket,
        status: c.status,
        caseStatus: c.status,
        trackingStatus: c.status,
        isOverdue: Boolean(c.isOverdue),
        userId: parseInt(c.userId),
        userName: c.userName || 'Unknown',
        userEmail: c.userEmail || '',
        assignedTo: parseInt(c.userId),
        assignedToName: c.userName || 'Unknown',
        assignedToEmail: c.userEmail || '',
        assignedAt: c.assignedAt,
        startedAt: c.startedAt,
        completedAt: c.completedAt,
        totalCompletionTimeMinutes: c.totalCompletionTimeMinutes ? parseFloat(c.totalCompletionTimeMinutes) : null,
        l1ProcessingTimeMinutes: c.l1ProcessingTimeMinutes ? parseInt(c.l1ProcessingTimeMinutes) : null,
        l2ProcessingTimeMinutes: c.l2ProcessingTimeMinutes ? parseInt(c.l2ProcessingTimeMinutes) : null,
        createdAt: c.createdAt,
      };
    });

    const trackingByWorkflowId = new Map<number, any>();
    const trackingByCustomerId = new Map<number, any>();

    for (const tracking of mappedTrackingCases) {
      if (tracking.workflowId && isNewerTracking(tracking, trackingByWorkflowId.get(tracking.workflowId))) {
        trackingByWorkflowId.set(tracking.workflowId, tracking);
      }
      if (tracking.customerId && isNewerTracking(tracking, trackingByCustomerId.get(tracking.customerId))) {
        trackingByCustomerId.set(tracking.customerId, tracking);
      }
    }

    const workflowIds = new Set<number>();
    const workflowCustomerIds = new Set<number>();

    let allCases: any[] = workflowRows.map((c: any) => {
      const workflowId = parseInt(c.id);
      const customerId = toNumber(c.customerId);
      workflowIds.add(workflowId);
      if (customerId) workflowCustomerIds.add(customerId);

      const tracking = trackingByWorkflowId.get(workflowId) || (customerId ? trackingByCustomerId.get(customerId) : null);
      const assignedUserId =
        toNumber(c.workflowAssignedUserId) ||
        toNumber(c.customerAssignedUserId) ||
        tracking?.assignedTo ||
        tracking?.userId ||
        null;
      const assignedUserName =
        c.workflowAssignedUserName ||
        c.customerAssignedUserName ||
        tracking?.assignedToName ||
        c.currentApproverRoleName ||
        'Unassigned';
      const assignedUserEmail =
        c.workflowAssignedUserEmail ||
        c.customerAssignedUserEmail ||
        tracking?.assignedToEmail ||
        '';
      const workflowStage =
        this.getStageFromWorkflowStatus(c.currentStatus, c.currentApproverRoleName) ||
        c.assignedStage ||
        c.customerAssignedStage;
      const currentStatus = c.currentStatus || 'draft';
      const derivedTrackingStatus = tracking?.trackingStatus || this.getTaskStatusFromWorkflowStatus(
        currentStatus,
        Boolean(c.isCompleted),
        Boolean(c.isRejected)
      );

      return {
        id: workflowId,
        workflowId,
        customerId,
        taskId: c.customerCode || (customerId ? `CUST${String(customerId).padStart(6, '0')}` : `WF${String(workflowId).padStart(6, '0')}`),
        taskType: 'CUSTOMER_ONBOARDING',
        companyName: c.companyName || c.customerName || tracking?.companyName || 'Unknown',
        bucket: workflowStage,
        status: currentStatus,
        caseStatus: currentStatus,
        trackingStatus: derivedTrackingStatus,
        isOverdue: Boolean(tracking?.isOverdue),
        userId: assignedUserId || 0,
        userName: assignedUserName,
        userEmail: assignedUserEmail,
        assignedTo: assignedUserId,
        assignedToName: assignedUserName,
        assignedToEmail: assignedUserEmail,
        assignedAt: tracking?.assignedAt || c.updatedAt || c.createdAt,
        startedAt: tracking?.startedAt || null,
        completedAt: tracking?.completedAt || c.completedDate || null,
        totalCompletionTimeMinutes: tracking?.totalCompletionTimeMinutes || null,
        l1ProcessingTimeMinutes: tracking?.l1ProcessingTimeMinutes || null,
        l2ProcessingTimeMinutes: tracking?.l2ProcessingTimeMinutes || null,
        createdAt: c.createdAt,
      };
    });

    const customerOnlyCases = customerRows
      .filter((c: any) => {
        const customerId = toNumber(c.customerId);
        return customerId && !workflowCustomerIds.has(customerId);
      })
      .map((c: any) => {
        const customerId = toNumber(c.customerId)!;
        const tracking = trackingByCustomerId.get(customerId);
        const assignedUserId = toNumber(c.assignedUserId) || tracking?.assignedTo || tracking?.userId || null;
        const assignedUserName = c.assignedUserName || tracking?.assignedToName || 'Unassigned';
        const assignedUserEmail = c.assignedUserEmail || tracking?.assignedToEmail || '';
        const currentStatus = c.status || 'draft';
        const workflowStage = this.getStageFromWorkflowStatus(currentStatus) || c.assignedStage || tracking?.bucket;
        const derivedTrackingStatus = tracking?.trackingStatus || this.getTaskStatusFromWorkflowStatus(currentStatus);

        workflowCustomerIds.add(customerId);

        return {
          id: customerId,
          workflowId: null,
          customerId,
          taskId: c.customerCode || `CUST${String(customerId).padStart(6, '0')}`,
          taskType: 'CUSTOMER_ONBOARDING',
          companyName: c.companyName || c.customerName || tracking?.companyName || 'Unknown',
          bucket: workflowStage,
          status: currentStatus,
          caseStatus: currentStatus,
          trackingStatus: derivedTrackingStatus,
          isOverdue: Boolean(tracking?.isOverdue),
          userId: assignedUserId || 0,
          userName: assignedUserName,
          userEmail: assignedUserEmail,
          assignedTo: assignedUserId,
          assignedToName: assignedUserName,
          assignedToEmail: assignedUserEmail,
          assignedAt: tracking?.assignedAt || c.updatedAt || c.createdAt,
          startedAt: tracking?.startedAt || null,
          completedAt: tracking?.completedAt || null,
          totalCompletionTimeMinutes: tracking?.totalCompletionTimeMinutes || null,
          l1ProcessingTimeMinutes: tracking?.l1ProcessingTimeMinutes || null,
          l2ProcessingTimeMinutes: tracking?.l2ProcessingTimeMinutes || null,
          createdAt: c.createdAt,
        };
      });

    allCases = [...allCases, ...customerOnlyCases];

    const orphanTrackingCases = mappedTrackingCases.filter((tracking) => {
      if (tracking.workflowId && workflowIds.has(tracking.workflowId)) return false;
      if (tracking.customerId && workflowCustomerIds.has(tracking.customerId)) return false;
      return true;
    });

    allCases = [...allCases, ...orphanTrackingCases];

    const normalizedStatus = normalizeText(status);
    const normalizedCompanyName = normalizeText(companyName).trim();
    allCases = allCases.filter((c) => {
      if (normalizedCompanyName && !normalizeText(c.companyName).includes(normalizedCompanyName)) return false;

      if (stage && c.bucket !== stage) return false;

      if (normalizedStatus) {
        const caseStatus = normalizeText(c.caseStatus || c.status);
        const trackingStatus = normalizeText(c.trackingStatus);

        if (LEGACY_TASK_STATUSES.has(normalizedStatus)) {
          if (caseStatus !== normalizedStatus && trackingStatus !== normalizedStatus) return false;
        } else if (caseStatus !== normalizedStatus) {
          return false;
        }
      }

      if (userId && c.userId !== userId && c.assignedTo !== userId) return false;

      const createdAt = toDate(c.createdAt);
      if (startDate && createdAt && createdAt.getTime() < startDate.getTime()) return false;
      if (endDate && createdAt && createdAt.getTime() > endDate.getTime()) return false;

      return true;
    });

    // Sort by createdAt descending
    allCases.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Get total count
    const total = allCases.length;

    // Apply pagination
    const paginatedCases = allCases.slice(offset, offset + limit);

    if (!includeSanctions) {
      return {
        cases: paginatedCases,
        total,
      };
    }

    const customerIds = Array.from(new Set(
      paginatedCases
        .map((c) => toNumber(c.customerId))
        .filter((id): id is number => Boolean(id))
    ));

    const sanctionStatsMap: Record<number, CustomerSanctionStats> = {};

    if (customerIds.length > 0) {
      const sanctionRows = await this.loanAccountRepository
        .createQueryBuilder('loan')
        .leftJoin('loan.partner', 'partner')
        .select('loan.customerId', 'customerId')
        .addSelect('COUNT(loan.id)', 'sanctionCount')
        .addSelect('SUM(COALESCE(loan.sanctionedAmount, 0))', 'sanctionedAmount')
        .addSelect('SUM(COALESCE(loan.disbursedAmount, 0))', 'disbursedAmount')
        .addSelect('SUM(COALESCE(loan.utilizedLimit, 0))', 'utilizedLimit')
        .addSelect('SUM(COALESCE(loan.unutilizedLimit, 0))', 'unutilizedLimit')
        .addSelect("GROUP_CONCAT(DISTINCT COALESCE(partner.code, loan.lender) ORDER BY COALESCE(partner.code, loan.lender) SEPARATOR ', ')", 'partnerNames')
        .where('loan.customerId IN (:...customerIds)', { customerIds })
        .groupBy('loan.customerId')
        .getRawMany();

      sanctionRows.forEach((row: any) => {
        const currentCustomerId = toNumber(row.customerId);
        if (!currentCustomerId) return;

        sanctionStatsMap[currentCustomerId] = {
          sanctionCount: toNumber(row.sanctionCount) ?? 0,
          sanctionedAmount: toNumber(row.sanctionedAmount) ?? 0,
          disbursedAmount: toNumber(row.disbursedAmount) ?? 0,
          utilizedLimit: toNumber(row.utilizedLimit) ?? 0,
          unutilizedLimit: toNumber(row.unutilizedLimit) ?? 0,
          partnerNames: String(row.partnerNames || '')
            .split(',')
            .map((name) => name.trim())
            .filter(Boolean),
        };
      });
    }

    const enrichedCases = paginatedCases.map((caseItem) => {
      const customerId = toNumber(caseItem.customerId);
      const sanctionStats = customerId ? sanctionStatsMap[customerId] : undefined;

      return {
        ...caseItem,
        ...(sanctionStats || emptySanctionStats),
      };
    });

    return {
      cases: enrichedCases,
      total,
    };
  }

  private isWorkflowCompleted(status?: string | null, isCompleted: boolean = false): boolean {
    const normalizedStatus = (status || '').toLowerCase();
    return isCompleted || ['completed', 'disbursed'].includes(normalizedStatus);
  }

  private isWorkflowRejected(status?: string | null, isRejected: boolean = false): boolean {
    return isRejected || (status || '').toLowerCase() === 'rejected';
  }

  private getWorkflowDurationMinutes(
    createdAt?: Date | string | null,
    completedDate?: Date | string | null,
    updatedAt?: Date | string | null
  ): number | null {
    if (!createdAt) return null;

    const start = new Date(createdAt);
    if (Number.isNaN(start.getTime())) return null;

    let end = completedDate ? new Date(completedDate) : null;
    const updated = updatedAt ? new Date(updatedAt) : null;

    if ((!end || Number.isNaN(end.getTime()) || end.getTime() < start.getTime()) && updated && !Number.isNaN(updated.getTime())) {
      end = updated;
    }

    if (!end || Number.isNaN(end.getTime()) || end.getTime() < start.getTime()) {
      return null;
    }

    return Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000));
  }

  private getReportPointsForCompletionTime(durationMinutes: number | null): number {
    if (!durationMinutes || durationMinutes <= 0) {
      return REPORT_REWARD_POINTS.SLOW;
    }

    if (durationMinutes <= 30) {
      return REPORT_REWARD_POINTS.FAST;
    }

    if (durationMinutes <= 120) {
      return REPORT_REWARD_POINTS.MEDIUM;
    }

    return REPORT_REWARD_POINTS.SLOW;
  }

  private getStageFromWorkflowStatus(status?: string | null, approverRole?: string | null): string | null {
    const normalizedStatus = (status || '').toLowerCase();
    const statusToStage: Record<string, string> = {
      draft: 'rm',
      returned_to_rm: 'rm',
      md_pending_terms: 'rm',
      md_approved: 'ops_l1',
      submitted: 'credit_l1',
      credit_l1_approved: 'credit_l2',
      credit_l2_approved: 'rm',
      ceo_approved: 'rm',
      md_terms_submitted: 'ps_l2',
      ops_l1_review: 'ops_l1',
      ops_l1_approved: 'ops_head',
      ops_head_approved: 'ops_head',
      pending_customer_approval: 'rm',
      rejected_by_customer: 'rm',
      pending_ops_l1_approval: 'ops_l1',
      pending_ops_l2_approval: 'ops_l2',
      pending_md_approval: 'ps_l2',
      pending_ops_head_approval: 'ops_head',
      disbursement_data_entry: 'ops_l1',
      pending_final_ops_l2_approval: 'ops_l2',
      active: 'completed',
      ops_l1_verified: 'ops_l2',
      ops_l2_verified: 'ops_head',
      invoice_pending_customer_approval: 'rm',
      invoice_rejected_by_customer: 'rm',
      invoice_pending_ops_l1_approval: 'ops_l1',
      invoice_pending_ops_l2_approval: 'ops_l2',
      invoice_pending_md_approval: 'ps_l2',
      invoice_pending_ops_head_approval: 'ops_head',
      invoice_disbursement_data_entry: 'ops_l1',
      invoice_pending_final_ops_l2_approval: 'ops_l2',
      invoice_active: 'completed',
      completed: 'completed',
      disbursed: 'completed',
      rejected: 'rejected',
    };

    if (statusToStage[normalizedStatus]) {
      return statusToStage[normalizedStatus];
    }

    const role = (approverRole || '').toLowerCase();

    if (role === 'rm' || role === 'relationship_manager') return 'rm';
    if (role === 'customer') return 'rm';
    if (role === 'credit_team_l1') return 'credit_l1';
    if (role === 'credit_team_l2') return 'credit_l2';
    if (role === 'md') return 'ps_l2';
    if (role === 'ops_l1') return 'ops_l1';
    if (role === 'ops_l2') return 'ops_l2';
    if (role === 'ops_head') return 'ops_head';
    if (role === 'operations_team_l1') return 'ops_l1';
    if (role === 'operations_team_l2') return 'ops_l2';
    if (role === 'operations_head') return 'ops_head';

    return null;
  }

  private getTaskStatusFromWorkflowStatus(
    status?: string | null,
    isCompleted: boolean = false,
    isRejected: boolean = false
  ): string {
    const normalizedStatus = (status || '').toLowerCase();

    if (isCompleted || ['completed', 'disbursed'].includes(normalizedStatus)) {
      return 'completed';
    }

    if (isRejected || normalizedStatus === 'rejected') {
      return 'rejected';
    }

    return 'pending';
  }

  /**
   * Calculate efficiency score (0-100)
   * Based on: completion rate, average time, and rewards
   * 
   * NOTE: Reward points are already calculated based on time taken (fast=5, medium=3, slow=1)
   * To avoid double-counting time, we use a time-based expected points calculation
   */
  private calculatePerformanceScore(
    completedCases: number,
    totalCases: number,
    avgTimeMinutes: number | null,
    rewards: number
  ): number {
    // Completion rate score (0-100)
    const completionRate = totalCases > 0 ? (completedCases / totalCases) * 100 : 0;
    const completionScore = completionRate;

    // Time score (inverse - faster is better)
    // Assume 120 minutes as average; less time is better.
    let timeScore = 50; // default medium
    if (avgTimeMinutes !== null && avgTimeMinutes > 0) {
      if (avgTimeMinutes <= 30) timeScore = 100;
      else if (avgTimeMinutes <= 60) timeScore = 85;
      else if (avgTimeMinutes <= 120) timeScore = 70;
      else if (avgTimeMinutes <= 240) timeScore = 50;
      else if (avgTimeMinutes <= 480) timeScore = 30;
      else timeScore = 15;
    }

    // Reward score - Calculate expected points based on average time
    // This aligns with the reward configuration: fast <= 30m = 5pts, medium <= 120m = 3pts, slow > 120m = 1pt.
    let expectedPointsPerTask = 3; // default medium
    if (avgTimeMinutes !== null && avgTimeMinutes > 0) {
      if (avgTimeMinutes <= 30) expectedPointsPerTask = 5;      // fast
      else if (avgTimeMinutes <= 120) expectedPointsPerTask = 3; // medium
      else expectedPointsPerTask = 1; // slow
    }
    
    const expectedPoints = completedCases * expectedPointsPerTask;
    const rewardScore = expectedPoints > 0 ? Math.min(100, (rewards / expectedPoints) * 100) : 0;

    // Weighted average
    const score = (
      (completionScore * SCORE_WEIGHTS.COMPLETION_RATE) +
      (timeScore * SCORE_WEIGHTS.AVG_TIME) +
      (rewardScore * SCORE_WEIGHTS.REWARD_POINTS)
    ) / 100;

    return Math.round(score * 100) / 100;
  }

  /**
   * Get stage label for display
   */
  private getStageLabel(stage: string): string {
    const labels: Record<string, string> = {
      'credit_l1': 'Credit L1',
      'credit_l2': 'Credit L2',
      'ps_l1': 'PS L1',
      'ps_l2': 'PS L2',
      'ops_l1': 'Operations L1',
      'ops_l2': 'Operations L2',
      'ops_head': 'Operations Head',
      'rm': 'RM',
    };
    return labels[stage] || stage;
  }

   /**
    * Internal method to get top performers
    */
   private async getTopPerformersInternal(limit: number): Promise<Array<{
     userId: number;
     userName: string;
     efficiencyScore: number;
   }>> {
     const userStats = await this.taskTimeTrackingRepository
       .createQueryBuilder('tracking')
       .select('tracking.userId', 'userId')
       .addSelect('user.name', 'userName')
       .addSelect('COUNT(*)', 'totalCases')
       .addSelect('SUM(CASE WHEN tracking.status = \'completed\' THEN 1 ELSE 0 END)', 'completedCases')
       .addSelect('AVG(tracking.totalCompletionTimeMinutes)', 'avgCompletionTime')
       .innerJoin('tracking.user', 'user')
       .innerJoin('user.userRoles', 'ur')
       .innerJoin('ur.role', 'role')
       .where('role.name IN (:...validRoles)', { validRoles: VALID_ROLES })
       .andWhere('ur.isActive = :isActive', { isActive: true })
       .groupBy('tracking.userId')
       .addGroupBy('user.name')
       .orderBy('completedCases', 'DESC')
       .limit(limit)
       .getRawMany();

     // Get rewards
     const userIds = userStats.map(u => parseInt(u.userId));
     let rewardMap: Record<number, number> = {};
    
    if (userIds.length > 0) {
      const rewards = await this.rewardPointRepository
        .createQueryBuilder('reward')
        .select('reward.userId', 'userId')
        .addSelect('SUM(reward.points)', 'totalRewards')
        .where('reward.userId IN (:...userIds)', { userIds })
        .groupBy('reward.userId')
        .getRawMany();
      
      rewards.forEach(r => {
        rewardMap[parseInt(r.userId)] = parseInt(r.totalRewards) || 0;
      });
    }

    return userStats.map(stat => {
      const completedCases = parseInt(stat.completedCases) || 0;
      const totalCases = parseInt(stat.totalCases) || 0;
      const avgTime = stat.avgCompletionTime ? parseFloat(stat.avgCompletionTime) : null;
      const rewards = rewardMap[parseInt(stat.userId)] || 0;

      return {
        userId: parseInt(stat.userId),
        userName: stat.userName || 'Unknown',
        efficiencyScore: this.calculatePerformanceScore(completedCases, totalCases, avgTime, rewards),
      };
    }).sort((a, b) => b.efficiencyScore - a.efficiencyScore);
  }
}

// Export singleton instance
export const userPerformanceService = new UserPerformanceService();
