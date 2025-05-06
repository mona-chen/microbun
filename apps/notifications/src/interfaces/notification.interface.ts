import { NOTIFICATION_TEMPLATES } from '../config/novu.config';

export interface NotificationPayload {
  templateId: keyof typeof NOTIFICATION_TEMPLATES;
  recipient: string;
  data: Record<string, any>;
}

export interface NotificationMetadata {
  messageId: string;
  timestamp: number;
  status: 'pending' | 'sent' | 'failed';
}