import { Request, Response, NextFunction } from 'express';
import { AppDataSource } from '../config/database';
import { UserRole } from '../entities/UserRole';
import { ROLES } from '../config/constants';

/**
 * Middleware to check if user has required role(s)
 * @param allowedRoles - Array of role names that can access the route
 */
export const roleMiddleware = (allowedRoles: string[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.userId) {
        res.status(401).json({ message: 'Authentication required' });
        return;
      }

      const userRoleRepository = AppDataSource.getRepository(UserRole);
      const userRoles = await userRoleRepository.find({
        where: { userId: req.userId, isActive: true },
        relations: ['role'],
      });

      const userRoleNames = userRoles.map((ur) => ur.role.name);

      // Check if user has any of the allowed roles
      const hasAccess = allowedRoles.some((role) => userRoleNames.includes(role));

      if (!hasAccess) {
        res.status(403).json({ message: 'Insufficient permissions' });
        return;
      }

      next();
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Role check failed' });
    }
  };
};

/**
 * Middleware to check if user is admin
 */
export const adminMiddleware = roleMiddleware([ROLES.ADMIN]);

