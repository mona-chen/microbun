# Base image with Bun
FROM oven/bun:alpine

# Set working directory
WORKDIR /app

# Copy everything
COPY . .

# Install dependencies
RUN bun install

# Optional: Build all apps (skip if you're using runtime-only scripts)
RUN bun run build

# Change this to the service you want to run
WORKDIR /app

# Expose desired port (adjust per service)
EXPOSE 4000

# Run the app
CMD ["bun", "run", "start"]
