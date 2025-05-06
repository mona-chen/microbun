// src/proxy/middleware/rate-limit.middleware.ts
import type {  Response } from 'express';
import rateLimit from 'express-rate-limit';
import { createHash } from 'crypto';
import type { IReq } from '@shared/types/config';

/**
 * Creates a rate limiter middleware for a specific route
 * 
 * @param routePath The path this rate limiter applies to
 * @param requestsPerMinute Maximum number of requests allowed per minute
 * @returns Express middleware function
 */
export const rateLimitMiddleware = (routePath: string, requestsPerMinute: number) => {
  return rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: requestsPerMinute,
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    
    // Use a composite key that combines IP address with user ID when available
    keyGenerator: (req: IReq) => {
      const userIdentifier = req.user?.id || 'anonymous';
      const baseKey = `${req.ip}:${userIdentifier}:${routePath}`;
      // Creating a hash to ensure consistent key length and format
      return createHash('sha256').update(baseKey).digest('hex');
    },
    
    // Custom handler for when rate limit is exceeded
    handler: (req: IReq, res: Response) => {
      res.status(429).json({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.',
        requestId: (req as any).id
      });
    },
    
    // Skip rate limiting for trusted IPs or admin users
    skip: (req: IReq) => {
      // Example: Skip for admin users
      if (req.user?.roles?.includes('admin')) {
        return true;
      }
      
      // Example: Skip for internal network requests
      const trustedIPs = (process.env.TRUSTED_IPS as string ?? "")?.split(',') || [];
      if (trustedIPs.includes(req.ip as string)) {
        return true;
      }
      
      return false;
    }
  });
};