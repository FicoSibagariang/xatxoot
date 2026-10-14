# ==============================================================================
# Production Dockerfile for Backend API & Worker (@xatxoot/api)
# Multi-stage build based on oven/bun:1-alpine
# ==============================================================================

# Stage 1: Build & Dependency Resolution
FROM oven/bun:1-alpine AS builder

WORKDIR /app

# Copy root monorepo manifests
COPY package.json bun.lock ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/

# Install production dependencies with frozen lockfile
RUN bun install --frozen-lockfile --production

# Copy source code
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

# Stage 2: Minimal Production Runner
FROM oven/bun:1-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install curl for healthcheck validation
RUN apk add --no-cache curl wget

# Copy installed dependencies and source files from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/api ./apps/api

# Set ownership to non-root bun user
RUN chown -R bun:bun /app

# Switch to non-root user
USER bun

EXPOSE 3000

# Run automatic database migrations then start Hono API server
CMD ["sh", "-c", "bun run --cwd apps/api db:migrate && bun run --cwd apps/api src/index.ts"]
