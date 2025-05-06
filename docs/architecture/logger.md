```js
    // Basic usage (backward compatible)
import { logger } from './path/to/logger';
logger.info('Hello world');
logger.error('Something went wrong', { details: 'error info' });

// Class-specific logger
class UserService {
  private logger = Logger.forClass(UserService);
  // or: private logger = new Logger({ name: 'UserService' });
  
  findUser(id: string) {
    this.logger.info(`Finding user by ID: ${id}`);
    // Will show: "ℹ️ [UserService]: Finding user by ID: 123"
  } 
}

// Auto-detecting context
const contextLogger = Logger.forContext();
contextLogger.warn('This will show the function name automatically');

// Timing operations
logger.time('database query', () => {
  // Expensive operation here
  return result;
});

// Global settings
Logger.setGlobalLogLevel(LogLevel.DEBUG);
Logger.setGlobalOptions({ timestamp: true, includeStackTrace: true });
```