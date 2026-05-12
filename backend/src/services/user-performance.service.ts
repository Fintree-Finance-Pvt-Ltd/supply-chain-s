import { AppDataSource } from '../config/database';
import { TaskTimeTracking } from '../entities/TaskTimeTracking';
import { RewardPoint } from '../entities/RewardPoint';
import { User } from '../entities/User';
import { UserRole } from '../entities/UserRole';
import { Role } from '../entities/Role';
import { CaseWorkflow } from '../entities/CaseWorkflow';
import { Customer } from '../entities/Customer';
import { Repository } from 'typeorm';

// Stage/steps mapping based on bucket field
const STAGE_MAPPING: Record<string, string> = {
  'credit_l1': 'credit_l1',
  'credit_l2': 'credit_l2',
  'ps_l1': 'ps_l1',
  'ps_l2': 'ps_l2',
  'rm': 'rm',
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
  }>;
}

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

  constructor() {
    this.taskTimeTrackingRepository = AppDataSource.getRepository(TaskTimeTracking);
    this.rewardPointRepository = AppDataSource.getRepository(RewardPoint);
    this.userRepository = AppDataSource.getRepository(User);
    this.userRoleRepository = AppDataSource.getRepository(UserRole);
    this.roleRepository = AppDataSource.getRepository(Role);
    this.caseWorkflowRepository = AppDataSource.getRepository(CaseWorkflow);
    this.customerRepository = AppDataSource.getRepository(Customer);
  }

  /**
   * Get overall performance summary for superadmin dashboard
   */
   async getOverallSummary(): Promise<OverallPerformanceSummary> {
    // Get unique users with task tracking and valid roles
    const userStats = await this.taskTimeTrackingRepository
      .createQueryBuilder('tracking')
      .innerJoin('tracking.user', 'user')
      .innerJoin('user.userRoles', 'ur')
      .innerJoin('ur.role', 'role')
      .where('role.name IN (:...validRoles)', { validRoles: VALID_ROLES })
      .andWhere('ur.isActive = :isActive', { isActive: true })
      .select('COUNT(DISTINCT tracking.userId)', 'totalUsers')
      .getRawOne();

    // Get total completed cases (with valid roles)
    const completedStats = await this.taskTimeTrackingRepository
      .createQueryBuilder('tracking')
      .innerJoin('tracking.user', 'user')
      .innerJoin('user.userRoles', 'ur')
      .innerJoin('ur.role', 'role')
      .where('role.name IN (:...validRoles)', { validRoles: VALID_ROLES })
      .andWhere('ur.isActive = :isActive', { isActive: true })
      .andWhere('tracking.status = :status', { status: 'completed' })
      .select('COUNT(*)', 'totalCompleted')
      .getRawOne();

    // Get total rewards distributed
    const rewardStats = await this.rewardPointRepository
      .createQueryBuilder('reward')
      .innerJoin('reward.user', 'user')
      .innerJoin('user.userRoles', 'ur')
      .innerJoin('ur.role', 'role')
      .where('role.name IN (:...validRoles)', { validRoles: VALID_ROLES })
      .andWhere('ur.isActive = :isActive', { isActive: true })
      .select('SUM(reward.points)', 'totalPoints')
      .getRawOne();

    // Get average completion time (with valid roles)
    const avgTimeStats = await this.taskTimeTrackingRepository
      .createQueryBuilder('tracking')
      .innerJoin('tracking.user', 'user')
      .innerJoin('user.userRoles', 'ur')
      .innerJoin('ur.role', 'role')
      .where('role.name IN (:...validRoles)', { validRoles: VALID_ROLES })
      .andWhere('ur.isActive = :isActive', { isActive: true })
      .andWhere('tracking.status = :status', { status: 'completed' })
      .andWhere('tracking.totalCompletionTimeMinutes IS NOT NULL')
      .select('AVG(tracking.totalCompletionTimeMinutes)', 'avgTime')
      .getRawOne();

    // Get top 5 performers
    const topPerformers = await this.getTopPerformersInternal(5);

    return {
      totalUsersTracked: parseInt(userStats?.totalUsers) || 0,
      totalCompletedCases: parseInt(completedStats?.totalCompleted) || 0,
      totalRewardsDistributed: parseInt(rewardStats?.totalPoints) || 0,
      avgCompletionTime: avgTimeStats?.avgTime ? parseFloat(avgTimeStats.avgTime) : null,
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

     // Build base query - only include users with valid roles
     const baseQuery = this.taskTimeTrackingRepository
       .createQueryBuilder('tracking')
       .innerJoin('tracking.user', 'user')
       .innerJoin('user.userRoles', 'ur')
       .innerJoin('ur.role', 'role')
       .where('role.name IN (:...validRoles)', { validRoles: VALID_ROLES })
       .andWhere('ur.isActive = :isActive', { isActive: true })
       .select('tracking.userId', 'userId')
       .addSelect('user.name', 'userName')
       .addSelect('user.email', 'email');

    // Apply date filters
    if (startDate) {
      baseQuery.andWhere('tracking.assignedAt >= :startDate', { startDate });
    }
    if (endDate) {
      baseQuery.andWhere('tracking.assignedAt <= :endDate', { endDate });
    }
    if (stage) {
      baseQuery.andWhere('tracking.bucket = :stage', { stage });
    }
    if (userId) {
      baseQuery.andWhere('tracking.userId = :userId', { userId });
    }

     // Get total count of unique users
     const countQuery = baseQuery.clone();
     const totalResult = await countQuery
       .select('COUNT(DISTINCT tracking.userId)', 'total')
       .getRawOne();
     const total = parseInt(totalResult?.total) || 0;

     // Get aggregated stats per user
     const validSortColumns = ['completedCases', 'totalRewards', 'avgCompletionTime', 'efficiencyScore'];
     const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'efficiencyScore';

const userStats = await baseQuery
       .addSelect('COUNT(*)', 'totalCases')
       .addSelect('SUM(CASE WHEN tracking.status = \'completed\' THEN 1 ELSE 0 END)', 'completedCases')
       .addSelect('SUM(CASE WHEN tracking.status = \'pending\' THEN 1 ELSE 0 END)', 'pendingCases')
       .addSelect('SUM(CASE WHEN tracking.status = \'in_progress\' THEN 1 ELSE 0 END)', 'inProgressCases')
       .addSelect('SUM(CASE WHEN tracking.status = \'rejected\' THEN 1 ELSE 0 END)', 'rejectedCases')
       .addSelect('AVG(tracking.totalCompletionTimeMinutes)', 'avgCompletionTime')
       .addSelect('SUM(tracking.totalCompletionTimeMinutes)', 'totalCompletionTime')
       .groupBy('tracking.userId')
       .addGroupBy('user.name')
       .addGroupBy('user.email')
      .orderBy(sortColumn === 'efficiencyScore' ? 'completedCases' : sortColumn, sortOrder)
      .limit(limit)
      .offset(offset)
      .getRawMany();

    // Get rewards for these users
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

    // Get user roles
    let rolesMap: Record<number, string[]> = {};
    if (userIds.length > 0) {
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
    }

    // Build final results with performance scores
    const results: UserPerformanceSummary[] = userStats.map(stat => {
      const completedCases = parseInt(stat.completedCases) || 0;
      const totalCases = parseInt(stat.totalCases) || 0;
      const avgTime = stat.avgCompletionTime ? parseFloat(stat.avgCompletionTime) : null;
      const rewards = rewardMap[parseInt(stat.userId)] || 0;
      
      return {
        userId: parseInt(stat.userId),
        userName: stat.userName || 'Unknown',
        email: stat.email || '',
        roles: rolesMap[parseInt(stat.userId)] || [],
        primaryRole: (rolesMap[parseInt(stat.userId)]?.[0]) || 'unknown',
        totalCases,
        completedCases,
        pendingCases: parseInt(stat.pendingCases) || 0,
        inProgressCases: parseInt(stat.inProgressCases) || 0,
        rejectedCases: parseInt(stat.rejectedCases) || 0,
        totalRewards: rewards,
        avgCompletionTime: avgTime,
        totalCompletionTime: stat.totalCompletionTime ? parseFloat(stat.totalCompletionTime) : null,
        efficiencyScore: this.calculatePerformanceScore(completedCases, totalCases, avgTime, rewards),
        stagePerformance: [], // Will be populated in detail view
      };
    });

    return { data: results, total };
  }

  /**
   * Get detailed performance for a specific user
   */
  async getUserPerformanceDetail(userId: number, filters?: PerformanceFilters): Promise<UserPerformanceSummary | null> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) return null;

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
    const stages = ['credit_l1', 'credit_l2', 'ps_l1', 'ps_l2', 'rm'];
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

    const completedCases = parseInt(overallStats.completedCases) || 0;
    const totalCases = parseInt(overallStats.totalCases) || 0;
    const avgTime = overallStats.avgCompletionTime ? parseFloat(overallStats.avgCompletionTime) : null;
    const rewards = parseInt(rewardStats.totalRewards) || 0;

    return {
      userId,
      userName: user.name,
      email: user.email,
      roles,
      primaryRole: roles[0] || 'unknown',
      totalCases,
      completedCases,
      pendingCases: parseInt(overallStats.pendingCases) || 0,
      inProgressCases: parseInt(overallStats.inProgressCases) || 0,
      rejectedCases: parseInt(overallStats.rejectedCases) || 0,
      totalRewards: rewards,
      avgCompletionTime: avgTime,
      totalCompletionTime: overallStats.totalCompletionTime ? parseFloat(overallStats.totalCompletionTime) : null,
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
    // Get all users from the User entity who have ops, credit, or rm roles
    // OPS roles: operations_team_l1, operations_team_l2, operations_head
    // CREDIT roles: credit_team_l1, credit_team_l2
    // RM roles: relationship_manager
    const validRoles = [
      'operations_team_l1',
      'operations_team_l2',
      'operations_head',
      'credit_team_l1',
      'credit_team_l2',
      'relationship_manager',
    ];

    const users = await this.userRepository
      .createQueryBuilder('user')
      .innerJoin('user.userRoles', 'ur')
      .innerJoin('ur.role', 'role')
      .select('user.id', 'id')
      .addSelect('user.name', 'name')
      .addSelect('user.email', 'email')
      .where('role.name IN (:...validRoles)', { validRoles })
      .andWhere('ur.isActive = :isActive', { isActive: true })
      .orderBy('user.name', 'ASC')
      .distinct()
      .getRawMany();

    return users.map(u => ({
      id: parseInt(u.id),
      name: u.name || 'Unknown',
      email: u.email || '',
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
    userId?: number;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{
    cases: Array<{
      id: number;
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
    }>;
    total: number;
  }> {
    const { status, stage, userId, startDate, endDate, limit = 50, offset = 0 } = filters || {};

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
    allCases = allCases.filter((c) => {
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

    return {
      cases: paginatedCases,
      total,
    };
  }

  private getStageFromWorkflowStatus(status?: string | null, approverRole?: string | null): string | null {
    const normalizedStatus = (status || '').toLowerCase();
    const statusToStage: Record<string, string> = {
      draft: 'rm',
      returned_to_rm: 'rm',
      md_pending_terms: 'rm',
      md_approved: 'ready_for_ops',
      submitted: 'credit_l1',
      credit_l1_approved: 'credit_l2',
      credit_l2_approved: 'ps_l1',
      ceo_approved: 'ps_l2',
      md_terms_submitted: 'ps_l2',
      ops_l1_review: 'ops_l1',
      ops_l1_approved: 'ops_head',
      ops_head_approved: 'ops_head',
      completed: 'completed',
      disbursed: 'completed',
      rejected: 'rejected',
    };

    if (statusToStage[normalizedStatus]) {
      return statusToStage[normalizedStatus];
    }

    const role = (approverRole || '').toLowerCase();

    if (role === 'rm' || role === 'relationship_manager') return 'rm';
    if (role === 'credit_team_l1') return 'credit_l1';
    if (role === 'credit_team_l2') return 'credit_l2';
    if (role === 'ceo') return 'ps_l1';
    if (role === 'md') return 'ps_l2';
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
    // Assuming基准 120 minutes as average, less = better
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
    // This aligns with the reward configuration: fast(≤30min)=5pts, medium(≤120min)=3pts, slow(>120min)=1pt
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
