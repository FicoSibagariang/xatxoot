# ==============================================================================
# Production Dockerfile for WhatsApp Unofficial Gateway (@xatxoot/wa-gateway)
# Node.js 20 LTS Alpine Runtime for Baileys Socket & Noise Protocol Stability
# ==============================================================================

# Stage 1: Dependency Preparation
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies if needed
RUN apk add --no-cache python3 make g++

# Copy root & package manifests
COPY package.json bun.lock ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/wa-gateway/package.json ./apps/wa-gateway/

# Install dependencies using npm
RUN npm install --prefix apps/wa-gateway

# Stage 2: Minimal Production Runner
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001
ENV WA_GATEWAY_SESSION_PATH=/data/baileys_auth

# Create directory for persistent Baileys session storage
RUN mkdir -p /data/baileys_auth && chown -R node:node /data/baileys_auth

# Copy application source & dependencies
COPY --from=builder /app/apps/wa-gateway/node_modules ./apps/wa-gateway/node_modules
COPY packages/shared ./packages/shared
COPY apps/wa-gateway ./apps/wa-gateway

# Set ownership to node non-root user
RUN chown -R node:node /app

# Switch to non-root user
USER node

EXPOSE 3001

# Run Baileys gateway service using tsx
CMD ["npx", "tsx", "apps/wa-gateway/src/index.ts"]
