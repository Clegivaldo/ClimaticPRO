import { Response } from 'express';

/**
 * Standardized API response utilities
 * Requirement 9.7: Standardized API response format
 */

export interface APIResponse<T = any> {
  code: number;
  message: string;
  data?: T;
  error?: {
    field?: string;
    details?: string;
  };
}

export function sendSuccess<T>(res: Response, data: T, message = 'Success', code = 200) {
  const response: APIResponse<T> = {
    code,
    message,
    data
  };
  return res.status(code).json(response);
}

export function sendError(res: Response, message: string, code = 500, errorDetails?: any) {
  const response: APIResponse = {
    code,
    message,
    error: errorDetails
  };
  return res.status(code).json(response);
}
