import { AppDataSource } from '../config/database';
import { User } from '../entities/User';
import { TaskTimeTracking } from '../entities/TaskTimeTracking';
import { TaskBucketMapping } from '../entities/TaskBucketMapping';
import { RewardPoint } from '../entities/RewardPoint';
import { UserRole } from '../entities/UserRole';
import { Role } from '../entities/Role';
import { Repository } from 'typeorm';
import { taskTimeTrackingService } from './task-time-tracking.service';
import { rewardService } from './reward.service';
import { taskBucketService } from './task-bucket.service';

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

  constructor() {
    this.userRepository = AppDataSource.getRepository(User);
    this.taskTrackingRepository = AppDataSource.getRepository(TaskTimeTracking);
    this.bucketMappingRepository = AppDataSource.getRepository(TaskBucketMapping);
    this.rewardPointRepository = AppDataSource.getRepository(RewardPoint);
    this.userRoleRepository = AppDataSource.getRepository(UserRole);
    this.roleRepository = AppDataSource.getRepository(Role);
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
   * Get complete analytics for SUPERADMIN dashboard
   */
  async getCompleteAnalytics(): Promise<{
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
    ] = await Promise.all([
      this.getDashboardOverview(),
      this.getTopPerformers(10),
      this.getLowestPerformers(10),
      this.getBucketPerformanceStats(),
      this.getL1L2ProcessingComparison(),
      this.getFastestClosersRanking(10),
      this.getSlowestClosersRanking(10),
      this.getHighestProductivityRanking(10),
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
    };
  }
}

// Export singleton instance
export const superAdminAnalyticsService = new SuperAdminAnalyticsService();