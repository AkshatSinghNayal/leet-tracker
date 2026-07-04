#!/bin/sh
set -e

# If DATABASE_URL points to a file path, ensure the directory exists
case "$DATABASE_URL" in
  file:*)
    DB_DIR=$(echo "$DATABASE_URL" | sed 's|^file:||' | xargs dirname)
    mkdir -p "$DB_DIR"
    ;;
esac

# Push the prisma schema (creates tables if missing; safe to run on every start)
echo "[entrypoint] Running prisma db push..."
npx prisma db push --skip-generate --accept-data-loss=false || true

# Generate prisma client (in case it's missing in the image)
echo "[entrypoint] Running prisma generate..."
npx prisma generate || true

echo "[entrypoint] Starting Next.js server on port ${PORT:-3000}..."
exec node server.js
