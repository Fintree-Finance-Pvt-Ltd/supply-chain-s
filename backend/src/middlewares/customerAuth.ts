import { Request, Response, NextFunction } from 'express';
import { verifyCustomerToken, CustomerJWTPayload } from '../utils/jwt';

// Extend Express Request type to include customerId
declare global {
  namespace Express {
    interface Request {
      customerId?: number;
      partnerLoanId?: string;
      customerPayload?: CustomerJWTPayload;
    }
  }
}

/**
 * Customer Authentication Middleware
 * 
 * Protects routes requiring customer authentication.
 * Reads JWT token from Authorization header (Bearer token).
 * 
 * Usage:
 * router.get('/profile', customerAuthMiddleware, controller.getProfile);
 */
export const customerAuthMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    // Get Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      res.status(401).json({
        success: false,
        message: 'Authorization header is required',
      });
      return;
    }

    // Check if it's a Bearer token
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      res.status(401).json({
        success: false,
        message: 'Invalid authorization format. Use: Bearer <token>',
      });
      return;
    }

    const token = parts[1];

    // Verify and decode the token
    const payload = verifyCustomerToken(token);

    // Attach customer info to request
    req.customerId = payload.id;
    req.partnerLoanId = payload.partnerLoanId;
    req.customerPayload = payload;

    next();
  } catch (error: any) {
    res.status(401).json({
      success: false,
      message: error.message || 'Invalid or expired token',
    });
  }
};
