import jwt, { SignOptions } from 'jsonwebtoken';
import * as dotenv from 'dotenv';
import { AppDataSource } from '../config/database';
import { RefreshToken, Customer } from '../entities';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN: SignOptions['expiresIn'] =
  (process.env.JWT_EXPIRES_IN as any) || '7d';
const REFRESH_TOKEN_EXPIRES_IN_DAYS = parseInt(process.env.REFRESH_TOKEN_EXPIRES_IN_DAYS || '30');

export interface JWTPayload {
  userId: number;
  email: string;
  role?: string;
}

export interface CustomerJWTPayload {
  id: number;
  partnerLoanId: string;
  role: 'CUSTOMER';
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export const generateToken = (payload: JWTPayload): string => {
  const options: SignOptions = {
    expiresIn: JWT_EXPIRES_IN,
  };
  return jwt.sign(payload, JWT_SECRET as string, options);
};

export const verifyToken = (token: string): JWTPayload => {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch (error: any) {
    // Provide more specific error for debugging
    if (error.name === 'TokenExpiredError') {
      throw new Error('Token has expired');
    }
    if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid token format');
    }
    throw new Error('Invalid or expired token');
  }
};

// =====================================================
// 🔹 CUSTOMER JWT METHODS
// =====================================================

/**
 * Generate JWT token for customer login
 * Payload: { id: customerId, partnerLoanId, role: 'CUSTOMER' }
 * Expiry: 7 days (configurable via JWT_EXPIRES_IN)
 */
export const generateCustomerToken = (customerId: number, partnerLoanId: string): string => {
  const payload: CustomerJWTPayload = {
    id: customerId,
    partnerLoanId,
    role: 'CUSTOMER',
  };
  const options: SignOptions = {
    expiresIn: JWT_EXPIRES_IN,
  };
  return jwt.sign(payload, JWT_SECRET as string, options);
};

/**
 * Verify and decode customer JWT token
 * Returns the payload if valid, throws error if invalid/expired
 */
export const verifyCustomerToken = (token: string): CustomerJWTPayload => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as CustomerJWTPayload;
    if (decoded.role !== 'CUSTOMER') {
      throw new Error('Invalid token role');
    }
    return decoded;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
};

/**
 * Generate access token and refresh token pair for customer
 */
export const generateTokenPair = async (customerId: number, partnerLoanId: string, deviceInfo?: string, ipAddress?: string): Promise<TokenPair> => {
  const accessToken = generateCustomerToken(customerId, partnerLoanId);
  
  // Generate refresh token
  const refreshToken = uuidv4();
  
  // Save refresh token to database
  const refreshTokenRepository: Repository<RefreshToken> = AppDataSource.getRepository(RefreshToken);
  
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRES_IN_DAYS);
  
  const refreshTokenEntity = refreshTokenRepository.create({
    customerId,
    token: refreshToken,
    expiresAt,
    issuedAt: new Date(),
    deviceInfo,
    ipAddress,
    isActive: true,
  });
  
  await refreshTokenRepository.save(refreshTokenEntity);
  
  return {
    accessToken,
    refreshToken,
  };
};

/**
 * Refresh access token using refresh token
 */
export const refreshAccessToken = async (refreshToken: string): Promise<TokenPair> => {
  const refreshTokenRepository: Repository<RefreshToken> = AppDataSource.getRepository(RefreshToken);
  
  // Find valid refresh token
  const storedToken = await refreshTokenRepository.findOne({
    where: {
      token: refreshToken,
      isActive: true,
    },
    relations: ['customer'],
  });
  
  if (!storedToken) {
    throw new Error('Invalid refresh token');
  }
  
  // Check if expired
  if (new Date() > storedToken.expiresAt) {
    storedToken.isActive = false;
    await refreshTokenRepository.save(storedToken);
    throw new Error('Refresh token has expired');
  }
  
  // Generate new token pair
  const customerId = storedToken.customerId;
  
  // For refresh, we need to get partner_loan_id from LMS or use empty string
  // The partner_loan_id should have been stored when token was originally generated
  const partnerLoanId = '';
  
  // Deactivate old refresh token
  storedToken.isActive = false;
  await refreshTokenRepository.save(storedToken);
  
  // Generate new tokens
  return await generateTokenPair(customerId, partnerLoanId, storedToken.deviceInfo || undefined, storedToken.ipAddress || undefined);
};

/**
 * Invalidate refresh token (logout)
 */
export const invalidateRefreshToken = async (refreshToken: string): Promise<boolean> => {
  const refreshTokenRepository: Repository<RefreshToken> = AppDataSource.getRepository(RefreshToken);
  
  const storedToken = await refreshTokenRepository.findOne({
    where: {
      token: refreshToken,
    },
  });
  
  if (!storedToken) {
    return false;
  }
  
  storedToken.isActive = false;
  await refreshTokenRepository.save(storedToken);
  
  return true;
};

/**
 * Invalidate all refresh tokens for a customer (logout from all devices)
 */
export const invalidateAllRefreshTokens = async (customerId: number): Promise<number> => {
  const refreshTokenRepository: Repository<RefreshToken> = AppDataSource.getRepository(RefreshToken);
  
  const result = await refreshTokenRepository.update(
    {
      customerId,
      isActive: true,
    },
    {
      isActive: false,
    }
  );
  
  return result.affected || 0;
};
