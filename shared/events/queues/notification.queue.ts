/**
 * Notification queue definitions
 * 
 * Queue naming convention:
 * - Topic exchange queues: notification.<channel>.<event>
 * - Fanout exchange queues: notification.broadcast.<event>
 * - Direct exchange queues: notification.direct.<recipient>
 */
const notificationQueues = {
    // Topic exchange queues (channel-specific)
    NOTIFICATION_EMAIL: 'notification.email',
    NOTIFICATION_SMS: 'notification.sms',
    NOTIFICATION_PUSH: 'notification.push',
    NOTIFICATION_IN_APP: 'notification.in_app',
    NOTIFICATION_WEBHOOK: 'notification.webhook',
    NOTIFICATION_SLACK: 'notification.slack',
    NOTIFICATION_PREFERENCES_UPDATED: 'notification.preference.updated',
    
    // Fanout exchange queues (broadcast to all subscribers)
    NOTIFICATION_BROADCAST_SYSTEM: 'notification.broadcast.system',
    NOTIFICATION_BROADCAST_MAINTENANCE: 'notification.broadcast.maintenance',
    NOTIFICATION_BROADCAST_ANNOUNCEMENT: 'notification.broadcast.announcement',
    
    // Direct exchange queues (targeted to specific recipients)
    NOTIFICATION_DIRECT_USER: 'notification.direct.user',
    NOTIFICATION_DIRECT_ADMIN: 'notification.direct.admin',
    NOTIFICATION_DIRECT_SUPPORT: 'notification.direct.support',
};

export default notificationQueues;