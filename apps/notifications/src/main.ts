// apps/auth/src/main.ts
import express from 'express';
// import { setupRoutes } from './routes';
import { errorHandler } from '../../../shared/utils/errorController';
import dotenv from 'dotenv';
import path from 'path';
import { config } from '@shared/config/environment';
import { logger } from '@shared/utils/logger';
// import '../db'
import {  RabbitMQService } from '@shared/events';
import type { NotificationPayload } from './interfaces/notification.interface';
import EVENTS, { QUEUES } from '@shared/events/queues';
import { EXCHANGES } from '@shared/events/exchanges';
import Email from '@shared/utils/email';
import { ACCEPTED_OTP_TYPES, OtpType } from '@shared/constants/otp-codes';


const envPath = path.resolve(__dirname, '../../../.env');
const overrideEnvPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: envPath });
dotenv.config({ path: overrideEnvPath, override: true });
dotenv.config();
async function bootstrap() {
  const app = express();
  const port = process.env.PORT || 3003;

  // Basic middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'healthy', service: 'auth' });
  });

  // Error handling
  app.use(errorHandler);


  RabbitMQService.getInstance().subscribeToEvents<EmailVerificationNotificationSchema>('notificaition-welcome-email-listener', EXCHANGES.NOTIFICATION, QUEUES.NOTIFICATION_EMAIL, async (msg) => {
    try {

         // Send OTP via email
         if(ACCEPTED_OTP_TYPES.includes(msg.data.otpType)){
          await new Email({ email: msg.recipient }, { passcode: msg.data.code, otpPurpose: msg.data.otpType }).sendEmailOtp();
         }

        console.log("NOTIFICATION EMAIL LISTENER - Received notification events", msg);
      // await new NotificationProducer().produceNotificationEvent(payload.templateId, payload.recipient, payload.data);
    } catch (error:any) {
      logger.error(`Error processing notification event: ${error.message}`);
    }
  },     {
  
  });

  // Start server
  app.listen(port, () => {
    logger.info(`[SERVICE] : Notifications service running on port ${port}`);
  });

  // Implement request logger
  app.use((req, res, next) => {
    logger.info(`[AUTH-REQUEST] ${req.method} ${req.url}`);
    next();
  });

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('Shutting down Auth service...');
    process.exit(0);
  });
}

bootstrap().catch(console.error);


