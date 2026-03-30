import { AppDataSource } from '../config/database';
import { Role, Permission, RolePermission, UserRole, User } from '../entities';
import { Repository } from 'typeorm';
import { ROLES, REWARD_INELIGIBLE_ROLES, ROLE_HIERARCHY } from '../config/constants';

/**
 * Permission Service
 * Handles multi-role permission merging and SUPERADMIN access control
 */
export class PermissionService {
  private roleRepository: Repository<Role>;
  private permissionRepository: Repository<Permission>;
  private rolePermissionRepository: Repository<RolePermission>;
  private userRoleRepository: Repository<UserRole>;
  private userRepository: Repository<User>;

  constructor() {
    this.roleRepository = AppDataSource.getRepository(Role);
    this.permissionRepository = AppDataSource.getRepository(Permission);
    this.rolePermissionRepository = AppDataSource.getRepository(RolePermission);
    this.userRoleRepository = AppDataSource.getRepository(UserRole);
    this.userRepository = AppDataSource.getRepository(User);
  }

  /**
   * Get all roles for a user (multi-role support)
   */
  async getUserRoles(userId: number): Promise<Role[]> {
    const userRoles = await this.userRoleRepository.find({
      where: { userId, isActive: true },
      relations: ['role', 'role.rolePermissions', 'role.rolePermissions.permission'],
    });
    return userRoles.map(ur => ur.role);
  }

  /**
   * Get user role names (multi-role support)
   */
  async getUserRoleNames(userId: number): Promise<string[]> {
    const roles = await this.getUserRoles(userId);
    return roles.map(role => role.name);
  }

  /**
   * Check if user has SUPERADMIN role
   */
  async hasSuperAdminRole(userId: number): Promise<boolean> {
    const roleNames = await this.getUserRoleNames(userId);
    return roleNames.includes(ROLES.SUPERADMIN);
  }

  /**
   * Check if user is CEO (executive role)
   */
  async hasCeoRole(userId: number): Promise<boolean> {
    const roleNames = await this.getUserRoleNames(userId);
    return roleNames.includes(ROLES.CEO);
  }

  /**
   * Check if user is MD (Managing Director)
   */
  async hasMdRole(userId: number): Promise<boolean> {
    const roleNames = await this.getUserRoleNames(userId);
    return roleNames.includes(ROLES.MD);
  }

  /**
   * Check if user has any admin-level role
   */
  async hasAdminRole(userId: number): Promise<boolean> {
    const roleNames = await this.getUserRoleNames(userId);
    return roleNames.includes(ROLES.ADMIN) || roleNames.includes(ROLES.SUPERADMIN);
  }

  /**
   * Check if user is eligible for reward points
   * CEO and MD are NOT eligible for rewards
   */
  async isEligibleForRewards(userId: number): Promise<boolean> {
    const roleNames = await this.getUserRoleNames(userId);
    // Check if any of the reward-ineligible roles are present
    const hasIneligibleRole = roleNames.some(role => 
      REWARD_INELIGIBLE_ROLES.includes(role as any)
    );
    return !hasIneligibleRole;
  }

  /**
   * Check if user has any of the specified roles
   * Multi-role support: returns true if user has ANY of the specified roles
   */
  async hasAnyRole(userId: number, allowedRoles: string[]): Promise<boolean> {
    const userRoles = await this.getUserRoleNames(userId);
    return allowedRoles.some(role => userRoles.includes(role));
  }

  /**
   * Check if user has ALL of the specified roles
   */
  async hasAllRoles(userId: number, requiredRoles: string[]): Promise<boolean> {
    const userRoles = await this.getUserRoleNames(userId);
    return requiredRoles.every(role => userRoles.includes(role));
  }

  /**
   * Merge permissions from all user roles (multi-role support)
   * Returns union of all permissions
   */
  async checkUserPermissions(userId: number): Promise<Permission[]> {
    const userRoles = await this.getUserRoles(userId);
    
    // Collect all permissions from all roles
    const allPermissions: Permission[] = [];
    const permissionSet = new Set<number>(); // Track by ID to avoid duplicates

    for (const role of userRoles) {
      if (role.rolePermissions) {
        for (const rp of role.rolePermissions) {
          if (rp.permission && !permissionSet.has(rp.permission.id)) {
            permissionSet.add(rp.permission.id);
            allPermissions.push(rp.permission);
          }
        }
      }
    }

    return allPermissions;
  }

  /**
   * Get user's effective permission names
   */
  async getUserPermissionNames(userId: number): Promise<string[]> {
    const permissions = await this.checkUserPermissions(userId);
    return permissions.map(p => p.name);
  }

