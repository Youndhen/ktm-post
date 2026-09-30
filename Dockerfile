# syntax=docker/dockerfile:1

# Stage 1: Base Alpine environment
FROM node:20-alpine AS base
WORKDIR /app
# Both are required by the Prisma query engine on musl/Alpine.
RUN apk add --no-cache libc6-compat openssl

# Stage 2: Install dependencies
FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma/
RUN npm ci

# Stage 3: Build the application
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time configuration.
#   DATABASE_URL       - "/" and "/news" are statically generated from the DB.
#   NEXT_PUBLIC_*      - inlined into the client bundle at build time.
ARG DATABASE_URL
ARG NEXT_PUBLIC_SITE_URL
ENV DATABASE_URL=$DATABASE_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_TELEMETRY_DISABLED=1

# "npm run build" already runs "prisma generate" before "next build".
RUN npm run build

# Stage 4: Production runner (standalone)
FROM base AS runner

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup -S -g 1001 nodejs \
 && adduser -S -u 1001 -G nodejs nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/ >/dev/null 2>&1 || exit 1

CMD ["node", "server.js"]
