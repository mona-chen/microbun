import { CircuitBreakerManager } from '@shared/utils/circuit-breaker';
import { NovuConfig, NOTIFICATION_TEMPLATES } from '../config/novu.config';
import type { NotificationMetadata, NotificationPayload } from '../interfaces/notification.interface';

export class NotificationService {
  private novuClient = NovuConfig.getInstance();

  constructor() {
    // Register circuit breaker for Novu operations
    CircuitBreakerManager.register('novu-trigger', 
      (payload: NotificationPayload) => this.sendNotification(payload),
      {
        failureThreshold: 3,
        retryBackoff: 'exponential',
        distributedTracking: true
      }
    );
  }

  async sendNotification(payload: NotificationPayload): Promise<NotificationMetadata> {
    try {
      const result = await this.novuClient.trigger(payload.templateId, {
        to: {
          subscriberId: payload.recipient
        },
        payload: payload.data
      });

      return {
        messageId: result.data?.id || crypto.randomUUID(),
        timestamp: Date.now(),
        status: 'sent'
      };
    } catch (error) {
      console.error('Notification sending failed', error);
      
      return {
        messageId: crypto.randomUUID(),
        timestamp: Date.now(),
        status: 'failed'
      };
    }
  }

  async createSubscriber(subscriberId: string, userData: {
    email: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
  }) {
    try {
      await this.novuClient.subscribers.identify(subscriberId, {
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        phone: userData.phone
      });
    } catch (error) {
      console.error('Subscriber creation failed', error);
    }
  }
}