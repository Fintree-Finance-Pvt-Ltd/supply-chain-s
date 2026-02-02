import { Request, Response } from 'express';
import { UserService } from '../services/user.service';

export class UserController {
  private userService: UserService;

  constructor() {
    this.userService = new UserService();
  }

  createUser = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = await this.userService.createUser({
        ...req.body,
        // assignedBy can be set from req.userId if needed
      });

      const { password, ...userWithoutPassword } = user;

      res.status(201).json({
        success: true,
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
      const usersWithoutPasswords = users.map(({ password, ...user }) => user);

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
      const user = await this.userService.getUserById(parseInt(id));

      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found',
        });
        return;
      }

      const { password, ...userWithoutPassword } = user;

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
      const user = await this.userService.updateUser(parseInt(id), req.body);

      const { password, ...userWithoutPassword } = user;

      res.json({
        success: true,
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
      await this.userService.deleteUser(parseInt(id));

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
        data: userRole,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to assign role',
      });
    }
  };
}

