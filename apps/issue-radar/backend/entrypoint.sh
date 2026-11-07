#!/bin/sh
set -e
pnpm exec prisma migrate deploy
pnpm run prisma:seed
pnpm run dev
