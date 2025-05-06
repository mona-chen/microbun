import util from 'util';
import path from 'path';
import { format } from 'util';
import * as stackTrace from 'stack-trace';

// Color constants
export enum LogColor {
  RESET = '\x1b[0m',
  RED = '\x1b[31m',
  GREEN = '\x1b[32m',
  YELLOW = '\x1b[33m',
  BLUE = '\x1b[34m',
  MAGENTA = '\x1b[35m',
  CYAN = '\x1b[36m',
  GRAY = '\x1b[90m',
  BRIGHT_RED = '\x1b[91m',
  BRIGHT_GREEN = '\x1b[92m',
  BRIGHT_YELLOW = '\x1b[93m',
  BRIGHT_BLUE = '\x1b[94m',
  BRIGHT_MAGENTA = '\x1b[95m',
  BRIGHT_CYAN = '\x1b[96m',
  WHITE = '\x1b[97m',
  
  // Background colors
  BG_BLACK = '\x1b[40m',
  BG_RED = '\x1b[41m',
  BG_GREEN = '\x1b[42m',
  BG_YELLOW = '\x1b[43m',
  BG_BLUE = '\x1b[44m',
  BG_MAGENTA = '\x1b[45m',
  BG_CYAN = '\x1b[46m',
  BG_WHITE = '\x1b[47m',
  
  // Text styles
  BOLD = '\x1b[1m',
  DIM = '\x1b[2m',
  ITALIC = '\x1b[3m',
  UNDERLINE = '\x1b[4m',
}

// Log levels
export enum LogLevel {
  VERBOSE = 'VERBOSE',
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARNING',
  ERROR = 'ERROR',
  FATAL = 'FATAL',
  SILENT = 'SILENT',
}

// Priority of log levels
const LOG_LEVEL_VALUES: Record<LogLevel, number> = {
  [LogLevel.VERBOSE]: 0,
  [LogLevel.DEBUG]: 1,
  [LogLevel.INFO]: 2,
  [LogLevel.WARN]: 3,
  [LogLevel.ERROR]: 4,
  [LogLevel.FATAL]: 5,
  [LogLevel.SILENT]: 6,
};

// Logger configuration options
export interface LoggerOptions {
  /** Custom logger name */
  name?: string;
  /** Custom color for the logger name */
  color?: string;
  /** Minimum log level to display */
  minLevel?: LogLevel;
  /** Whether to include timestamps */
  timestamp?: boolean;
  /** Whether to detect and display class/context names */
  detectContext?: boolean;
  /** Format for timestamps */
  timestampFormat?: string;
  /** Whether to pretty-print objects */
  prettyPrint?: boolean;
  /** Depth for object inspection */
  inspectDepth?: number;
  /** Custom log handlers */
  handlers?: LogHandler[];
  /** Whether to include stack trace for errors */
  includeStackTrace?: boolean;
}

// Interface for custom log handlers
export interface LogHandler {
  handleLog(level: LogLevel, context: string, message: any, meta: LogMeta, ...args: any[]): void;
}

// Metadata for each log entry
export interface LogMeta {
  timestamp: Date;
  level: LogLevel;
  context: string;
  pid: number;
  hostname: string;
  name?: string;
  color?: string;
  callsite?: {
    fileName: string;
    lineNumber: number;
    functionName: string;
    typeName: string;
    methodName: string;
  };
}

/**
 * Enhanced Logger - NestJS-inspired logger with advanced features
 */
export class Logger {
  private static instances: Map<string, Logger> = new Map();
  private static globalLogLevel: LogLevel = LogLevel.INFO;
  private static globalOptions: Partial<LoggerOptions> = {
    timestamp: true,
    detectContext: true,
    prettyPrint: true,
    inspectDepth: 4,
    includeStackTrace: false,
  };
  
  private options: LoggerOptions;
  private contextName: string;

