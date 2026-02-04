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
    roleId?: number;
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
    });

    const savedUser = await this.userRepository.save(user);

    // Assign role if provided
    if (data.roleId) {
      await this.assignRole(savedUser.id, data.roleId);
    }

    return savedUser;
  }

  async getUsers(): Promise<User[]> {
    return await this.userRepository.find({
      relations: ['userRoles', 'userRoles.role'],
      order: { createdAt: 'DESC' },
    });
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

    // If password is being updated, hash it
    if (data.password) {
      data.password = await hashPassword(data.password);
    }

    Object.assign(user, data);
    return await this.userRepository.save(user);
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

    if (existing) {
      existing.isActive = true;
      return await this.userRoleRepository.save(existing);
    }

    const userRole = this.userRoleRepository.create({
      userId,
      roleId,
      assignedBy,
    });

    return await this.userRoleRepository.save(userRole);
  }

  async removeRole(userId: number, roleId: number): Promise<void> {
    const userRole = await this.userRoleRepository.findOne({
      where: { userId, roleId },
    });

    if (userRole) {
      userRole.isActive = false;
      await this.userRoleRepository.save(userRole);
    }
  }
}



