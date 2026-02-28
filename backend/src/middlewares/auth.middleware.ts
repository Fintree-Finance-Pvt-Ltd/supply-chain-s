import { Request, Response, NextFunction } from 'express';
import { verifyToken, JWTPayload } from '../utils/jwt';
import { AppDataSource } from '../config/database';
import { User, UserRole } from '../entities';

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: User & { roles?: any[] };
      userId?: number;
      userRole?: string;
    }
  }
}

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ message: 'No token provided' });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const decoded = verifyToken(token) as JWTPayload;

    // Get user from database
    const userRepository = AppDataSource.getRepository(User);
    const user = await userRepository.findOne({
      where: { id: decoded.userId, isActive: true },
    });

    if (!user) {
      res.status(401).json({ message: 'User not found or inactive' });
      return;
    }

    // Get user roles
    const userRoleRepository = AppDataSource.getRepository(UserRole);
    const userRoles = await userRoleRepository.find({
      where: { userId: user.id, isActive: true },
      relations: ['role'],
    });

    // Attach user to request with roles
    req.user = {
      ...user,
      roles: userRoles.map(ur => ur.role),
    };
    req.userId = user.id;
    req.userRole = decoded.role;

    next();
  } catch (error: any) {
    res.status(401).json({ message: error.message || 'Invalid token' });
  }
};
