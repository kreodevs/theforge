# Build stage — context = repo root (necesario para resolver @theforge/shared-types workspace)
FROM node:20-alpine AS builder

ARG BUILD_CACHE_BUST=68
RUN echo "Cache bust key: ${BUILD_CACHE_BUST}"

WORKDIR /app

# Copy workspace manifests
COPY package.json turbo.json .npmrc ./
COPY packages/shared-types/package.json packages/shared-types/
COPY packages/mcp-server/package.json packages/mcp-server/

RUN npm install

# Copy all source code
COPY packages/shared-types packages/shared-types
COPY packages/mcp-server packages/mcp-server

# Build: compila shared-types primero, luego mcp-server
RUN npx turbo run build --filter=@theforge/shared-types --filter=@theforge/mcp-server

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app/packages/mcp-server/dist ./dist
COPY --from=builder /app/packages/shared-types/dist ./node_modules/@theforge/shared-types/dist
COPY --from=builder /app/packages/mcp-server/node_modules ./node_modules
COPY --from=builder /app/packages/mcp-server/package.json ./

EXPOSE 3100

CMD ["node", "dist/index.js", "--http"]