  /**
   * Creates a new Logger instance or returns an existing one
   */
  constructor(options?: Partial<LoggerOptions>) {
    this.options = { ...Logger.globalOptions, ...options } as LoggerOptions;
    this.contextName = this.options.name || 'Logger';
    
    // Detect context on construction if enabled
    if (this.options.detectContext && !this.options.name) {
      const detectedContext = this.detectContext(3); // Skip constructor and caller
      if (detectedContext) {
        this.contextName = detectedContext;
      }
    }
    
    // Store instance for reuse
    if (this.options.name && !Logger.instances.has(this.options.name)) {
      Logger.instances.set(this.options.name, this);
    }
  }

  /**
   * Gets an existing logger instance by name or creates a new one
   */
  static getLogger(nameOrOptions?: string | Partial<LoggerOptions>): Logger {
    if (typeof nameOrOptions === 'string') {
      const existingLogger = Logger.instances.get(nameOrOptions);
      if (existingLogger) {
        return existingLogger;
      }
      return new Logger({ name: nameOrOptions });
    }
    
    if (nameOrOptions?.name) {
      const existingLogger = Logger.instances.get(nameOrOptions.name);
      if (existingLogger) {
        return existingLogger;
      }
    }
    
    return new Logger(nameOrOptions);
  }

  /**
   * Sets global options for all loggers
   */
  static setGlobalOptions(options: Partial<LoggerOptions>): void {
    Logger.globalOptions = { ...Logger.globalOptions, ...options };
  }

  /**
   * Sets global minimum log level
   */
  static setGlobalLogLevel(level: LogLevel): void {
    Logger.globalLogLevel = level;
  }

  /**
   * Creates a child logger with inherited options
   */
  createChild(nameOrOptions?: string | Partial<LoggerOptions>): Logger {
    const childOptions = typeof nameOrOptions === 'string' 
      ? { ...this.options, name: nameOrOptions } 
      : { ...this.options, ...nameOrOptions };
    
    return new Logger(childOptions);
  }

  /**
   * Detects the caller context (class, function name, or filename)
   * @param skipFrames Number of stack frames to skip
   */
  private detectContext(skipFrames: number = 2): string {
    try {
      // Get current stack trace
      const trace = stackTrace.get();
      
      // Skip the specified number of frames to find the actual caller
      for (let i = skipFrames; i < trace.length; i++) {
        const callSite = trace[i];
        const fileName = callSite.getFileName();
        
        // Skip internal Node.js files and this file
        if (!fileName || 
            fileName.includes('node:internal/') || 
            fileName.includes('logger.ts') || 
            fileName.includes('node_modules/')) {
          continue;
        }


        const typeName = callSite.getTypeName();
        const methodName = callSite.getMethodName();
        const functionName = callSite.getFunctionName();


        // Try to get the most specific name from the call site
        if (Boolean(typeName) && Boolean(typeName !== "undefined") && typeName !== 'Object') {
          return typeName;
        } else if (functionName && Boolean(functionName !== "undefined") && functionName !== 'Object.<anonymous>') {
          return functionName;
        } else if (methodName && Boolean(methodName !== "undefined")) {
          return methodName;
        } else {
          // Use the file name as context
          const baseName = path.basename(fileName, path.extname(fileName));

          // Convert kebab-case or snake_case to PascalCase for better appearance
          return baseName
            .split(/[-_]/)
            .map(part => part.charAt(0).toUpperCase() + part.slice(1))
            .join('');
        }
      }
      
      // Special case for bootstrap function
      if (trace.length > skipFrames) {
        const frame = trace[skipFrames];
        if (frame.getFunctionName() === 'bootstrap') {
          return 'Bootstrap';
        }
      }
    } catch (e) {
      // Silent fail on context detection errors
      console.error('Error detecting context:', e);
    }
    
    return this.contextName;
  }

