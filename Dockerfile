# API TriboHub (NestJS + Prisma) — imagem para o Fly.io (região São Paulo/gru).
# Monorepo pnpm: builda @tribohub/config, @tribohub/db (prisma generate) e @tribohub/api.
FROM node:20-slim

# openssl é exigido pelo engine do Prisma; ca-certificates para TLS ao Supabase.
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@11.5.1 --activate

WORKDIR /app

# Copia o monorepo (o .dockerignore exclui node_modules/dist/.next/.env).
COPY . .

# Instala as dependências (lockfile congelado) e builda só o necessário para a API.
RUN pnpm install --frozen-lockfile \
 && pnpm --filter @tribohub/config build \
 && pnpm --filter @tribohub/db build \
 && pnpm --filter @tribohub/api build

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

# main.ts escuta em 0.0.0.0:$PORT
CMD ["node", "apps/api/dist/main.js"]
