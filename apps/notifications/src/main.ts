import express, { type NextFunction } from 'express';
import { errorHandler } from '@shared/utils/errorController';
import dotenv from 'dotenv';
import path from 'path';
import { logger } from '@shared/utils/logger';
import { RabbitMQService, initializeRabbitMQ } from '@shared/events';
import { NotificationConsumer } from './events/consumers/notification.consumers';
import { NotificationService } from './services/notification.service';
import { NotificationController } from './controllers/notification.controller';
import type { IReq, IRes } from '@shared/types/config';
import { getPortFromUrl } from '@shared/utils/get-ports-from-url';
import { appConfig } from '@shared/config/environment';

// Load environment variables
const envPath = path.resolve(__dirname, '../../../.env');
const overrideEnvPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: envPath });
dotenv.config({ path: overrideEnvPath, override: true });
dotenv.config();

async function bootstrap() {
  try {
    // Initialize Express app
    const app = express();
    const port = getPortFromUrl(appConfig.NOTIFICATIONS_SERVICE_URL as string) || process.env.PORT || 3003;

    // Basic middleware
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // Implement request logger middleware
    app.use((req: IReq, res: IRes, next: NextFunction) => {
      logger.info(`[NOTIFICATION-REQUEST] ${req.method} ${req.url}`);
      next();
    });

    // Initialize RabbitMQ
    logger.info('Initializing RabbitMQ...');
    await initializeRabbitMQ();
    logger.info('RabbitMQ initialized successfully');

    // Set up notification consumers
    logger.info('Setting up notification consumers...');
    const notificationConsumer = new NotificationConsumer();
    await notificationConsumer.setupConsumers();
    logger.info('Notification consumers set up successfully');

    // Create notification service instance
    const notificationService = new NotificationService();
    
    // Initialize and register the notification controller
    const rabbitMQService = RabbitMQService.getInstance();
    const notificationController = new NotificationController(notificationService, rabbitMQService);
    
    // Register controller routes
    app.use('/api/notifications', notificationController.getRouter());

    // Health check endpoint
    app.get('/health', (req: IReq, res: IRes) => {
      res.json({ status: 'healthy', service: 'notifications' });
    });

    // Error handling middleware (must be after routes)
    app.use(errorHandler);

    // Start server
    app.listen(port, () => {
      logger.info(`[SERVICE] : Notifications service running on port ${port}`);
    });

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('Shutting down Notifications service...');
      await rabbitMQService.closeConnection();
      process.exit(0);
    });
  } catch (error) {
    logger.error('Failed to start Notifications service:', error);
    process.exit(1);
  }
}

// Start the application
bootstrap().catch(error => {
  logger.error('Unhandled error during bootstrap:', error);
  process.exit(1);
});