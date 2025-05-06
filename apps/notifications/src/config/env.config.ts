import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NOVU_API_KEY: z.string(),
  NOVU_BACKEND_URL: z.string().optional(),
  RABBITMQ_URL: z.string(),
  SERVICE_NAME: z.string().default('notification-service')
});

export const envConfig = envSchema.parse(process.env);