  /**
   * Creates a logger with the context name automatically derived from the caller
   */
  static forContext(contextLevel?: number): Logger {
    const logger = new Logger({ detectContext: true });
    
    // Force immediate context detection with additional frame skip
    // to account for the static method call
    const context = logger.detectContext(contextLevel || 2);
    if (context) {
      logger.contextName = context;
    }
    
    return logger;
  }

  /**
   * Gets emoji for log level
   */
  private getLevelEmoji(level: LogLevel): string {
    switch (level) {
      case LogLevel.VERBOSE:
        return '🔍';
      case LogLevel.DEBUG:
        return '🐛';
      case LogLevel.INFO:
        return 'ℹ️ ';
      case LogLevel.WARN:
        return '⚠️ ';
      case LogLevel.ERROR:
        return '❌';
      case LogLevel.FATAL:
        return '🚨';
      default:
        return '  ';
    }
  }

  /**
   * Gets color for log level
   */
  private getLevelColor(level: LogLevel): string {
    switch (level) {
      case LogLevel.VERBOSE:
        return LogColor.GRAY;
      case LogLevel.DEBUG:
        return LogColor.BLUE;
      case LogLevel.INFO:
        return LogColor.GREEN;
      case LogLevel.WARN:
        return LogColor.YELLOW;
      case LogLevel.ERROR:
        return LogColor.RED;
      case LogLevel.FATAL:
        return LogColor.BRIGHT_RED;
      default:
        return '';
    }
  }

  /**
   * Gets distinctive color for a context name (for consistent coloring)
   */
  private getContextColor(context: string): string {
    if (this.options.color) {
      return this.options.color;
    }
    
    // Generate a consistent color based on the context name
    const colors = [
      LogColor.CYAN, 
      LogColor.MAGENTA, 
      LogColor.YELLOW, 
      LogColor.GREEN,
      LogColor.BLUE, 
      LogColor.BRIGHT_CYAN,
      LogColor.BRIGHT_MAGENTA,
      LogColor.BRIGHT_GREEN
    ];
    
    let hash = 0;
    for (let i = 0; i < context.length; i++) {
      hash = ((hash << 5) - hash) + context.charCodeAt(i);
      hash |= 0; // Convert to 32bit integer
    }
    
    return colors[Math.abs(hash) % colors.length];
  }

  /**
   * Formats a timestamp according to specified format
   */
  private formatTimestamp(date: Date): string {
    if (!this.options.timestamp) {
      return '';
    }

    const formatter = new TimestampFormatter({
      timestamp: true,
      timestampFormat: 'YYYY-MM-DD HH:mm:ss'
    });
    
    // console.log(formatter['formatTimestamp'](new Date())); // → "2025-04-12 17:05:21"    
    
    if (this.options.timestampFormat) {
      // Custom format implementation could go here
      return date.toISOString();
    }
    return formatter['formatTimestamp'](date)
    
    // return date.toISOString();
  }

  /**
   * Core logging method
   */
  private logWithLevel(level: LogLevel, message: any, ...args: any[]): void {
    // Skip logging if below minimum level
    const minLevel = this.options.minLevel || Logger.globalLogLevel;
    if (LOG_LEVEL_VALUES[level] < LOG_LEVEL_VALUES[minLevel]) {
      return;
    }
    
    // Use stored context name
    const context = this.contextName;
    
    // Create metadata
    const meta: LogMeta = {
      timestamp: new Date(),
      level,
      context,
      pid: process.pid,
      hostname: require('os').hostname(),
      name: this.options.name,
      color: this.options.color,
    };
    
    // Add callsite information for errors if enabled
    if ((level === LogLevel.ERROR || level === LogLevel.FATAL) && this.options.includeStackTrace) {
      try {
        const trace = stackTrace.get();
        if (trace.length > 2) {
          const callSite = trace[2]; // Skip this method and the public log method
          meta.callsite = {
            fileName: callSite.getFileName() || 'unknown',
            lineNumber: callSite.getLineNumber() || 0,
            functionName: callSite.getFunctionName() || 'anonymous',
            typeName: callSite.getTypeName() || 'global',
            methodName: callSite.getMethodName() || 'none',
          };
        }
      } catch (e) {
        // Silent fail on callsite detection errors
      }
    }
    
    // Pass to custom handlers if any
    if (this.options.handlers?.length) {
      for (const handler of this.options.handlers) {
        handler.handleLog(level, context, message, meta, ...args);
      }
      return;
    }
    
    // Format the log entry
    this.writeFormattedLog(level, context, message, meta, ...args);
  }

