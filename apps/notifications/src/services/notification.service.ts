import { CircuitBreakerManager } from '@shared/utils/circuit-breaker';
import type { 
  NotificationMetadata, 
  NotificationPayload, 
  NotificationRecord, 
  PushNotificationPayload,
  NotificationPreferences,
  NotificationResponse,
  NotificationQueryParams
} from '../interfaces/notification.interface';
import { 
  NOTIFICATION_TYPES, 
  NOTIFICATION_STATUS,
  NOTIFICATION_CHANNELS
} from '@shared/constants/notifications';
import { logger } from '@shared/utils/logger';
import { RabbitMQService, publishEvent, publishBroadcast, publishDirect } from '@shared/events';
import { EXCHANGES, type Exchange } from '@shared/events/exchanges';
import { EmailService, type EmailData } from './email.service';
import { SmsService, type SmsData } from './sms.service';
import axios from 'axios';
import * as fs from 'fs';
import { config } from '@shared/config/environment';

// Using a type declaration instead of importing the JWT class
// This avoids the need for the google-auth-library package
type JWT = {
  authorize: (callback: (err: any, tokens: { access_token?: string }) => void) => void;
};
declare const JWT: {
  new (
    email: string | undefined, 
    keyFile: any, 
    key: string | undefined, 
    scopes: string[]
  ): JWT;
};

/**
 * Notification service for handling all types of notifications
 */
export class NotificationService {
  private emailService: EmailService;
  private smsService: SmsService;
  private rabbitMQService: RabbitMQService;

  constructor() {
    // Initialize services
    this.emailService = EmailService.getInstance();
    this.smsService = SmsService.getInstance();
    this.rabbitMQService = RabbitMQService.getInstance();

    // Register circuit breakers
    CircuitBreakerManager.register('email-notification', 
      (payload: NotificationPayload) => this.sendEmailNotification(payload),
      {
        failureThreshold: 3,
        retryBackoff: 'exponential',
        distributedTracking: true
      }
    );

    CircuitBreakerManager.register('sms-notification', 
      (payload: NotificationPayload) => this.sendSmsNotification(payload),
      {
        failureThreshold: 3,
        retryBackoff: 'exponential',
        distributedTracking: true
      }
    );

    CircuitBreakerManager.register('push-notification', 
      (payload: PushNotificationPayload) => this.sendPushNotification(payload),
      {
        failureThreshold: 3,
        retryBackoff: 'exponential',
        distributedTracking: true
      }
    );
  }

  /**
   * Send a notification to all specified channels
   */
  async sendNotification(payload: NotificationPayload): Promise<NotificationMetadata> {
    try {
      let overallResult = false;
      
      // If no channels specified, default to EMAIL
      const channels = payload.channels && payload.channels.length > 0 
        ? payload.channels 
        : ['EMAIL' as keyof typeof NOTIFICATION_CHANNELS];
      
      // Send to each channel
      for (const channel of channels) {
        let channelResult = false;
        
        switch (channel) {
          case 'EMAIL':
            channelResult = await this.sendEmailNotification(payload);
            break;
          case 'SMS':
            channelResult = await this.sendSmsNotification(payload);
            break;
          case 'PUSH':
            if (payload.recipient && payload.data?.pushToken) {
              channelResult = await this.sendPushNotification({
                to: payload.data.pushToken,
                title: payload.data.title || 'Notification',
                body: payload.data.body || '',
                link: payload.data.link,
                otherData: payload.data
              });
            }
            break;
          case 'IN_APP':
            // In-app notifications are handled by the client
            channelResult = true;
            break;
          case 'WEBHOOK':
            // Webhook notifications would be implemented here
            channelResult = true;
            break;
          case 'SLACK':
            // Slack notifications would be implemented here
            channelResult = true;
            break;
          default:
            logger.warn(`Unsupported notification channel: ${channel}`);
            channelResult = false;
        }
        
        // If any channel succeeds, consider the overall notification successful
        if (channelResult) {
          overallResult = true;
        }
      }

      return {
        messageId: crypto.randomUUID(),
        timestamp: Date.now(),
        status: overallResult ? 'SENT' : 'FAILED'
      };
    } catch (error) {
      logger.error('Notification sending failed', error);
      
      return {
        messageId: crypto.randomUUID(),
        timestamp: Date.now(),
        status: 'FAILED'
      };
    }
  }

