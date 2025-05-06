import { NotificationService } from '../../services/notification.service';
import type { NotificationPayload } from '../../interfaces/notification.interface';
import { logger } from '@shared/utils/logger';
import { RabbitMQService } from '@shared/events';
import EVENTS, { QUEUES } from '@shared/events/queues';
import { EXCHANGES } from '@shared/events/exchanges';
import { NOTIFICATION_TEMPLATES } from '../../config/novu.config';

export class NotificationConsumer {
  private notificationService = new NotificationService();
  private rabbitMQService = RabbitMQService.getInstance();

  async setupConsumers() {
    try {
      // Email notification consumer
      await this.rabbitMQService.subscribeToEvents(
        'notification-email-queue',
        EXCHANGES.NOTIFICATION,
        QUEUES.NOTIFICATION_EMAIL,
        async (message: NotificationPayload) => {
          try {
            // Send notification via service
            const result = await this.notificationService.sendNotification(message);

            // Optional: Handle failed notifications
            if (result.status === 'failed') {
              // Log the failure or implement retry mechanism
              logger.error('Notification send failed', { 
                payload: message, 
                result 
              });

              // Optionally publish to a dead letter or retry queue
              await this.rabbitMQService.publishEvent(
                EXCHANGES.DEAD_LETTER, 
                'notification.failed', 
                { 
                  originalPayload: message, 
                  failureReason: result 
                }
              );
            }
          } catch (error) {
            logger.error('Failed to process notification', { 
              error, 
              payload: message 
            });

            // Throw to trigger RabbitMQ's error handling (will nack the message)
            throw error;
          }
        }
      );

      // Wallet events consumer
      await this.rabbitMQService.subscribeToEvents(
        'wallet-notification-queue',
        EXCHANGES.WALLET,
        '*', // Subscribe to all wallet events
        async (message: any) => {
          try {
            // Map wallet events to notification templates
            let templateId: keyof typeof NOTIFICATION_TEMPLATES | undefined;
            
            switch (message.type) {
              case QUEUES.WALLET_CREATED:
                templateId = 'WALLET_CREATED';
                break;
              case QUEUES.TRANSFER_COMPLETED:
                templateId = 'TRANSFER_COMPLETED';
                break;
              case QUEUES.WITHDRAWAL_COMPLETED:
                templateId = 'WITHDRAWAL_COMPLETED';
                break;
              case QUEUES.DEPOSIT_COMPLETED:
                templateId = 'DEPOSIT_COMPLETED';
                break;
            }
            
            if (templateId) {
              // Send notification via service
              const result = await this.notificationService.sendNotification({
                templateId,
                recipient: message.recipient,
                data: message.data
              });
              
              if (result.status === 'failed') {
                logger.error('Wallet notification send failed', { 
                  payload: message, 
                  result 
                });
                
                await this.rabbitMQService.publishEvent(
                  EXCHANGES.DEAD_LETTER, 
                  'wallet.notification.failed', 
                  { 
                    originalPayload: message, 
                    failureReason: result 
                  }
                );
              }
            }
          } catch (error) {
            logger.error('Failed to process wallet notification', { 
              error, 
              payload: message 
            });
            
            throw error;
          }
        }
      );

      logger.info('Notification consumers setup complete');
    } catch (error) {
      logger.error('Failed to setup notification consumers', error);
      throw error;
    }
  }
}