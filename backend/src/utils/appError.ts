/**
 * Custom Application Error Classes
 * Hierarchical error handling for different error types
 */

/**
 * Base Application Error
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly errors?: any;

  constructor(message: string, statusCode: number, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Bad Request Error (400)
 */
export class BadRequestError extends AppError {
  public errors?: any;
  
  constructor(message: string = 'Bad request', errors?: any) {
    super(message, 400);
    Object.defineProperty(this, 'errors', {
      value: errors,
      writable: true,
      enumerable: true,
    });
  }
}

/**
 * Unauthorized Error (401)
 */
export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401);
  }
}

/**
 * Forbidden Error (403)
 */
export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 403);
  }
}

/**
 * Not Found Error (404)
 */
export class NotFoundError extends AppError {
  constructor(message: string = 'Not found') {
    super(message, 404);
  }
}

/**
 * Conflict Error (409)
 */
export class ConflictError extends AppError {
  constructor(message: string = 'Conflict') {
    super(message, 409);
  }
}

/**
 * Validation Error (422)
 */
export class ValidationError extends AppError {
  public errors?: any;
  
  constructor(message: string = 'Validation failed', errors?: any) {
    super(message, 422);
    Object.defineProperty(this, 'errors', {
      value: errors,
      writable: true,
      enumerable: true,
    });
  }
}

/**
 * Internal Server Error (500)
 */
export class InternalServerError extends AppError {
  constructor(message: string = 'Internal server error') {
    super(message, 500, false); // Non-operational - don't expose to client
  }
}

/**
 * Service Unavailable Error (503)
 */
export class ServiceUnavailableError extends AppError {
  constructor(message: string = 'Service unavailable') {
    super(message, 503);
  }
}

/**
 * Error Handler Utility
 * Converts errors to standardized response format
 */
export const handleError = (error: Error | AppError): {
  message: string;
  statusCode: number;
  errors?: any;
} => {
  if (error instanceof AppError) {
    return {
      message: error.message,
      statusCode: error.statusCode,
      errors: error.errors,
    };
  }

  // Handle unknown errors
  return {
    message: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : error.message,
    statusCode: 500,
  };
};

/**
 * Async Handler Wrapper
 * Wraps async route handlers to catch errors automatically
 */
export const asyncHandler = (
  fn: (req: any, res: any, next: any) => Promise<any>
) => {
  return (req: any, res: any, next: any) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Validation Result Interface
 */
export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}
