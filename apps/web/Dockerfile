# ==============================================================================
# Production Dockerfile for Frontend Dashboard (@xatxoot/web)
# Multi-stage build: Bun builder + Nginx Alpine static web server
# ==============================================================================

# Stage 1: Build React 19 + Vite Static Assets
FROM oven/bun:1-alpine AS builder

WORKDIR /app

# Copy root monorepo manifests
COPY package.json bun.lock ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/web/package.json ./apps/web/

# Install dependencies with frozen lockfile
RUN bun install --frozen-lockfile

# Copy source code
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web

# Build static production assets
WORKDIR /app/apps/web
RUN bun run build

# Stage 2: High Performance Nginx Alpine Server
FROM nginx:alpine AS runner

# Remove default nginx welcome page
RUN rm -rf /usr/share/nginx/html/*

# Copy built frontend bundle from builder
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

# Copy custom Nginx configuration with gzip & SPA fallback
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