  /**
   * Send an email notification
   */
  private async sendEmailNotification(payload: NotificationPayload): Promise<boolean> {
    try {
      // Extract email data from payload
      const { recipient, templateId, data } = payload;
      
      // Convert to email data
      const emailData: EmailData = {
        to: recipient,
        subject: data?.subject || 'Notification',
        templateName: templateId,
        templateData: data || {}
      };
      
      // Send email
      return await this.emailService.sendEmail(emailData);
    } catch (error) {
      logger.error('Email notification sending failed', error);
      return false;
    }
  }

  /**
   * Send an SMS notification
   */
  private async sendSmsNotification(payload: NotificationPayload): Promise<boolean> {
    try {
      // Extract SMS data from payload
      const { recipient, data } = payload;
      
      // Convert to SMS data
      const smsData: SmsData = {
        to: recipient,
        message: data?.body || 'Notification',
        mediaUrl: data?.mediaUrl
      };
      
      // Send SMS
      return await this.smsService.sendSms(smsData);
    } catch (error) {
      logger.error('SMS notification sending failed', error);
      return false;
    }
  }

  /**
   * Create a notification record and publish to appropriate queues
   */
  async createNotification(notification: NotificationRecord): Promise<NotificationMetadata> {
    try {
      // Check if notification should be created based on user preferences
      if (!await this.shouldSendNotification(notification)) {
        logger.info('Notification filtered based on user preferences', { 
          userId: notification.notificationOwner,
          type: notification.type
        });
        
        return {
          messageId: crypto.randomUUID(),
          timestamp: Date.now(),
          status: 'PENDING'
        };
      }

      // Determine the appropriate exchange and routing key based on notification type
      let exchange: Exchange = EXCHANGES.NOTIFICATION;
      let routingKey = `notification.${notification.type.toLowerCase()}`;
      
      // For broadcast notifications, use the broadcast exchange
      if (notification.type.includes('SYSTEM') || notification.type.includes('MAINTENANCE')) {
        exchange = EXCHANGES.NOTIFICATION_BROADCAST;
        routingKey = `notification.broadcast.${notification.type.toLowerCase()}`;
        
        // Publish to broadcast exchange
        await publishBroadcast(exchange, notification);
      } 
      // For direct notifications to specific users, use the direct exchange
      else if (notification.notificationTriggeredBy) {
        exchange = EXCHANGES.NOTIFICATION_DIRECT;
        routingKey = `notification.direct.user`;
        
        // Publish to direct exchange
        await publishDirect(exchange, routingKey, notification);
      }
      // For regular notifications, use the topic exchange
      else {
        // Publish to topic exchange
        await publishEvent(exchange, routingKey, notification);
      }
      
      // If this is a push notification, send it directly
      if (notification.pushNotificationBody) {
        // Get user's push token (this would typically come from a user service)
        const pushToken = await this.getUserPushToken(notification.notificationOwner);
        
        if (pushToken) {
          await this.sendPushNotification({
            to: pushToken,
            title: notification.title,
            body: notification.pushNotificationBody,
            link: notification.link,
            image: notification.image,
            otherData: notification.otherData
          });
        }
      }
      
      return {
        messageId: crypto.randomUUID(),
        timestamp: Date.now(),
        status: 'SENT'
      };
    } catch (error) {
      logger.error('Error creating notification', error);
      
      return {
        messageId: crypto.randomUUID(),
        timestamp: Date.now(),
        status: 'FAILED'
      };
    }
  }

  /**
   * Get user notifications with pagination
   */
  async getUserNotifications(
    userId: string, 
    query: NotificationQueryParams
  ): Promise<NotificationResponse> {
    try {
      // This would typically query a database
      // For now, we'll return a mock response
      return {
        data: [],
        total: 0,
        current: query.page || 1,
        pages: 0
      };
    } catch (error) {
      logger.error('Error getting user notifications', error);
      throw error;
    }
  }

  /**
   * Get unread notification count for a user
   */
  async getUnreadNotificationCount(userId: string): Promise<number> {
    try {
      // This would typically query a database
      // For now, we'll return a mock count
      return 0;
    } catch (error) {
      logger.error('Error getting unread notification count', error);
      throw error;
    }
  }

  /**
   * Update notification status (e.g., mark as read)
   */
  async updateNotificationStatus(userId: string, status: 'READ' | 'UNREAD' | 'PENDING' | 'SENT' | 'FAILED' = 'READ'): Promise<void> {
    try {
      // This would typically update a database
      // For now, we'll just log the action
      logger.info(`Updating notifications for user ${userId} to status ${status}`);
    } catch (error) {
      logger.error('Error updating notification status', error);
      throw error;
    }
  }

