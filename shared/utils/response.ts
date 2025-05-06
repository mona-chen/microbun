// shared/utils/response.ts
import type { Response } from 'express';

/**
 * Standard success response function
 */
export const success = (
  res: Response,
  message: string,
  statusCode: number = 200,
  data: any = {},
) => {
  return res.status(statusCode).json({
    status: 'success',
    message,
    data,
  });
};

/**
 * Standard failure response function
 */
export const fail = (res: Response, message: string, statusCode: number = 400, data: any = {}) => {
  return res.status(statusCode).json({
    status: 'fail',
    message,
    data,
  });
};

/**
 * Standard error response function
 */
export const error = (res: Response, message: string, statusCode: number = 500, data: any = {}) => {
  return res.status(statusCode).json({
    status: 'error',
    message,
    data,
  });
};
