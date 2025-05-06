import Redis from 'ioredis';

class RedisSingleton {
  private static instance: Redis;

  private constructor() {}

  public static getInstance(): Redis {
    if (!RedisSingleton.instance) {
      // Use REDIS_URL if provided, otherwise use individual connection parameters
      if (process.env.REDIS_URL) {
        RedisSingleton.instance = new Redis(process.env.REDIS_URL as string);
      } else {
        RedisSingleton.instance = new Redis({
          host: (process.env.REDIS_HOST as string) || '127.0.0.1',
          port: Number(process.env.REDIS_PORT) || 6379,
          password: process.env.REDIS_PASSWORD
            ? process.env.REDIS_PASSWORD.toString().trim()
            : undefined,
          username: process.env.REDIS_USERNAME
            ? process.env.REDIS_USERNAME.toString().trim()
            : undefined,
          tls: process.env.REDIS_TLS ? {} : undefined, // Use TLS if specified
        });
      }

      RedisSingleton.instance.on('connect', () => {
        console.log('✅ Connected to Redis');
      });

      RedisSingleton.instance.on('error', (err: any) => {
        console.error('❌ Redis Error:', err);
      });
    }

    return RedisSingleton.instance;
  }
}

export default RedisSingleton;