  /**
   * Writes the formatted log to the console
   */
  private writeFormattedLog(level: LogLevel, context: string, message: any, meta: LogMeta, ...args: any[]): void {
    // Pick output stream based on log level
    const outputFn = (level === LogLevel.ERROR || level === LogLevel.FATAL) 
      ? console.error 
      : console.log;
    
    // Get colors and emoji
    const levelColor = this.getLevelColor(level);
    const contextColor = this.getContextColor(context);
    const levelEmoji = this.getLevelEmoji(level);
    
    // Format timestamp if enabled
    const timestamp = this.options.timestamp 
      ? `${LogColor.DIM}${this.formatTimestamp(meta.timestamp)}${LogColor.RESET} `
      : '';
    
    // Format the context
    const contextStr = `${contextColor}[${context}]${LogColor.RESET}`;
    
    // Format message
    let formattedMessage: string;
    
    if (message instanceof Error) {
      formattedMessage = `${message.stack || message.message}`;
    } else if (typeof message === 'object' && message !== null) {
      if (this.options.prettyPrint) {
        formattedMessage = util.inspect(message, { 
          depth: this.options.inspectDepth, 
          colors: true 
        });
      } else {
        formattedMessage = message.toString();
      }
    } else {
      formattedMessage = String(message);
    }
    
    // Format any additional arguments
    const formattedArgs = args.map(arg => {
      if (typeof arg === 'object' && arg !== null) {
        return this.options.prettyPrint
          ? util.inspect(arg, { depth: this.options.inspectDepth, colors: true })
          : String(arg);
      }
      return arg;
    });
    
    // Combine all parts
    const logPrefix = `${timestamp}${levelColor}${levelEmoji}${LogColor.RESET} ${contextStr}:`;
    
    // Output the log entry
    if (formattedArgs.length > 0) {
      outputFn(logPrefix, formattedMessage, ...formattedArgs);
    } else {
      outputFn(logPrefix, formattedMessage);
    }
    
    // Add callsite information for errors if available
    if (meta.callsite && (level === LogLevel.ERROR || level === LogLevel.FATAL)) {
      const { fileName, lineNumber, functionName } = meta.callsite;
      outputFn(`${LogColor.DIM}at ${functionName || 'anonymous'} (${fileName}:${lineNumber})${LogColor.RESET}`);
    }
  }

  // Public logging methods
  
  /**
   * Logs a verbose message
   */
  verbose(message: any, ...args: any[]): void {
    this.logWithLevel(LogLevel.VERBOSE, message, ...args);
  }

  /**
   * Logs a debug message
   */
  debug(message: any, ...args: any[]): void {
    this.logWithLevel(LogLevel.DEBUG, message, ...args);
  }

  /**
   * Logs an informational message
   */
  info(message: any, ...args: any[]): void {
    this.logWithLevel(LogLevel.INFO, message, ...args);
  }

  /**
   * Logs a warning message
   */
  warn(message: any, ...args: any[]): void {
    this.logWithLevel(LogLevel.WARN, message, ...args);
  }

  /**
   * Logs an error message
   */
  error(message: any, ...args: any[]): void {
    this?.logWithLevel(LogLevel.ERROR, message, ...args);
  }

  /**
   * Logs a fatal error message
   */
  fatal(message: any, ...args: any[]): void {
    this.logWithLevel(LogLevel.FATAL, message, ...args);
  }

