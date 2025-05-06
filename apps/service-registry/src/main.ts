// apps/service-registry/src/main.ts
import express from 'express';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../../../shared/config/environment';
import type { IReq, IRes } from '@shared/types/config';
import Logger from '@shared/utils/logger';
import RedisSingleton from '@shared/utils/redis';
import path from 'path';
import dotenv from 'dotenv';


const envPath = path.resolve(__dirname, '../../../.env');
const overrideEnvPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: envPath });
dotenv.config({ path: overrideEnvPath, override: true });
dotenv.config();
// Service registry using Redis for persistence
async function bootstrap() {
  const app = express();
  const port = process.env.PORT || 3011;

  const logger =  Logger.getLogger("ServiceRegistry")
  logger.info(`Starting service registry on port ${port}`);
  // Connect to Redis
  const redisClient = RedisSingleton.getInstance()

  redisClient.on('error', (err: any) => logger.error('Redis client error:', err));

  // Basic middleware
  app.use(express.json());

  // Service registration endpoint
  app.post('/register', async ( req:IReq, res:any) => {
    const { name, host, port, healthEndpoint = '/health', version = '1.0.0' } = req.body;

    if (!name || !host || !port) {
      return res.status(400).json({ error: 'Missing required fields: name, host, port' });
    }

    const serviceId = uuidv4();
    const serviceKey = `service:${name}:${serviceId}`;

    const serviceInfo = {
      id: serviceId,
      name,
      host,
      port,
      url: `http://${host}:${port}`,
      healthEndpoint,
      version,
      status: 'UP',
      registeredAt: new Date().toISOString(),
      lastHeartbeat: new Date().toISOString(),
    };

    // Store service info in Redis
    await redisClient.hset(serviceKey, serviceInfo);
    // Add to service index
    await redisClient.sadd(`services:${name}`, serviceId);

    res.status(201).json({
      message: 'Service registered successfully',
      serviceId,
      ...serviceInfo,
    });
  });

  // Service heartbeat endpoint
  app.put('/heartbeat/:serviceId', async (req:IReq, res:any) => {
    const { serviceId } = req.params;
    const { status = 'UP' } = req.body;

    // Find the service
    const serviceKeys = await redisClient.keys(`service:*:${serviceId}`);

    if (serviceKeys.length === 0) {
      return res.status(404).json({ error: 'Service not found' });
    }

    const serviceKey = serviceKeys[0];
    const serviceInfo = await redisClient.hgetall(serviceKey);

    if (!serviceInfo) {
      return res.status(404).json({ error: 'Service not found' });
    }

    // Update heartbeat timestamp and status
    await redisClient.hset(serviceKey, {
      ...serviceInfo,
      status,
      lastHeartbeat: new Date().toISOString(),
    });

    res.json({ message: 'Heartbeat received', serviceId });
  });

  // Service discovery endpoint
  app.get('/services', async (req:IReq, res:any) => {
    const { name } = req.query;

    if (name) {
      // Get service instances by name
      const serviceIds = await redisClient.smembers(`services:${name}`);
      const services = await Promise.all(
        serviceIds.map(async (id: any) => {
          const serviceInfo = await redisClient.hgetall(`service:${name}:${id}`);
          return serviceInfo;
        }),
      );

      return res.json(services.filter(service => service && service.status === 'UP'));
    }

    // Get all services
    const serviceKeys = await redisClient.keys('service:*');
    const services = await Promise.all(
      serviceKeys.map(async (key: any) => {
        const serviceInfo = await redisClient.hgetall(key);
        return serviceInfo;
      }),
    );

    res.json(services.filter(service => service && service.status === 'UP'));
  });

  // Service deregistration endpoint
  app.delete('/services/:serviceId', async (req:IReq, res:any) => {
    const { serviceId } = req.params;

    // Find the service
    const serviceKeys = await redisClient.keys(`service:*:${serviceId}`);

    if (serviceKeys.length === 0) {
      return res.status(404).json({ error: 'Service not found' });
    }

    const serviceKey = serviceKeys[0];
    const serviceName = serviceKey.split(':')[1];

    // Remove from index and delete service info
    await redisClient.srem(`services:${serviceName}`, serviceId);
    await redisClient.del(serviceKey);

    res.json({ message: 'Service deregistered successfully', serviceId });
  });

  // Start the server
  app.listen(port, () => {
    logger.info(`Service registry running on port ${port}`);
  });

  // Clean up expired services periodically
  const CLEANUP_INTERVAL = config.SERVICE_REGISTRY.cleanupInterval;
  const MAX_HEARTBEAT_AGE = config.SERVICE_REGISTRY.maxHeartbeatAge; 

  setInterval(async () => {
    try {
      const serviceKeys = await redisClient.keys('service:*');
    const now = Date.now();

    for (const key of serviceKeys) {
      const serviceInfo = await redisClient.hgetall(key);
      if (!serviceInfo?.lastHeartbeat) continue;

      const lastHeartbeat = new Date(serviceInfo.lastHeartbeat).getTime();
      if (now - lastHeartbeat > MAX_HEARTBEAT_AGE) {
        const [, serviceName, serviceId] = key.split(':');
        logger.info(`Service ${serviceName}:${serviceId} expired. Removing...`);
        await redisClient.srem(`services:${serviceName}`, serviceId);
        await redisClient.del(key);
      }
    }

    } catch (error) {
      logger.error('Error during service cleanup:', error);
    }
  }, CLEANUP_INTERVAL);

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    logger.debug('Shutting down service registry...');
    await redisClient.quit();
    process.exit(0);
  });
}

bootstrap().catch(console.error);
