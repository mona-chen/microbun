# Service Registry and Discovery

## Overview

The Service Registry and Discovery system provides a centralized mechanism for microservices to register themselves, maintain their availability status via heartbeats, and discover other services in the distributed system. This documentation covers the purpose, components, and usage of this system.

## Table of Contents

1. [System Components](#system-components)
2. [Service Registration](#service-registration)
3. [Heartbeat Mechanism](#heartbeat-mechanism)
4. [Service Discovery](#service-discovery)
5. [Error Handling and Resilience](#error-handling-and-resilience)
6. [Usage Examples](#usage-examples)
7. [Configuration Options](#configuration-options)

## System Components

The service registry system consists of two main components:

1. **Service Registry Service** - A centralized registry that maintains information about all available services
2. **ServiceRegistryManager** - A client utility used by services to interact with the registry

### Service Registry Service

The service registry service provides REST endpoints for:
- Registering new services
- Receiving periodic heartbeats from services
- Responding to discovery queries
- Deregistering services when they're no longer available

The registry maintains service information in Redis for persistence.

### ServiceRegistryManager

The ServiceRegistryManager is a utility class that provides a simple interface for:
- Registering services with the registry
- Sending heartbeats automatically
- Discovering other services
- Deregistering services when shutting down

## Service Registration

Services register themselves with the registry on startup, providing information such as:
- Service name
- Host and port
- Health check endpoint
- Version
- Description

### Registration Process

```typescript
// Example: Registering a service
const serviceId = await ServiceRegistryManager.register({
  name: 'Auth',
  port: 3001,
  version: '1.0.0',
  description: 'Authentication service for Paymable'
});
```

Upon successful registration, the service receives a unique ID that is used for subsequent communication with the registry.

## Heartbeat Mechanism

To maintain an accurate view of service availability, each service sends periodic heartbeats to the registry:

1. After registration, services begin sending automatic heartbeats at configurable intervals (default: 30 seconds)
2. Each heartbeat includes the service's current status (UP, DOWN, STARTING, STOPPING)
3. If a service fails to send heartbeats for a configurable period (default: 90 seconds), it's automatically deregistered

### How Heartbeats Work

The ServiceRegistryManager automatically handles sending heartbeats:
- Sends an immediate heartbeat after registration
- Establishes an interval to send regular heartbeats
- Implements retry logic for failed heartbeat attempts
- Reports the current service status

## Service Discovery

The discovery mechanism allows services to find other services dynamically without hardcoded connection details.

### How to Discover Services

```typescript
// Find all instances of a specific service
const authServices = await ServiceRegistryManager.discoverServices('Auth');

// Find all available services
const allServices = await ServiceRegistryManager.discoverServices();
```

The discovery method returns detailed information about each service instance, including:
- Service ID
- Name
- Host and port
- URL
- Health endpoint
- Version
- Status
- Registration time
- Last heartbeat time

## Error Handling and Resilience

The ServiceRegistryManager includes several features to ensure resilience:

1. **Automatic Retries** - Failed registrations are retried with exponential backoff
2. **Re-registration** - If heartbeats receive 404 responses (service not found), the service automatically re-registers
3. **Graceful Shutdown** - Services deregister themselves when shutting down
4. **Failover Support** - Discovery results can be used to implement client-side load balancing and failover

## Usage Examples

### Basic Service Registration

```typescript
// In your service's startup code
app.listen(port, async () => {
  logger.info(`Service running on port ${port}`);
  
  const serviceId = await ServiceRegistryManager.register({
    name: 'MyService',
    port: port,
    version: '1.0.0',
    description: 'Description of my service'
  });
  
  if (serviceId) {
    logger.info(`Registered with service registry, ID: ${serviceId}`);
  }
});
```

### Service-to-Service Communication

```typescript
async function callUserService(userId: string) {
  const userServices = await ServiceRegistryManager.discoverServices('User');
  
  if (userServices.length === 0) {
    throw new Error('User service not available');
  }
  
  const userService = userServices[0];
  const url = `http://${userService.host}:${userService.port}/users/${userId}`;
  
  return axios.get(url);
}
```

### Load Balancing Example

```typescript
let requestCounter = 0;

async function callServiceWithLoadBalancing(serviceName: string, endpoint: string, data?: any) {
  const services = await ServiceRegistryManager.discoverServices(serviceName);
  
  if (services.length === 0) {
    throw new Error(`${serviceName} service not available`);
  }
  
  // Round-robin selection
  const serviceIndex = requestCounter % services.length;
  requestCounter++;
  
  const service = services[serviceIndex];
  const url = `http://${service.host}:${service.port}/${endpoint}`;
  
  if (data) {
    return axios.post(url, data);
  }
  return axios.get(url);
}
```

### Failover Example

```typescript
async function callServiceWithFailover(serviceName: string, endpoint: string, data?: any) {
  const services = await ServiceRegistryManager.discoverServices(serviceName);
  
  if (services.length === 0) {
    throw new Error(`${serviceName} service not available`);
  }
  
  // Try each service until one succeeds
  let lastError;
  for (const service of services) {
    try {
      const url = `http://${service.host}:${service.port}/${endpoint}`;
      if (data) {
        return await axios.post(url, data);
      }
      return await axios.get(url);
    } catch (error) {
      lastError = error;
      // Try next service
    }
  }
  
  throw new Error(`All ${serviceName} instances failed: ${lastError.message}`);
}
```

## Configuration Options

The service registry system can be configured through environment variables:

| Environment Variable | Description | Default |
|--------------------|-------------|---------|
| SERVICE_REGISTRY_URL | URL of the service registry | http://localhost:3011 |
| SERVICE_REGISTRY_HEARTBEAT_INTERVAL | Interval between heartbeats (ms) | 30000 |
| SERVICE_REGISTRY_RETRY_DELAY | Base delay for retry attempts (ms) | 10000 |
| SERVICE_REGISTRY_MAX_RETRIES | Maximum number of retries | 5 |
| HOST | Host name for the service | localhost |
| PORT | Port for the service | 3000 |

These can be set in your .env file or directly in your hosting environment.

## Best Practices

1. **Always handle discovery failures** - Services may be temporarily unavailable
2. **Implement circuit breakers** - Prevent cascading failures when services are down
3. **Use service versioning** - Include version information during registration
4. **Implement health checks** - Provide meaningful health status information
5. **Clean shutdown** - Ensure services properly deregister when shutting down
6. **Handle reconnection** - Services should attempt to re-register if disconnected from the registry

By following these practices and using the ServiceRegistryManager, your microservices architecture will be more resilient, scalable, and easier to maintain.