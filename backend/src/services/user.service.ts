import { AppDataSource } from '../config/database';
import { User, UserRole, Role } from '../entities';
import { hashPassword } from '../utils/password';
import { Repository } from 'typeorm';

export class UserService {
  private userRepository: Repository<User>;
  private userRoleRepository: Repository<UserRole>;
  private roleRepository: Repository<Role>;

  constructor() {
    this.userRepository = AppDataSource.getRepository(User);
    this.userRoleRepository = AppDataSource.getRepository(UserRole);
    this.roleRepository = AppDataSource.getRepository(Role);
  }

  async createUser(data: {
    name: string;
    email: string;
    password: string;
    mobile?: string;
    defaultRole?: string;
  }): Promise<User> {
    // Check if user exists
    const existingUser = await this.userRepository.findOne({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await hashPassword(data.password);

    // Create user
    const user = this.userRepository.create({
      name: data.name,
      email: data.email,
      password: hashedPassword,
      mobile: data.mobile,
      defaultRole: data.defaultRole,
      isActive: true,
    });

    const savedUser = await this.userRepository.save(user);

    // Assign default role if provided
    if (data.defaultRole) {
      const role = await this.roleRepository.findOne({
        where: { name: data.defaultRole },
      });
      if (role) {
        await this.assignRole(savedUser.id, role.id);
      }
    }

    return savedUser;
  }

  async getUsers(): Promise<User[]> {
    // Use query builder to only get active user roles
    const users = await this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.userRoles', 'userRole', 'userRole.isActive = :isActive', { isActive: true })
      .leftJoinAndSelect('userRole.role', 'role')
      .where('user.isActive = :isActive', { isActive: true })
      .orderBy('user.createdAt', 'DESC')
      .getMany();

    return users;
  }

  async getUserById(id: number): Promise<User | null> {
    return await this.userRepository.findOne({
      where: { id },
      relations: ['userRoles', 'userRoles.role'],
    });
  }

  async updateUser(id: number, data: Partial<User>): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });

    if (!user) {
      throw new Error('User not found');
    }

    // Only update allowed fields
    if (data.name) user.name = data.name;
    if (data.email) user.email = data.email;
    if (data.mobile !== undefined) user.mobile = data.mobile;
    if (data.isActive !== undefined) user.isActive = data.isActive;
    if (data.defaultRole !== undefined) user.defaultRole = data.defaultRole;

    if (
      typeof data.password === 'string' &&
      data.password.trim() !== ''
    ) {
      const nextPasswordTrimmed = data.password.trim();
      const nextHashedPassword = await hashPassword(nextPasswordTrimmed);

      // Debug: confirm password update path + hashed value is generated
      console.log('[UserService.updateUser] updating password', {
        id,
        passwordLength: nextPasswordTrimmed.length,
        hashedLength: nextHashedPassword.length,
        hashedPrefix: nextHashedPassword.slice(0, 10),
      });

      user.password = nextHashedPassword;
    } else {
      console.log('[UserService.updateUser] password not updated (empty/missing)', { id });
    }
    // return await this.userRepository.save(user);
    await this.userRepository.update(
  { id },
  {
    name: user.name,
    email: user.email,
    mobile: user.mobile,
    isActive: user.isActive,
    defaultRole: user.defaultRole,
    password: user.password, // ✅ force update
  }
);

const updatedUser =
  await this.userRepository.findOne({
    where: { id }
  });

console.log(
  "UPDATED PASSWORD:",
  updatedUser?.password
);

return updatedUser!;
  }

  async deleteUser(id: number): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id } });

    if (!user) {
      throw new Error('User not found');
    }

    // Soft delete - set isActive to false
    user.isActive = false;
    await this.userRepository.save(user);
  }

  async assignRole(userId: number, roleId: number, assignedBy?: number): Promise<UserRole> {
    // Check if role assignment already exists
    const existing = await this.userRoleRepository.findOne({
      where: { userId, roleId },
    });
    console.log(existing)
    if (existing) {
      existing.isActive = true;
      return await this.userRoleRepository.save(existing);
    }

    const userRole = this.userRoleRepository.create({
      userId,
      roleId,
      assignedBy,
      isActive: true,
    });

    return await this.userRoleRepository.save(userRole);
  }

  async removeRole(userId: number, roleId: number): Promise<void> {
    const userRole = await this.userRoleRepository.findOne({
      where: { userId, roleId },
    });
    console.log(userId,roleId);
    console.log(userRole)
    if (userRole) {
      userRole.isActive = false;
      await this.userRoleRepository.save(userRole);
    }
  }

  /**
   * Assign multiple roles to a user at once
   * 
   * This is useful for admin to assign both Maker (L1) and Checker (L2) roles
   * to a user in a single operation.
   * 
   * @param userId - The user ID to assign roles to
   * @param roleIds - Array of role IDs to assign
   * @param assignedBy - Optional ID of user performing the assignment
   * @returns Array of created UserRole records
   */
  async assignMultipleRoles(
    userId: number,
    roleIds: number[],
    assignedBy?: number
  ): Promise<UserRole[]> {
    if (!roleIds || roleIds.length === 0) {
      throw new Error('At least one role ID must be provided');
    }

    // Verify user exists
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }

    // Verify all roles exist
    const roles = await this.roleRepository.findByIds(roleIds);
    if (roles.length !== roleIds.length) {
      throw new Error('One or more roles not found');
    }

    const userRoles: UserRole[] = [];

    // Assign each role
    for (const roleId of roleIds) {
      const existing = await this.userRoleRepository.findOne({
        where: { userId, roleId },
      });


      if (existing) {
        // Reactivate if already exists
        existing.isActive = true;
        userRoles.push(await this.userRoleRepository.save(existing));
      } else {
        const userRole = this.userRoleRepository.create({
          userId,
          roleId,
          assignedBy,
          isActive: true,
        });
        userRoles.push(await this.userRoleRepository.save(userRole));
      }
    }

    return userRoles;
  }
}



