
// src/proxy/routes.ts
import { config } from '@shared/config/environment';
import { ServiceRoutesSchema, type ServiceRouteConfig } from '../types/proxy';

/**
 * Service routes configuration
 * 
 * RULES:
 * 1. All routes must start with /api/
 * 2. More specific routes must come before general routes
 * 3. Authentication settings must be explicit
 * 4. Each service should have its own namespace under /api/
 */
const serviceRoutes: Record<string, ServiceRouteConfig> = {
  // Auth service routes - specific routes first
  '/api/auth/profile': {
    target: (config.AUTH_SERVICE_URL as string) || 'http://auth-service:3001',
    pathRewrite: { '': '/profile' },
    auth: true,
    timeout: 10000, // Lower timeout for profile requests
  },
  '/api/auth/settings': {
    target: (config.AUTH_SERVICE_URL as string) || 'http://auth-service:3001',
    pathRewrite: { '': '/settings' },
    auth: true,
  },
  '/api/auth/passcode': {
    target: (config.AUTH_SERVICE_URL as string) || 'http://auth-service:3001',
    pathRewrite: { '': '/passcode' },
    auth: true,
  },
  '/api/auth': {
    target: (config.AUTH_SERVICE_URL as string) || 'http://auth-service:3001',
    pathRewrite: { '^/api/auth': '' },
    auth: false, // Skip auth for auth endpoints (login, register, etc.)
    rateLimit: 10
  },
  
  // Wallet service
  '/api/wallets': {
    target: (config.WALLET_SERVICE_URL as string) || 'http://wallet-service:3002',
    pathRewrite: { '^/api/wallets': '' },
    auth: true,
    rateLimit: 60, // Limit to 60 requests per minute
  },
  
  // Business service
  '/api/business': {
    target: (config.BUSINESS_SERVICE_URL as string) || 'http://business-service:3003',
    pathRewrite: { '^/api/business': '' },
    auth: true,
  },
  
  // Personal service
  '/api/personal': {
    target: (config.PERSONAL_SERVICE_URL as string) || 'http://personal-service:3004',
    pathRewrite: { '^/api/personal': '' },
    auth: true,
  },
  
  // Payment service
  '/api/payments': {
    target: (config.PAYMENTS_SERVICE_URL as string) || 'http://payments-service:3005',
    pathRewrite: { '^/api/payments': '' },
    auth: true,
    timeout: 45000, // Longer timeout for payment processing
  },
  
  // Notification service
  '/api/notifications': {
    target: (config.NOTIFICATIONS_SERVICE_URL as string) || 'http://notifications-service:3006',
    pathRewrite: { '^/api/notifications': '' },
    auth: true,
  },
  
  // Compliance service
  '/api/compliance': {
    target: (config.COMPLIANCE_SERVICE_URL as string) || 'http://compliance-service:3007',
    pathRewrite: { '^/api/compliance': '' },
    auth: true,
    headers: {
      'X-Compliance-Version': '1.0'
    }
  },
};

// Validate the service routes configuration
try {
  ServiceRoutesSchema.parse(serviceRoutes);
  console.log('✅ Service routes configuration is valid');
} catch (error) {
  console.error('❌ Invalid service routes configuration:', error);
  process.exit(1); // Exit if configuration is invalid
}

export default serviceRoutes;