  /**
   * Send a push notification
   */
  async sendPushNotification(payload: PushNotificationPayload): Promise<boolean> {
    try {
      // Get Firebase credentials from environment variable or file
      const firebaseCredentialsPath = process.env.FIREBASE_CREDENTIALS_PATH || '.env';
      const firebaseConfig = JSON.parse(
        fs.readFileSync(firebaseCredentialsPath, 'utf8')
      );

      // Create JWT client
      const jwtClient = new JWT(
        firebaseConfig?.client_email || process.env.FIREBASE_CLIENT_EMAIL,
        null,
        firebaseConfig?.private_key || process.env.FIREBASE_PRIVATE_KEY,
        ['https://www.googleapis.com/auth/cloud-platform']
      );

      // Get access token
      const accessToken = await new Promise<string | undefined>((resolve) => {
        jwtClient.authorize(function (err, tokens) {
          resolve(tokens?.access_token);
        });
      });

      const serverKey = accessToken as string;
      const url = 'https://fcm.googleapis.com/v1/projects/giftiapp/messages:send';

      // Prepare request data
      const requestData = {
        message: {
          token: payload.to,
          notification: {
            title: payload.title,
            body: payload.body,
          },
          data: {
            link: payload.link,
            ...payload.otherData,
          },
        },
      };

      // Send push notification
      const response = await axios.post(url, requestData, {
        headers: {
          Authorization: `Bearer ${serverKey}`,
          'Content-Type': 'application/json',
        },
      });

      logger.info('Push notification sent', { response: response.data });
      return true;
    } catch (error: unknown) {
      // Properly handle unknown error type
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorResponse = (error as any)?.response?.data || errorMessage;
      
      logger.error('Error sending push notification', errorResponse);
      return false;
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

  /**
   * Get user's notification preferences
   * This would typically come from a user settings service
   */
  private async getUserNotificationPreferences(userId: string): Promise<NotificationPreferences> {
    // This would typically query a user settings service
    // For now, we'll return default preferences
    return {
      userId,
      pauseAllNotifications: false,
      mutePushNotifications: false,
      likesFromEveryone: true,
      likesFromProfilesIFollow: true,
      commentsFromEveryone: true,
      commentsFromProfilesIKnow: true,
      photosOfYouFromEveryone: true,
      photosOfYouFromPeopleIFollow: true,
      firstPostFromEveryone: true,
      firstPostFromProfilesIFollow: true
    };
  }

  /**
   * Check if a user is following another user
   * This would typically come from a user service
   */
  private async isUserFollowing(followerId: string, followedId: string): Promise<boolean> {
    // This would typically query a user service
    // For now, we'll return false
    return false;
  }

  /**
   * Determine if a notification should be sent based on user preferences
   */
  private async shouldSendNotification(notification: NotificationRecord): Promise<boolean> {
    try {
      // Get user preferences
      const preferences = await this.getUserNotificationPreferences(notification.notificationOwner);
      
      // If all notifications are paused, don't send
      if (preferences.pauseAllNotifications) {
        return false;
      }
      
      // If this is a push notification and push notifications are muted, don't send
      if (notification.pushNotificationBody && preferences.mutePushNotifications) {
        return false;
      }
      
      // If there's no triggering user, always send (system notifications)
      if (!notification.notificationTriggeredBy) {
        return true;
      }
      
      // Check if the user follows the triggering user
      const isFollowing = await this.isUserFollowing(
        notification.notificationOwner,
        notification.notificationTriggeredBy
      );
      
      // Apply social notification preferences
      if (notification.isLike) {
        if (!isFollowing && !preferences.likesFromEveryone) return false;
        if (isFollowing && !preferences.likesFromProfilesIFollow) return false;
      }
      
      if (notification.isComment) {
        if (!isFollowing && !preferences.commentsFromEveryone) return false;
        if (isFollowing && !preferences.commentsFromProfilesIKnow) return false;
      }
      
      if (notification.isTag) {
        if (!isFollowing && !preferences.photosOfYouFromEveryone) return false;
        if (isFollowing && !preferences.photosOfYouFromPeopleIFollow) return false;
      }
      
      return true;
    } catch (error) {
      logger.error('Error checking notification preferences', error);
      // Default to sending the notification if there's an error
      return true;
    }
  }
}