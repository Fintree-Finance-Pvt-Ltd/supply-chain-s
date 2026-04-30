import { AppDataSource } from '../config/database';
import { TaskTimeTracking } from '../entities/TaskTimeTracking';
import { Repository } from 'typeorm';

/**
 * Roles that should NOT have timing calculated
 * Admin and SuperAdmin are excluded from time tracking
 */
const EXCLUDED_ROLES = ['admin', 'superadmin'];

/**
 * Operational roles that ARE included in time tracking
 */
const OPERATIONAL_ROLES = [
  'relationship_manager',
  'credit_team_l1',
  'credit_team_l2',
  'credit_head',
  'operations_team_l1',
  'operations_team_l2',
  'operations_head',
  'ceo',
  'md',
];

/**
 * Check if a role should have timing calculated
 * @param roleName - The role name to check
 * @returns true if timing should be calculated, false otherwise
 */
function shouldCalculateTiming(roleName: string): boolean {
  const normalizedRole = roleName.toLowerCase();
  // Don't calculate timing for Admin or SuperAdmin
  if (EXCLUDED_ROLES.includes(normalizedRole)) {
    return false;
  }
  // Calculate timing for all operational roles
  return OPERATIONAL_ROLES.includes(normalizedRole) || normalizedRole.includes('operations') || normalizedRole.includes('credit');
}

/**
 * Task Time Tracking Service
 * Tracks and manages task timing metrics
 * 
 * Updated to:
 * - Calculate timing for all operational roles (except Admin and SuperAdmin)
 * - Add role_stage_time calculation for workflow transitions
 * - Ensure visibility of assigned_to, created_at, completed_at for all roles
 */
export class TaskTimeTrackingService {
  private taskTimeTrackingRepository: Repository<TaskTimeTracking>;

  constructor() {
    this.taskTimeTrackingRepository = AppDataSource.getRepository(TaskTimeTracking);
  }

  /**
   * Create a new task time tracking record
   */
  async createTaskTracking(data: {
    userId: number;
    taskId: string;
    taskType: string;
    bucket?: string;
    assignedAt?: Date;
  }): Promise<TaskTimeTracking> {
    const tracking = new TaskTimeTracking();
    tracking.userId = data.userId;
    tracking.taskId = data.taskId;
    tracking.taskType = data.taskType;
    tracking.bucket = data.bucket || null;
    tracking.assignedAt = data.assignedAt || new Date();
    tracking.status = 'pending';
    tracking.isOverdue = false;

    return await this.taskTimeTrackingRepository.save(tracking);
  }

  /**
   * Mark task as started
   */
  async startTask(taskId: string, userId: number): Promise<TaskTimeTracking | null> {
    const tracking = await this.taskTimeTrackingRepository.findOne({
      where: { taskId, userId },
    });

    if (tracking && !tracking.startedAt) {
      tracking.startedAt = new Date();
      tracking.status = 'in_progress';
      return await this.taskTimeTrackingRepository.save(tracking);
    }

    return tracking;
  }

  /**
   * Mark task as completed and calculate times
   */
  async completeTask(
    taskId: string,
    userId: number,
    l1TimeMinutes?: number,
    l2TimeMinutes?: number
  ): Promise<TaskTimeTracking | null> {
    const tracking = await this.taskTimeTrackingRepository.findOne({
      where: { taskId, userId },
    });

    if (tracking) {
      tracking.completedAt = new Date();
      tracking.status = 'completed';

      // Calculate total completion time
      if (tracking.assignedAt) {
        const totalMs = tracking.completedAt.getTime() - tracking.assignedAt.getTime();
        tracking.totalCompletionTimeMinutes = Math.round(totalMs / (1000 * 60));
      }

      // Set L1 and L2 processing times
      if (l1TimeMinutes !== undefined) {
        tracking.l1ProcessingTimeMinutes = l1TimeMinutes;
      }
      if (l2TimeMinutes !== undefined) {
        tracking.l2ProcessingTimeMinutes = l2TimeMinutes;
      }

      return await this.taskTimeTrackingRepository.save(tracking);
    }

    return null;
  }

  /**
   * Mark task as overdue
   */
  async markAsOverdue(taskId: string, userId: number): Promise<TaskTimeTracking | null> {
    const tracking = await this.taskTimeTrackingRepository.findOne({
      where: { taskId, userId },
    });

    if (tracking) {
      tracking.isOverdue = true;
      tracking.status = 'overdue';
      return await this.taskTimeTrackingRepository.save(tracking);
    }

    return null;
  }

  /**
   * Get task tracking by task ID
   */
  async getTrackingByTaskId(taskId: string): Promise<TaskTimeTracking[]> {
    return await this.taskTimeTrackingRepository.find({
      where: { taskId },
      relations: ['user'],
    });
  }

