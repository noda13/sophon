#!/bin/sh

echo "Running Prisma migrations..."
pnpm prisma migrate deploy || echo "Migration failed or already exists"

echo "Starting waga-scope server..."
pnpm run dev
