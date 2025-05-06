// src/config/environment.ts
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '../../.env') });

export const config = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3000', 10),
  DB_CONNECTION: process.env.DATABASE_URL as string,
  INTERNAL_SERVICE_SECRET: process.env.INTERNAL_SERVICE_SECRET,

  // Authentication
  AUTH: {
    JWT_SECRET: process.env.JWT_SECRET,
    COOKIE_NAME: process.env.COOKIE_NAME,
    EXPIRES_IN: process.env.EXPIRES_IN as string,
    REFRESH_TOKEN_EXPIRES_IN: process.env.REFRESH_TOKEN_EXPIRES_IN as string,
    PASSWORDLESS_CODE_EXPIRY: parseInt(
      process.env.PASSWORDLESS_CODE_EXPIRY as string,
      10,
    ),
    MAX_LOGIN_ATTEMPTS: parseInt(process.env.MAX_LOGIN_ATTEMPTS as string, 10),
    LOCK_DURATION: parseInt(process.env.LOCK_DURATION as string, 10),
  },

  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  GOOGLE_CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL,

  // Service URLs
  PAYMENTS_SERVICE_URL: process.env.PAYMENTS_SERVICE_URL,
  NOTIFICATIONS_SERVICE_URL: process.env.NOTIFICATIONS_SERVICE_URL  || 'http://localhost:3001',
  COMPLIANCE_SERVICE_URL: process.env.COMPLIANCE_SERVICE_URL,
  BUSINESS_SERVICE_URL: process.env.BUSINESS_SERVICE_URL,
  PERSONAL_SERVICE_URL: process.env.PERSONAL_SERVICE_URL,
  WALLET_SERVICE_URL: process.env.WALLET_SERVICE_URL,
  USER_SERVICE_URL: process.env.USER_SERVICE_URL || 'http://localhost:3001',
  AUTH_SERVICE_URL: process.env.AUTH_SERVICE_URL,
  RABBITMQ_SERVICE_URL: process.env.RABBITMQ_SERVICE_URL,
  REDIS_SERVICE_URL: process.env.REDIS_URL,
  CACHE_TTL: process.env.CACHE_TTL,
  CACHE_MAX: process.env.CACHE_MAX,
  CACHE_ENABLED: process.env.CACHE_ENABLED === 'true',
  SERVICE_REGISTRY: {
    /**
     * URL of the service registry where services register themselves.
     */
    url: process.env.SERVICE_REGISTRY_URL || 'http://localhost:3011',
  
    /**
     * Time-to-live (TTL) for a service entry in milliseconds.
     * This is how long a service is considered alive after its last heartbeat.
     */
    ttl: parseInt(process.env.SERVICE_REGISTRY_TTL as string || '30000', 10), // 30 seconds
  
    /**
     * Maximum number of services to be stored/returned.
     */
    max: parseInt(process.env.SERVICE_REGISTRY_MAX as string || '50', 10),
  
    /**
     * Interval (ms) at which a service sends heartbeat to show it's alive.
     */
    heartbeatInterval: parseInt(
      process.env.SERVICE_REGISTRY_HEARTBEAT_INTERVAL as string || '30000',
      10,
    ), // 30 seconds
  
    /**
     * Delay (ms) before retrying a failed heartbeat.
     */
    retryDelay: parseInt(process.env.SERVICE_REGISTRY_RETRY_DELAY as string || '10000', 10), // 10 seconds
  
    /**
     * Maximum number of heartbeat retries allowed before considering a service down.
     */
    maxRetries: parseInt(process.env.SERVICE_REGISTRY_MAX_RETRIES as string || '5', 10),
  
    /**
     * Maximum age (ms) a service is allowed to go without a heartbeat
     * before being considered expired and removed.
     * Derived from: ttl + (retryDelay * maxRetries)
     */
    get maxHeartbeatAge() {
      return this.ttl + this.retryDelay * this.maxRetries;
    },
  
    /**
     * How often the cleanup process should run to remove expired services.
     * Recommended to be half of maxHeartbeatAge or a safe minimum of 30s.
     */
    get cleanupInterval() {
      return Math.min(60000, this.maxHeartbeatAge / 2);
    },
  },
  

  // Messaging
  RABBIT_MQ: {
    HOST: process.env.RABBIT_MQ_HOST,
    PORT: parseInt((process.env.RABBIT_MQ_PORT as string) || '5672', 10),
    USERNAME: process.env.RABBIT_MQ_USERNAME,
    PASSWORD: process.env.RABBIT_MQ_PASSWORD,
    SERVICE_URL: process.env.RABBITMQ_SERVICE_URL,
  },

  // Redis Cache
  REDIS: {
    HOST: process.env.REDIS_HOST,
    PORT: parseInt((process.env.REDIS_PORT as string) || '6379', 10),
    PASSWORD: process.env.REDIS_PASSWORD,
    URL: process.env.REDIS_URL,
  },

  EMAIL:{
    FROM: process.env.EMAIL_FROM,
    FROM_NAME: process.env.FROM_NAME,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_HOST: process.env.SMTP_HOST,
    USERNAME: process.env.SMTP_USERNAME,
    PASSWORD: process.env.SMTP_PASSWORD,
  },

  FINCRA: {
    API_KEY: process.env.FINCRA_API_KEY,
    SECRET_KEY: process.env.FINCRA_SECRET_KEY,
    BASE_URL: process.env.FINCRA_BASE_URL,
    WEBHOOK_SECRET: process.env.FINCRA_WEBHOOK_SECRET,
  },
  
  MAPLERAD: {
    API_KEY: process.env.MAPLERAD_API_KEY,
    SECRET_KEY: process.env.MAPLERAD_SECRET_KEY,
    BASE_URL: process.env.MAPLERAD_BASE_URL,
    WEBHOOK_SECRET: process.env.MAPLERAD_WEBHOOK_SECRET,
  },
};

export {config as appConfig}

// Validate required environment variables
const requiredEnvVars: Array<string> = ['AUTH.JWT_SECRET'];

requiredEnvVars.forEach(varName => {
  const value = varName.split('.').reduce((acc, key) => acc && acc[key], config);
  if (!value) {
    console.warn(`Warning: Environment variable ${varName} is not set`);
  }
});
