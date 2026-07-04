# LeetCode Tracker — production image
# Builds the Next.js standalone output and runs it on port 3000.
# Persistent SQLite volume should be mounted at /data for production.
#
# Build:  docker build -t leetcode-tracker .
# Run:    docker run -p 3000:3000 -v $(pwd)/data:/data \
#           -e JWT_SECRET_KEY=$(openssl rand -hex 32) \
#           -e DATABASE_URL=file:/data/app.db \
#           leetcode-tracker

FROM node:20-slim AS base
WORKDIR /app

# Install bun for fast installs
RUN npm install -g bun

# Install openssl (needed for Prisma engine) + tini for signal handling
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl tini ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# ---- deps stage ----
FROM base AS deps
COPY package.json bun.lock* ./
COPY prisma ./prisma
RUN bun install --frozen-lockfile

# ---- build stage ----
FROM deps AS builder
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Build the Next.js standalone output
RUN bun run db:generate
RUN bun run build

# ---- runner stage ----
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# Default DATABASE_URL points to a persistent volume
ENV DATABASE_URL=file:/data/app.db

# Create non-root user
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# Create data directory
RUN mkdir -p /data && chown nextjs:nodejs /data

# Copy standalone server + static + public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Copy prisma schema + migrations so we can run db:push at startup
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma

# Copy the start script
COPY --chown=nextjs:nodejs docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

USER nextjs
EXPOSE 3000
VOLUME ["/data"]

ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/docker-entrypoint.sh"]
