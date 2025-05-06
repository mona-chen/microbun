# RabbitMQ Queue Management in Microservices

## 1. Overview

This documentation provides a comprehensive guide to implementing RabbitMQ queue management in a microservices architecture, focusing on best practices, conventions, and implementation strategies.

## 2. Core Concepts

### 2.1 Queue Naming Convention

Queues should follow a strict naming convention:
- Use lowercase letters
- Separate parts with dots
- Structure: `<service>.<domain>.<event>`

#### Examples
- Good: `user.account.created`
- Good: `payment.transaction.processed`
- Avoid: `UserCreated`, `new_payment`, `x`

### 2.2 Exchange Types

We utilize different exchange types based on message distribution needs:

| Exchange Type | Use Case | Description |
|--------------|----------|-------------|
| Topic        | Most Flexible | Supports complex routing with wildcards |
| Direct       | Exact Matching | Precise routing based on exact routing keys |
| Fanout       | Broadcast | Sends to all bound queues |

## 3. Project Structure

```
shared/
│
├── events/
│   ├── exchanges.ts       # Central exchange definitions
│   ├── queues/
│   │   ├── index.ts       # Aggregate queues
│   │   ├── user.queues.ts
│   │   ├── payment.queues.ts
│   │   └── notification.queues.ts
│   │
│   ├── setupQueues.ts     # Queue initialization logic
│   └── rabbitmqService.ts # RabbitMQ service implementation
```

## 4. Queue Configuration

### 4.1 Queue Creation Guidelines

```typescript
await createQueue(
  queueName,     // Descriptive queue name
  exchange,      // Appropriate exchange
  routingKey,    // Specific routing pattern
  {
    durable: true,           // Survive broker restarts
    messageTtl: 24 * 60 * 60 * 1000,  // 24-hour message expiration
    deadLetterExchange: EXCHANGES.DEAD_LETTER  // Unprocessed message handling
  }
);
```

### 4.2 Recommended Queue Options

| Option | Recommended Value | Purpose |
|--------|-------------------|---------|
| `durable` | `true` | Persist queues across broker restarts |
| `messageTtl` | 24 hours | Prevent message buildup |
| `deadLetterExchange` | Dead Letter Exchange | Handle unprocessed messages |

## 5. Event Payload Structure

```typescript
{
  metadata: {
    eventId: string,        // Unique identifier
    timestamp: ISOString,   // Event creation time
    traceId: string,        // Distributed tracing
    service: string,        // Originating service
    version?: string        // Optional event schema version
  },
  data: {
    // Actual event-specific payload
  }
}
```

## 6. Routing Key Patterns

### 6.1 Hierarchical Routing

```typescript
// Publish an event
publishEvent(
  EXCHANGES.USER, 
  'user.account.created',  // Hierarchical routing key
  { 
    metadata: { /* ... */ },
    data: { userId: '123' } 
  }
);

// Wildcard subscription
subscribeToEvents(
  'user-account-listener',
  EXCHANGES.USER,
  'user.account.*',  // Matches all user account events
  handler
);
```

## 7. Best Practices

### 7.1 Event Publishing

1. Always include comprehensive metadata
2. Ensure payload is serializable
3. Use unique event IDs
4. Implement idempotency checks

### 7.2 Event Consuming

1. Handle errors gracefully
2. Implement retry mechanisms
3. Log all processing attempts
4. Use dead-letter queues for failure handling

## 8. Example Service Implementation

```typescript
// users.queues.ts
export const UserQueues = {
  ACCOUNT_CREATED: 'user.account.created',
  PROFILE_UPDATED: 'user.profile.updated',
  PASSWORD_RESET: 'user.security.password-reset'
};

// user.service.ts
class UserService {
  async createUser(userData) {
    // Create user logic

    // Publish user creation event
    await publishEvent(
      EXCHANGES.USER, 
      UserQueues.ACCOUNT_CREATED, 
      {
        metadata: {
          eventId: generateUniqueId(),
          timestamp: new Date().toISOString(),
          service: 'user-service'
        },
        data: {
          userId: user.id,
          email: user.email
        }
      }
    );
  }
}
```

## 9. Common Pitfalls to Avoid

- Sending sensitive data directly in messages
- Creating too many fine-grained queues
- Lack of error handling
- Ignoring message processing failures
- Not implementing idempotency

## 10. Monitoring and Debugging

### Recommended Monitoring Tools
- RabbitMQ Management Plugin
- Prometheus
- ELK Stack
- Custom logging mechanisms

## 11. Performance Considerations

- Batch similar events
- Use appropriate message persistence
- Monitor queue lengths
- Implement circuit breakers
- Consider message compression for large payloads

## 12. Security Guidelines

- Sanitize message contents
- Use encryption for sensitive data
- Implement access controls
- Rotate credentials regularly

## Appendix: Sample Configuration

```typescript
// exchanges.ts
export const EXCHANGES = {
  USER: 'user.events',
  PAYMENT: 'payment.events',
  NOTIFICATION: 'notification.events',
  DEAD_LETTER: 'dead.letter'
};

export const EXCHANGE_TYPES = {
  TOPIC: 'topic',
  DIRECT: 'direct',
  FANOUT: 'fanout'
} as const;
```

## Conclusion

By following these guidelines, you'll create a robust, scalable, and maintainable event-driven microservices architecture using RabbitMQ.