  /**
   * Get user's task tracking records
   */
  async getUserTaskTracking(userId: number, options?: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<TaskTimeTracking[]> {
    const query = this.taskTimeTrackingRepository.createQueryBuilder('tracking')
      .where('tracking.userId = :userId', { userId });

    if (options?.status) {
      query.andWhere('tracking.status = :status', { status: options.status });
    }

    query.orderBy('tracking.createdAt', 'DESC');

    if (options?.limit) {
      query.take(options.limit);
    }
    if (options?.offset) {
      query.skip(options.offset);
    }

    return await query.getMany();
  }

  /**
   * Get task statistics for a user
   */
  async getUserTaskStats(userId: number): Promise<{
    totalTasks: number;
    completedTasks: number;
    pendingTasks: number;
    overdueTasks: number;
    avgCompletionTime: number | null;
    avgL1Time: number | null;
    avgL2Time: number | null;
  }> {
    const stats = await this.taskTimeTrackingRepository
      .createQueryBuilder('tracking')
      .select('COUNT(*)', 'totalTasks')
      .addSelect('SUM(CASE WHEN tracking.status = \'completed\' THEN 1 ELSE 0 END)', 'completedTasks')
      .addSelect('SUM(CASE WHEN tracking.status = \'pending\' THEN 1 ELSE 0 END)', 'pendingTasks')
      .addSelect('SUM(CASE WHEN tracking.isOverdue = true THEN 1 ELSE 0 END)', 'overdueTasks')
      .addSelect('AVG(tracking.totalCompletionTimeMinutes)', 'avgCompletionTime')
      .addSelect('AVG(tracking.l1ProcessingTimeMinutes)', 'avgL1Time')
      .addSelect('AVG(tracking.l2ProcessingTimeMinutes)', 'avgL2Time')
      .where('tracking.userId = :userId', { userId })
      .getRawOne();

    return {
      totalTasks: parseInt(stats.totalTasks) || 0,
      completedTasks: parseInt(stats.completedTasks) || 0,
      pendingTasks: parseInt(stats.pendingTasks) || 0,
      overdueTasks: parseInt(stats.overdueTasks) || 0,
      avgCompletionTime: stats.avgCompletionTime ? parseFloat(stats.avgCompletionTime) : null,
      avgL1Time: stats.avgL1Time ? parseFloat(stats.avgL1Time) : null,
      avgL2Time: stats.avgL2Time ? parseFloat(stats.avgL2Time) : null,
    };
  }

  /**
   * Get all users with their task statistics (for SUPERADMIN)
   */
  async getAllUsersTaskStats(): Promise<Array<{
    userId: number;
    userName: string;
    totalTasks: number;
    completedTasks: number;
    pendingTasks: number;
    overdueTasks: number;
    avgCompletionTime: number | null;
    avgL1Time: number | null;
    avgL2Time: number | null;
  }>> {
    const results = await this.taskTimeTrackingRepository
      .createQueryBuilder('tracking')
      .select('tracking.userId', 'userId')
      .addSelect('tracking.user->name', 'userName')
      .addSelect('COUNT(*)', 'totalTasks')
      .addSelect('SUM(CASE WHEN tracking.status = \'completed\' THEN 1 ELSE 0 END)', 'completedTasks')
      .addSelect('SUM(CASE WHEN tracking.status = \'pending\' THEN 1 ELSE 0 END)', 'pendingTasks')
      .addSelect('SUM(CASE WHEN tracking.isOverdue = true THEN 1 ELSE 0 END)', 'overdueTasks')
      .addSelect('AVG(tracking.totalCompletionTimeMinutes)', 'avgCompletionTime')
      .addSelect('AVG(tracking.l1ProcessingTimeMinutes)', 'avgL1Time')
      .addSelect('AVG(tracking.l2ProcessingTimeMinutes)', 'avgL2Time')
      .leftJoin('tracking.user', 'user')
      .groupBy('tracking.userId')
      .addGroupBy('user.name')
      .orderBy('completedTasks', 'DESC')
      .getRawMany();

    return results.map(r => ({
      userId: parseInt(r.userId),
      userName: r.userName || 'Unknown',
      totalTasks: parseInt(r.totalTasks) || 0,
      completedTasks: parseInt(r.completedTasks) || 0,
      pendingTasks: parseInt(r.pendingTasks) || 0,
      overdueTasks: parseInt(r.overdueTasks) || 0,
      avgCompletionTime: r.avgCompletionTime ? parseFloat(r.avgCompletionTime) : null,
      avgL1Time: r.avgL1Time ? parseFloat(r.avgL1Time) : null,
      avgL2Time: r.avgL2Time ? parseFloat(r.avgL2Time) : null,
    }));
  }

  /**
   * Get fastest closers (users with lowest avg completion time)
   */
  async getFastestClosers(limit: number = 10): Promise<Array<{
    userId: number;
    userName: string;
    avgCompletionTime: number;
    completedTasks: number;
  }>> {
    const results = await this.taskTimeTrackingRepository
      .createQueryBuilder('tracking')
      .select('tracking.userId', 'userId')
      .addSelect('user.name', 'userName')
      .addSelect('AVG(tracking.totalCompletionTimeMinutes)', 'avgCompletionTime')
      .addSelect('COUNT(*)', 'completedTasks')
      .leftJoin('tracking.user', 'user')
      .where('tracking.status = :status', { status: 'completed' })
      .andWhere('tracking.totalCompletionTimeMinutes IS NOT NULL')
      .groupBy('tracking.userId')
      .addGroupBy('user.name')
      .orderBy('avgCompletionTime', 'ASC')
      .limit(limit)
      .getRawMany();

    return results.map(r => ({
      userId: parseInt(r.userId),
      userName: r.userName || 'Unknown',
      avgCompletionTime: parseFloat(r.avgCompletionTime),
      completedTasks: parseInt(r.completedTasks),
    }));
  }

  /**
   * Get slowest closers (users with highest avg completion time)
   */
  async getSlowestClosers(limit: number = 10): Promise<Array<{
    userId: number;
    userName: string;
    avgCompletionTime: number;
    completedTasks: number;
  }>> {
    const results = await this.taskTimeTrackingRepository
      .createQueryBuilder('tracking')
      .select('tracking.userId', 'userId')
      .addSelect('user.name', 'userName')
      .addSelect('AVG(tracking.totalCompletionTimeMinutes)', 'avgCompletionTime')
      .addSelect('COUNT(*)', 'completedTasks')
      .leftJoin('tracking.user', 'user')
      .where('tracking.status = :status', { status: 'completed' })
      .andWhere('tracking.totalCompletionTimeMinutes IS NOT NULL')
      .groupBy('tracking.userId')
      .addGroupBy('user.name')
      .orderBy('avgCompletionTime', 'DESC')
      .limit(limit)
      .getRawMany();

    return results.map(r => ({
      userId: parseInt(r.userId),
      userName: r.userName || 'Unknown',
      avgCompletionTime: parseFloat(r.avgCompletionTime),
      completedTasks: parseInt(r.completedTasks),
    }));
  }

  /**
   * Get tasks by bucket
   */
  async getTasksByBucket(bucket: string): Promise<TaskTimeTracking[]> {
    return await this.taskTimeTrackingRepository.find({
      where: { bucket },
      relations: ['user'],
      order: { assignedAt: 'DESC' },
    });
  }

  /**
   * Get bucket performance statistics
   */
  async getBucketStats(): Promise<Array<{
    bucket: string;
    totalTasks: number;
    completedTasks: number;
    pendingTasks: number;
    avgCompletionTime: number | null;
  }>> {
    const results = await this.taskTimeTrackingRepository
      .createQueryBuilder('tracking')
      .select('tracking.bucket', 'bucket')
      .addSelect('COUNT(*)', 'totalTasks')
      .addSelect('SUM(CASE WHEN tracking.status = \'completed\' THEN 1 ELSE 0 END)', 'completedTasks')
      .addSelect('SUM(CASE WHEN tracking.status = \'pending\' THEN 1 ELSE 0 END)', 'pendingTasks')
      .addSelect('AVG(tracking.totalCompletionTimeMinutes)', 'avgCompletionTime')
      .where('tracking.bucket IS NOT NULL')
      .groupBy('tracking.bucket')
      .orderBy('totalTasks', 'DESC')
      .getRawMany();

    return results.map(r => ({
      bucket: r.bucket,
      totalTasks: parseInt(r.totalTasks) || 0,
      completedTasks: parseInt(r.completedTasks) || 0,
      pendingTasks: parseInt(r.pendingTasks) || 0,
      avgCompletionTime: r.avgCompletionTime ? parseFloat(r.avgCompletionTime) : null,
    }));
  }

  /**
   * Get L1 vs L2 processing comparison
   */
  async getL1L2Comparison(): Promise<{
    avgL1Time: number | null;
    avgL2Time: number | null;
    l1Tasks: number;
    l2Tasks: number;
  }> {
    const result = await this.taskTimeTrackingRepository
      .createQueryBuilder('tracking')
      .select('AVG(tracking.l1ProcessingTimeMinutes)', 'avgL1Time')
      .addSelect('AVG(tracking.l2ProcessingTimeMinutes)', 'avgL2Time')
      .addSelect('SUM(CASE WHEN tracking.l1ProcessingTimeMinutes IS NOT NULL THEN 1 ELSE 0 END)', 'l1Tasks')
      .addSelect('SUM(CASE WHEN tracking.l2ProcessingTimeMinutes IS NOT NULL THEN 1 ELSE 0 END)', 'l2Tasks')
      .getRawOne();

    return {
      avgL1Time: result.avgL1Time ? parseFloat(result.avgL1Time) : null,
      avgL2Time: result.avgL2Time ? parseFloat(result.avgL2Time) : null,
      l1Tasks: parseInt(result.l1Tasks) || 0,
      l2Tasks: parseInt(result.l2Tasks) || 0,
    };
  }
}

// Export singleton instance
export const taskTimeTrackingService = new TaskTimeTrackingService();