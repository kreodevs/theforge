# Build stage — context = repo root
# Imágenes fijas en ECR Public (evita TLS timeout a Docker Hub y fallos de ARG en Dokploy).
FROM public.ecr.aws/docker/library/node:20-alpine AS builder

ARG BUILD_CACHE_BUST=101
RUN echo "Cache bust key: ${BUILD_CACHE_BUST}" && rm -rf /root/.turbo 2>/dev/null || true

RUN apk add --no-cache gcompat openssl

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json .npmrc ./
COPY packages/database/package.json packages/database/
COPY packages/shared-types/package.json packages/shared-types/
COPY packages/business-rules/package.json packages/business-rules/
COPY packages/config/package.json packages/config/
COPY apps/api/package.json apps/api/

RUN pnpm install --frozen-lockfile

# Copy source files - invalidate when BUILD_CACHE_BUST changes
COPY packages/database packages/database
COPY packages/shared-types packages/shared-types
COPY packages/business-rules packages/business-rules
COPY packages/config packages/config
COPY apps/api apps/api
COPY apps/api/.build-bump apps/api/.build-bump  # Touch to invalidate cache
COPY scripts/rotate-master-key.ts scripts/rotate-master-key.ts

# Touch apps/api/.build-stamp to break Docker cache when BUILD_CACHE_BUST changes
RUN touch apps/api/.build-stamp 2>/dev/null || true

# Build with turbo - the --force flag ensures turbo re-runs, and the stamp ensures we see output
RUN pnpm exec turbo run build --force --filter=@theforge/database --filter=@theforge/shared-types --filter=@theforge/business-rules --filter=@theforge/api

# Verify dist/main.js was produced (turbo cache can silently skip builds)
RUN test -f apps/api/dist/main.js || (echo "FATAL: apps/api/dist/main.js missing after turbo build" && ls -la apps/api/dist/ 2>/dev/null && exit 1)

# Production stage — layout pnpm hoisted desde builder
FROM public.ecr.aws/docker/library/node:20-alpine AS runner

RUN apk add --no-cache wget openssl postgresql-client \
  chromium \
  nss \
  freetype \
  harfbuzz \
  ttf-freefont \
  font-noto-emoji

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app .
COPY apps/api/docker-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
# entrypoint: wait DB → prisma migrate deploy → node (no sobrescribir CMD en Dokploy)

WORKDIR /app/apps/api

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

EXPOSE 3000

# HEALTHCHECK desactivado: Dokploy no lo soporta correctamente
# HEALTHCHECK NONE

ENTRYPOINT ["/entrypoint.sh"]
