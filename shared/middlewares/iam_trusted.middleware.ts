import type { Request, Response, NextFunction } from 'express';
import { ApiError } from '@shared/utils/errorController';
import { config } from '@shared/config/environment';

export const iAmTrustedServiceMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers['x-internal-token'];
  if (!token || token !== config.INTERNAL_SERVICE_SECRET) {
    return next(new ApiError(403, 'Forbidden - Invalid internal access', 'FORBIDDEN_INTERNAL'));
  }

  next();
};
