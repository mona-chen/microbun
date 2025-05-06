import { EventEmitter } from 'events';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import RedisSingleton from './redis';

// Advanced configuration interface
interface CircuitBreakerOptions {
  failureThreshold?: number;
  resetTimeout?: number;
  timeout?: number;
  successThreshold?: number;
  retryBackoff?: 'linear' | 'exponential';
  maxRetries?: number;
  metricsTracking?: boolean;
  distributedTracking?: boolean;
}

// Detailed failure context
interface FailureContext {
  error: unknown;
  timestamp: number;
  serviceId: string;
}

// Metrics storage interface
interface CircuitMetrics {
  totalCalls: number;
  successCalls: number;
  failureCalls: number;
  lastFailures: FailureContext[];
}

class CircuitBreaker<T extends (...args: any[]) => Promise<any>> {
  // Distributed state management
  private static redisClient?: Redis;
  private static initializeRedis(connectionString?: string) {
    this.redisClient = RedisSingleton.getInstance()
  }

  // Unique identifier for this circuit breaker instance
  private circuitId: string;

  // Configuration with enhanced defaults
  private options: Required<CircuitBreakerOptions> = {
    failureThreshold: 5,
    resetTimeout: 30000,
    timeout: 10000,
    successThreshold: 3,
    retryBackoff: 'exponential',
    maxRetries: 3,
    metricsTracking: true,
    distributedTracking: false
  };

  // Advanced state tracking
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private failures = 0;
  private successCount = 0;
  private lastFailureTime = 0;
  private eventEmitter = new EventEmitter();

  // Metrics and tracking
  private metrics: CircuitMetrics = {
    totalCalls: 0,
    successCalls: 0,
    failureCalls: 0,
    lastFailures: []
  };

  constructor(
    private operation: T,
    options?: CircuitBreakerOptions
  ) {
    // Generate unique circuit ID
    this.circuitId = `circuit:${uuidv4()}`;

    // Merge options
    this.options = { ...this.options, ...options };

    // Setup distributed tracking if enabled
    if (this.options.distributedTracking && !CircuitBreaker.redisClient) {
      CircuitBreaker.initializeRedis();
    }

    this.setupAdvancedEventListeners();
  }

  private setupAdvancedEventListeners() {
    // Enhanced logging and monitoring
    this.eventEmitter.on('circuit-state-change', (newState: string) => {
      console.info(`Circuit ${this.circuitId} state changed to: ${newState}`);
      this.trackDistributedState(newState);
    });

    this.eventEmitter.on('failure-recorded', (failureContext: FailureContext) => {
      this.recordFailureMetrics(failureContext);
    });
  }

  private async trackDistributedState(state: string) {
    if (!this.options.distributedTracking) return;

    try {
      await CircuitBreaker.redisClient?.set(
        `circuit:state:${this.circuitId}`, 
        JSON.stringify({
          state,
          timestamp: Date.now()
        })
      );
    } catch (error) {
      console.error('Failed to track distributed circuit state', error);
    }
  }

  private recordFailureMetrics(failureContext: FailureContext) {
    if (!this.options.metricsTracking) return;

    // Update metrics
    this.metrics.failureCalls++;
    this.metrics.lastFailures.push(failureContext);

    // Limit last failures to 10 entries
    if (this.metrics.lastFailures.length > 10) {
      this.metrics.lastFailures.shift();
    }
  }

  private calculateRetryDelay(attempt: number): number {
    switch (this.options.retryBackoff) {
      case 'linear':
        return attempt * 1000; // Linear: 1s, 2s, 3s...
      case 'exponential':
      default:
        return Math.pow(2, attempt) * 1000; // Exponential: 2s, 4s, 8s...
    }
  }

