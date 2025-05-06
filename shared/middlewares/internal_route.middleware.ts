import type { Request, Response, NextFunction } from 'express';
import { ApiError } from '@shared/utils/errorController';
import { config } from '@shared/config/environment';

/**
 * Middleware to protect routes that should only be accessible via service-to-service communication.
 * This middleware checks for the internal service token and ensures the request is coming from
 * another service within our infrastructure.
 */
export const internalRouteMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Check for internal service token
  const token = req.headers['x-internal-token'];
  if (!token || token !== config.INTERNAL_SERVICE_SECRET) {
    return next(new ApiError(403, 'Forbidden - This endpoint is only accessible via internal service communication', 'FORBIDDEN_INTERNAL'));
  }

  // Check for service identifier header
  const serviceId = req.headers['x-service-id'];
  if (!serviceId) {
    return next(new ApiError(403, 'Forbidden - Missing service identifier', 'FORBIDDEN_INTERNAL'));
  }

  // Add service context to request for logging/tracking
  (req as any).serviceContext = {
    serviceId,
    timestamp: new Date().toISOString()
  };

  next();
}; 