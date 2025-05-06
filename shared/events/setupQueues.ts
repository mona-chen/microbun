import { config } from "@shared/config/environment";
import notificationQueues from "./queues/notification.queue";
import { type RabbitMQService } from ".";
import { logger } from "@shared/utils/logger";
import { EXCHANGES, ExchangeConfig, EXCHANGE_TYPES, type Exchange } from "./exchanges";

async function setupQueues(this: RabbitMQService): Promise<void> {
  logger.info('Starting notification queue setup...');
  
  try {
    // Setup notification queues
    for (const [queueKey, queueName] of Object.entries(notificationQueues)) {
      try {
        // Cast queueName to string to fix TypeScript error
        const queueNameStr = queueName as string;
        
        // Determine the appropriate exchange based on queue name
        let exchange: Exchange;
        let routingPattern: string;
        
        // Check if this is a broadcast or direct notification
        if (queueNameStr.includes('broadcast')) {
          exchange = EXCHANGES.NOTIFICATION_BROADCAST;
          routingPattern = ''; // Empty for fanout exchange
        } else if (queueNameStr.includes('direct')) {
          exchange = EXCHANGES.NOTIFICATION_DIRECT;
          routingPattern = queueNameStr; // Use queue name as routing key for direct exchange
        } else {
          exchange = EXCHANGES.NOTIFICATION;
          routingPattern = queueNameStr; // Use queue name as routing key for topic exchange
        }
        
        // Get the exchange type
        const exchangeType = ExchangeConfig[exchange];
        
        logger.debug(`Processing queue: ${queueNameStr} (${queueKey}) on exchange: ${exchange} (${exchangeType})`);
        
        // Create queue with appropriate routing pattern and timeout protection
        const queuePromise = this.createQueue(
          queueNameStr, // Full queue name
          exchange,
          routingPattern,
          {
            durable: true,
            messageTtl: 24 * 60 * 60 * 1000, // 24-hour message expiration
          }
        );
        
        // Add timeout to prevent hanging
        const result = await Promise.race([
          queuePromise,
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`Timeout creating queue: ${queueNameStr}`)), 10000)
          )
        ]);
        
        logger.info(`✔️ Queue registered: ${queueKey} on exchange ${exchange} (${exchangeType})`);
      } catch (queueError) {
        // Log error but continue with next queue
        logger.error(`Error setting up queue ${queueKey}:`, queueError);
      }
    }
    
    // Setup special queue for broadcast notifications
    try {
      await this.createQueue(
        'notification.broadcast.all',
        EXCHANGES.NOTIFICATION_BROADCAST,
        '', // Empty routing key for fanout exchange
        {
          durable: true,
          messageTtl: 24 * 60 * 60 * 1000, // 24-hour message expiration
        }
      );
      logger.info(`✔️ Broadcast queue registered on exchange ${EXCHANGES.NOTIFICATION_BROADCAST}`);
    } catch (broadcastError) {
      logger.error('Error setting up broadcast queue:', broadcastError);
    }
    
    // Setup dead letter queue
    try {
      await this.setupDeadLetterQueue('notification-dead-letter-queue');
      logger.info('✔️ Dead letter queue registered successfully');
    } catch (dlqError) {
      logger.error('Error setting up dead letter queue:', dlqError);
    }
    
    logger.info('✅ All notification queues are set up successfully.');
  } catch (error) {
    logger.error('❌ Error in queue setup process:', error);
    throw error;
  }
}

export default setupQueues;



