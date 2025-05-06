import { NOTIFICATION_TEMPLATES } from '../../config/novu.config';
import type { 
  NotificationPayload, 
  NotificationRecord 
} from '../../interfaces/notification.interface';
import { logger } from '@shared/utils/logger';
import { 
  publishEvent, 
  publishBroadcast, 
  publishDirect 
} from '@shared/events';
import { EXCHANGES, type Exchange } from '@shared/events/exchanges';
import { NOTIFICATION_TYPES, NOTIFICATION_STATUS } from '@shared/constants/notifications';
import notificationQueues from '@shared/events/queues/notification.queue';

/**
 * Notification producer for publishing notification events to RabbitMQ
 */
export class NotificationProducer {
  /**
   * Publish a notification to the appropriate exchange and queue
   */
  async produceNotification(notification: NotificationRecord): Promise<boolean> {
    try {
      logger.info('Publishing notification', { 
        recipient: notification.notificationOwner,
        type: notification.type
      });
      
      // Determine the appropriate exchange and routing key based on notification type
      let exchange: Exchange = EXCHANGES.NOTIFICATION;
      let routingKey = `notification.${notification.type.toLowerCase()}`;
      
      // For broadcast notifications, use the broadcast exchange
      if (notification.type.includes('SYSTEM') || notification.type.includes('MAINTENANCE')) {
        // Use a separate variable to avoid type errors
        const broadcastExchange: Exchange = EXCHANGES.NOTIFICATION_BROADCAST;
        routingKey = `notification.broadcast.${notification.type.toLowerCase()}`;
        
        // Publish to broadcast exchange
        return await publishBroadcast(broadcastExchange, notification);
      } 
      // For direct notifications to specific users, use the direct exchange
      else if (notification.notificationTriggeredBy) {
        // Use a separate variable to avoid type errors
        const directExchange: Exchange = EXCHANGES.NOTIFICATION_DIRECT;
        routingKey = `notification.direct.user`;
        
        // Publish to direct exchange with routing key
        return await publishDirect(directExchange, routingKey, notification);
      }
      // For regular notifications, use the topic exchange
      else {
        // Publish to topic exchange
        return await publishEvent(exchange, routingKey, notification);
      }
    } catch (error) {
      logger.error('Error publishing notification', error);
      throw error;
    }
  }

  /**
   * Publish an email notification
   */
  async produceEmailNotification(
    recipient: string,
    title: string,
    body: string,
    data: Record<string, any> = {}
  ): Promise<boolean> {
    try {
      const notification: NotificationRecord = {
        notificationOwner: recipient,
        title,
        body,
        status: 'PENDING' as keyof typeof NOTIFICATION_STATUS,
        type: 'WELCOME_EMAIL' as keyof typeof NOTIFICATION_TYPES,
        otherData: data
      };
      
      return await publishEvent(
        EXCHANGES.NOTIFICATION,
        notificationQueues.NOTIFICATION_EMAIL,
        notification
      );
    } catch (error) {
      logger.error('Error publishing email notification', error);
      throw error;
    }
  }

  /**
   * Publish a push notification
   */
  async producePushNotification(
    recipient: string,
    title: string,
    body: string,
    link?: string,
    image?: string,
    data: Record<string, any> = {}
  ): Promise<boolean> {
    try {
      const notification: NotificationRecord = {
        notificationOwner: recipient,
        title,
        pushNotificationBody: body,
        link,
        image,
        status: 'PENDING' as keyof typeof NOTIFICATION_STATUS,
        type: 'PUSH' as keyof typeof NOTIFICATION_TYPES,
        otherData: data
      };
      
      return await publishEvent(
        EXCHANGES.NOTIFICATION,
        notificationQueues.NOTIFICATION_PUSH,
        notification
      );
    } catch (error) {
      logger.error('Error publishing push notification', error);
      throw error;
    }
  }

  /**
   * Publish a social notification (like, comment, follow, etc.)
   */
  async produceSocialNotification(
    recipient: string,
    triggeredBy: string,
    type: 'LIKE' | 'COMMENT' | 'FOLLOW' | 'TAG' | 'GIFT',
    title: string,
    body: string,
    postId?: string,
    commentId?: string,
    data: Record<string, any> = {}
  ): Promise<boolean> {
    try {
      const notification: NotificationRecord = {
        notificationOwner: recipient,
        notificationTriggeredBy: triggeredBy,
        title,
        body,
        status: 'PENDING' as keyof typeof NOTIFICATION_STATUS,
        type: type as keyof typeof NOTIFICATION_TYPES,
        isLike: type === 'LIKE',
        isComment: type === 'COMMENT',
        isFollow: type === 'FOLLOW',
        isTag: type === 'TAG',
        isGift: type === 'GIFT',
        postId,
        commentId,
        otherData: data
      };
      
      // Use the correct routing key for direct exchange
      const routingKey = `notification.direct.user`;
      return await publishDirect(
        EXCHANGES.NOTIFICATION_DIRECT,
        routingKey,
        notification
      );
    } catch (error) {
      logger.error('Error publishing social notification', error);
      throw error;
    }
  }

  /**
   * Publish a broadcast notification to all users
   */
  async produceBroadcastNotification(
    type: 'SYSTEM_ANNOUNCEMENT' | 'MAINTENANCE' | 'SECURITY_ALERT',
    title: string,
    body: string,
    data: Record<string, any> = {}
  ): Promise<boolean> {
    try {
      const notification: NotificationRecord = {
        notificationOwner: 'all', // Special value for broadcast
        title,
        body,
        status: 'PENDING' as keyof typeof NOTIFICATION_STATUS,
        type: type as keyof typeof NOTIFICATION_TYPES,
        otherData: data
      };
      
      return await publishBroadcast(
        EXCHANGES.NOTIFICATION_BROADCAST,
        notification
      );
    } catch (error) {
      logger.error('Error publishing broadcast notification', error);
      throw error;
    }
  }
}

// Export a singleton instance for convenience
export default new NotificationProducer();