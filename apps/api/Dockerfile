# Build stage — context = repo root
FROM node:20-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.14.2 --activate
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

COPY package.json pnpm-workspace.yaml turbo.json ./
COPY packages/database/package.json packages/database/
COPY packages/shared-types/package.json packages/shared-types/
COPY packages/config/package.json packages/config/
COPY apps/api/package.json apps/api/

RUN pnpm install

COPY packages/database packages/database
COPY packages/shared-types packages/shared-types
COPY packages/config packages/config
COPY apps/api apps/api

ENV DATABASE_URL="postgresql://local:local@db:5432/theforge"
RUN pnpm run build --filter=@the-forge/database --filter=@the-forge/shared-types --filter=@the-forge/api

# Production stage — preserve pnpm layout for workspace resolution
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app .
WORKDIR /app/apps/api

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:3000/projects || exit 1

CMD ["node", "dist/main.js"]
