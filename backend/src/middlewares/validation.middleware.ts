import { Request, Response, NextFunction } from 'express';
import { BadRequestError, ValidationError } from '../utils/appError';

/**
 * Request Validation Middleware
 * Validates required fields in request body, params, and query
 */

interface ValidationRule {
  field: string;
  required?: boolean;
  type?: 'string' | 'number' | 'boolean' | 'date';
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  enum?: string[];
  custom?: (value: any) => boolean | string;
}

/**
 * Validate request body against rules
 */
export const validateBody = (rules: ValidationRule[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: string[] = [];

    for (const rule of rules) {
      const value = req.body[rule.field];

      // Check required
      if (rule.required && (value === undefined || value === null || value === '')) {
        errors.push(`${rule.field} is required`);
        continue;
      }

      if (value === undefined || value === null || value === '') {
        continue;
      }

      // Check type
      if (rule.type) {
        if (rule.type === 'number' && typeof value !== 'number') {
          errors.push(`${rule.field} must be a number`);
          continue;
        }
        if (rule.type === 'string' && typeof value !== 'string') {
          errors.push(`${rule.field} must be a string`);
          continue;
        }
        if (rule.type === 'boolean' && typeof value !== 'boolean') {
          errors.push(`${rule.field} must be a boolean`);
          continue;
        }
      }

      // Check minLength
      if (rule.minLength && typeof value === 'string' && value.length < rule.minLength) {
        errors.push(`${rule.field} must be at least ${rule.minLength} characters`);
      }

      // Check maxLength
      if (rule.maxLength && typeof value === 'string' && value.length > rule.maxLength) {
        errors.push(`${rule.field} must be at most ${rule.maxLength} characters`);
      }

      // Check min
      if (rule.min !== undefined && typeof value === 'number' && value < rule.min) {
        errors.push(`${rule.field} must be at least ${rule.min}`);
      }

      // Check max
      if (rule.max !== undefined && typeof value === 'number' && value > rule.max) {
        errors.push(`${rule.field} must be at at most ${rule.max}`);
      }

      // Check pattern
      if (rule.pattern && typeof value === 'string' && !rule.pattern.test(value)) {
        errors.push(`${rule.field} has invalid format`);
      }

      // Check enum
      if (rule.enum && !rule.enum.includes(value)) {
        errors.push(`${rule.field} must be one of: ${rule.enum.join(', ')}`);
      }

      // Check custom validation
      if (rule.custom) {
        const customResult = rule.custom(value);
        if (customResult !== true && typeof customResult === 'string') {
          errors.push(customResult);
        }
      }
    }

    if (errors.length > 0) {
      next(new ValidationError('Validation failed', errors));
      return;
    }

    next();
  };
};

/**
 * Validate request params
 */
export const validateParams = (rules: ValidationRule[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: string[] = [];

    for (const rule of rules) {
      const value = req.params[rule.field];

      if (rule.required && !value) {
        errors.push(`${rule.field} is required`);
        continue;
      }

      if (!value) {
        continue;
      }

      // Check type for params (usually strings)
      if (rule.type === 'number') {
        const numValue = parseInt(value, 10);
        if (isNaN(numValue)) {
          errors.push(`${rule.field} must be a valid number`);
        }
      }
    }

    if (errors.length > 0) {
      next(new BadRequestError(errors.join(', ')));
      return;
    }

    next();
  };
};

/**
 * Validate request query parameters
 */
export const validateQuery = (rules: ValidationRule[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: string[] = [];

    for (const rule of rules) {
      const value = req.query[rule.field];

      if (rule.required && !value) {
        errors.push(`${rule.field} is required`);
        continue;
      }

      if (!value) {
        continue;
      }

      // Check type
      if (rule.type === 'number' && typeof value === 'string') {
        const numValue = parseInt(value, 10);
        if (isNaN(numValue)) {
          errors.push(`${rule.field} must be a valid number`);
        }
      }
    }

    if (errors.length > 0) {
      next(new BadRequestError(errors.join(', ')));
      return;
    }

    next();
  };
};

/**
 * Common validation rules
 */
export const ValidationRules = {
  mobile: {
    pattern: /^[6-9]\d{9}$/,
    message: 'Invalid mobile number format',
  },
  email: {
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    message: 'Invalid email format',
  },
  pan: {
    pattern: /^[A-Z]{5}\d{4}[A-Z]$/,
    message: 'Invalid PAN format',
  },
  ifsc: {
    pattern: /^[A-Z]{4}\d{7}$/,
    message: 'Invalid IFSC code format',
  },
};

/**
 * Sanitize query parameters to prevent SQL injection
 * Only allows alphanumeric, hyphen, underscore, and common query characters
 */
export const sanitizeQueryParams = (req: Request, res: Response, next: NextFunction): void => {
  const allowedPattern = /^[a-zA-Z0-9\-_.,\s]+$/;
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(req.query)) {
    if (typeof value === 'string' && allowedPattern.test(value)) {
      sanitized[key] = value.trim();
    } else if (value === undefined || value === null) {
      // Skip undefined/null values
    } else {
      // Invalid characters detected
      next(new BadRequestError(`Invalid characters in query parameter: ${key}`));
      return;
    }
  }

  req.query = sanitized as any;
  next();
};
