import { AppDataSource } from '../config/database';
import { User, UserRole } from '../entities';
import { hashPassword, comparePassword } from '../utils/password';
import { generateToken } from '../utils/jwt';
import { Repository } from 'typeorm';

export class AuthService {
  private userRepository: Repository<User>;
  private userRoleRepository: Repository<UserRole>;

  constructor() {
    this.userRepository = AppDataSource.getRepository(User);
    this.userRoleRepository = AppDataSource.getRepository(UserRole);
  }

  async login(email: string, password: string): Promise<{ user: User; token: string }> {
    const user = await this.userRepository.findOne({
      where: { email, isActive: true },
    });

    if (!user) {
      throw new Error('Invalid Email');
    }
console.log('USER FOUND:',user);
    const isPasswordValid = await comparePassword(password, user.password);
    console.log("isPasswordValid:", isPasswordValid);
    if (!isPasswordValid) {
      throw new Error('Invalid Password');
    }

    // Get user roles
    const userRoles = await this.userRoleRepository.find({
      where: { userId: user.id, isActive: true },
      relations: ['role'],
    });

    const primaryRole = userRoles[0]?.role.name || user.defaultRole || '';

    // Generate token
    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: primaryRole,
    });

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    // Add role to user object for frontend
    const userWithRole = {
      ...userWithoutPassword,
      role: primaryRole, // Add role to user object
    } as User & { role: string };

    return {
      user: userWithRole,
      token,
    };
  }

  async logout(userId: number): Promise<void> {
    // In a stateless JWT system, logout is handled client-side
    // But we can track logout events or invalidate tokens if needed
    // For now, just return success
    return Promise.resolve();
  }
}

