#!/bin/sh
set -e

# Wait for service registry to be available
wait_for_service() {
  echo "Waiting for $1 to be available..."
  until wget --no-verbose --tries=1 --spider $2 || exit 1; do
    echo "Service at $2 not available yet, waiting..."
    sleep 2
  done
  echo "$1 is available"
}

# Add this to services that need to connect to service registry
if [ -n "$SERVICE_REGISTRY_URL" ]; then
  wait_for_service "Service Registry" "$SERVICE_REGISTRY_URL/health"
fi

# Execute the CMD
exec "$@"