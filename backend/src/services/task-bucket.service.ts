import { AppDataSource } from '../config/database';
import { TaskBucketMapping } from '../entities/TaskBucketMapping';
import { Role } from '../entities/Role';
import { User } from '../entities/User';
import { UserRole } from '../entities/UserRole';
import { Repository } from 'typeorm';
import { ROLES } from '../config/constants';

/**
 * Task Bucket Mapping Service
 * Handles role-based task distribution system
 */
export class TaskBucketService {
  private taskBucketRepository: Repository<TaskBucketMapping>;
  private roleRepository: Repository<Role>;
  private userRoleRepository: Repository<UserRole>;
  private userRepository: Repository<User>;

  constructor() {
    this.taskBucketRepository = AppDataSource.getRepository(TaskBucketMapping);
    this.roleRepository = AppDataSource.getRepository(Role);
    this.userRoleRepository = AppDataSource.getRepository(UserRole);
    this.userRepository = AppDataSource.getRepository(User);
  }

  /**
   * Create a task bucket mapping
   */
  async createBucketMapping(data: {
    roleId: number;
    bucketName: string;
    description?: string;
    priority?: number;
    taskTypeFilter?: string;
  }): Promise<TaskBucketMapping> {
    const mapping = this.taskBucketRepository.create({
      roleId: data.roleId,
      bucketName: data.bucketName,
      description: data.description,
      priority: data.priority || 0,
      taskTypeFilter: data.taskTypeFilter,
      isActive: true,
    });

    return await this.taskBucketRepository.save(mapping);
  }

  /**
   * Get bucket for a role
   */
  async getBucketForRole(roleId: number): Promise<TaskBucketMapping | null> {
    return await this.taskBucketRepository.findOne({
      where: { roleId, isActive: true },
      relations: ['role'],
      order: { priority: 'DESC' },
    });
  }

  /**
   * Get all bucket mappings
   */
  async getAllBucketMappings(): Promise<TaskBucketMapping[]> {
    return await this.taskBucketRepository.find({
      where: { isActive: true },
      relations: ['role'],
      order: { priority: 'DESC' },
    });
  }

  /**
   * Get bucket mappings by role name
   */
  async getBucketsByRoleName(roleName: string): Promise<TaskBucketMapping[]> {
    const role = await this.roleRepository.findOne({
      where: { name: roleName },
    });

    if (!role) {
      return [];
    }

    return await this.taskBucketRepository.find({
      where: { roleId: role.id, isActive: true },
      order: { priority: 'DESC' },
    });
  }

  /**
   * Get users by bucket
   */
  async getUsersByBucket(bucketName: string): Promise<User[]> {
    const bucketMappings = await this.taskBucketRepository.find({
      where: { bucketName, isActive: true },
      relations: ['role'],
    });

    const roleIds = bucketMappings.map(m => m.roleId);

    if (roleIds.length === 0) {
      return [];
    }

    const userRoles = await this.userRoleRepository.find({
      where: roleIds.map(rid => ({ roleId: rid, isActive: true })),
      relations: ['user'],
    });

    const userMap = new Map<number, User>();
    userRoles.forEach(ur => {
      if (ur.user && !userMap.has(ur.user.id)) {
        userMap.set(ur.user.id, ur.user);
      }
    });

    return Array.from(userMap.values());
  }

  /**
   * Get task distribution by role
   */
  async getTaskDistributionByRole(): Promise<Array<{
    roleId: number;
    roleName: string;
    bucketName: string;
    userCount: number;
  }>> {
    const bucketMappings = await this.taskBucketRepository.find({
      where: { isActive: true },
      relations: ['role'],
    });

    const results: Array<{
      roleId: number;
      roleName: string;
      bucketName: string;
      userCount: number;
    }> = [];

    for (const mapping of bucketMappings) {
      const userRoles = await this.userRoleRepository.count({
        where: { roleId: mapping.roleId, isActive: true },
      });

      results.push({
        roleId: mapping.roleId,
        roleName: mapping.role?.name || 'Unknown',
        bucketName: mapping.bucketName,
        userCount: userRoles,
      });
    }

    return results;
  }

