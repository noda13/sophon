# Build context is the repository root (see docker-compose.yml) so the workspace lockfile can be frozen.
FROM node:22-slim

# Same version as backend and CI; pnpm 9 and 10 differ in whether dependency build scripts run, so keep them aligned.
RUN npm install -g pnpm@10.33.4

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY frontend/package.json frontend/

# The lockfile records autoInstallPeers=false; without the flag a frozen install rejects it as a settings mismatch.
RUN pnpm install --frozen-lockfile --filter econoguard-frontend...

WORKDIR /app/frontend

COPY frontend/ ./

EXPOSE 3901

CMD ["pnpm", "run", "dev"]
