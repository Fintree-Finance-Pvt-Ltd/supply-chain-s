import { AppDataSource } from '../config/database';
import { RewardPoint, RewardConfiguration } from '../entities/RewardPoint';
import { User } from '../entities/User';
import { Repository } from 'typeorm';
import { REWARD_INELIGIBLE_ROLES } from '../config/constants';
import { permissionService } from './permission.service';

/**
 * Reward Point Service
 * Manages reward points, configurations, and leaderboards
 * NOTE: CEO and MD are NOT eligible for reward points
 */
export class RewardService {
  private rewardPointRepository: Repository<RewardPoint>;
  private rewardConfigRepository: Repository<RewardConfiguration>;
  private userRepository: Repository<User>;

  constructor() {
    this.rewardPointRepository = AppDataSource.getRepository(RewardPoint);
    this.rewardConfigRepository = AppDataSource.getRepository(RewardConfiguration);
    this.userRepository = AppDataSource.getRepository(User);
  }

  /**
   * Award points for task completion
   * Returns null if user is not eligible (CEO/MD)
   */
  async awardPoints(data: {
    userId: number;
    taskId: string;
    completionTimeMinutes: number;
    bucket?: string;
    taskType?: string;
    description?: string;
  }): Promise<RewardPoint | null> {
    // Check if user is eligible for rewards
    const isEligible = await permissionService.isEligibleForRewards(data.userId);
    if (!isEligible) {
      console.log(`User ${data.userId} is not eligible for rewards (CEO/MD)`);
      return null;
    }

    // Determine category and points based on completion time
    const { category, points } = await this.calculatePoints(data.completionTimeMinutes);

    const rewardPoint = new RewardPoint();
    rewardPoint.userId = data.userId;
    rewardPoint.taskId = data.taskId;
    rewardPoint.points = points;
    rewardPoint.completionSpeedCategory = category;
    rewardPoint.completionTimeMinutes = data.completionTimeMinutes;
    rewardPoint.bucket = data.bucket || null;
    rewardPoint.taskType = data.taskType || null;
    rewardPoint.description = data.description || null;

    return await this.rewardPointRepository.save(rewardPoint);
  }

  /**
   * Calculate points based on completion time
   */
  async calculatePoints(completionTimeMinutes: number): Promise<{
    category: string;
    points: number;
  }> {
    // Get active reward configurations
    const configs = await this.rewardConfigRepository.find({
      where: { isActive: true },
      order: { maxMinutes: 'ASC' },
    });

    // Find matching category
    for (const config of configs) {
      const minMinutes = config.minMinutes || 0;
      const maxMinutes = config.maxMinutes || Infinity;
      
      if (completionTimeMinutes >= minMinutes && completionTimeMinutes <= maxMinutes) {
        return {
          category: config.category,
          points: config.points,
        };
      }
    }

    // Default fallback - medium completion
    return {
      category: 'medium',
      points: 3,
    };
  }

  /**
   * Get user's total points
   */
  async getUserTotalPoints(userId: number): Promise<number> {
    const result = await this.rewardPointRepository
      .createQueryBuilder('reward')
      .select('SUM(reward.points)', 'total')
      .where('reward.userId = :userId', { userId })
      .getRawOne();

    return parseInt(result?.total) || 0;
  }

  /**
   * Get user points by period (monthly)
   */
  async getUserMonthlyPoints(userId: number, year: number, month: number): Promise<number> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const result = await this.rewardPointRepository
      .createQueryBuilder('reward')
      .select('SUM(reward.points)', 'total')
      .where('reward.userId = :userId', { userId })
      .andWhere('reward.awardedAt >= :startDate', { startDate })
      .andWhere('reward.awardedAt <= :endDate', { endDate })
      .getRawOne();

