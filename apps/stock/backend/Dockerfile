# Build context is the repository root (pnpm-lock.yaml lives there).
FROM node:24-slim

RUN apt-get update && apt-get install -y \
    openssl \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm@9

WORKDIR /app

# Workspace manifests are required for --frozen-lockfile to match the lockfile importers.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
COPY packages/shared ./packages/shared/

RUN pnpm install --frozen-lockfile --filter waga-scope-backend...

WORKDIR /app/backend

COPY backend/prisma ./prisma/
RUN pnpm run prisma:generate

COPY backend/ ./

RUN chmod +x entrypoint.sh \
    && chown -R node:node /app

USER node

EXPOSE 8902

CMD ["/bin/sh", "/app/backend/entrypoint.sh"]
