# MicroBun

A flexible, extensible microservice boilerplate built with Bun/Node.js, Express, and TypeScript. MicroBun provides a solid foundation for building scalable, event-driven microservices without the constraints of heavy frameworks.

## Features

- **Modular Architecture**: Clean separation of concerns with a well-organized directory structure
- **Event-Driven Communication**: Built-in RabbitMQ integration for reliable service communication
- **Notification Service**: Ready-to-use email and SMS notification capabilities
- **TypeScript**: Full TypeScript support for better developer experience and type safety
- **Docker Ready**: Docker and docker-compose configurations for easy deployment
- **Environment Management**: Robust configuration system for different environments
- **Extensible**: Easily add new microservices to the ecosystem
- **Runtime Flexibility**: Works with both Bun and Node.js runtimes

## Project Structure

```
├── apps/                      # Microservice applications
│   ├── api/                   # API Gateway service
│   ├── notifications/         # Notification service
│   └── service-registry/      # Service discovery and registry
├── shared/                    # Shared code and utilities
│   ├── config/                # Configuration management
│   ├── constants/             # Shared constants
│   ├── events/                # Event management (RabbitMQ)
│   ├── utils/                 # Utility functions
│   └── views/                 # Email templates
├── docs/                      # Documentation
└── docker-compose.yml         # Docker compose configuration
```

## Getting Started

### Prerequisites

- Bun (recommended) or Node.js v16+
- Docker and docker-compose (for containerized deployment)
- RabbitMQ (included in docker-compose)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/microbun.git
   cd microbun
   ```

2. Install dependencies:
   ```bash
   # With Bun (recommended)
   bun install

   # With npm
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. Start the services:
   ```bash
   # Development mode with Bun
   bun run dev

   # With Docker
   docker-compose up
   ```

## Available Services

### Notification Service

The notification service handles sending various types of notifications through different channels:

- Email notifications (using configurable providers)
- SMS notifications
- Support for templated messages
- Queue-based processing for reliability

### API Gateway

A lightweight API gateway that routes requests to appropriate microservices:

- Request routing
- Authentication middleware
- Rate limiting
- Proxy capabilities

### Service Registry

Simple service discovery and health monitoring:

- Service registration
- Health checks
- Service metadata

## Adding New Services

To create a new microservice:

1. Create a new directory in the `apps/` folder
2. Copy the basic structure from an existing service
3. Update the service-specific code
4. Register the service in docker-compose.yml
5. Add any necessary queues or exchanges in shared/events

## Configuration

Configuration is managed through environment variables and the shared configuration system:

- `.env` - Environment-specific variables
- `shared/config/` - Configuration management
- Service-specific configurations in each service directory

## Development

```bash
# Start all services in development mode
bun run dev

# Start a specific service
bun run dev:notifications

# Run tests
bun test

# Build for production
bun run build
```

## Deployment

MicroBun includes Docker configurations for easy deployment:

```bash
# Development environment
docker-compose up

# Production environment
docker-compose -f docker-compose.prod.yml up
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.