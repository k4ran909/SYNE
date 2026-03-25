FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies (including devDeps for tsx, prisma, typescript)
COPY package.json package-lock.json ./
RUN npm ci

# Copy the Prisma schema
COPY prisma ./prisma

# Copy source
COPY . .

# ─── Production image ────────────────────────────────────────────
FROM node:20-alpine

# Prisma needs openssl on Alpine
RUN apk add --no-cache openssl

WORKDIR /app

# Copy everything from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./
COPY --from=builder /app/src ./src
COPY --from=builder /app/tsconfig.json ./

# Regenerate Prisma client for the production Alpine target
RUN npx prisma generate

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD node -e "process.exit(0)"

# Start with shard manager using tsx
CMD ["npx", "tsx", "src/shard.ts"]
