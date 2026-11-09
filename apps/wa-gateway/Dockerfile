# ==============================================================================
# Production Dockerfile for WhatsApp Unofficial Gateway (@xatxoot/wa-gateway)
# Node.js 20 LTS Alpine Runtime for Baileys Socket & Noise Protocol Stability
# ==============================================================================

# Stage 1: Build & Compile TypeScript Ahead-of-Time (AOT)
FROM oven/bun:1-alpine AS builder

WORKDIR /app

# Copy root monorepo manifests
COPY package.json bun.lock ./
COPY packages/shared ./packages/shared
COPY apps/wa-gateway ./apps/wa-gateway

# Install dependencies and compile Ahead-of-Time (AOT) bundle
RUN bun install --frozen-lockfile
RUN bun build apps/wa-gateway/src/index.ts --target=node --outfile=apps/wa-gateway/dist/index.js

# Stage 2: Minimal Production Runner (Node.js 20 LTS Alpine)
FROM node:20-alpine AS runner

WORKDIR /app/apps/wa-gateway

ENV NODE_ENV=production
ENV PORT=3001
ENV WA_GATEWAY_SESSION_PATH=/data/baileys_auth

# Create directory for persistent Baileys session storage
RUN mkdir -p /data/baileys_auth && chown -R node:node /data/baileys_auth

# Copy application manifests & compiled AOT JavaScript
COPY --from=builder /app/package.json /app/package.json
COPY --from=builder /app/apps/wa-gateway/package.json ./package.json
COPY --from=builder /app/apps/wa-gateway/dist ./dist

# Set ownership to node non-root user
RUN chown -R node:node /app

# Switch to non-root user
USER node

EXPOSE 3001

# Run compiled Ahead-of-Time JavaScript via node
CMD ["node", "dist/index.js"]
