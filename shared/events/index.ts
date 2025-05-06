// shared/events/rabbitmqService.ts
import amqp, { type Channel, type Connection, type ChannelModel } from 'amqplib';
import { EventEmitter } from 'events';
import { config } from '../../shared/config/environment';
import { logger } from '@shared/utils/logger';
import { ExchangeConfig, EXCHANGES } from './exchanges';
import setupQueues from './setupQueues';

export class RabbitMQService {
  private connection: amqp.Connection | null = null;
  private channel: Channel | null = null;
  private eventEmitter = new EventEmitter();
  private static instance: RabbitMQService | null = null;
  private initialized = false;
  private connecting = false;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private maxReconnectAttempts = 10;
  private reconnectAttempts = 0;
  private eventListeners: Map<string, Set<Function>> = new Map();

  private constructor() {
    // Set max listeners to prevent memory leaks
    this.eventEmitter.setMaxListeners(20);
  }

  /**
   * Get singleton instance of RabbitMQService
   */
  public static getInstance(): RabbitMQService {
    if (!RabbitMQService.instance) {
      RabbitMQService.instance = new RabbitMQService();
    }
    return RabbitMQService.instance;
  }

  /**
   * Initialize RabbitMQ connection
   */
  public async initialize(): Promise<{ connection: Connection; channel: Channel }> {
    if (this.initialized && this.connection && this.channel) {
      return { connection: this.connection, channel: this.channel };
    }

    if (this.connecting) {
      // Wait for the ongoing connection to complete
      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          this.eventEmitter.removeListener('connected', connectHandler);
          reject(new Error('Connection timeout after 30 seconds'));
        }, 30000);

        const connectHandler = () => {
          clearTimeout(timeoutId);
          if (this.connection && this.channel) {
            resolve({ connection: this.connection, channel: this.channel });
          } else {
            reject(new Error('Connection or channel is null after connection event'));
          }
        };

