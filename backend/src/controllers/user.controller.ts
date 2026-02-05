import { Request, Response } from 'express';
import { UserService } from '../services/user.service';

export class UserController {
  private userService: UserService;

  constructor() {
    this.userService = new UserService();
  }

  createUser = async (req: Request, res: Response): Promise<void> => {
    try {
      const { name, email, password, mobile, defaultRole } = req.body;

      if (!name || !email || !password) {
        res.status(400).json({
          success: false,
          message: 'Name, email, and password are required',
        });
        return;
      }

      const user = await this.userService.createUser({
        name,
        email,
        password,
        mobile,
        defaultRole,
      });

      const { password: _, ...userWithoutPassword } = user;

      res.status(201).json({
        success: true,
        message: 'User created successfully',
        data: userWithoutPassword,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to create user',
      });
    }
  };

  getUsers = async (req: Request, res: Response): Promise<void> => {
    try {
      const users = await this.userService.getUsers();

      // Remove passwords from response
      const usersWithoutPasswords = users.map(({ password: _, ...user }) => user);

      res.json({
        success: true,
        data: usersWithoutPasswords,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch users',
      });
    }
  };

  getUserById = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const user = await this.userService.getUserById(id);

      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found',
        });
        return;
      }

      const { password: _, ...userWithoutPassword } = user;

      res.json({
        success: true,
        data: userWithoutPassword,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch user',
      });
    }
  };

  updateUser = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { name, email, mobile, isActive, defaultRole } = req.body;

      if (!id) {
        res.status(400).json({
          success: false,
          message: 'User ID is required',
        });
        return;
      }

      const user = await this.userService.updateUser(id, {
        name,
        email,
        mobile,
        isActive,
        defaultRole,
      });

      const { password: _, ...userWithoutPassword } = user;

      res.json({
        success: true,
        message: 'User updated successfully',
        data: userWithoutPassword,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to update user',
      });
    }
  };

  deleteUser = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          success: false,
          message: 'User ID is required',
        });
        return;
      }

      await this.userService.deleteUser(id);

      res.json({
        success: true,
        message: 'User deleted successfully',
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to delete user',
      });
    }
  };

  assignRole = async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId, roleId } = req.body;

      if (!userId || !roleId) {
        res.status(400).json({
          success: false,
          message: 'userId and roleId are required',
        });
        return;
      }

      const userRole = await this.userService.assignRole(
        userId,
        roleId,
        req.userId ? parseInt(req.userId) : undefined
      );

      res.json({
        success: true,
        message: 'Role assigned successfully',
        data: userRole,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to assign role',
      });
    }
  };

  removeRole = async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId, roleId } = req.body;

      if (!userId || !roleId) {
        res.status(400).json({
          success: false,
          message: 'userId and roleId are required',
        });
        return;
      }

      await this.userService.removeRole(userId, roleId);

      res.json({
        success: true,
        message: 'Role removed successfully',
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to remove role',
      });
    }
  };

  toggleUserStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          success: false,
          message: 'User ID is required',
        });
        return;
      }

      const user = await this.userService.toggleUserStatus(id);

      const { password: _, ...userWithoutPassword } = user;

      res.json({
        success: true,
        message: `User ${user.isActive ? 'activated' : 'deactivated'} successfully`,
        data: userWithoutPassword,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to toggle user status',
      });
    }
  };
}



