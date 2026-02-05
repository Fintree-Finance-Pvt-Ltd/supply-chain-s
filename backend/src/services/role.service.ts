import { AppDataSource } from '../config/database';
import { Role, RolePermission, Permission } from '../entities';
import { Repository } from 'typeorm';

export class RoleService {
  private roleRepository: Repository<Role>;
  private rolePermissionRepository: Repository<RolePermission>;
  private permissionRepository: Repository<Permission>;

  constructor() {
    this.roleRepository = AppDataSource.getRepository(Role);
    this.rolePermissionRepository = AppDataSource.getRepository(RolePermission);
    this.permissionRepository = AppDataSource.getRepository(Permission);
  }

  async createRole(data: {
    name: string;
    label: string;
    description?: string;
  }): Promise<Role> {
    // Check if role exists
    const existingRole = await this.roleRepository.findOne({
      where: { name: data.name },
    });

    if (existingRole) {
      throw new Error('Role with this name already exists');
    }

    const role = this.roleRepository.create({
      name: data.name,
      label: data.label,
      description: data.description,
      isActive: true,
    });

    return await this.roleRepository.save(role);
  }

  async getRoles(): Promise<Role[]> {
    return await this.roleRepository.find({
      relations: ['rolePermissions', 'rolePermissions.permission'],
      order: { createdAt: 'DESC' },
    });
  }

  async getRoleById(id: number): Promise<Role | null> {
    return await this.roleRepository.findOne({
      where: { id },
      relations: ['rolePermissions', 'rolePermissions.permission', 'userRoles'],
    });
  }

  async updateRole(
    id: number,
    data: Partial<Role>
  ): Promise<Role> {
    const role = await this.roleRepository.findOne({ where: { id } });

    if (!role) {
      throw new Error('Role not found');
    }

    if (data.label) role.label = data.label;
    if (data.description !== undefined) role.description = data.description;
    if (data.isActive !== undefined) role.isActive = data.isActive;

    return await this.roleRepository.save(role);
  }

  async deleteRole(id: number): Promise<void> {
    const role = await this.roleRepository.findOne({ where: { id } });

    if (!role) {
      throw new Error('Role not found');
    }

    // Hard delete - remove all related permissions and role assignments
    await this.rolePermissionRepository.delete({ roleId: id });
    await this.roleRepository.delete({ id });
  }

  async toggleRoleStatus(id: number): Promise<Role> {
    const role = await this.roleRepository.findOne({ where: { id } });

    if (!role) {
      throw new Error('Role not found');
    }

    role.isActive = !role.isActive;
    return await this.roleRepository.save(role);
  }

  async assignPermission(roleId: number, permissionId: number): Promise<RolePermission> {
    // Verify role exists
    const role = await this.roleRepository.findOne({ where: { id: roleId } });
    if (!role) {
      throw new Error('Role not found');
    }

    // Verify permission exists
    const permission = await this.permissionRepository.findOne({ where: { id: permissionId } });
    if (!permission) {
      throw new Error('Permission not found');
    }

    // Check if assignment already exists
    const existing = await this.rolePermissionRepository.findOne({
      where: { roleId, permissionId },
    });

    if (existing) {
      return existing;
    }

    const rolePermission = this.rolePermissionRepository.create({
      roleId,
      permissionId,
    });

    return await this.rolePermissionRepository.save(rolePermission);
  }

  async removePermission(roleId: number, permissionId: number): Promise<void> {
    const rolePermission = await this.rolePermissionRepository.findOne({
      where: { roleId, permissionId },
    });

    if (rolePermission) {
      await this.rolePermissionRepository.remove(rolePermission);
    }
  }
}
