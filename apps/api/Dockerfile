# API Gateway Dockerfile
FROM oven/bun:1.0.3 AS base
WORKDIR /app

# Install dependencies
COPY apps/api/package.json apps/api/bun.lockb ./
RUN bun install --frozen-lockfile

# Production stage
FROM base AS production
COPY apps/api ./
RUN bun run build

# Expose API Gateway port
EXPOSE 8080

# Run the API Gateway
CMD ["bun", "src/main.ts"]