# ZTech CRM — Deployment Guide
**System:** ZingParks Operations CRM (ZTech/ZPOP)  
**Stack:** Node.js/Express API · PostgreSQL 15 · Next.js 15  
**Last updated:** 2026-05-21

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Deployment Options](#2-deployment-options)
3. [Option A: Docker Compose (Recommended)](#3-option-a-docker-compose-recommended)
4. [Option B: VPS + PM2 + Nginx (Bare-Metal)](#4-option-b-vps--pm2--nginx-bare-metal)
5. [Environment Variables Reference](#5-environment-variables-reference)
6. [SSL / TLS Configuration](#6-ssl--tls-configuration)
7. [First-Deploy Checklist](#7-first-deploy-checklist)
8. [Upgrade / Rollback Procedure](#8-upgrade--rollback-procedure)

---

## 1. Architecture Overview

```
Internet
    │
    ▼
[Nginx / Caddy]  ← SSL termination, reverse proxy
    │
    ├── /          → Next.js frontend  (port 3000)
    └── /api/*     → Express backend   (port 4000)
                             │
                             ▼
                     [PostgreSQL 15]  (port 5432, internal only)
```

**Key points:**
- The backend API is never exposed directly to the internet — only through the reverse proxy.
- PostgreSQL port 5432 must **not** be open to external traffic.
- The frontend is a Next.js standalone build; it does not need a separate Node.js process in Docker mode.
- Both services are stateless; session state lives in signed JWTs and the PostgreSQL `token_version` column.

---

## 2. Deployment Options

| Option | When to Use | Complexity | Scaling |
|--------|------------|------------|---------|
| **Docker Compose** | VPS, single-server cloud | Low | Vertical only |
| **PM2 + Nginx (bare-metal)** | Existing server, no Docker | Low | Vertical only |
| **Kubernetes** | Not recommended at current scale | High | Horizontal |

**Constraint:** The permCache is in-process memory. Until Redis is added (see RBAC-02 in technical-debt.md), run **exactly one** backend instance. Do not use PM2 cluster mode or Docker replica scaling.

---

## 3. Option A: Docker Compose (Recommended)

### Prerequisites

- Docker Engine 24+
- Docker Compose v2.20+
- Reverse proxy (Nginx or Caddy) for SSL on the host

### Step-by-step

**1. Clone the repository and enter the project root:**
```bash
git clone <repo-url> zingparks
cd zingparks
```

**2. Create production environment file:**
```bash
cp backend/.env.example .env.prod
# Edit .env.prod and fill in all required values (see Section 5).
nano .env.prod
```

**3. Build images:**
```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod build
```

**4. Run database migrations (first time only, or after schema changes):**
```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod \
  run --rm backend node scripts/migrate.js
```

**5. Start services:**
```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
```

**6. Verify health:**
```bash
curl http://localhost:4000/api/health
# Expected: {"status":"ok","database":"connected"}
```

**7. Configure Nginx to proxy requests (see Section 6).**

### Persistent data

PostgreSQL data is stored in the `pgdata_prod` Docker volume. To back up:
```bash
docker exec <postgres-container-name> \
  pg_dump -U postgres zingparks | gzip > backup_$(date +%Y%m%d).sql.gz
```

---

## 4. Option B: VPS + PM2 + Nginx (Bare-Metal)

### Prerequisites

- Ubuntu 22.04 LTS (or equivalent)
- Node.js 20 LTS
- PostgreSQL 15
- PM2 (`npm install -g pm2`)
- Nginx

### Step-by-step

**1. Install dependencies and clone repo:**
```bash
sudo apt-get update && sudo apt-get install -y nginx postgresql-15
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
npm install -g pm2
git clone <repo-url> /opt/zingparks
cd /opt/zingparks
```

**2. Set up PostgreSQL:**
```bash
sudo -u postgres psql -c "CREATE DATABASE zingparks;"
sudo -u postgres psql -c "CREATE USER zingadmin WITH PASSWORD 'your_strong_password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE zingparks TO zingadmin;"
```

**3. Install backend dependencies:**
```bash
cd /opt/zingparks/backend
npm ci --omit=dev
cp .env.example .env
nano .env   # fill in all values
```

**4. Install frontend dependencies and build:**
```bash
cd /opt/zingparks/frontend
npm ci
NEXT_PUBLIC_API_URL=https://api.yourdomain.com npm run build
```

**5. Run database migrations:**
```bash
cd /opt/zingparks/backend
npm run migrate
```

**6. Start with PM2:**
```bash
cd /opt/zingparks
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup   # follow printed instructions to enable autostart
```

**7. Configure Nginx (see Section 6).**

---

## 5. Environment Variables Reference

All variables must be set before starting the server. See `backend/.env.example` for the full annotated template.

| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET` | **Yes** | Min 32 chars. Unique per environment. Never share between staging/prod. |
| `DB_PASSWORD` | **Yes** | PostgreSQL password for `DB_USER`. |
| `CORS_ORIGINS` | **Yes (prod)** | Comma-separated list of allowed frontend origins. |
| `FRONTEND_URL` | **Yes (prod)** | Primary frontend origin (fallback if CORS_ORIGINS unset). |
| `DB_HOST` | No | Default: `localhost`. In Docker: `postgres`. |
| `DB_PORT` | No | Default: `5432`. |
| `DB_NAME` | No | Default: `zingparks`. |
| `DB_USER` | No | Default: `postgres`. |
| `PORT` | No | Backend listen port. Default: `4000`. |
| `NODE_ENV` | No | `production` or `development`. Default: `development`. |
| `TRUST_PROXY` | No | Set to `1` when behind nginx/Caddy (fixes rate limiter IP detection). |

**Generate a strong JWT_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

---

## 6. SSL / TLS Configuration

### Nginx reverse proxy config

Create `/etc/nginx/sites-available/zingparks`:

```nginx
# Redirect HTTP → HTTPS
server {
    listen 80;
    server_name app.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name app.yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/app.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.yourdomain.com/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    # Security headers (supplement helmet.js on the backend)
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;

    # Frontend (Next.js)
    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api/ {
        proxy_pass         http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 30s;
        client_max_body_size 2m;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/zingparks /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# SSL certificate via Let's Encrypt
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d app.yourdomain.com
```

---

## 7. First-Deploy Checklist

See `docs/production-checklist.md` for the full go-live checklist.

Quick summary:
- [ ] All environment variables set and validated (`node scripts/migrate.js --status`)
- [ ] Database migrations applied
- [ ] Health endpoint returns `{"status":"ok","database":"connected"}`
- [ ] SSL certificate installed and HTTPS enforced
- [ ] `TRUST_PROXY=1` set (if behind nginx/Caddy)
- [ ] Backup strategy configured (see `docs/db-operations.md`)
- [ ] PM2 startup configured / Docker restart policy set to `always`

---

## 8. Upgrade / Rollback Procedure

### Upgrade

```bash
git pull origin master

# Backend
cd backend && npm ci --omit=dev

# Frontend
cd ../frontend && npm ci && npm run build

# Run any new migrations
cd ../backend && npm run migrate:status   # review what will be applied
npm run migrate

# Restart services
pm2 restart all   # or: docker compose -f docker-compose.prod.yml up -d --build
```

### Rollback

Migrations are **not** automatically reversed — they are additive (`IF NOT EXISTS`). If a deployment causes issues:

1. Roll back application code with `git checkout <previous-tag>`.
2. Rebuild and redeploy the previous version.
3. If the new migration added a column that broke things, consult `docs/db-operations.md` for manual reversal.
4. Do **not** drop tables unless you have verified a recent backup.

See `docs/db-operations.md` for restore-from-backup instructions.
