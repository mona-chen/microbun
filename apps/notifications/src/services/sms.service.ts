import { logger } from '@shared/utils/logger';
import { CircuitBreakerManager } from '@shared/utils/circuit-breaker';

/**
 * SMS provider types
 */
export enum SmsProviderType {
  TWILIO = 'twilio',
  MOCK = 'mock'
}

/**
 * SMS configuration interface
 */
export interface SmsConfig {
  provider: SmsProviderType;
  from: string;
  twilio?: {
    accountSid: string;
    authToken: string;
  };
}

/**
 * SMS data interface
 */
export interface SmsData {
  to: string | string[];
  message: string;
  mediaUrl?: string | string[];
}

/**
 * Twilio message result interface
 */
interface TwilioMessageResult {
  sid: string;
  [key: string]: any;
}

/**
 * SMS provider interface
 */
interface SmsProvider {
  sendSms(data: SmsData): Promise<boolean>;
}

/**
 * Mock SMS provider implementation for testing
 */
class MockSmsProvider implements SmsProvider {
  private config: SmsConfig;

  constructor(config: SmsConfig) {
    this.config = config;
  }

  async sendSms(data: SmsData): Promise<boolean> {
    const recipients = Array.isArray(data.to) ? data.to : [data.to];
    
    for (const recipient of recipients) {
      logger.info(`[MOCK] SMS sent from ${this.config.from} to ${recipient}: ${data.message}`);
      if (data.mediaUrl) {
        const mediaUrls = Array.isArray(data.mediaUrl) ? data.mediaUrl : [data.mediaUrl];
        logger.info(`[MOCK] Media URLs: ${mediaUrls.join(', ')}`);
      }
    }
    
    return true;
  }
}

/**
 * Twilio SMS provider implementation
 */
class TwilioSmsProvider implements SmsProvider {
  private config: SmsConfig;
  private client: {
    messages: {
      create: (params: any) => Promise<TwilioMessageResult>;
    };
  };

  constructor(config: SmsConfig) {
    this.config = config;
    
    // Mock Twilio client to avoid direct dependency
    this.client = {
      messages: {
        create: async (params: any) => {
          logger.info(`[MOCK-TWILIO] SMS sent from ${params.from} to ${params.to}: ${params.body}`);
          if (params.mediaUrl) {
            logger.info(`[MOCK-TWILIO] Media URLs: ${params.mediaUrl}`);
          }
          return { sid: 'MOCK_SID_' + Date.now() };
        }
      }
    };
    
    // In a real implementation, we would initialize the Twilio client like this:
    // if (config.twilio?.accountSid && config.twilio?.authToken) {
    //   const twilio = require('twilio');
    //   this.client = twilio(config.twilio.accountSid, config.twilio.authToken);
    // } else {
    //   throw new Error('Twilio account SID and auth token are required');
    // }
  }

  async sendSms(data: SmsData): Promise<boolean> {
    try {
      const recipients = Array.isArray(data.to) ? data.to : [data.to];
      const results: TwilioMessageResult[] = [];
      
      for (const recipient of recipients) {
        const params: any = {
          body: data.message,
          from: this.config.from,
          to: recipient
        };
        
        if (data.mediaUrl) {
          params.mediaUrl = data.mediaUrl;
        }
        
        const result = await this.client.messages.create(params);
        results.push(result);
        logger.info(`SMS sent to ${recipient}, SID: ${result.sid}`);
      }
      
      return true;
    } catch (error) {
      logger.error('Error sending SMS via Twilio', error);
      return false;
    }
  }
}

/**
 * SMS service for sending SMS messages using different providers
 */
export class SmsService {
  private static instance: SmsService;
  private provider: SmsProvider;
  private config: SmsConfig;

  private constructor(config: SmsConfig) {
    this.config = config;
    
    // Create provider based on configuration
    switch (config.provider) {
      case SmsProviderType.TWILIO:
        this.provider = new TwilioSmsProvider(config);
        break;
      case SmsProviderType.MOCK:
        this.provider = new MockSmsProvider(config);
        break;
      default:
        throw new Error(`Unsupported SMS provider: ${config.provider}`);
    }

    // Register circuit breaker for SMS operations
    CircuitBreakerManager.register('sms-send', 
      (data: SmsData) => this.sendSms(data),
      {
        failureThreshold: 3,
        retryBackoff: 'exponential',
        distributedTracking: true
      }
    );
  }

  /**
   * Get singleton instance
   */
  public static getInstance(config?: SmsConfig): SmsService {
    if (!SmsService.instance) {
      if (!config) {
        // Default configuration from environment variables
        const provider = (process.env.SMS_PROVIDER as SmsProviderType) || SmsProviderType.MOCK;
        const config: SmsConfig = {
          provider,
          from: process.env.SMS_FROM as string || '+15555555555'
        };

        if (provider === SmsProviderType.TWILIO) {
          config.twilio = {
            accountSid: process.env.TWILIO_ACCOUNT_SID as string || '',
            authToken: process.env.TWILIO_AUTH_TOKEN as string || ''
          };
        }

        SmsService.instance = new SmsService(config);
      } else {
        SmsService.instance = new SmsService(config);
      }
    }
    return SmsService.instance;
  }

  /**
   * Reconfigure the SMS service with new settings
   */
  public static reconfigure(config: SmsConfig): SmsService {
    SmsService.instance = new SmsService(config);
    return SmsService.instance;
  }

  /**
   * Send an SMS message
   */
  async sendSms(data: SmsData): Promise<boolean> {
    try {
      return await this.provider.sendSms(data);
    } catch (error) {
      logger.error('Error sending SMS', error);
      return false;
    }
  }

  /**
   * Send an SMS message to multiple recipients
   */
  async sendBulkSms(
    recipients: string[],
    message: string,
    mediaUrl?: string | string[]
  ): Promise<boolean> {
    return this.sendSms({
      to: recipients,
      message,
      mediaUrl
    });
  }
}