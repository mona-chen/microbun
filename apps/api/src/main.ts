// apps/api/src/main.ts
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { closeConnection, publishEvent, RabbitMQService } from '@shared/events';
import { config } from '@shared/config/environment';
import type { IReq, IRes } from '@shared/types/config';
import { authMiddleware } from './middleware/auth.middleware';
import { errorHandler } from '@shared/utils/errorController';
import setupProxy from './proxy';
import Logger, { LogColor, LogLevel } from '@shared/utils/logger';
import { EXCHANGES } from '@shared/events/exchanges';
import { ServiceRegistryManager } from '@shared/utils/registery';
import path from 'path';
import dotenv from 'dotenv';
import { StorageRouter } from '@shared/providers/storage.provider';


const envPath = path.resolve(__dirname, '../../../.env');
const overrideEnvPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: envPath });
dotenv.config({ path: overrideEnvPath, override: true });
dotenv.config();

// Define service cache interface
interface CachedService {
  url: string;
  timestamp: number;
}


// Service registry cache
const serviceCache = new Map<string, CachedService>();
const SERVICE_CACHE_TTL = 30000; // 30 seconds
const logger = Logger.getLogger("BootstrapApi")
async function bootstrap() {
  const app = express();
  const port = process.env.PORT || 4000;

  // Basic middleware
  app.use(helmet()); // Security headers
  app.use(cors());
  // app.use(express.json())


  // Request ID middleware
  app.use((req: IReq, res: IRes, next) => {
    const requestId = Array.isArray(req.headers['x-request-id'])
      ? req.headers['x-request-id'][0]
      : req.headers['x-request-id'];
    req.id = requestId || uuidv4();
    res.setHeader('X-Request-ID', req.id);
    next();
  });

  const s3Router = new StorageRouter({
    accessKeyId: process.env.STORAGE_ACCESS_KEY! as string,
    secretAccessKey: process.env.STORAGE_SECRET_KEY! as string,
    bucket: process.env.STORAGE_BUCKET_NAME! as string,
    endpoint: process.env.STORAGE_ENDPOINT! as string,
    region: process.env.S3_REGION as string,
    acl: 'private',
  });
  

  // Request logging
  app.use((req: IReq, res: IRes, next) => {
    logger.info({
      id: req.id,
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    // Log response
    const originalSend = res.send;
    res.send = function (body) {
      logger.info({
        id: req.id,
        statusCode: res.statusCode,
        responseTime: Date.now() - (req.startTime || Date.now()),
      });
      return originalSend.call(this, body);
    };

    req.startTime = Date.now();
    next();
  });

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  });

  app.use('/api/storage', s3Router.getRouter());

  // setup proxy
  setupProxy(app)

  

  // Event publishing endpoint
  app.post('/events', authMiddleware, async (req: IReq, res: IRes): Promise<any> =>  {
    try {
      const { exchange, routingKey, payload } = req.body;

      if (!exchange || !routingKey || !payload) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Validate the exchange and routing key
      if (!Object.values(EXCHANGES).includes(exchange)) {
        return res.status(400).json({ error: 'Invalid exchange' });
      }

      // Add user info to payload if authenticated
      const enhancedPayload = {
        ...payload,
        userId: req.user?.id,
        metadata: {
          ...payload.metadata,
          source: 'api-gateway',
          requestId: req.id,
        },
      };

      // Publish the event
      const published = await publishEvent(exchange, routingKey, enhancedPayload);

      if (published) {
        res.status(202).json({ message: 'Event published successfully' });
      } else {
        res.status(500).json({ error: 'Failed to publish event' });
      }
    } catch (error: any) {
      logger.error({
        id: req.id,
        error: error.message,
        stack: error.stack,
      });
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Error handling
  app.use(errorHandler);

  // Start server
  app.listen(port, () => {
    logger.info(`API Gateway running on port ${port}`);

    // Register with service registry
    ServiceRegistryManager.register({
      port: Number(port),
      name: "API Gateway",
      version: "1.0.0",
      description: "API Gateway for Paymable services",
    });
  });



  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    logger.verbose('Shutting down API service...');
    closeConnection()
    process.exit(0);
  });
}

bootstrap().catch((err: any) => {
  logger.error('Failed to start API Gateway:', err);
  process.exit(1);
});
