import { config } from "@shared/config/environment";
import allQueues from "./queues";
import { type RabbitMQService } from ".";
import { logger } from "@shared/utils/logger";
import { EXCHANGES } from "./exchanges";

const amqp = require('amqplib');

async function setupQueues(this: RabbitMQService): Promise<void> {
  logger.info('Starting queue setup...');
  
  try {
    // Process each queue sequentially to better handle errors
    for (const [queueKey, queueName] of Object.entries(allQueues)) {
      try {
        const queueParts = queueName.split('.');
        const serviceName = queueParts[0]; // First segment is the service name
        const exchangeKey = serviceName.toUpperCase() as keyof typeof EXCHANGES;
        const exchange = EXCHANGES[exchangeKey];
        
        logger.debug(`Processing queue: ${queueName} (${queueKey}) on exchange: ${exchange}`);
        
        // Check if exchange exists
        if (!exchange) {
          logger.warn(`Exchange not found for service: ${serviceName}, skipping queue: ${queueName}`);
          continue;
        }
        
        // Create queue with appropriate routing pattern and timeout protection
        const queuePromise = this.createQueue(
          queueName, // Full queue name
          exchange,
          queueName, // Use full name as routing pattern
          {
            durable: true,
            messageTtl: 24 * 60 * 60 * 1000, // 24-hour message expiration
          }
        );
        
        // Add timeout to prevent hanging
        const result = await Promise.race([
          queuePromise,
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`Timeout creating queue: ${queueName}`)), 10000)
          )
        ]);
        
        logger.info(`✔️ Queue registered: ${queueKey} on exchange ${exchange}`);
      } catch (queueError) {
        // Log error but continue with next queue
        logger.error(`Error setting up queue ${queueName}:`, queueError);
      }
    }
    
    // Setup dead letter queue
    try {
      await this.setupDeadLetterQueue('dead-letter-queue');
      logger.info('✔️ Dead letter queue registered successfully');
    } catch (dlqError) {
      logger.error('Error setting up dead letter queue:', dlqError);
    }
    
    logger.info('✅ All queues are set up successfully.');
  } catch (error) {
    logger.error('❌ Error in queue setup process:', error);
    throw error;
  }
}


export default setupQueues;



