# Service Registry Dockerfile
FROM oven/bun:1.0.3 AS base
WORKDIR /app

# Install dependencies
COPY apps/service-registry/package.json apps/service-registry/bun.lockb ./
RUN bun install --frozen-lockfile

# Production stage
FROM base AS production
COPY apps/service-registry ./
RUN bun run build

# Expose Service Registry port
EXPOSE 4000

# Run the Service Registry
CMD ["bun", "src/main.ts"]