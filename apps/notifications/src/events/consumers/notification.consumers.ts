import { NotificationService } from '../../services/notification.service';
import type { 
  NotificationPayload, 
  NotificationRecord,
  PushNotificationPayload
} from '../../interfaces/notification.interface';
import { logger } from '@shared/utils/logger';
import { 
  RabbitMQService, 
  subscribeToEvents, 
  subscribeToBroadcast, 
  subscribeToDirect 
} from '@shared/events';
import { EXCHANGES } from '@shared/events/exchanges';
import notificationQueues from '@shared/events/queues/notification.queue';
import { NOTIFICATION_TYPES, NOTIFICATION_STATUS } from '@shared/constants/notifications';

/**
 * Notification consumer for handling notification events from RabbitMQ
 */
export class NotificationConsumer {
  private notificationService = new NotificationService();
  private rabbitMQService = RabbitMQService.getInstance();

  /**
   * Set up all notification consumers
   */
  async setupConsumers(): Promise<void> {
    try {
      logger.info('Setting up notification consumers...');
      
      // Set up topic exchange consumers (channel-specific)
      await this.setupTopicConsumers();
      
      // Set up fanout exchange consumers (broadcast)
      await this.setupBroadcastConsumers();
      
      // Set up direct exchange consumers (targeted)
      await this.setupDirectConsumers();
      
      logger.info('All notification consumers set up successfully');
    } catch (error) {
      logger.error('Failed to set up notification consumers', error);
      throw error;
    }
  }

  /**
   * Set up topic exchange consumers for channel-specific notifications
   */
  private async setupTopicConsumers(): Promise<void> {
    try {
      // Email notifications
      await subscribeToEvents<NotificationRecord>(
        'notification-email-consumer',
        EXCHANGES.NOTIFICATION,
        notificationQueues.NOTIFICATION_EMAIL,
        async (message) => {
          try {
            logger.info('Processing email notification', { 
              recipient: message.notificationOwner,
              type: message.type
            });
            
            // Process the notification
            await this.notificationService.createNotification(message);
          } catch (error) {
            logger.error('Error processing email notification', error);
            throw error;
          }
        }
      );
      
      // Push notifications
      await subscribeToEvents<NotificationRecord>(
        'notification-push-consumer',
        EXCHANGES.NOTIFICATION,
        notificationQueues.NOTIFICATION_PUSH,
        async (message) => {
          try {
            logger.info('Processing push notification', { 
              recipient: message.notificationOwner,
              type: message.type
            });
            
            // Get user's push token (this would typically come from a user service)
            const pushToken = await this.getUserPushToken(message.notificationOwner);
            
            if (pushToken && message.pushNotificationBody) {
              // Send push notification
              await this.notificationService.sendPushNotification({
                to: pushToken,
                title: message.title,
                body: message.pushNotificationBody,
                link: message.link,
                image: message.image,
                otherData: message.otherData
              });
            }
          } catch (error) {
            logger.error('Error processing push notification', error);
            throw error;
          }
        }
      );
      
      // SMS notifications
      await subscribeToEvents<NotificationRecord>(
        'notification-sms-consumer',
        EXCHANGES.NOTIFICATION,
        notificationQueues.NOTIFICATION_SMS,
        async (message) => {
          try {
            logger.info('Processing SMS notification', { 
              recipient: message.notificationOwner,
              type: message.type
            });
            
            // Process the notification (SMS implementation would go here)
            await this.notificationService.createNotification(message);
          } catch (error) {
            logger.error('Error processing SMS notification', error);
            throw error;
          }
        }
      );
      
      // In-app notifications
      await subscribeToEvents<NotificationRecord>(
        'notification-in-app-consumer',
        EXCHANGES.NOTIFICATION,
        notificationQueues.NOTIFICATION_IN_APP,
        async (message) => {
          try {
            logger.info('Processing in-app notification', { 
              recipient: message.notificationOwner,
              type: message.type
            });
            
            // Process the notification (in-app implementation would go here)
            await this.notificationService.createNotification(message);
          } catch (error) {
            logger.error('Error processing in-app notification', error);
            throw error;
          }
        }
      );
      
      logger.info('Topic exchange consumers set up successfully');
    } catch (error) {
      logger.error('Error setting up topic exchange consumers', error);
      throw error;
    }
  }

  /**
   * Set up fanout exchange consumers for broadcast notifications
   */
  private async setupBroadcastConsumers(): Promise<void> {
    try {
      // System broadcast notifications
      await subscribeToBroadcast<NotificationRecord>(
        'notification-broadcast-consumer',
        EXCHANGES.NOTIFICATION_BROADCAST,
        async (message) => {
          try {
            logger.info('Processing broadcast notification', { 
              type: message.type
            });
            
            // Process the broadcast notification
            // This would typically involve sending to all users
            // For now, we'll just log it
            logger.info('Broadcast notification received', message);
          } catch (error) {
            logger.error('Error processing broadcast notification', error);
            throw error;
          }
        }
      );
      
      logger.info('Fanout exchange consumers set up successfully');
    } catch (error) {
      logger.error('Error setting up fanout exchange consumers', error);
      throw error;
    }
  }

  /**
   * Set up direct exchange consumers for targeted notifications
   */
  private async setupDirectConsumers(): Promise<void> {
    try {
      // User-specific notifications
      await subscribeToDirect<NotificationRecord>(
        'notification-direct-user-consumer',
        EXCHANGES.NOTIFICATION_DIRECT,
        notificationQueues.NOTIFICATION_DIRECT_USER,
        async (message) => {
          try {
            logger.info('Processing direct user notification', { 
              recipient: message.notificationOwner,
              type: message.type
            });
            
            // Process the direct notification
            await this.notificationService.createNotification(message);
          } catch (error) {
            logger.error('Error processing direct user notification', error);
            throw error;
          }
        }
      );
      
      // Admin notifications
      await subscribeToDirect<NotificationRecord>(
        'notification-direct-admin-consumer',
        EXCHANGES.NOTIFICATION_DIRECT,
        notificationQueues.NOTIFICATION_DIRECT_ADMIN,
        async (message) => {
          try {
            logger.info('Processing direct admin notification', { 
              recipient: message.notificationOwner,
              type: message.type
            });
            
            // Process the direct notification
            await this.notificationService.createNotification(message);
          } catch (error) {
            logger.error('Error processing direct admin notification', error);
            throw error;
          }
        }
      );
      
      logger.info('Direct exchange consumers set up successfully');
    } catch (error) {
      logger.error('Error setting up direct exchange consumers', error);
      throw error;
    }
  }

  /**
   * Get user's push token
   * This would typically come from a user service
   */
  private async getUserPushToken(userId: string): Promise<string | null> {
    // This would typically query a user service
    // For now, we'll return null
    return null;
  }
}