import { NOTIFICATION_TEMPLATES } from '../config/novu.config';
import { 
  NOTIFICATION_TYPES, 
  NOTIFICATION_CHANNELS, 
  NOTIFICATION_STATUS, 
  NOTIFICATION_PRIORITY 
} from '@shared/constants/notifications';

/**
 * Base notification payload
 */
export interface NotificationPayload {
  templateId: keyof typeof NOTIFICATION_TEMPLATES;
  recipient: string;
  data: Record<string, any>;
  channels?: Array<keyof typeof NOTIFICATION_CHANNELS>;
  priority?: keyof typeof NOTIFICATION_PRIORITY;
}

/**
 * Metadata returned after sending a notification
 */
export interface NotificationMetadata {
  messageId: string;
  timestamp: number;
  status: keyof typeof NOTIFICATION_STATUS | 'pending' | 'sent' | 'failed';
}

/**
 * Notification record stored in the database
 */
export interface NotificationRecord {
  id?: string;
  notificationOwner: string;
  title: string;
  body?: string;
  pushNotificationBody?: string;
  image?: string;
  action?: string;
  link?: string;
  status: keyof typeof NOTIFICATION_STATUS;
  type: keyof typeof NOTIFICATION_TYPES;
  createdAt?: Date;
  updatedAt?: Date;
  
  // Social notification flags
  isFollow?: boolean;
  isLike?: boolean;
  isComment?: boolean;
  isGift?: boolean;
  isTag?: boolean;
  
  // References to related entities
  postId?: string;
  commentId?: string;
  notificationTriggeredBy?: string;
  
  // Additional data
  otherData?: Record<string, any>;
  shouldCreateRecord?: boolean;
}

/**
 * Push notification specific payload
 */
export interface PushNotificationPayload {
  to: string;
  title: string;
  body: string;
  link?: string;
  image?: string;
  otherData?: Record<string, any>;
}

/**
 * User notification preferences
 */
export interface NotificationPreferences {
  userId: string;
  pauseAllNotifications?: boolean;
  mutePushNotifications?: boolean;
  
  // Social notification preferences
  likesFromEveryone?: boolean;
  likesFromProfilesIFollow?: boolean;
  commentsFromEveryone?: boolean;
  commentsFromProfilesIKnow?: boolean;
  photosOfYouFromEveryone?: boolean;
  photosOfYouFromPeopleIFollow?: boolean;
  firstPostFromEveryone?: boolean;
  firstPostFromProfilesIFollow?: boolean;
}

/**
 * Notification query parameters
 */
export interface NotificationQueryParams {
  page?: number;
  perPage?: number;
  status?: keyof typeof NOTIFICATION_STATUS;
  type?: keyof typeof NOTIFICATION_TYPES;
}

/**
 * Notification response with pagination
 */
export interface NotificationResponse {
  data: NotificationRecord[];
  total: number;
  current: number;
  pages: number;
}