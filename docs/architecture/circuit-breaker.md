# Advanced Circuit Breaker Documentation

## Overview

The Advanced Circuit Breaker is a robust, flexible mechanism for handling failures in distributed systems and microservices. It provides intelligent failure management, retry mechanisms, and comprehensive monitoring capabilities.

## Table of Contents
1. [Key Features](#key-features)
2. [Installation](#installation)
3. [Basic Usage](#basic-usage)
4. [Configuration Options](#configuration-options)
5. [Advanced Usage](#advanced-usage)
6. [Metrics and Monitoring](#metrics-and-monitoring)
7. [Distributed Tracking](#distributed-tracking)
8. [Best Practices](#best-practices)
9. [Troubleshooting](#troubleshooting)

## Key Features

- **Intelligent Failure Handling**
  - Automatic circuit state management
  - Configurable failure thresholds
  - State transitions: Closed → Open → Half-Open

- **Advanced Retry Mechanisms**
  - Configurable retry strategies
  - Exponential and linear backoff
  - Customizable max retries

- **Comprehensive Metrics**
  - Detailed call tracking
  - Failure context preservation
  - Performance insights

- **Distributed State Management**
  - Redis-based state tracking
  - Cross-service circuit state monitoring

## Installation

### Prerequisites
- Node.js (v16+)
- Redis (optional, for distributed tracking)

### Package Installation
```bash
npm install ioredis uuid
npm install --save-dev @types/ioredis @types/uuid
```

### Environment Configuration
Create a `.env` file in your project root:
```bash
# Optional: Redis connection for distributed tracking
REDIS_URL=redis://localhost:6379
```

## Basic Usage

### Simple Circuit Breaker
```typescript
import { createAdvancedCircuitBreaker } from '@shared/utils/advanced-circuit-breaker';

async function callExternalService() {
  // Create circuit breaker for specific operation
  const circuitBreaker = createAdvancedCircuitBreaker(
    () => externalApiCall(),
    {
      failureThreshold: 3,
      resetTimeout: 30000,
      retryBackoff: 'exponential'
    }
  );

  try {
    // Execute operation through circuit breaker
    const result = await circuitBreaker.execute();
    return result;
  } catch (error) {
    // Handle final failure
    console.error('Operation failed after all retries');
  }
}
```

## Configuration Options

### Detailed Configuration Interface
```typescript
interface AdvancedCircuitBreakerOptions {
  // Number of consecutive failures before opening circuit
  failureThreshold?: number;  // Default: 5

  // Time to wait before attempting recovery
  resetTimeout?: number;      // Default: 30000 ms

  // Maximum operation execution time
  timeout?: number;           // Default: 10000 ms

  // Successful calls needed to close circuit
  successThreshold?: number; // Default: 3

  // Retry delay strategy
  retryBackoff?: 'linear' | 'exponential';  // Default: 'exponential'

  // Maximum retry attempts
  maxRetries?: number;        // Default: 3

  // Enable detailed metrics collection
  metricsTracking?: boolean;  // Default: true

  // Enable Redis-based distributed tracking
  distributedTracking?: boolean;  // Default: false
}
```

## Advanced Usage

### Centralized Circuit Breaker Management
```typescript
import { CircuitBreakerManager } from '@shared/utils/advanced-circuit-breaker';

// Register circuit breakers for different services
CircuitBreakerManager.register('payment-service', 
  () => processPayment(),
  { 
    failureThreshold: 5,
    distributedTracking: true 
  }
);

// Retrieve and use specific circuit breaker
const paymentCircuitBreaker = CircuitBreakerManager.get('payment-service');
await paymentCircuitBreaker?.execute();

// Aggregate metrics across all circuit breakers
const metrics = await CircuitBreakerManager.aggregateMetrics();
```

## Metrics and Monitoring

### Metrics Structure
```typescript
interface CircuitMetrics {
  // Total number of calls
  totalCalls: number;

  // Successful calls
  successCalls: number;

  // Failed calls
  failureCalls: number;

  // Detailed failure contexts
  lastFailures: FailureContext[];
}

interface FailureContext {
  // Specific error that occurred
  error: unknown;

  // Timestamp of failure
  timestamp: number;

  // Unique service identifier
  serviceId: string;
}
```

### Retrieving Metrics
```typescript
// Get metrics for a specific circuit breaker
const metrics = circuitBreaker.getMetrics();

// Access specific metric details
console.log(metrics.totalCalls);
console.log(metrics.lastFailures);
```

## Distributed Tracking

### Requirements
- Redis must be configured
- `distributedTracking` option enabled

### How It Works
- Circuit state stored in Redis
- Cross-service state visibility
- Centralized monitoring

## Best Practices

1. **Failure Threshold**
   - Set appropriately for each service
   - Consider service criticality
   - Balance between resilience and availability

2. **Retry Strategies**
   - Use exponential backoff for most scenarios
   - Linear backoff for time-sensitive operations
   - Limit max retries

3. **Timeout Configuration**
   - Set realistic operation timeouts
   - Consider network latency
   - Align with service-level agreements

4. **Monitoring**
   - Implement comprehensive logging
   - Set up alerts for circuit state changes
   - Track and analyze failure patterns

## Troubleshooting

### Common Issues
- **Redis Connection Failures**
  - Ensure Redis is running
  - Check `REDIS_URL` configuration
  - Implement fallback mechanisms

- **Unexpected Circuit State**
  - Use `reset()` method to force reset
  - Check metrics for failure insights
  - Verify configuration parameters

### Debugging
```typescript
// Get current circuit state
const state = circuitBreaker.getState();

// Reset circuit breaker
circuitBreaker.reset();

// Retrieve distributed state
const distributedState = await circuitBreaker.getDistributedState();
```

## Performance Considerations

- Minimal overhead for circuit breaker operations
- Redis tracking adds slight latency
- Configure with performance-critical services in mind

## Security

- Use environment variables for sensitive configurations
- Implement proper Redis authentication
- Sanitize and validate all inputs

## Contribution

Contributions welcome! Please submit pull requests or open issues on the project repository.

## License

[Your License Here - e.g., MIT]

## Contact

For support or questions, contact [Your Contact Information]