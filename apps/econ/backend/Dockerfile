# Build context is the repository root (see docker-compose.yml) so the workspace lockfile can be frozen.
FROM node:22-slim

RUN apt-get update && apt-get install -y \
    openssl \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

# Same major as CI; pnpm 9 and 10 differ in whether dependency build scripts (prisma) run, so keep them aligned.
RUN npm install -g pnpm@10.33.4

WORKDIR /app
RUN chown node:node /app
USER node

COPY --chown=node:node package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY --chown=node:node backend/package.json backend/

# The lockfile records autoInstallPeers=false; without the flag a frozen install rejects it as a settings mismatch.
RUN pnpm install --frozen-lockfile --filter econoguard-backend...

WORKDIR /app/backend

COPY --chown=node:node backend/prisma ./prisma/
RUN pnpm run prisma:generate

# Listed explicitly as defense in depth: BuildKit reads Dockerfile.dockerignore but the legacy builder reads the root .dockerignore, so a wholesale COPY would depend on both ignore files staying in sync.
COPY --chown=node:node backend/src ./src/
COPY --chown=node:node backend/tsconfig.json backend/entrypoint.sh ./

EXPOSE 8901

CMD ["/bin/sh", "/app/backend/entrypoint.sh"]
