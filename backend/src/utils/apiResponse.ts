import { Response } from 'express';

/**
 * API Response Helper
 * Standardized response format for all API endpoints
 * 
 * Format:
 * {
 *   success: boolean,
 *   message?: string,
 *   data?: any,
 *   meta?: {
 *     page?: number,
 *     limit?: number,
 *     total?: number,
 *     totalPages?: number
 *   }
 * }
 */

export interface ApiResponse {
  success: boolean;
  message?: string;
  data?: any;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

export interface PaginatedResponse<T> extends ApiResponse {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Send success response
 */
export const sendSuccess = (
  res: Response,
  data: any = null,
  message: string = 'Success',
  statusCode: number = 200
): Response => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

/**
 * Send paginated success response
 */
export const sendPaginatedSuccess = <T>(
  res: Response,
  data: T[],
  page: number,
  limit: number,
  total: number,
  message: string = 'Success'
): Response => {
  const totalPages = Math.ceil(total / limit);
  
  return res.status(200).json({
    success: true,
    message,
    data,
    meta: {
      page,
      limit,
      total,
      totalPages,
    },
  });
};

/**
 * Send created response (201)
 */
export const sendCreated = (
  res: Response,
  data: any = null,
  message: string = 'Created successfully'
): Response => {
  return res.status(201).json({
    success: true,
    message,
    data,
  });
};

/**
 * Send error response
 */
export const sendError = (
  res: Response,
  message: string = 'An error occurred',
  statusCode: number = 500,
  errors?: any
): Response => {
  const response: ApiResponse = {
    success: false,
    message,
  };

  if (errors) {
    (response as any).errors = errors;
  }

  return res.status(statusCode).json(response);
};

/**
 * Send bad request response (400)
 */
export const sendBadRequest = (
  res: Response,
  message: string = 'Bad request',
  errors?: any
): Response => {
  return sendError(res, message, 400, errors);
};

/**
 * Send unauthorized response (401)
 */
export const sendUnauthorized = (
  res: Response,
  message: string = 'Unauthorized'
): Response => {
  return sendError(res, message, 401);
};

/**
 * Send forbidden response (403)
 */
export const sendForbidden = (
  res: Response,
  message: string = 'Forbidden'
): Response => {
  return sendError(res, message, 403);
};

/**
 * Send not found response (404)
 */
export const sendNotFound = (
  res: Response,
  message: string = 'Not found'
): Response => {
  return sendError(res, message, 404);
};

/**
 * Send validation error response (422)
 */
export const sendValidationError = (
  res: Response,
  message: string = 'Validation failed',
  errors?: any
): Response => {
  return sendError(res, message, 422, errors);
};

/**
 * Send conflict response (409)
 */
export const sendConflict = (
  res: Response,
  message: string = 'Conflict'
): Response => {
  return sendError(res, message, 409);
};

/**
 * Send no content response (204)
 */
export const sendNoContent = (res: Response): Response => {
  return res.status(204).json();
};