    return parseInt(result?.total) || 0;
  }

  /**
   * Get top performers leaderboard
   */
  async getTopPerformers(limit: number = 10): Promise<Array<{
    userId: number;
    userName: string;
    totalPoints: number;
    tasksCompleted: number;
  }>> {
    const results = await this.rewardPointRepository
      .createQueryBuilder('reward')
      .select('reward.userId', 'userId')
      .addSelect('user.name', 'userName')
      .addSelect('SUM(reward.points)', 'totalPoints')
      .addSelect('COUNT(*)', 'tasksCompleted')
      .leftJoin('reward.user', 'user')
      .groupBy('reward.userId')
      .addGroupBy('user.name')
      .orderBy('totalPoints', 'DESC')
      .limit(limit)
      .getRawMany();

    return results.map(r => ({
      userId: parseInt(r.userId),
      userName: r.userName || 'Unknown',
      totalPoints: parseInt(r.totalPoints) || 0,
      tasksCompleted: parseInt(r.tasksCompleted) || 0,
    }));
  }

  /**
   * Get monthly leaderboard
   */
  async getMonthlyLeaderboard(year: number, month: number, limit: number = 10): Promise<Array<{
    userId: number;
    userName: string;
    totalPoints: number;
    tasksCompleted: number;
  }>> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const results = await this.rewardPointRepository
      .createQueryBuilder('reward')
      .select('reward.userId', 'userId')
      .addSelect('user.name', 'userName')
      .addSelect('SUM(reward.points)', 'totalPoints')
      .addSelect('COUNT(*)', 'tasksCompleted')
      .leftJoin('reward.user', 'user')
      .where('reward.awardedAt >= :startDate', { startDate })
      .andWhere('reward.awardedAt <= :endDate', { endDate })
      .groupBy('reward.userId')
      .addGroupBy('user.name')
      .orderBy('totalPoints', 'DESC')
      .limit(limit)
      .getRawMany();

    return results.map(r => ({
      userId: parseInt(r.userId),
      userName: r.userName || 'Unknown',
      totalPoints: parseInt(r.totalPoints) || 0,
      tasksCompleted: parseInt(r.tasksCompleted) || 0,
    }));
  }

  /**
   * Get department/bucket leaderboard
   */
  async getBucketLeaderboard(bucket: string, limit: number = 10): Promise<Array<{
    userId: number;
    userName: string;
    totalPoints: number;
    tasksCompleted: number;
  }>> {
    const results = await this.rewardPointRepository
      .createQueryBuilder('reward')
      .select('reward.userId', 'userId')
      .addSelect('user.name', 'userName')
      .addSelect('SUM(reward.points)', 'totalPoints')
      .addSelect('COUNT(*)', 'tasksCompleted')
      .leftJoin('reward.user', 'user')
      .where('reward.bucket = :bucket', { bucket })
      .groupBy('reward.userId')
      .addGroupBy('user.name')
      .orderBy('totalPoints', 'DESC')
      .limit(limit)
      .getRawMany();

    return results.map(r => ({
      userId: parseInt(r.userId),
      userName: r.userName || 'Unknown',
      totalPoints: parseInt(r.totalPoints) || 0,
      tasksCompleted: parseInt(r.tasksCompleted) || 0,
    }));
  }

  /**
   * Get user's reward history
   */
  async getUserRewards(userId: number, limit: number = 20): Promise<RewardPoint[]> {
    return await this.rewardPointRepository.find({
      where: { userId },
      relations: ['user'],
      order: { awardedAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Create/update reward configuration (SUPERADMIN only)
   */
  async updateRewardConfig(data: {
    category: string;
    points: number;
    maxMinutes?: number;
    minMinutes?: number;
    description?: string;
  }): Promise<RewardConfiguration> {
    let config = await this.rewardConfigRepository.findOne({
      where: { category: data.category },
    });

    if (config) {
      config.points = data.points;
      config.maxMinutes = data.maxMinutes !== undefined ? data.maxMinutes : null;
      config.minMinutes = data.minMinutes !== undefined ? data.minMinutes : null;
      config.description = data.description || null;
      config.updatedAt = new Date();
    } else {
      config = new RewardConfiguration();
      config.category = data.category;
      config.points = data.points;
      config.maxMinutes = data.maxMinutes !== undefined ? data.maxMinutes : null;
      config.minMinutes = data.minMinutes !== undefined ? data.minMinutes : null;
      config.description = data.description || null;
      config.isActive = true;
    }

    return await this.rewardConfigRepository.save(config);
  }

  /**
   * Get all reward configurations
   */
  async getRewardConfigurations(): Promise<RewardConfiguration[]> {
    return await this.rewardConfigRepository.find({
      order: { minMinutes: 'ASC' },
    });
  }

  /**
   * Initialize default reward configurations
   */
  async initializeDefaultConfigs(): Promise<void> {
    const defaultConfigs = [
      { category: 'fast', points: 5, maxMinutes: 30, minMinutes: 0, description: 'Fast completion (0-30 minutes)' },
      { category: 'medium', points: 3, maxMinutes: 120, minMinutes: 31, description: 'Medium completion (31-120 minutes)' },
      { category: 'slow', points: 1, maxMinutes: null, minMinutes: 121, description: 'Slow completion (121+ minutes)' },
    ];

    for (const config of defaultConfigs) {
      const existing = await this.rewardConfigRepository.findOne({
        where: { category: config.category },
      });

      if (!existing) {
        await this.rewardConfigRepository.save({
          ...config,
          isActive: true,
        });
      }
    }
  }

  /**
   * Get reward statistics
   */
  async getRewardStats(): Promise<{
    totalPointsAwarded: number;
    totalTasksCompleted: number;
    avgPointsPerTask: number;
    fastestUser: { userId: number; userName: string; avgTime: number } | null;
    mostProductiveUser: { userId: number; userName: string; tasksCompleted: number } | null;
  }> {
    const totalStats = await this.rewardPointRepository
      .createQueryBuilder('reward')
      .select('SUM(reward.points)', 'totalPoints')
      .addSelect('COUNT(*)', 'totalTasks')
      .addSelect('AVG(reward.points)', 'avgPoints')
      .getRawOne();

    const fastestUser = await this.rewardPointRepository
      .createQueryBuilder('reward')
      .select('reward.userId', 'userId')
      .addSelect('user.name', 'userName')
      .addSelect('AVG(reward.completionTimeMinutes)', 'avgTime')
      .leftJoin('reward.user', 'user')
      .where('reward.completionSpeedCategory = :category', { category: 'fast' })
      .groupBy('reward.userId')
      .addGroupBy('user.name')
      .orderBy('avgTime', 'ASC')
      .limit(1)
      .getRawOne();

    const mostProductive = await this.rewardPointRepository
      .createQueryBuilder('reward')
      .select('reward.userId', 'userId')
      .addSelect('user.name', 'userName')
      .addSelect('COUNT(*)', 'tasksCompleted')
      .leftJoin('reward.user', 'user')
      .groupBy('reward.userId')
      .addGroupBy('user.name')
      .orderBy('tasksCompleted', 'DESC')
      .limit(1)
      .getRawOne();

    return {
      totalPointsAwarded: parseInt(totalStats?.totalPoints) || 0,
      totalTasksCompleted: parseInt(totalStats?.totalTasks) || 0,
      avgPointsPerTask: parseFloat(totalStats?.avgPoints) || 0,
      fastestUser: fastestUser ? {
        userId: parseInt(fastestUser.userId),
        userName: fastestUser.userName || 'Unknown',
        avgTime: parseFloat(fastestUser.avgTime),
      } : null,
      mostProductiveUser: mostProductive ? {
        userId: parseInt(mostProductive.userId),
        userName: mostProductive.userName || 'Unknown',
        tasksCompleted: parseInt(mostProductive.tasksCompleted),
      } : null,
    };
  }
}

// Export singleton instance
export const rewardService = new RewardService();