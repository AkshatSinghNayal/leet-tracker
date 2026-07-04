# Deployment Guide — LeetCode Tracker

This guide covers deploying to **Vercel** (PostgreSQL) and **Render** (SQLite or PostgreSQL).

---

## Quick Comparison

| | Vercel | Render |
|---|---|---|
| **Database** | PostgreSQL required (no persistent FS) | SQLite (persistent disk) or PostgreSQL |
| **Cost** | Free tier available | Free tier available |
| **Build** | Serverless functions | Docker container |
| **Best for** | Fast global CDN, serverless scale | Persistent storage, Docker simplicity |
| **Cold starts** | Yes (serverless) | Yes on free tier (spins down after 15 min) |

---

## Vercel Deployment

Vercel uses serverless functions — no persistent filesystem, so **SQLite won't work**. You must use PostgreSQL.

### Step 1 — Provision a PostgreSQL Database

Pick one of these free options:

- **[Neon](https://neon.tech)** ← recommended (generous free tier, serverless Postgres)
- **[Supabase](https://supabase.com)** (free tier, includes auth/storage too)
- **[Vercel Postgres](https://vercel.com/storage/postgres)** (built into Vercel dashboard)

After creating the database, copy your **connection string**. It looks like:

```
postgresql://user:password@host/dbname?sslmode=require
```

### Step 2 — Switch Prisma to PostgreSQL

```bash
# Replace the SQLite schema with the PostgreSQL variant
cp prisma/schema.postgres.prisma prisma/schema.prisma

# Push schema to your Postgres DB to create all tables
DATABASE_URL="your-postgres-connection-string" bun run db:push
```

> **Note:** Commit `prisma/schema.prisma` after switching. The PostgreSQL schema is identical in models — only the datasource block changes.

### Step 3 — Push to GitHub

```bash
git add prisma/schema.prisma
git commit -m "chore: switch to PostgreSQL schema for Vercel"
git push origin main
```

### Step 4 — Import into Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Click **"Import Git Repository"** → select your repo
3. Vercel auto-detects Next.js. The `vercel.json` in the repo already sets:
   - `installCommand`: `bun install`
   - `buildCommand`: `bun run db:generate && next build`
   - API function timeout: 30s
4. **Don't deploy yet** — set env vars first (next step)

### Step 5 — Set Environment Variables

In the Vercel dashboard → your project → **Settings → Environment Variables**, add:

| Variable | Value | Notes |
|---|---|---|
| `DATABASE_URL` | `postgresql://user:pass@host/db?sslmode=require` | From Step 1 |
| `JWT_SECRET_KEY` | `<random 32-byte hex>` | Run `openssl rand -hex 32` |
| `JWT_ALGORITHM` | `HS256` | |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `15` | |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `7` | |
| `COOKIE_SECURE` | `true` | Required for HTTPS |
| `COOKIE_SAMESITE` | `lax` | Same-origin (Next.js API + frontend on same Vercel app) |
| `MAX_CSV_SIZE_BYTES` | `5242880` | 5 MB |
| `NODE_ENV` | `production` | |

Generate a secure secret:
```bash
openssl rand -hex 32
```

### Step 6 — Deploy

Click **Deploy**. Vercel will:
1. Run `bun install`
2. Run `bun run db:generate && next build`
3. Deploy the serverless Next.js app

Your app will be live at `https://<your-app>.vercel.app`.

### Vercel Notes

- **Cookie SameSite:** Since the frontend and API are on the same Vercel domain, `COOKIE_SAMESITE=lax` works. Only use `none` if you point a custom frontend domain that differs from the API domain (then also ensure `COOKIE_SECURE=true`).
- **Function timeout:** The `vercel.json` sets API routes to 30s max — sufficient for CSV uploads.
- **Re-deploys:** Every push to `main` triggers an automatic re-deploy.
- **Custom domain:** Vercel dashboard → Domains → Add your domain.

---

## Render Deployment

Render runs a **Docker container** with a **persistent disk** — perfect for SQLite with zero extra infrastructure.

### Option A — Blueprint (Recommended, one-click)

The repo includes `render.yaml` which defines the entire service. Render reads it automatically.

1. Push this repo to GitHub or GitLab
2. Go to [dashboard.render.com](https://dashboard.render.com) → **New → Blueprint**
3. Connect your repo — Render detects `render.yaml` and shows a preview of what it will create:
   - Web service: `leetcode-tracker` (Docker, free tier)
   - Persistent disk: 1 GB at `/data` for SQLite
4. Click **Apply** to create the service

### Step 2 — Set Required Env Vars

After the Blueprint is applied, go to your service → **Environment** and set:

| Variable | Value | Notes |
|---|---|---|
| `JWT_SECRET_KEY` | `<random 32-byte hex>` | **Required** — marked `sync: false` in render.yaml, must be set manually |

All other env vars are already set in `render.yaml`:

| Variable | Value |
|---|---|
| `DATABASE_URL` | `file:/data/app.db` |
| `JWT_ALGORITHM` | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `15` |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `7` |
| `COOKIE_SECURE` | `true` |
| `COOKIE_SAMESITE` | `none` |
| `MAX_CSV_SIZE_BYTES` | `5242880` |
| `NODE_ENV` | `production` |

Generate a secret:
```bash
openssl rand -hex 32
```

### Step 3 — Deploy

Render builds the Docker image and deploys. First build takes ~5 minutes. On every push to `main`, it auto-deploys.

Your app is live at `https://leetcode-tracker.onrender.com` (or your chosen service name).

### What Happens on Each Deploy

The `docker-entrypoint.sh` runs on every container start:
1. Ensures `/data` directory exists
2. Runs `prisma db push` — creates tables if missing (safe to run repeatedly)
3. Runs `prisma generate` — ensures the Prisma client is up to date
4. Starts the Next.js standalone server on port 3000

Health check is at `/api/health` — Render polls this to confirm the service is up.

### Option B — Manual Docker Service (without Blueprint)

If you prefer to configure manually:

1. Render dashboard → **New → Web Service**
2. Connect your repo
3. Set:
   - **Runtime**: Docker
   - **Dockerfile path**: `./Dockerfile`
   - **Plan**: Free
4. Add a **Disk**: mount path `/data`, size 1 GB
5. Set all env vars from the table above (including `JWT_SECRET_KEY`)

### Option C — Render with PostgreSQL

If you prefer PostgreSQL on Render (e.g., for multiple app instances):

1. Create a **Render PostgreSQL** database (New → PostgreSQL)
2. Copy the **Internal Database URL**
3. Switch Prisma to the PostgreSQL schema:
   ```bash
   cp prisma/schema.postgres.prisma prisma/schema.prisma
   git add prisma/schema.prisma && git commit -m "chore: postgres schema" && git push
   ```
4. Set `DATABASE_URL` to the Render Postgres internal URL in your web service env vars
5. Remove the disk mount (not needed for Postgres)

### Render Notes

- **Free tier spin-down:** Free web services spin down after 15 minutes of inactivity. First request after spin-down takes ~30s. Upgrade to the Starter plan ($7/mo) to avoid this.
- **Persistent disk:** The 1 GB disk at `/data` persists across deploys and restarts. SQLite data is safe.
- **Auto-deploy:** `autoDeploy: true` in `render.yaml` means every push to your default branch triggers a new build.
- **Custom domain:** Render dashboard → your service → Settings → Custom Domains.

---

## Environment Variables Reference

Complete list of all env vars used by the app:

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | ✅ | — | SQLite: `file:/data/app.db` · Postgres: `postgresql://...` |
| `JWT_SECRET_KEY` | ✅ | — | Secret for signing JWTs. Use `openssl rand -hex 32` |
| `JWT_ALGORITHM` | ✅ | `HS256` | JWT signing algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | ✅ | `15` | Access token TTL in minutes |
| `REFRESH_TOKEN_EXPIRE_DAYS` | ✅ | `7` | Refresh token TTL in days |
| `COOKIE_SECURE` | ✅ | `true` | Set `true` for HTTPS (always in production) |
| `COOKIE_SAMESITE` | ✅ | `lax` | `lax` for same-origin · `none` for cross-origin (requires HTTPS) |
| `MAX_CSV_SIZE_BYTES` | ❌ | `5242880` | Max CSV upload size (5 MB) |
| `NODE_ENV` | ❌ | `production` | Node environment |

---

## Troubleshooting

### "Database not found" on Vercel
- Confirm `DATABASE_URL` is set in Vercel env vars and points to a live Postgres instance
- Confirm you ran `bun run db:push` with the Postgres schema before deploying

### Refresh cookie not sent (401 on token refresh)
- Check `COOKIE_SECURE=true` and your site is on HTTPS
- If frontend and API are on different domains, set `COOKIE_SAMESITE=none`
- Browsers block `SameSite=None` cookies over HTTP — HTTPS is mandatory

### Render service slow on first request
- Free tier spins down after inactivity. Expected behavior. Upgrade plan to disable.

### CSV upload fails
- Check `MAX_CSV_SIZE_BYTES` is set (default 5 MB)
- Verify the CSV header matches one of the two supported formats (see README)

### Prisma client not generated (Vercel build error)
- The `vercel.json` `buildCommand` runs `bun run db:generate && next build`
- If you customized the build command, ensure `prisma generate` runs before `next build`

### SQLite data lost after Render deploy
- Confirm the disk is mounted at `/data` and `DATABASE_URL=file:/data/app.db`
- The disk persists across deploys — data loss only happens if you delete the disk

---

## Post-Deployment Checklist

- [ ] App loads at your deployment URL
- [ ] Register a new account
- [ ] Upload a CSV and verify questions appear
- [ ] Mark a question solved — confirm it syncs across sheets
- [ ] Check `/api/health` returns `{ "status": "ok", "db": "ok" }`
- [ ] Confirm HTTPS is active (required for cookies)
- [ ] Dark/light theme toggle works
