// apps/api/src/middleware/errorHandler.ts
import { DBError } from 'objection';
import type { IReq, IRes } from '@shared/types/config';
import { ErrorStack } from '@shared/models/error.model';
import { logger } from './logger';

/**
 * Custom error class for API errors
 */
export class ApiError extends Error {
  statusCode: number;
  status: string;
  isOperational: boolean;
  code: string;

  constructor(statusCode: number, message: string, code: string = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
    this.code = code;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Saves error details to the database.
 * @param err The error object to save.
 * @returns The ID of the saved error.
 */
const saveError = async (err: any): Promise<number> => {
  try {
    const newError = await ErrorStack.query().insert({
      status: err.status,
      statusCode: err.statusCode,
      code: err.code || 'UNKNOWN_ERROR',
      message: err.message,
      stack: err.stack,
    });
    return newError.id;
  } catch (dbError) {
    logger.error('Failed to save error to database:', dbError);
    return 0; // Return 0 if error couldn't be saved
  }
};

/**
 * Handles specific database errors
 */
const handleDBError = (err: any): ApiError => {
  if (err instanceof DBError) {
    return new ApiError(400, `Database error: ${err.message}`, 'DB_ERROR');
  }

  // Check for specific error types
  if (err.code === '23505') {
    // PostgreSQL unique violation
    return new ApiError(400, 'Duplicate entry', 'DUPLICATE_ENTRY');
  }

  return err;
};

/**
 * Handles JWT errors.
 */
const handleJWTError = (): ApiError =>
  new ApiError(401, 'Invalid token. Please log in again!', 'INVALID_TOKEN');

/**
 * Handles expired JWT errors.
 */
const handleJWTExpiredError = (): ApiError =>
  new ApiError(401, 'Your token has expired! Please log in again.', 'EXPIRED_TOKEN');

/**
 * Sends detailed error information in development environment.
 */
const sendErrorDev = async (err: any, req: IReq, res: IRes): Promise<any> => {
  logger.error({
    id: req.id,
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  const errorId = await saveError(err);

  return res.status(err.statusCode || 500).json({
   
      status: err.status,
      code: err.code || 'SERVER_ERROR',
      message: err.message,
      stack: err.stack,
      requestId: req.id,
      errorId: errorId || undefined,
  
  });
};

/**
 * Sends summarized error information in production environment.
 */
const sendErrorProd = async (err: any, req: IReq, res: IRes): Promise<any> => {
  // Operational errors are trusted errors that we can send to the client
  const errorId = await saveError(err);

  if (err.isOperational) {
    return res.status(err.statusCode || 500).json({
      error: {
        code: err.code || 'SERVER_ERROR',
        message: err.message,
        requestId: req.id,
        errorId: errorId || undefined,
      },
    });
  }

  // For non-operational errors (programming or unknown errors), send generic message
  logger.error({
    id: req.id,
    error: 'Non-operational error',
    message: err.message,
    stack: err.stack,
    errorId,
  });

  return res.status(500).json({
    error: {
      code: 'SERVER_ERROR',
      message: 'Something went wrong on our end. Our team has been notified.',
      requestId: req.id,
      errorId: errorId || undefined,
    },
  });
};

/**
 * Global error handler middleware.
 */
export const errorHandler = async (err: any, req: IReq, res: IRes, next: any): Promise<void> => {
  // Set default status code and status
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  // Transform known errors to ApiError instances
  let error = err;

  // Handle specific error types
  if (error instanceof DBError) {
    error = handleDBError(error);
  } else if (error.name === 'JsonWebTokenError') {
    error = handleJWTError();
  } else if (error.name === 'TokenExpiredError') {
    error = handleJWTExpiredError();
  }

  // Send appropriate error response based on environment
  if (process.env.NODE_ENV === 'development') {
    await sendErrorDev(error, req, res);
  } else {
    await sendErrorProd(error, req, res);
  }
};
