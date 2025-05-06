import mongoose from 'mongoose';
import CustomLogger, { logger } from '../utils/logger';
import { AnsiColor } from '../constants/ansicolor';

// Get environment variables and type-check them
//@ts-ignore
const env: Required<Env> = process.env;
export const dbLogger = new CustomLogger({ color: AnsiColor.CYAN });

export default function database(callback: (error: Error | null, result?: any) => void) {
  return async () => {
    try {
      // Determine which connection string to use based on environment
      const connectionString = env.DATABASE_URL || 
        (env.NODE_ENV === 'production' 
          ? env.PRODUCTION_DATABASE_URL 
          : env.NODE_ENV === 'test'
            ? env.TEST_DATABASE_URL
            : env.DEVELOPMENT_DATABASE_URL);
      
      if (!connectionString) {
        throw new Error('Database connection string not found in environment variables');
      }

      // Configure mongoose connection options
      const mongooseOptions = {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
        autoIndex: env.NODE_ENV !== 'production', // Don't build indexes in production
      };

      // Connect to MongoDB
      await mongoose.connect(connectionString, mongooseOptions);

      // Test the connection by getting connection state
      const connectionState = mongoose.connection.readyState;
      if (connectionState !== 1) {
        throw new Error(`MongoDB connection failed. Connection state: ${connectionState}`);
      }

      dbLogger.log('info', '[database]: MongoDB connection successful');

      // Invoke the callback with null error and optional result
      callback(null, mongoose.connection);
    } catch (error) {
      dbLogger.log('error', `[database]: MongoDB connection error: ${error}`);
      // Invoke the callback with the error
      callback(error as Error);
    }
  };
}

// Export a function to close the MongoDB connection
export async function closeMongoConnection(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
    dbLogger.log('info', '[database]: MongoDB connection closed');
  }
}