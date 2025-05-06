// src/proxy/types.ts
import { z } from 'zod'; // We'll add schema validation for configuration

/**
 * Configuration for a service route that is proxied to a backend service
 */
export interface ServiceRouteConfig {
  /** Target service URL where requests will be proxied to */
  target: string;
  
  /** Path rewrite rules - keys are regex patterns, values are replacements */
  pathRewrite: Record<string, string>;
  
  /** Whether authentication is required for this route */
  auth: boolean;
  
  /** Optional timeout in milliseconds (default: 30000) */
  timeout?: number;
  
  /** Rate limit in requests per minute (0 means no limit) */
  rateLimit?: number;
  
  /** Custom headers to add to the proxied request */
  headers?: Record<string, string>;
}

/**
 * Schema for validating service route configuration
 */
export const ServiceRouteSchema = z.object({
  target: z.string().url('Target must be a valid URL'),
  pathRewrite: z.record(z.string(), z.string()),
  auth: z.boolean(),
  timeout: z.number().int().min(1000).max(120000).optional(),
  rateLimit: z.number().int().min(0).max(10000).optional(),
  headers: z.record(z.string(), z.string()).optional()
});

/**
 * Complete service routes configuration
 */
export const ServiceRoutesSchema = z.record(
  z.string().startsWith('/api/', 'Route must start with /api/'),
  ServiceRouteSchema
);