  /**
   * Logs a message with an explicit log level (for backward compatibility)
   */
  log(level: string | LogLevel | any, message?: any, ...args: any[]): void {
    // Handle signature overloading for backward compatibility
    if (typeof level === 'string' && Object.values(LogLevel).includes(level as LogLevel)) {
      // Called as log(level, message, ...args)
      this.logWithLevel(level as LogLevel, message, ...args);
    } else if (typeof level === 'string' && message !== undefined) {
      // Called as log('INFO', message, ...args) with string level
      const normalizedLevel = level.toUpperCase() as LogLevel;
      if (Object.values(LogLevel).includes(normalizedLevel)) {
        this.logWithLevel(normalizedLevel, message, ...args);
      } else {
        // Default to INFO if level string doesn't match
        this.logWithLevel(LogLevel.INFO, message, ...args);
      }
    } else {
      // Called as log(message, ...args) - use INFO level
      const newArgs = message !== undefined ? [message, ...args] : args;
      this.logWithLevel(LogLevel.INFO, level, ...newArgs);
    }
  }

  /**
   * Creates a logger for a specific class (static method for convenience)
   */
  static forClass(clazz: new (...args: any[]) => any): Logger {
    const className = clazz.name;
    return Logger.getLogger({ name: className });
  }

  /**
   * Logs execution time of a function
   */
  time<T>(label: string, fn: () => T): T {
    const start = process.hrtime();
    this.debug(`⏱️ Starting: ${label}`);
    
    try {
      const result = fn();
      const [seconds, nanoseconds] = process.hrtime(start);
      const durationMs = (seconds * 1000 + nanoseconds / 1000000).toFixed(2);
      this.debug(`⏱️ Completed: ${label} (took ${durationMs}ms)`);
      return result;
    } catch (error) {
      const [seconds, nanoseconds] = process.hrtime(start);
      const durationMs = (seconds * 1000 + nanoseconds / 1000000).toFixed(2);
      this.error(`⏱️ Failed: ${label} (took ${durationMs}ms)`, error);
      throw error;
    }
  }

  /**
   * Logs execution time of an async function
   */
  async timeAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
    const start = process.hrtime();
    this.debug(`⏱️ Starting: ${label}`);
    
    try {
      const result = await fn();
      const [seconds, nanoseconds] = process.hrtime(start);
      const durationMs = (seconds * 1000 + nanoseconds / 1000000).toFixed(2);
      this.debug(`⏱️ Completed: ${label} (took ${durationMs}ms)`);
      return result;
    } catch (error) {
      const [seconds, nanoseconds] = process.hrtime(start);
      const durationMs = (seconds * 1000 + nanoseconds / 1000000).toFixed(2);
      this.error(`⏱️ Failed: ${label} (took ${durationMs}ms)`, error);
      throw error;
    }
  }
}

// Create default logger
export const logger = new Logger();

// Export backward compatibility
export default Logger;


interface FormatterOptions {
  timestamp?: boolean;
  timestampFormat?: string; // Supports basic patterns like 'YYYY-MM-DD HH:mm:ss'
}

class TimestampFormatter {
  constructor(private options: FormatterOptions = {}) {}

  private formatTimestamp(date: Date): string {
    if (!this.options.timestamp) return '';

    if (this.options.timestampFormat) {
      return this.applyCustomFormat(date, this.options.timestampFormat);
    }

    return date.toISOString();
  }

  private pad(num: number): string {
    return num < 10 ? `0${num}` : `${num}`;
  }

  private applyCustomFormat(date: Date, format: string): string {
    const map: Record<string, string> = {
      YYYY: date.getFullYear().toString(),
      MM: this.pad(date.getMonth() + 1),
      DD: this.pad(date.getDate()),
      HH: this.pad(date.getHours()),
      mm: this.pad(date.getMinutes()),
      ss: this.pad(date.getSeconds()),
    };

    let formatted = format;

    for (const [token, value] of Object.entries(map)) {
      formatted = formatted.replace(token, value);
    }

    return formatted;
  }
}
