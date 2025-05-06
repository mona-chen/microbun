// import { NOTIFICATION_TEMPLATES } from '../../config/novu.config';
// import type { NotificationPayload } from '../../interfaces/notification.interface';

// export class NotificationProducer {
//   private rabbitProducer = new RabbitMQProducer();

//   async produceNotificationEvent(
//     templateId: keyof typeof NOTIFICATION_TEMPLATES, 
//     recipient: string, 
//     data: Record<string, any>
//   ) {
//     const payload: NotificationPayload = {
//       templateId,
//       recipient,
//       data
//     };

//     await this.rabbitProducer.publish(
//       'notification-events', 
//       'notification.created', 
//       payload
//     );
//   }
// }