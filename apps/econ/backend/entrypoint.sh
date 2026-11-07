#!/bin/sh
set -e

echo "Applying Prisma migrations..."
pnpm prisma migrate deploy

echo "Seeding database (only when empty and not in production)..."
pnpm run prisma:seed

if [ "$NODE_ENV" = "production" ]; then
  echo "Starting Econoguard server (production)..."
  exec pnpm run start
else
  echo "Starting Econoguard server (development, watch mode)..."
  exec pnpm run dev
fi
