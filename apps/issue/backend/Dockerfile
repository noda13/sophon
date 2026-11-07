FROM node:22-slim
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
RUN npm install -g pnpm@10
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --ignore-scripts
RUN pnpm exec prisma generate
COPY . .
EXPOSE 8902
RUN chmod +x entrypoint.sh
CMD ["./entrypoint.sh"]
