import { AppDataSource } from '../config/database';
import { TaskTimeTracking } from '../entities/TaskTimeTracking';
import { RewardPoint } from '../entities/RewardPoint';
import { User } from '../entities/User';
import { UserRole } from '../entities/UserRole';
import { Role } from '../entities/Role';
import { CaseWorkflow } from '../entities/CaseWorkflow';
import { Customer } from '../entities/Customer';
import { Repository, In } from 'typeorm';

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
    // Get unique users with task tracking
    const userStats = await this.taskTimeTrackingRepository
      .createQueryBuilder('tracking')
      .select('COUNT(DISTINCT tracking.userId)', 'totalUsers')
      .getRawOne();

    // Get total completed cases
    const completedStats = await this.taskTimeTrackingRepository
      .createQueryBuilder('tracking')
      .select('COUNT(*)', 'totalCompleted')
      .where('tracking.status = :status', { status: 'completed' })
      .getRawOne();

    // Get total rewards distributed
    const rewardStats = await this.rewardPointRepository
      .createQueryBuilder('reward')
      .select('SUM(reward.points)', 'totalPoints')
      .getRawOne();

    // Get average completion time
    const avgTimeStats = await this.taskTimeTrackingRepository
      .createQueryBuilder('tracking')
      .select('AVG(tracking.totalCompletionTimeMinutes)', 'avgTime')
      .where('tracking.status = :status', { status: 'completed' })
      .andWhere('tracking.totalCompletionTimeMinutes IS NOT NULL')
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

    // Build base query
    const baseQuery = this.taskTimeTrackingRepository
      .createQueryBuilder('tracking')
      .leftJoin('tracking.user', 'user')
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
      taskType: string;
      bucket: string | null;
      status: string;
      isOverdue: boolean;
      userId: number;
      userName: string;
      userEmail: string;
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

    let allCases: any[] = [];

    // Map stage to workflow status for credit/ops stages
    const stageToWorkflowStatus: Record<string, string[]> = {
      'credit_l1': ['submitted'],
      'credit_l2': ['credit_l1_approved'],
      'ps_l1': ['credit_l2_approved'],
      'ps_l2': ['ceo_approved', 'md_approved'],
      'rm': ['draft', 'rejected'],
    };

    // Get workflow cases when filtering by stage (credit_l1, credit_l2, etc.)
    if (stage && stageToWorkflowStatus[stage]) {
      const workflowStatuses = stageToWorkflowStatus[stage];
      const workflowQuery = this.caseWorkflowRepository
        .createQueryBuilder('workflow')
        .select('workflow.id', 'id')
        .addSelect('workflow.id', 'taskId')
        .addSelect("'customer_onboarding'", 'taskType')
        .addSelect('workflow.currentStatus', 'bucket')
        .addSelect('workflow.currentStatus', 'status')
        .addSelect('false', 'isOverdue')
        .addSelect('0', 'userId')
        .addSelect('workflow.currentApproverRoleName', 'userName')
        .addSelect("''", 'userEmail')
        .addSelect('workflow.createdAt', 'assignedAt')
        .addSelect('workflow.createdAt', 'startedAt')
        .addSelect('workflow.completedAt', 'completedAt')
        .addSelect('null', 'totalCompletionTimeMinutes')
        .addSelect('null', 'l1ProcessingTimeMinutes')
        .addSelect('null', 'l2ProcessingTimeMinutes')
        .addSelect('workflow.createdAt', 'createdAt')
        .innerJoin('workflow.customer', 'customer')
        .addSelect('customer.name', 'customerName')
        .where('workflow.workflowType = :type', { type: 'CUSTOMER_ONBOARDING' })
        .andWhere('workflow.currentStatus IN (:...statuses)', { statuses: workflowStatuses })
        .andWhere('workflow.isCompleted = :completed', { completed: false });

      if (startDate) {
        workflowQuery.andWhere('workflow.createdAt >= :startDate', { startDate });
      }
      if (endDate) {
        workflowQuery.andWhere('workflow.createdAt <= :endDate', { endDate });
      }

      const workflowCases = await workflowQuery.getRawMany();
      allCases = workflowCases.map(c => ({
        id: parseInt(c.id),
        taskId: `CUST${String(c.id).padStart(6, '0')}`,
        taskType: c.taskType,
        bucket: c.bucket,
        status: c.status,
        isOverdue: false,
        userId: 0,
        userName: c.userName || 'Waiting for Review',
        userEmail: '',
        assignedAt: c.assignedAt,
        startedAt: c.startedAt,
        completedAt: c.completedAt,
        totalCompletionTimeMinutes: null,
        l1ProcessingTimeMinutes: null,
        l2ProcessingTimeMinutes: null,
        createdAt: c.createdAt,
      }));
    }

    // Also get task tracking cases
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
      .leftJoin('tracking.user', 'user');

    if (stage && stage !== 'credit_l2') {
      trackingQuery.andWhere('tracking.bucket = :stage', { stage });
    }

    if (status) {
      trackingQuery.andWhere('tracking.status = :status', { status });
    }

    if (userId) {
      trackingQuery.andWhere('tracking.userId = :userId', { userId });
    }

    if (startDate) {
      trackingQuery.andWhere('tracking.createdAt >= :startDate', { startDate });
    }

    if (endDate) {
      trackingQuery.andWhere('tracking.createdAt <= :endDate', { endDate });
    }

    // Get tracking cases
    const trackingCases = await trackingQuery
      .orderBy('tracking.createdAt', 'DESC')
      .getRawMany();

    const mappedTrackingCases = trackingCases.map((c: any) => ({
      id: parseInt(c.id),
      taskId: c.taskId,
      taskType: c.taskType,
      bucket: c.bucket,
      status: c.status,
      isOverdue: Boolean(c.isOverdue),
      userId: parseInt(c.userId),
      userName: c.userName || 'Unknown',
      userEmail: c.userEmail || '',
      assignedAt: c.assignedAt,
      startedAt: c.startedAt,
      completedAt: c.completedAt,
      totalCompletionTimeMinutes: c.totalCompletionTimeMinutes ? parseFloat(c.totalCompletionTimeMinutes) : null,
      l1ProcessingTimeMinutes: c.l1ProcessingTimeMinutes ? parseInt(c.l1ProcessingTimeMinutes) : null,
      l2ProcessingTimeMinutes: c.l2ProcessingTimeMinutes ? parseInt(c.l2ProcessingTimeMinutes) : null,
      createdAt: c.createdAt,
    }));

    // Combine workflow and tracking cases
    allCases = [...allCases, ...mappedTrackingCases];

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
      .leftJoin('tracking.user', 'user')
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
