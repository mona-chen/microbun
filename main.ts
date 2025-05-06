import express from 'express';
import dotenv from 'dotenv';
import morgan from 'morgan';
import cors from 'cors';
import './apps/auth/src/middleware/passport';
import path from 'path';
import http from 'http';
import { logger } from './shared/utils/logger';
import initDb, { dbLogger } from './shared/config/config.db';
import type { Env } from '@shared/types/config';


dotenv.config();

export const app = express();

const env: Env = process?.env;
app.use(
  cors({
    origin: '*',
  }),
);

if (env.APP_ENV === 'development') {
  logger.warn(`[core]: App is running on ${env.APP_ENV} environment don't use this in production`);
}

// let server: ServerInstance;

app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));
app.set('view engine', 'ejs');
app.set('trust proxy', true);
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/storage', express.static(path.join(__dirname, 'storage')));

const server = http.createServer(app);

// Connecting to DB
const connectToDatabase = function () {
  logger.info('[database]: connecting to Postgres...');
  initDb((err: Error | null) => {
    if (err) {
      // Health Route
      app.route('/v1/health').get(function (_req, res) {
        res.status(200).json({
          success: true,
          server: 'offline',
          message: 'server is down due to database connection error',
        });
      });

      app.use('*', (req, res) => {
        res.status(500).json({
          success: false,
          server: 'offline',
          message: '[server] offline due to database error',
        });
      });

      logger.fatal(`[database]: could not connect due to [${err.message}]`);
      server.listen(env.APP_PORT, () => {
        logger.info(`[core] Server is running on port ${env.APP_PORT}`);
      });

      setTimeout(() => {
        server.close();

        connectToDatabase();
      }, 10000);
      return;
    } else {
      dbLogger.info(`[database]: connected successfully to Postgres`);

      // Health Route
      app.route('/api/v1/health').get(function (req, res) {
        res.status(200).json({
          success: true,
          server: 'online',
          message: 'server is up and running',
        });
      });

      server.listen(env.APP_PORT, () => {
        console.log(`[server] running on port: ${env.APP_PORT}`);
      });

      // Handling Uncaught Exception
      process.on('uncaughtException', (err: Error) => {
        console.log(`Error: ${err.message}`);
        console.log(`[server] shutting down due to Uncaught Exception`);

        // TODO: we temporary disabled the server from shutting down
        server.close(() => {});

        process.exit(1);
      });

      // Unhandled Promise Rejection
      process.on('unhandledRejection', (err: Error) => {
        console.log(`Error: ${err.message}`);
        console.log(`[server] shutting down due to Unhandled Promise Rejection`, err);
        server.close(() => {
          process.exit(1);
        });
      });
    }
  });
};

const sigIntHandler = () => {
  logger.warn('Received SIGTERM signal. Shutting down gracefully...');

  // Close the server
  server.close();
  // Perform any other cleanup tasks
  logger.info('Server gracefully shut down.');
  // Terminate the process
  process.exit();
};

// Handle SIGTERM signal for graceful shutdown
process.on('SIGINT', sigIntHandler);

// Handle unhandled promise rejections
process.on('unhandledrejection', event => {
  logger.error('Unhandled Promise Rejection:');
  logger.error(event);
});
// Handle uncaught exceptions
process.on('uncaughtexception', event => {
  logger.error('Uncaught Exception:');
  logger.error(event);
});

// Starting Server
(() => {
  if (process.env.SERVER_MAINTENANCE === 'true') {
    // Health Route
    app.route('api//v1/health').get(function (req, res) {
      return res.status(200).json({
        success: false,
        server: 'maintenance',
        message: 'Server is under maintenance',
      });
    });

    app.use('*', (req, res) => {
      res.status(503).json({
        success: false,
        server: 'maintenance',
        message: '[server] offline for maintenance',
      });
    });

    server.listen(env.APP_PORT, () => {
      logger.info(`[server] running on port: ${env.APP_PORT}`);
    });
    server.timeout = 600000;
  } else {
    connectToDatabase();
  }
})();
