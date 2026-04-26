FROM node:24-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    openssl \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm@9

COPY package.json ./

RUN pnpm install --no-frozen-lockfile

COPY prisma ./prisma/

RUN pnpm run prisma:generate

COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

COPY . .

EXPOSE 8902

CMD ["/bin/sh", "/app/entrypoint.sh"]