  async execute(...args: Parameters<T>): Promise<ReturnType<T>> {
    // Increment total calls
    this.metrics.totalCalls++;

    // Check circuit state
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime < this.options.resetTimeout) {
        throw new Error('Circuit OPEN: Service temporarily unavailable');
      }
      this.state = 'HALF_OPEN';
      this.eventEmitter.emit('circuit-state-change', 'HALF_OPEN');
    }

    // Retry mechanism with backoff
    for (let attempt = 0; attempt <= this.options.maxRetries; attempt++) {
      try {
        // Timeout promise
        const executionPromise = this.operation(...args);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Operation timed out')), this.options.timeout)
        );

        // Race between operation and timeout
        const result = await Promise.race([
          executionPromise,
          timeoutPromise
        ]);

        // Success handling
        this.onSuccess();
        this.metrics.successCalls++;
        return result as ReturnType<T>;
      } catch (error) {
        // Failure handling
        const failureContext: FailureContext = {
          error,
          timestamp: Date.now(),
          serviceId: this.circuitId
        };

        this.eventEmitter.emit('failure-recorded', failureContext);
        
        // Last attempt
        if (attempt === this.options.maxRetries) {
          this.onFailure(error);
          throw error;
        }

        // Retry with backoff
        const delay = this.calculateRetryDelay(attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw new Error('Max retries exceeded');
  }

  // Advanced state management methods
  private onSuccess() {
    if (this.state === 'HALF_OPEN') {
      this.successCount++;

      if (this.successCount >= this.options.successThreshold) {
        this.state = 'CLOSED';
        this.successCount = 0;
        this.failures = 0;
        this.eventEmitter.emit('circuit-state-change', 'CLOSED');
      }
    } else {
      this.successCount = 0;
      this.failures = 0;
    }
  }

  private onFailure(error: unknown) {
    this.failures++;
    this.lastFailureTime = Date.now();
    this.successCount = 0;

    if (this.failures >= this.options.failureThreshold) {
      this.state = 'OPEN';
      this.eventEmitter.emit('circuit-state-change', 'OPEN');
    } else if (this.state === 'HALF_OPEN') {
      this.state = 'OPEN';
    }
  }

  // Metrics and monitoring methods
  getMetrics(): CircuitMetrics {
    return { ...this.metrics };


  }

  public async getDistributedState(): Promise<string | null> {
    if (!this.options.distributedTracking) {
      return null;
    }

    try {
      const state = await CircuitBreaker.redisClient?.get(
        `circuit:state:${this.circuitId}`
      );
      return state ? JSON.parse(state) : null;
    } catch (error) {
      console.error('Failed to retrieve distributed circuit state', error);
      return null;
    }
  }

  public async reportAggregateMetrics() {
    if (!this.options.distributedTracking) {
      return;
    }

    try {
      await CircuitBreaker.redisClient?.set(
        `circuit:metrics:${this.circuitId}`,
        JSON.stringify(this.metrics)
      );
    } catch (error) {
      console.error('Failed to report aggregate metrics', error);
    }
  }
  // Reset and management methods
  reset() {
    this.state = 'CLOSED';
    this.failures = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
    this.metrics = {
      totalCalls: 0,
      successCalls: 0,
      failureCalls: 0,
      lastFailures: []
    };
    this.eventEmitter.emit('circuit-state-change', 'CLOSED');
  }
}

// Utility function for creating circuit breakers
export function createCircuitBreaker<T extends (...args: any[]) => Promise<any>>(
  operation: T, 
  options?: CircuitBreakerOptions
) {
  return new CircuitBreaker(operation, options);
}

// Global circuit breaker management
export class CircuitBreakerManager {
  private static circuitBreakers: Map<string, CircuitBreaker<any>> = new Map();

  static register<T extends (...args: any[]) => Promise<any>>(
    key: string, 
    operation: T, 
    options?: CircuitBreakerOptions
  ) {
    const circuitBreaker = createCircuitBreaker(operation, options);
    this.circuitBreakers.set(key, circuitBreaker);
    return circuitBreaker;
  }

  static get(key: string) {
    return this.circuitBreakers.get(key);
  }

  static async aggregateMetrics() {
    const aggregatedMetrics: Record<string, CircuitMetrics> = {};
    
    for (const [key, circuitBreaker] of this.circuitBreakers) {
      aggregatedMetrics[key] = circuitBreaker.getMetrics();
    }

    return aggregatedMetrics;
  }
}