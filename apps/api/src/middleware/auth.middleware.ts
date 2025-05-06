// apps/api/src/middleware/authMiddleware.ts
import type { NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../../../shared/config/environment';
import { logger } from '../../../../shared/utils/logger';
import type { IReq, IRes } from '@shared/types/config';
import { ApiError } from '@shared/utils/errorController';

interface TokenPayload {
  sub: string;
  email: string;
  roles: string[];
  permissions: string[];
  iat: number;
  exp: number;
}

export const authMiddleware = async (req: IReq, res: IRes, next: NextFunction) => {
  try {
    // Extract token from header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new ApiError(401, 'Authentication required', 'AUTH_REQUIRED');
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      throw new ApiError(401, 'Invalid authentication token format', 'INVALID_TOKEN_FORMAT');
    }

    // Verify token
    try {
      const decoded = jwt.verify(token, config.AUTH.JWT_SECRET) as TokenPayload;

      console.log(decoded)
      // Add user info to request
      req.user = {
        id: decoded.sub,
        email: decoded.email,
        roles: decoded.roles || [],
        permissions: decoded.permissions || [],
      };

      // Check token expiration
      const now = Math.floor(Date.now() / 1000);
      if (decoded.exp && decoded.exp < now) {
        throw new ApiError(401, 'Token expired', 'TOKEN_EXPIRED');
      }

      next();
    } catch (error: any) {
      if (error instanceof ApiError) {
        throw error;
      }

      logger.warn({
        id: req.id,
        message: 'Token validation failed',
        error: error.message,
      });

      throw new ApiError(401, 'Invalid authentication token', 'INVALID_TOKEN');
    }
  } catch (error) {
    next(error);
  }
};

// Role-based authorization middleware factory
export const requireRole = (requiredRoles: string[]) => {
  return (req: IReq, res: IRes, next: NextFunction) => {
    if (!req.user) {
      return next(new ApiError(401, 'Authentication required', 'AUTH_REQUIRED'));
    }

    const userRoles = req.user.roles || [];
    const hasRequiredRole = requiredRoles.some(role => userRoles.includes(role));

    if (!hasRequiredRole) {
      return next(new ApiError(403, 'Insufficient permissions', 'INSUFFICIENT_PERMISSIONS'));
    }

    next();
  };
};

// Permission-based authorization middleware factory
export const requirePermission = (requiredPermissions: string[]) => {
  return (req: IReq, res: IRes, next: NextFunction) => {
    if (!req.user) {
      return next(new ApiError(401, 'Authentication required', 'AUTH_REQUIRED'));
    }

    const userPermissions = req.user.permissions || [];
    const hasAllRequiredPermissions = requiredPermissions.every(permission =>
      userPermissions.includes(permission),
    );

    if (!hasAllRequiredPermissions) {
      return next(new ApiError(403, 'Insufficient permissions', 'INSUFFICIENT_PERMISSIONS'));
    }

    next();
  };
};