  /**
   * Get task distribution by user
   */
  async getTaskDistributionByUser(): Promise<Array<{
    userId: number;
    userName: string;
    roles: string[];
    buckets: string[];
    tasksAssignedCount: number;
    tasksCompletedCount: number;
  }>> {
    const users = await this.userRepository.find({
      where: { isActive: true },
      relations: ['userRoles', 'userRoles.role'],
    });

    const results = [];

    for (const user of users) {
      const roles = user.userRoles
        ?.filter(ur => ur.isActive)
        .map(ur => ur.role?.name)
        .filter(Boolean) as string[] || [];

      const buckets = user.userRoles
        ?.filter(ur => ur.isActive)
        .map(ur => ur.role?.name)
        .filter(Boolean) as string[] || [];

      // For now, task counts would come from task tracking service
      // This is a placeholder for the structure
      results.push({
        userId: user.id,
        userName: user.name,
        roles,
        buckets: [...new Set(buckets)],
        tasksAssignedCount: 0,
        tasksCompletedCount: 0,
      });
    }

    return results;
  }

  /**
   * Initialize default bucket mappings for standard roles
   */
  async initializeDefaultBuckets(): Promise<void> {
    // Define default bucket mappings
    const defaultMappings = [
      { roleName: ROLES.ANALYST, bucketName: 'Bucket A', description: 'Analyst tasks', priority: 10 },
      { roleName: ROLES.REVIEWER, bucketName: 'Bucket B', description: 'Reviewer tasks', priority: 20 },
      { roleName: ROLES.MANAGER, bucketName: 'Bucket C', description: 'Manager tasks', priority: 30 },
      { roleName: ROLES.RELATIONSHIP_MANAGER, bucketName: 'Bucket A', description: 'RM tasks', priority: 10 },
      { roleName: ROLES.CREDIT_TEAM_L1, bucketName: 'Bucket A', description: 'L1 Credit tasks', priority: 10 },
      { roleName: ROLES.CREDIT_TEAM_L2, bucketName: 'Bucket B', description: 'L2 Credit tasks', priority: 20 },
      { roleName: ROLES.OPERATIONS_TEAM_L1, bucketName: 'Bucket A', description: 'L1 Ops tasks', priority: 10 },
      { roleName: ROLES.OPERATIONS_TEAM_L2, bucketName: 'Bucket B', description: 'L2 Ops tasks', priority: 20 },
      { roleName: ROLES.OPERATIONS_HEAD, bucketName: 'Bucket C', description: 'Ops Head tasks', priority: 30 },
    ];

    for (const mapping of defaultMappings) {
      const role = await this.roleRepository.findOne({
        where: { name: mapping.roleName },
      });

      if (!role) continue;

      // Check if mapping already exists
      const existing = await this.taskBucketRepository.findOne({
        where: { roleId: role.id, bucketName: mapping.bucketName },
      });

      if (!existing) {
        await this.taskBucketRepository.save({
          roleId: role.id,
          bucketName: mapping.bucketName,
          description: mapping.description,
          priority: mapping.priority,
          isActive: true,
        });
      }
    }
  }

  /**
   * Update bucket mapping
   */
  async updateBucketMapping(
    id: number,
    data: Partial<TaskBucketMapping>
  ): Promise<TaskBucketMapping | null> {
    const mapping = await this.taskBucketRepository.findOne({
      where: { id },
    });

    if (!mapping) {
      return null;
    }

    if (data.bucketName !== undefined) mapping.bucketName = data.bucketName;
    if (data.description !== undefined) mapping.description = data.description;
    if (data.priority !== undefined) mapping.priority = data.priority;
    if (data.taskTypeFilter !== undefined) mapping.taskTypeFilter = data.taskTypeFilter;
    if (data.isActive !== undefined) mapping.isActive = data.isActive;

    return await this.taskBucketRepository.save(mapping);
  }

  /**
   * Delete bucket mapping
   */
  async deleteBucketMapping(id: number): Promise<boolean> {
    const result = await this.taskBucketRepository.delete({ id });
    return (result.affected || 0) > 0;
  }
}

// Export singleton instance
export const taskBucketService = new TaskBucketService();