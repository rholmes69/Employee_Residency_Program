# Shared image for the Node services (api, mcp). Build with --build-arg APP=api|mcp
FROM node:22-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install deps with only manifests copied, for layer caching
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY packages/core/package.json packages/core/
COPY apps/api/package.json apps/api/
COPY apps/mcp/package.json apps/mcp/
COPY apps/web/package.json apps/web/
RUN npm ci --no-audit --no-fund

COPY . .
RUN npx prisma generate --schema packages/db/prisma/schema.prisma

ARG APP
RUN test -n "$APP" && npm run build -w @erp/${APP}

ENV NODE_ENV=production
