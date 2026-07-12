# Cache bust v4 - 20260712T2317
FROM public.ecr.aws/docker/library/node:20-alpine AS builder

ARG BUILD_CACHE_BUST=105
RUN echo "Cache bust key: ${BUILD_CACHE_BUST}" && rm -rf /root/.turbo 2>/dev/null || true

WORKDIR /app

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
COPY scripts/rotate-master-key.ts scripts/rotate-master-key.ts

RUN pnpm exec turbo run build --force --filter=@theforge/database --filter=@theforge/shared-types --filter=@theforge/business-rules --filter=@theforge/api && \
    echo "Build completed"

RUN test -f apps/api/dist/main.js || (echo "FATAL: apps/api/dist/main.js missing after turbo build" && ls -la apps/api/dist/ 2>/dev/null && exit 1)

FROM public.ecr.aws/docker/library/node:20-alpine AS runner

RUN apk add --no-cache wget openssl postgresql-client \
  chromium nss freetype harfbuzz ttf-freefont font-noto-emoji

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app .
COPY apps/api/docker-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

WORKDIR /app/apps/api

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

EXPOSE 3000

ENTRYPOINT ["/entrypoint.sh"]