        this.eventEmitter.once('connected', connectHandler);
      });
    }

    this.connecting = true;
    this.reconnectAttempts = 0;

    logger.info('Connecting to RabbitMQ...');

    try {
      this.connection = await amqp.connect(config.RABBIT_MQ.SERVICE_URL as string) as unknown as Connection;
      
      // Create channel first to enable queue operations
      this.channel = await (this.connection as any).createChannel();
      
      // Setup exchanges
      await this.setupExchanges();
      
      // Then setup queues with the channel available
      await this.setupQueues();

      // Handle connection errors
      this.connection.on('error', err => {
        logger.error('RabbitMQ connection error:', err);
        this.reconnect();
      });

      this.connection.on('close', () => {
        logger.info('RabbitMQ connection closed, attempting to reconnect...');
        this.reconnect();
      });

      logger.info('RabbitMQ connection established');
      this.initialized = true;
      this.connecting = false;
      this.eventEmitter.emit('connected');
      
      return { connection: this.connection, channel: this.channel as Channel };
    } catch (error) {
      logger.error('Failed to connect to RabbitMQ:', error);
      this.connecting = false;
      this.reconnect();
      throw error;
    }
  }

  /**
   * Setup exchanges
   */
  private async setupExchanges(): Promise<void> {
    if (!this.channel) {
      throw new Error('Channel not available for setting up exchanges');
    }

    try {
      logger.info('Setting up exchanges...');
      for (const exchange of Object.values(EXCHANGES)) {
        logger.debug(`Asserting exchange: ${exchange}`);
        await this.channel.assertExchange(
          exchange, 
          ExchangeConfig[exchange as keyof typeof ExchangeConfig], 
          { durable: true }
        );
        logger.debug(`Exchange ${exchange} asserted successfully`);
      }
      logger.info('All exchanges set up successfully');
    } catch (error) {
      logger.error('Error setting up exchanges:', error);
      throw error;
    }
  }

  /**
   * Setup queues
   */
  public async setupQueues(): Promise<void> {
    if (!this.channel) {
      throw new Error('Channel not available for setting up queues');
    }

    setupQueues.call(this);
    
  }

  /**
   * Reconnect to RabbitMQ
   */
  private async reconnect(): Promise<void> {
    this.reconnectAttempts++;
    
    if (this.reconnectAttempts > this.maxReconnectAttempts) {
      logger.error(`Maximum reconnect attempts (${this.maxReconnectAttempts}) reached. Giving up.`);
      return;
    }
    
    try {
      // Cancel any existing reconnect timeout
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
      }
      
      // Close existing connections
      if (this.channel) {
        await this.channel.close().catch(err => 
          logger.error('Error closing channel:', err)
        );
      }
      
      if (this.connection) {
        await (this.connection as any).close().catch(err => 
          logger.error('Error closing connection:', err)
        );
      }
    } catch (err) {
      logger.error('Error closing existing connections:', err);
    }

    // Reset connection and channel
    this.connection = null;
    this.channel = null;
    this.initialized = false;
    this.connecting = false;

    // Try to reconnect after a delay with exponential backoff
    const delay = Math.min(5000 * Math.pow(1.5, this.reconnectAttempts - 1), 60000);
    logger.info(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
    
    this.reconnectTimeout = setTimeout(async () => {
      try {
        await this.initialize();
        this.reconnectAttempts = 0;
        // Emit reconnected event so consumers can resubscribe
        this.eventEmitter.emit('reconnected');
      } catch (error) {
        logger.error('Failed to reconnect to RabbitMQ:', error);
      }
    }, delay);
  }

  /**
   * Get the RabbitMQ channel
   */
  public async getChannel(): Promise<Channel> {
    if (!this.channel) {
      const { channel } = await this.initialize();
      return channel;
    }
    return this.channel;
  }

  /**
   * Create a queue with dead letter routing
   */
  public async createQueue(
    queueName: string,
    exchange: string,
    routingPattern: string,
    options: amqp.Options.AssertQueue = {},
  ): Promise<amqp.Replies.AssertQueue> {
    try {
      logger.debug(`Creating queue: ${queueName} on exchange: ${exchange}`);
      const ch = await this.getChannel();

      // Queue options with dead letter exchange
      const queueOptions: amqp.Options.AssertQueue = {
        durable: true,
        deadLetterExchange: EXCHANGES.DEAD_LETTER,
        ...options,
      };

      // Assert the queue
      logger.debug(`Asserting queue: ${queueName}`);
      const q = await ch.assertQueue(queueName, queueOptions);
      logger.debug(`Queue asserted: ${queueName}`);

      // Bind the queue to the exchange with the routing pattern
      logger.debug(`Binding queue ${queueName} to exchange ${exchange} with pattern ${routingPattern}`);
      await ch.bindQueue(q.queue, exchange, routingPattern);
      logger.debug(`Queue bound: ${queueName}`);

      logger.info(`Queue ${queueName} created and bound successfully`);
      return q;
    } catch (error) {
      logger.error(`Error creating queue ${queueName}:`, error);
      throw error;
    }
  }

  /**
   * Create and setup dead letter queue
   */
  public async setupDeadLetterQueue(dlqName: string): Promise<void> {
    try {
      logger.debug(`Setting up dead letter queue: ${dlqName}`);
      const ch = await this.getChannel();
      await ch.assertQueue(dlqName, { durable: true });
      await ch.bindQueue(dlqName, EXCHANGES.DEAD_LETTER, '#');
      logger.info(`Dead letter queue ${dlqName} set up successfully`);
    } catch (error) {
      logger.error(`Error setting up dead letter queue ${dlqName}:`, error);
      throw error;
    }
  }

  /**
   * Publish an event to an exchange
   */
  public async publishEvent(
    exchange: string,
    routingKey: string,
    message: any,
    options: amqp.Options.Publish = {},
  ): Promise<boolean> {
    try {
      const ch = await this.getChannel();

      // Add metadata to the message
      const enhancedMessage = {
        ...message,
        metadata: {
          timestamp: new Date().toISOString(),
          eventId: this.generateEventId(),
          ...(message.metadata || {}),
        },
      };

      // Default options
      const defaultOptions: amqp.Options.Publish = {
        persistent: true,
        contentType: 'application/json',
        contentEncoding: 'utf-8',
        ...options,
      };

      logger.debug(`Publishing event to ${exchange}/${routingKey}`);
      return ch.publish(
        exchange,
        routingKey,
        Buffer.from(JSON.stringify(enhancedMessage)),
        defaultOptions,
      );
    } catch (error) {
      logger.error(`Error publishing event to ${exchange}/${routingKey}:`, error);
      throw error;
    }
  }

  /**
   * Subscribe to events
   */
  public async subscribeToEvents<T>(
    queueName: string,
    exchange: string,
    routingPattern: string,
    handler: (message: T) => Promise<void>,
    options: amqp.Options.Consume = {},
  ): Promise<amqp.Replies.Consume> {
    try {
      logger.info(`Subscribing to events on ${queueName} (${exchange}/${routingPattern})`);
      const ch = await this.getChannel();

      // Create the queue and bind it
      await this.createQueue(queueName, exchange, routingPattern);

      // Default consume options
      const consumeOptions: amqp.Options.Consume = {
        noAck: false,
        ...options,
      };

      // Track handler to prevent memory leaks
      if (!this.eventListeners.has(queueName)) {
        this.eventListeners.set(queueName, new Set());
      }
      this.eventListeners.get(queueName)!.add(handler);

      // Create a wrapper function to handle errors
      const messageHandler = async (msg: amqp.ConsumeMessage | null) => {
        if (!msg) return;

        try {
          const content = JSON.parse(msg.content.toString());
          await handler(content);
          ch.ack(msg);
        } catch (error) {
          logger.error(`Error processing message from ${queueName}:`, error);
          // Reject the message
          ch.nack(msg, false, false);
        }
      };

      // Start consuming
      const { consumerTag } = await ch.consume(
        queueName,
        messageHandler,
        consumeOptions,
      );

      // Create reconnection handler
      const reconnectHandler = async () => {
        try {
          logger.info(`Resubscribing to ${queueName} after reconnect`);
          await this.subscribeToEvents(queueName, exchange, routingPattern, handler, options);
        } catch (error) {
          logger.error(`Failed to re-subscribe to ${queueName}:`, error);
        }
      };

      // Handle reconnection
      this.onReconnect(reconnectHandler);

      logger.info(`Successfully subscribed to ${queueName}`);
      return { consumerTag };
    } catch (error) {
      logger.error(`Error subscribing to ${exchange}/${routingPattern}:`, error);
      throw error;
    }
  }

  /**
   * Unsubscribe from events
   */
  public async unsubscribeFromEvents(
    queueName: string,
    consumerTag: string,
    handler: (message: any) => Promise<void>
  ): Promise<void> {
    try {
      logger.info(`Unsubscribing from ${queueName} (tag: ${consumerTag})`);
      const ch = await this.getChannel();
      await ch.cancel(consumerTag);
      
      // Remove handler from tracked listeners
      if (this.eventListeners.has(queueName)) {
        this.eventListeners.get(queueName)!.delete(handler);
        if (this.eventListeners.get(queueName)!.size === 0) {
          this.eventListeners.delete(queueName);
        }
      }
      
      logger.info(`Successfully unsubscribed from ${queueName}`);
    } catch (error) {
      logger.error(`Error unsubscribing from ${queueName}:`, error);
      throw error;
    }
  }

  /**
   * Generate a unique event ID
   */
  private generateEventId(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  /**
   * Close connection (for graceful shutdown)
   */
  public async closeConnection(): Promise<void> {
    logger.info('Closing RabbitMQ connection...');
    
    try {
      // Clear any pending reconnect timeout
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
      }
      
      // Clear all event listeners
      this.eventEmitter.removeAllListeners();
      this.eventListeners.clear();
      
      if (this.channel) {
        await this.channel.close();
        this.channel = null;
      }
      
      if (this.connection) {
        await (this.connection as any).close();
        this.connection = null;
      }
      
      this.initialized = false;
      logger.info('RabbitMQ connection closed successfully');
    } catch (error) {
      logger.error('Error closing RabbitMQ connection:', error);
      throw error;
    }
  }

  /**
   * Register a callback for reconnect events
   */
  public onReconnect(callback: () => void): void {
    this.eventEmitter.on('reconnected', callback);
  }

  /**
   * Remove a reconnect event listener
   */
  public removeReconnectListener(callback: () => void): void {
    this.eventEmitter.off('reconnected', callback);
  }
}

