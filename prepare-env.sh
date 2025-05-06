#!/bin/bash

# Ensure .env.prod exists
if [[ ! -f .env.prod ]]; then
    echo "❌ ERROR: .env.prod file not found!"
    exit 1
fi

# Copy and clean .env
cp .env.prod .env
sed -i '' -e 's/[[:space:]]*$//' -e '/^$/d' .env

echo "✅ Cleaned .env file is ready."

# Restart Docker to apply changes (optional)
# docker-compose down && docker-compose up -d
