import complianceQueues from './compliance.queue';
import  notificationQueues from './notification.queue';
import userQueues from './users.queue'
import walletQueue from './wallet.queue';

 const EVENTS = {
    ...userQueues,
    ...complianceQueues,
    ...notificationQueues,
    ...walletQueue
}

export type EventName = keyof typeof EVENTS;

export const QUEUES = EVENTS // alias name
export default EVENTS;
