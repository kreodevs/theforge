FROM node:22-bullseye AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y postgresql-client gcompat openssl && rm -rf /var/lib/apt/lists/*

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json .npmrc ./
COPY packages/database/package.json packages/database/
COPY packages/shared-types/package.json packages/shared-types/
COPY packages/business-rules/package.json packages/business-rules/
COPY packages/config/package.json packages/config/
COPY apps/api/package.json apps/api/

RUN pnpm install --frozen-lockfile

COPY packages/database packages/database
COPY packages/shared-types packages/shared-types
COPY packages/business-rules packages/business-rules
COPY packages/config packages/config
COPY apps/api apps/api
COPY scripts/rotate-master-key.ts scripts/

RUN pnpm exec turbo run build --filter=@theforge/database --filter=@theforge/shared-types --filter=@theforge/business-rules --filter=@theforge/api

FROM node:22-bullseye AS runner

RUN apt-get update && apt-get install -y wget openssl postgresql-client \
  chromium && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

COPY --from=builder /app .
COPY apps/api/docker-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

WORKDIR /app/apps/api

EXPOSE 3000

ENTRYPOINT ["/entrypoint.sh"]