/**
 * Notification types for the system
 * These types are used to identify different kinds of notifications
 */
export const NOTIFICATION_TYPES = {
    // User account notifications
    WELCOME_EMAIL: 'WELCOME_EMAIL',
    ACCOUNT_VERIFICATION: 'ACCOUNT_VERIFICATION',
    PASSWORD_RESET: 'PASSWORD_RESET',
    ACCOUNT_UPDATED: 'ACCOUNT_UPDATED',
    
    // Social notifications
    FOLLOW: 'FOLLOW',
    LIKE: 'LIKE',
    COMMENT: 'COMMENT',
    MENTION: 'MENTION',
    TAG: 'TAG',
    GIFT: 'GIFT',
    FIRST_POST: 'FIRST_POST',
    
    // System notifications
    SYSTEM_ANNOUNCEMENT: 'SYSTEM_ANNOUNCEMENT',
    MAINTENANCE: 'MAINTENANCE',
    SECURITY_ALERT: 'SECURITY_ALERT',
    
    // Wallet notifications
    WALLET_CREATED: 'WALLET_CREATED',
    TRANSFER_COMPLETED: 'TRANSFER_COMPLETED',
    WITHDRAWAL_COMPLETED: 'WITHDRAWAL_COMPLETED',
    DEPOSIT_COMPLETED: 'DEPOSIT_COMPLETED',
};

/**
 * Notification channels available in the system
 */
export const NOTIFICATION_CHANNELS = {
    EMAIL: 'EMAIL',
    SMS: 'SMS',
    PUSH: 'PUSH',
    IN_APP: 'IN_APP',
    WEBHOOK: 'WEBHOOK',
    SLACK: 'SLACK',
};

/**
 * Notification status values
 */
export const NOTIFICATION_STATUS = {
    READ: 'READ',
    UNREAD: 'UNREAD',
    PENDING: 'PENDING',
    SENT: 'SENT',
    FAILED: 'FAILED',
};

/**
 * Notification priority levels
 */
export const NOTIFICATION_PRIORITY = {
    LOW: 'LOW',
    MEDIUM: 'MEDIUM',
    HIGH: 'HIGH',
    URGENT: 'URGENT',
};