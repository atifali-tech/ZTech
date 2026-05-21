# ZTech CRM — Production Go-Live Checklist
**System:** ZingParks Operations CRM (ZTech/ZPOP)  
**Last updated:** 2026-05-21

Work through this list top to bottom before pointing real traffic at the system. Tick each item off only when verified in production (or staging equivalent), not just in development.

---

## Phase 1 — Infrastructure Setup

- [ ] **Server provisioned** — minimum 2 vCPU, 4 GB RAM, 40 GB SSD
- [ ] **Operating system** — Ubuntu 22.04 LTS (or equivalent), fully updated
- [ ] **Firewall configured** — only ports 22 (SSH), 80, 443 open externally; 5432 (Postgres) blocked
- [ ] **SSH key access** — password login disabled; root login disabled
- [ ] **Swap space** — at least 2 GB swap configured (helps under memory pressure)
- [ ] **Hostname / DNS** — A record for `app.yourdomain.com` pointing to server IP

---

## Phase 2 — Application Deployment

- [ ] **Repository cloned** at `/opt/zingparks` (or equivalent)
- [ ] **Backend dependencies** installed: `cd backend && npm ci --omit=dev`
- [ ] **Frontend built**: `cd frontend && npm ci && npm run build`
- [ ] **`backend/.env` populated** — all required variables set (see [Environment Variables](#environment-variables))
- [ ] **No placeholder secrets** in `.env` (JWT_SECRET, DB_PASSWORD must not contain `changeme`)

---

## Phase 3 — Database

- [ ] **PostgreSQL 15 running** and accessible by the backend
- [ ] **Database created**: `CREATE DATABASE zingparks;`
- [ ] **Database user** created with limited privileges (not `postgres` superuser preferred)
- [ ] **Migrations applied**: `npm run migrate:status` shows all files `✅ applied`
- [ ] **RBAC tables seeded**: roles, permissions, role_permissions populated (run seeding scripts if needed)
- [ ] **Super Admin user** created and login tested
- [ ] **Port 5432 not reachable externally**: `nmap -p 5432 <server-ip>` shows filtered/closed

---

## Phase 4 — Security

- [ ] **JWT_SECRET** is at least 48 characters, randomly generated, unique to this environment
- [ ] **`NODE_ENV=production`** set in backend `.env`
- [ ] **`TRUST_PROXY=1`** set (behind nginx/Caddy)
- [ ] **`CORS_ORIGINS`** set to exact production frontend URL — no wildcards
- [ ] **`secure=true`** cookie confirmed: inspect browser cookies, `Secure` flag must be present
- [ ] **`sameSite=strict`** cookie confirmed: visible in Set-Cookie response header
- [ ] **Helmet headers** present: check `X-Content-Type-Options: nosniff` in API responses
  ```bash
  curl -I https://app.yourdomain.com/api/health
  ```
- [ ] **Rate limiting active**: verify 20 login attempts triggers 429 response
  ```bash
  for i in {1..21}; do
    curl -s -o /dev/null -w "%{http_code}\n" \
      -X POST https://app.yourdomain.com/api/auth/login \
      -H 'Content-Type: application/json' \
      -d '{"email":"bad@test.com","password":"wrong"}'
  done
  ```
- [ ] **Env validation**: server rejects startup if `JWT_SECRET` is absent
- [ ] **No raw DB errors** in API responses (check 500 responses return generic "Server error")
- [ ] **`.env` file permissions**: `chmod 600 backend/.env`

---

## Phase 5 — Reverse Proxy + SSL

- [ ] **Nginx installed** and `nginx -t` passes
- [ ] **Site config created** at `/etc/nginx/sites-available/zingparks` and symlinked
- [ ] **Let's Encrypt certificate** issued: `certbot --nginx -d app.yourdomain.com`
- [ ] **HTTP → HTTPS redirect** active: `curl -I http://app.yourdomain.com` returns `301`
- [ ] **HTTPS working**: `curl -I https://app.yourdomain.com` returns `200`
- [ ] **HSTS header** present: `Strict-Transport-Security` in response
- [ ] **SSL Labs grade** A or above: https://www.ssllabs.com/ssltest/

---

## Phase 6 — Process Management

**PM2 deployment:**
- [ ] PM2 installed globally: `pm2 --version`
- [ ] Services started: `pm2 start ecosystem.config.js --env production`
- [ ] PM2 autostart configured: `pm2 save && pm2 startup` (follow printed instructions)
- [ ] Both processes show `online`: `pm2 status`

**Docker deployment:**
- [ ] Services running: `docker compose -f docker-compose.prod.yml ps` shows all `healthy`
- [ ] Restart policy `always` set in docker-compose.prod.yml ✅ (already configured)

---

## Phase 7 — Health Checks

- [ ] **Backend health**: `curl https://app.yourdomain.com/api/health` returns `{"status":"ok","database":"connected"}`
- [ ] **Frontend loads**: `curl -I https://app.yourdomain.com` returns `200`
- [ ] **Login flow** works end-to-end in browser
- [ ] **Dashboard data** loads (KPIs, tickets, parks)
- [ ] **RBAC enforcement** verified: Cashier cannot access `/admin/users`
- [ ] **Park scoping** verified: Park Manager only sees their park's data

---

## Phase 8 — Backup + Monitoring

- [ ] **Backup cron installed** (see `docs/db-operations.md` Section 2)
- [ ] **Test restore** performed: restore from latest backup to a staging DB and verify row counts
- [ ] **Log rotation configured**: `logrotate` for PM2 logs in `/opt/zingparks/logs/`
- [ ] **Disk space monitored**: alert if `/var/lib/postgresql` exceeds 80% capacity
- [ ] **Uptime monitoring** set up (UptimeRobot, Freshping, or equivalent) for `https://app.yourdomain.com/api/health`

---

## Phase 9 — Final Smoke Test

Run these end-to-end tests as each role before signing off:

| Role | Tests |
|------|-------|
| Super Admin | Login · dashboard · create park · create user · manage roles |
| Corporate Admin | Dashboard · analytics · view users (no create) |
| Finance Head | Finance dashboard · approve refund · approve settlement |
| Park Manager | Dashboard (scoped) · create ticket · view parks |
| Cashier | Create ticket · view own tickets only |
| Authority User | Read-only dashboard · no edit actions visible |

---

## Environment Variables

All of these must be set before go-live:

| Variable | Status | Notes |
|----------|--------|-------|
| `JWT_SECRET` | ✅ Required | min 32 chars, random, unique |
| `DB_PASSWORD` | ✅ Required | Strong password |
| `CORS_ORIGINS` | ✅ Required in prod | Exact origin URL |
| `FRONTEND_URL` | ✅ Required in prod | Same as CORS_ORIGINS usually |
| `NODE_ENV` | ✅ Set to `production` | |
| `TRUST_PROXY` | ✅ Set to `1` | If behind nginx/Caddy |
| `DB_HOST` | Set if not localhost | |
| `DB_NAME` | Set if not `zingparks` | |

---

## Known Limitations at Go-Live

These are documented in `docs/technical-debt.md` and do not block go-live but should be tracked:

| Limitation | Debt ID | Impact |
|------------|---------|--------|
| GST calculation hardcoded to 0 | FIN-01 | Tax filings will be incorrect |
| Single-instance only (no horizontal scale) | RBAC-02 | Cannot run >1 backend process |
| Login rate limiting is IP-based only | SEC-06 | No per-account lockout |
| Settlement submitter notifications may fail | ARCH-07 | Type mismatch — notifications silently dropped |
| Notification delivery is polling only (30s lag) | NOTIF-01 | Not real-time |

---

*Sign-off required from:*  
- [ ] Engineering lead  
- [ ] QA  
- [ ] Operations / DevOps
