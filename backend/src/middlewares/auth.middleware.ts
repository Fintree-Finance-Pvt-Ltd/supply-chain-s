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
      console.log('[AUTH] No token provided or invalid format');
      res.status(401).json({ message: 'No token provided' });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    console.log('[AUTH] Token received, length:', token.length);

    // Verify token
    const decoded = verifyToken(token) as JWTPayload;
    console.log('[AUTH] Token decoded, userId:', decoded.userId, 'role:', decoded.role);

    // Get user from database
    const userRepository = AppDataSource.getRepository(User);
    const user = await userRepository.findOne({
      where: { id: decoded.userId, isActive: true },
    });

    if (!user) {
      console.log('[AUTH] User not found or inactive, userId:', decoded.userId);
      res.status(401).json({ message: 'User not found or inactive' });
      return;
    }

    // Get user roles
    const userRoleRepository = AppDataSource.getRepository(UserRole);
    const userRoles = await userRoleRepository.find({
      where: { userId: user.id, isActive: true },
      relations: ['role'],
    });
    console.log('[AUTH] User roles:', userRoles);
    // Attach user to request with roles
    req.user = {
      ...user,
      roles: userRoles.map(ur => ur.role),
    };
    req.userId = user.id;
    req.userRole = decoded.role;

    console.log('[AUTH] Success, user:', user.email);
    next();
  } catch (error: any) {
    // Provide more specific error messages
    let errorMessage = 'Invalid or expired token';
    
    if (error.name === 'TokenExpiredError') {
      errorMessage = 'Token has expired. Please login again.';
    } else if (error.name === 'JsonWebTokenError') {
      errorMessage = 'Invalid token format. Please login again.';
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    console.log('[AUTH] Error:', errorMessage, '| Original error:', error.message);
    res.status(401).json({ message: errorMessage });
  }
};