  /**
   * Check if user has a specific permission
   * Supports multi-role: checks all user roles
   */
  async hasPermission(userId: number, permissionName: string): Promise<boolean> {
    // SUPERADMIN has all permissions
    const isSuperAdmin = await this.hasSuperAdminRole(userId);
    if (isSuperAdmin) {
      return true;
    }

    const permissions = await this.getUserPermissionNames(userId);
    return permissions.includes(permissionName);
  }

  /**
   * Check if user can access all data (SUPERADMIN)
   */
  async canAccessAllData(userId: number): Promise<boolean> {
    return await this.hasSuperAdminRole(userId);
  }

  /**
   * Check if user has executive visibility (CEO, MD, CFO, SUPERADMIN)
   */
  async hasExecutiveVisibility(userId: number): Promise<boolean> {
    const roleNames = await this.getUserRoleNames(userId);
    const executiveRoles = [ROLES.CEO, ROLES.MD, ROLES.CFO, ROLES.SUPERADMIN, ROLES.ADMIN];
    return roleNames.some(role => (executiveRoles as string[]).includes(role));
  }

  /**
   * Get user's highest role level
   */
  async getHighestRoleLevel(userId: number): Promise<number> {
    const roleNames = await this.getUserRoleNames(userId);
    let highestLevel = 0;
    
    for (const roleName of roleNames) {
      const level = ROLE_HIERARCHY[roleName] || 0;
      if (level > highestLevel) {
        highestLevel = level;
      }
    }
    
    return highestLevel;
  }

  /**
   * Check if user can view another user's data
   * SUPERADMIN can view all users
   * Managers can view their team members
   */
  async canViewUserData(viewerId: number, targetUserId: number): Promise<boolean> {
    // Same user can always view their own data
    if (viewerId === targetUserId) {
      return true;
    }

    // SUPERADMIN can view all users
    const isSuperAdmin = await this.hasSuperAdminRole(viewerId);
    if (isSuperAdmin) {
      return true;
    }

    // Executive roles can view all users
    const hasExecutive = await this.hasExecutiveVisibility(viewerId);
    if (hasExecutive) {
      return true;
    }

    // TODO: Add team-based access control here
    // For now, return false - only SUPERADMIN and executives can view other users
    return false;
  }

  /**
   * Assign a role to a user
   */
  async assignRoleToUser(userId: number, roleId: number, assignedBy?: number): Promise<UserRole> {
    // Check if assignment already exists
    const existing = await this.userRoleRepository.findOne({
      where: { userId, roleId, isActive: true },
    });

    if (existing) {
      return existing;
    }

    const userRole = this.userRoleRepository.create({
      userId,
      roleId,
      assignedBy: assignedBy || null,
      isActive: true,
    });

    return await this.userRoleRepository.save(userRole);
  }

  /**
   * Remove a role from a user
   */
  async removeRoleFromUser(userId: number, roleId: number): Promise<void> {
    const userRole = await this.userRoleRepository.findOne({
      where: { userId, roleId, isActive: true },
    });

    if (userRole) {
      userRole.isActive = false;
      await this.userRoleRepository.save(userRole);
    }
  }

  /**
   * Get all users with a specific role
   */
  async getUsersByRole(roleName: string): Promise<User[]> {
    const role = await this.roleRepository.findOne({
      where: { name: roleName },
      relations: ['userRoles', 'userRoles.user'],
    });

    if (!role) {
      return [];
    }

    return role.userRoles
      .filter(ur => ur.isActive)
      .map(ur => ur.user);
  }

  /**
   * Get SUPERADMIN users
   */
  async getSuperAdmins(): Promise<User[]> {
    return await this.getUsersByRole(ROLES.SUPERADMIN);
  }

  /**
   * Create SUPERADMIN role with full permissions
   */
  async createSuperAdminRole(): Promise<Role> {
    // Check if SUPERADMIN role already exists
    let superAdminRole = await this.roleRepository.findOne({
      where: { name: ROLES.SUPERADMIN },
      relations: ['rolePermissions'],
    });

    if (superAdminRole) {
      return superAdminRole;
    }

    // Create SUPERADMIN role
    superAdminRole = await this.roleRepository.save({
      name: ROLES.SUPERADMIN,
      label: 'Super Administrator',
      description: 'Full system access with global visibility across all modules',
      isActive: true,
    });

    // Get all existing permissions and assign to SUPERADMIN
    const allPermissions = await this.permissionRepository.find();
    for (const permission of allPermissions) {
      await this.rolePermissionRepository.save({
        roleId: superAdminRole.id,
        permissionId: permission.id,
      });
    }

    return superAdminRole;
  }
}

// Export singleton instance
export const permissionService = new PermissionService();