// For backward compatibility
let singletonInstance: RabbitMQService | null = null;

// Legacy functions using the singleton pattern internally
export async function initializeRabbitMQ() {
  singletonInstance = RabbitMQService.getInstance();
  const { connection, channel } = await singletonInstance.initialize();
  return { connection, channel };
}

export async function getChannel(): Promise<Channel> {
  if (!singletonInstance) {
    singletonInstance = RabbitMQService.getInstance();
  }
  return singletonInstance.getChannel();
}

export async function createQueue(
  queueName: string,
  exchange: string,
  routingPattern: string,
  options: amqp.Options.AssertQueue = {},
): Promise<amqp.Replies.AssertQueue> {
  if (!singletonInstance) {
    singletonInstance = RabbitMQService.getInstance();
  }
  return singletonInstance.createQueue(queueName, exchange, routingPattern, options);
}

export async function setupDeadLetterQueue(dlqName: string): Promise<void> {
  if (!singletonInstance) {
    singletonInstance = RabbitMQService.getInstance();
  }
  return singletonInstance.setupDeadLetterQueue(dlqName);
}

export async function publishEvent(
  exchange: string,
  routingKey: string,
  message: any,
  options: amqp.Options.Publish = {},
): Promise<boolean> {
  if (!singletonInstance) {
    singletonInstance = RabbitMQService.getInstance();
  }
  return singletonInstance.publishEvent(exchange, routingKey, message, options);
}

export async function subscribeToEvents(
  queueName: string,
  exchange: string,
  routingPattern: string,
  handler: (message: any) => Promise<void>,
  options: amqp.Options.Consume = {},
): Promise<amqp.Replies.Consume> {
  if (!singletonInstance) {
    singletonInstance = RabbitMQService.getInstance();
  }
  return singletonInstance.subscribeToEvents(queueName, exchange, routingPattern, handler, options);
}

export async function closeConnection(): Promise<void> {
  logger.info('Closing RabbitMQ connection...');
  
  try {
    if (!singletonInstance) {
      return;
    }
    await singletonInstance.closeConnection();
  } catch (error) {
    logger.error('Error closing connection:', error);
  }
}

// Export default instance for convenience
export default RabbitMQService.getInstance();