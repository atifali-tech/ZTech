# ZTech CRM — Technical Debt Backlog
**System:** ZingParks Operations CRM (ZTech/ZPOP)  
**Architecture:** Node.js + Express v5 API · PostgreSQL · Next.js 15 App Router  
**Branch:** `dashboard-redesign`  
**Document date:** 2026-05-20  
**Source of truth:** Phase 7–17 audit (security hardening, UX stabilization, test coverage, RBAC, finance/refund workflow, notification layer, UX/accessibility polish)

---

## Priority Classification

| Tag | Meaning |
|-----|---------|
| 🔴 **BLOCKER** | Must be resolved before any public/production release |
| 🟠 **SHORT-TERM** | Should be resolved within the next 1–2 sprints |
| 🟡 **LONG-TERM** | Planned architectural improvements, no active production risk |
| ✅ **RESOLVED** | Fixed in Phase 10 or later (as of 2026-05-20) |

---

## Table of Contents

1. [Security Debt](#1-security-debt)
2. [RBAC / Auth Debt](#2-rbac--auth-debt)
3. [Performance Debt](#3-performance-debt)
4. [UX Debt](#4-ux-debt)
5. [Architecture Debt](#5-architecture-debt)
6. [Testing Debt](#6-testing-debt)
7. [Analytics Debt](#7-analytics-debt)
8. [Finance / Governance Debt](#8-finance--governance-debt)
9. [Notifications & Workflow Debt](#9-notifications--workflow-debt)
10. [Consolidated Priority Matrix](#10-consolidated-priority-matrix)

---

## 1. Security Debt

---

### SEC-01 · Hardcoded JWT Secret Fallback
**Priority:** ✅ RESOLVED — Phase 10 · `backend/lib/env.js`, `middleware/auth.js`, `routes/auth.js`  
**Severity:** Critical  
**Risk Level:** HIGH

**Impact:** If `JWT_SECRET` is absent from `.env`, the server silently falls back to the literal string `'zingparks_dev_secret_change_in_prod'`. Any attacker who reads the source code (e.g., via a leaked repo or public GitHub) can forge valid JWTs for any user, including Super Admin.

**Affected Files/Modules:**
- `backend/middleware/auth.js:3`
- `backend/routes/auth.js:8`

**Observed Code:**
```js
const SECRET = process.env.JWT_SECRET || 'zingparks_dev_secret_change_in_prod';
```

**Recommended Solution:** Remove the fallback entirely. Fail-fast at startup if `JWT_SECRET` is not set:
```js
const SECRET = process.env.JWT_SECRET;
if (!SECRET) { console.error('FATAL: JWT_SECRET not set'); process.exit(1); }
```

**Temporary Mitigation:** Ensure `JWT_SECRET` is set in all deployment environments. Add to CI/CD pre-flight check.

**Implementation Complexity:** Low (30 min)  
**Recommended Phase:** Immediate — before any staging/production deployment

---

### SEC-02 · CORS Allows All Origins with Credentials
**Priority:** ✅ RESOLVED — Phase 10 · `backend/app.js`  
**Severity:** High  
**Risk Level:** HIGH

**Impact:** `cors({ origin: true, credentials: true })` reflects the incoming `Origin` header back, effectively allowing any domain to make credentialed cross-origin requests. This exposes all authenticated API endpoints to CSRF-style attacks from arbitrary websites.

**Affected Files/Modules:**
- `backend/app.js:8`

**Observed Code:**
```js
app.use(cors({ origin: true, credentials: true }));
```

**Recommended Solution:** Whitelist specific frontend origins via environment variable:
```js
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || 'http://localhost:3000').split(',');
app.use(cors({
  origin: (origin, cb) => cb(null, !origin || ALLOWED_ORIGINS.includes(origin)),
  credentials: true,
}));
```

**Temporary Mitigation:** Deploy API and frontend on same origin (reverse proxy), eliminating CORS need.

**Implementation Complexity:** Low (1 hour)  
**Recommended Phase:** Immediate — before any staging/production deployment

---

### SEC-03 · JWT Cookie Missing `Secure` Flag
**Priority:** ✅ RESOLVED — Phase 10 · `backend/routes/auth.js`  
**Severity:** High  
**Risk Level:** HIGH

**Impact:** The auth cookie is set without `secure: true`. Over HTTP (non-HTTPS) connections — including local dev environments that mirror staging — the token is transmitted in plaintext, making it vulnerable to network interception.

**Affected Files/Modules:**
- `backend/routes/auth.js:9`

**Observed Code:**
```js
const COOKIE = { httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 };
```

**Recommended Solution:**
```js
const COOKIE = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};
```

**Temporary Mitigation:** Enforce HTTPS at the infrastructure level (load balancer / reverse proxy).

**Implementation Complexity:** Trivial (5 min)  
**Recommended Phase:** Immediate

---

### SEC-04 · Pre-Migration Permission Bypass in Middleware
**Priority:** 🟠 SHORT-TERM  
**Severity:** Medium  
**Risk Level:** MEDIUM

**Impact:** `requirePermission` silently passes (`next()`) if the `permissions` table doesn't exist (`err.code === '42P01'`). This was added to ease the RBAC migration rollout. Now that all RBAC tables are live, this fallback creates a hidden bypass path — if the DB is misconfigured or tables are accidentally dropped, all permission checks silently pass.

**Affected Files/Modules:**
- `backend/middleware/permission.js:26-28`

**Observed Code:**
```js
if (err.code === '42P01') return next(); // undefined_table
```

**Recommended Solution:** Remove the `42P01` bypass. Replace with an explicit startup assertion that validates RBAC tables exist. Any DB error during a permission check should return 500, not grant access.

**Temporary Mitigation:** Monitor for `42P01` errors in logs. Add DB integrity check to health endpoint.

**Implementation Complexity:** Low (2 hours including startup assertion)  
**Recommended Phase:** Short-term (next sprint)

---

### SEC-05 · parkScope JWT Fallback After Table Miss
**Priority:** 🟠 SHORT-TERM  
**Severity:** Medium  
**Risk Level:** MEDIUM

**Impact:** If `user_parks` table is unavailable, `parkScope` falls back to JWT `parkIds`. JWT data is not refreshed on park reassignment — a user whose park access was revoked retains scope from their old JWT for up to 7 days.

**Affected Files/Modules:**
- `backend/middleware/parkScope.js:30-33`

**Observed Code:**
```js
if (err.code === '42P01') {
  req.scopedParkIds = req.user.parkIds || [];
```

**Recommended Solution:** Remove the `42P01` fallback. If `user_parks` is unavailable, deny access (`scopedParkIds = []`). This is already the behavior for all other DB errors on line 35.

**Temporary Mitigation:** Alert on `42P01` errors in `[parkScope]` log prefix.

**Implementation Complexity:** Trivial (10 min)  
**Recommended Phase:** Short-term

---

### SEC-06 · No Login Rate Limiting / Brute-Force Protection
**Priority:** 🟠 SHORT-TERM  
**Severity:** High  
**Risk Level:** HIGH

**Impact:** `POST /api/auth/login` has no rate limit. An attacker can attempt unlimited password guesses against any known email address. The audit log records failures, but there is no automated lockout or throttle.

**Affected Files/Modules:**
- `backend/routes/auth.js`
- `backend/app.js`

**Recommended Solution:** Add `express-rate-limit` with a per-IP window for login attempts:
```js
const rateLimit = require('express-rate-limit');
app.use('/api/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 20 }));
```
Additionally implement account lockout after N consecutive failures using the `audit_log`.

**Temporary Mitigation:** Block repeated failures at the reverse proxy/WAF level (nginx `limit_req_zone`).

**Implementation Complexity:** Low (2 hours)  
**Recommended Phase:** Short-term

---

### SEC-07 · Raw DB Error Messages Leaked to Client
**Priority:** 🟠 SHORT-TERM  
**Severity:** Medium  
**Risk Level:** MEDIUM

**Impact:** Several routes return `err.message` directly in the response body. PostgreSQL error messages can reveal table names, column names, constraint names, and query fragments — useful for SQL injection reconnaissance.

**Affected Files/Modules:**
- `backend/routes/tickets.js` — `res.status(500).json({ error: err.message })` at two locations
- `backend/routes/tickets.js` — GET handler: `res.status(500).json({ error: err.message })`

**Recommended Solution:** Standardize all 500 handlers to return a generic message. Log the real error server-side:
```js
console.error('[tickets/post]', err);
res.status(500).json({ error: 'Server error' });
```

**Temporary Mitigation:** None — this requires code change.

**Implementation Complexity:** Low (1 hour)  
**Recommended Phase:** Short-term

---

### SEC-08 · No Request Body Size Limit
**Priority:** 🟡 LONG-TERM  
**Severity:** Low  
**Risk Level:** LOW

**Impact:** Express default body parser allows up to 100kb JSON bodies. The batch ticket endpoint (`POST /api/tickets/batch`) accepts up to 500 bookings. A malicious actor could send oversized payloads to exhaust memory.

**Affected Files/Modules:**
- `backend/app.js:10`

**Recommended Solution:**
```js
app.use(express.json({ limit: '1mb' }));
```

**Temporary Mitigation:** Enforce payload limits at reverse proxy.

**Implementation Complexity:** Trivial  
**Recommended Phase:** Long-term

---

## 2. RBAC / Auth Debt

---

### RBAC-01 · No JWT Revocation / Token Blacklist
**Priority:** ✅ RESOLVED — Phase 10 · `tokenVersion` strategy · `backend/lib/sessionCache.js`, `routes/auth.js`, `middleware/auth.js`, `migrations/001_add_token_version.sql`  
**Severity:** High  
**Risk Level:** HIGH

**Impact:** JWTs are valid for 7 days with no server-side revocation mechanism. Logout only clears the client cookie — the token itself remains valid. A stolen token cannot be invalidated. A deprovisioned user (deleted from DB) still has a working JWT until expiry. `GET /api/auth/me` returns 404 after deletion but all other endpoints rely solely on `jwt.verify`.

**Affected Files/Modules:**
- `backend/middleware/auth.js`
- `backend/routes/auth.js` (logout handler)

**Recommended Solution:** Implement a token blacklist (Redis preferred, PostgreSQL table fallback) keyed by JWT `jti` claim. On logout and user deletion, add the JTI to the blacklist. `requireAuth` checks the blacklist after signature verification.

**Temporary Mitigation:** Reduce JWT expiry from 7 days to 24 hours. Enforce immediate deletion checks in high-value endpoints by validating user existence in DB.

**Implementation Complexity:** Medium (1–2 days with Redis, 4 hours with DB table)  
**Recommended Phase:** Short-term — critical for enterprise deployment

---

### RBAC-02 · permCache is Process-Local (Multi-Instance Unsafe)
**Priority:** 🟠 SHORT-TERM  
**Severity:** High  
**Risk Level:** HIGH in multi-server deployments

**Impact:** `permCache` is an in-process `Map`. When running multiple Node.js instances (PM2 cluster, Kubernetes replicas), `permCache.invalidate(roleId)` only clears the cache on the instance that received the `PUT /rbac/roles/:id/permissions` request. Other instances continue serving stale permissions for up to 5 minutes.

**Affected Files/Modules:**
- `backend/lib/permCache.js`
- `backend/routes/rbac.js:55` (invalidate call)

**Recommended Solution:** Replace in-process cache with Redis (preferred) or a `pg_notify`-based invalidation bus. All instances subscribe and clear their local cache on the notify event.

**Temporary Mitigation:** Run single Node.js instance only (no cluster/replicas). Document this constraint.

**Implementation Complexity:** Medium (1 day)  
**Recommended Phase:** Short-term — required before horizontal scaling

---

### RBAC-03 · GLOBAL_ROLES Hardcoded in Middleware
**Priority:** 🟡 LONG-TERM  
**Severity:** Medium  
**Risk Level:** MEDIUM

**Impact:** `GLOBAL_ROLES = new Set(['Super Admin', 'Corporate Admin'])` in `parkScope.js` is a hardcoded list of role names that bypass park scoping. Adding a new global role requires a code deployment. The set is compared by exact name string, making it sensitive to role renames.

**Affected Files/Modules:**
- `backend/middleware/parkScope.js:8`

**Recommended Solution:** Add an `is_global` boolean column to the `roles` table. `parkScope` queries this flag once at startup (or from permCache) instead of matching hardcoded names.

**Temporary Mitigation:** Document the hardcoded list. Add a test that fails if a role named `'Super Admin'` or `'Corporate Admin'` is renamed.

**Implementation Complexity:** Medium (4 hours — DB migration + middleware + tests)  
**Recommended Phase:** Long-term

---

### RBAC-04 · Role Hierarchy is Implicit (ID-Ordered)
**Priority:** 🟡 LONG-TERM  
**Severity:** Medium  
**Risk Level:** MEDIUM

**Impact:** Privilege checking uses `target_role_id <= actor_role_id` to determine hierarchy. This silently assumes role IDs are assigned in descending privilege order (1 = highest). Inserting a new role into the `roles` table without understanding this invariant will silently break privilege escalation guards.

**Affected Files/Modules:**
- `backend/routes/users.js:12-18` (`privilegeError` function)

**Recommended Solution:** Add a `hierarchy_level` column to `roles` (explicit, not derived from ID). Use `hierarchy_level` for all privilege comparisons. Add a DB check constraint to enforce uniqueness and ordering.

**Temporary Mitigation:** Add a comment and a CI test that asserts role ID ordering matches documented hierarchy.

**Implementation Complexity:** Medium (4 hours)  
**Recommended Phase:** Long-term

---

### RBAC-05 · Super Admin Immutability Hardcoded as `roleId === 1`
**Priority:** 🟡 LONG-TERM  
**Severity:** Low  
**Risk Level:** LOW

**Impact:** The check `if (roleId === 1)` in `PUT /api/rbac/roles/:id/permissions` hardcodes Super Admin's DB ID. If roles are re-seeded or IDs change, this protection silently breaks.

**Affected Files/Modules:**
- `backend/routes/rbac.js:51`

**Recommended Solution:** Add an `is_protected` boolean to the `roles` table. Use `WHERE is_protected = true` to identify immutable roles rather than a magic ID.

**Temporary Mitigation:** None required — current code is correct, only fragile.

**Implementation Complexity:** Low  
**Recommended Phase:** Long-term

---

### RBAC-06 · No Multi-Factor Authentication
**Priority:** 🟡 LONG-TERM  
**Severity:** Medium  
**Risk Level:** MEDIUM

**Impact:** High-privilege roles (Super Admin, Corporate Admin) have no MFA requirement. A single compromised password grants full system access including user management, park deletion, and audit log visibility.

**Affected Files/Modules:**
- `backend/routes/auth.js`

**Recommended Solution:** Implement TOTP-based MFA (e.g., `speakeasy`) for roles with `role_id <= 2`. Add `mfa_secret` and `mfa_enabled` columns to `users`. Require OTP on login for MFA-enabled accounts.

**Temporary Mitigation:** Enforce strong password policy. Add IP allowlisting for admin accounts at infrastructure level.

**Implementation Complexity:** High (2–3 days)  
**Recommended Phase:** Long-term

---

## 3. Performance Debt

---

### PERF-01 · parkScope DB Query on Every Authenticated Request
**Priority:** 🟠 SHORT-TERM  
**Severity:** Medium  
**Risk Level:** MEDIUM

**Impact:** `parkScope` middleware executes `SELECT park_id FROM user_parks WHERE user_id = $1` on every request to any park-scoped route (all dashboard, ticket, and park endpoints). At 100 req/s this is 100 additional DB queries per second that could be cached.

**Affected Files/Modules:**
- `backend/middleware/parkScope.js:24-27`

**Recommended Solution:** Add a short TTL (30–60s) user-park assignment cache alongside `permCache`. Invalidate on `PUT /api/users/:id` when `park_ids` changes. Use the same Redis layer as RBAC-02.

**Temporary Mitigation:** Ensure `user_parks` has an index on `user_id` (should already exist from FK). Monitor query latency.

**Implementation Complexity:** Medium (4 hours)  
**Recommended Phase:** Short-term

---

### PERF-02 · Ticket Batch Insert is Sequential (No Transaction)
**Priority:** 🟠 SHORT-TERM  
**Severity:** Medium  
**Risk Level:** MEDIUM

**Impact:** `POST /api/tickets/batch` inserts rows sequentially in a `for` loop. 500 bookings × multiple rows each = potentially 1000+ sequential round-trips. Each insertion is also not wrapped in a transaction — a partial failure leaves orphaned rows without consistent state.

**Affected Files/Modules:**
- `backend/routes/tickets.js:220-230` (batch handler)

**Recommended Solution:** Batch inserts using parameterized multi-row `INSERT ... VALUES ($1,$2,...),($3,$4,...) ON CONFLICT ...`. Wrap the entire batch in a single DB transaction. Use `unnest` for large arrays.

**Temporary Mitigation:** Cap batch size (currently 500 bookings). Monitor batch endpoint latency in production.

**Implementation Complexity:** Medium (4–6 hours)  
**Recommended Phase:** Short-term

---

### PERF-03 · No DB Connection Pool Configuration
**Priority:** 🟡 LONG-TERM  
**Severity:** Low  
**Risk Level:** LOW

**Impact:** `new Pool({ ... })` uses pg defaults (max 10 connections). For a multi-park enterprise deployment with concurrent dashboard, ticket, and analytics queries, the default pool will exhaust quickly under load.

**Affected Files/Modules:**
- `backend/index.js`

**Recommended Solution:** Add explicit pool sizing via environment variables:
```js
const pool = new Pool({ ..., max: parseInt(process.env.DB_POOL_MAX || '20'), idleTimeoutMillis: 30000 });
```

**Temporary Mitigation:** Monitor `pg_stat_activity` for connection counts.

**Implementation Complexity:** Trivial  
**Recommended Phase:** Long-term

---

### PERF-04 · No Pagination on Parks and Roles List Endpoints
**Priority:** 🟡 LONG-TERM  
**Severity:** Low  
**Risk Level:** LOW

**Impact:** `GET /api/parks` and `GET /api/rbac/roles` return unbounded result sets. At enterprise scale (100+ parks), these payloads will grow proportionally and will not be filterable.

**Affected Files/Modules:**
- `backend/routes/parks.js:20-39`
- `backend/routes/rbac.js:13-37`

**Recommended Solution:** Add `page`/`limit` pagination and `search` query parameter to both endpoints, consistent with the tickets API pattern.

**Temporary Mitigation:** Enforce max-park and max-role limits at the business level.

**Implementation Complexity:** Low (2–3 hours each)  
**Recommended Phase:** Long-term

---

### PERF-05 · Dashboard dateSQL Interpolates Strings into Query
**Priority:** 🟠 SHORT-TERM  
**Severity:** Medium  
**Risk Level:** MEDIUM (correctness + potential injection vector)

**Impact:** `dateSQL()` and `prevDateSQL()` in `dashboard.js` interpolate validated date strings directly into SQL text (`DATE '${date}'`). While the regex guard prevents obvious injection, string interpolation into SQL is categorically fragile — any future code path that relaxes validation creates a SQL injection vulnerability. It also prevents parameterized query caching in PostgreSQL.

**Affected Files/Modules:**
- `backend/routes/dashboard.js:23-55`

**Recommended Solution:** Refactor date filtering to pass dates as query parameters, not interpolated strings. Use `$N::date` placeholders throughout.

**Temporary Mitigation:** Regression test the regex guard. Never relax the `^\d{4}-\d{2}-\d{2}$` validation.

**Implementation Complexity:** Medium (4 hours, affects all dashboard endpoints)  
**Recommended Phase:** Short-term

---

## 4. UX Debt

---

### UX-01 · Inconsistent Error Response Schema
**Priority:** 🟠 SHORT-TERM  
**Severity:** Medium  
**Risk Level:** MEDIUM

**Impact:** Different routes return different error shapes. Frontend must handle all variants defensively:
- `{ error: 'string' }` — most routes
- `{ error: 'string', details: [...] }` — tickets validation
- `{ error: err.message }` — raw DB error (tickets route)
- `{ required: 'perm' }` — permission middleware adds extra field

This inconsistency makes unified frontend error handling impossible and prevents standardized user-facing error messages.

**Affected Files/Modules:**
- `backend/middleware/permission.js:19`
- `backend/routes/tickets.js` (multiple locations)
- All route files

**Recommended Solution:** Establish a single error response factory:
```js
// lib/apiError.js
const apiError = (res, status, message, meta = {}) =>
  res.status(status).json({ error: message, ...meta });
```
Apply uniformly. Remove `required: perm` from 403 responses (information disclosure).

**Temporary Mitigation:** Document all error shapes for frontend team.

**Implementation Complexity:** Medium (2–3 hours)  
**Recommended Phase:** Short-term

---

### UX-02 · No Park Archive / Soft-Delete
**Priority:** 🟡 LONG-TERM  
**Severity:** Medium  
**Risk Level:** LOW

**Impact:** `DELETE /api/parks/:id` returns 409 if any tickets exist and suggests "Archive instead." — but no archive endpoint or `archived_at` column exists. Park managers have no way to deactivate a closed park. Tickets referencing the park become orphaned if the park is force-deleted.

**Affected Files/Modules:**
- `backend/routes/parks.js:70-77`
- Database schema (`parks` table)

**Recommended Solution:** Add `archived_at TIMESTAMPTZ` column to `parks`. Add `PUT /api/parks/:id/archive` endpoint. Filter archived parks from all list and scope queries by default; add `?include_archived=true` flag for admins.

**Temporary Mitigation:** Document that parks with tickets cannot be deleted. Train admins.

**Implementation Complexity:** Medium (4–6 hours — migration + route + frontend filter)  
**Recommended Phase:** Long-term

---

### UX-03 · Weak Password Policy
**Priority:** 🟡 LONG-TERM  
**Severity:** Low  
**Risk Level:** LOW

**Impact:** Password validation only checks `length >= 8`. No complexity requirements (uppercase, number, symbol). For an enterprise system with PII and financial data, this is below acceptable standard.

**Affected Files/Modules:**
- `backend/routes/users.js:89`
- `backend/routes/auth.js:52`

**Recommended Solution:**
```js
function validatePassword(p) {
  return p.length >= 10 && /[A-Z]/.test(p) && /[0-9]/.test(p) && /[^A-Za-z0-9]/.test(p);
}
```
Return a descriptive error listing all unmet criteria.

**Temporary Mitigation:** Document password requirements for admins creating users.

**Implementation Complexity:** Low (1 hour)  
**Recommended Phase:** Long-term

---

### UX-04 · Park ID Has No Format Enforcement
**Priority:** 🟡 LONG-TERM  
**Severity:** Low  
**Risk Level:** LOW

**Impact:** `POST /api/parks` accepts any string as a park ID up to 10 characters. Production parks use format `ZP001` (2-letter prefix + 3-digit number), but this is not enforced. A miscreated park ID (`'my park'`, `'1'`, `'TEST'`) creates irreversible data inconsistency since park ID is the FK used across tickets, analytics, and user assignments.

**Affected Files/Modules:**
- `backend/routes/parks.js:44-46` (`generateParkId` function)

**Recommended Solution:** Add a `PARK_ID_PATTERN = /^[A-Z]{2,4}\d{3,6}$/` validation. Reject IDs that don't match. The `generateParkId` function should also follow this pattern.

**Temporary Mitigation:** Train admins on the ID format convention.

**Implementation Complexity:** Low (1 hour)  
**Recommended Phase:** Long-term

---

### UX-05 · Delete Buttons Use Wrong Icon (`file` instead of trash)
**Priority:** 🟠 SHORT-TERM  
**Severity:** Low  
**Risk Level:** LOW

**Impact:** In `AdminParksClient.jsx:130` and `AdminUsersClient.jsx:143`, the delete action button renders `<Icon name="file" size={13}/>`. This is a copy-paste error — users see a file icon where they expect a trash/delete icon. The action itself works correctly; only the visual affordance is wrong.

**Affected Files/Modules:**
- `frontend/src/components/AdminParksClient.jsx:130`
- `frontend/src/components/AdminUsersClient.jsx:143`

**Recommended Solution:** Replace `name="file"` with `name="trash"` (or whichever trash icon key is registered in `Icon.jsx`) on all delete buttons.

**Temporary Mitigation:** None — cosmetic only, no functional impact.

**Implementation Complexity:** Trivial (5 min)  
**Recommended Phase:** Short-term

---

## 5. Architecture Debt

---

### ARCH-01 · Business Logic Embedded in Route Handlers
**Priority:** 🟡 LONG-TERM  
**Severity:** Medium  
**Risk Level:** LOW (maintenance risk, not runtime risk)

**Impact:** Core business logic lives directly in route files rather than a service layer:
- `expandBooking()` and `validateBooking()` in `routes/tickets.js`
- `privilegeError()` in `routes/users.js`
- `generateParkId()` in `routes/parks.js`
- `dateSQL()` and `prevDateSQL()` in `routes/dashboard.js`

This makes unit testing impossible without starting an HTTP server, and logic cannot be shared across routes or background jobs.

**Affected Files/Modules:**
- `backend/routes/tickets.js`
- `backend/routes/users.js`
- `backend/routes/parks.js`
- `backend/routes/dashboard.js`

**Recommended Solution:** Introduce a `backend/services/` layer. Move business logic to `services/tickets.js`, `services/parks.js`, `services/users.js`, `services/dashboard.js`. Routes become thin adapters (parse → call service → respond).

**Temporary Mitigation:** The current structure is testable via integration tests. Acceptable until a service needs to be called from multiple routes or a background job.

**Implementation Complexity:** High (2–3 days of refactoring + regression testing)  
**Recommended Phase:** Long-term

---

### ARCH-02 · No Database Migration System
**Priority:** 🟠 SHORT-TERM  
**Severity:** High  
**Risk Level:** HIGH

**Impact:** Schema changes are applied manually via SQL scripts or ad-hoc `ALTER TABLE` statements. There is no version-controlled migration history. The test suite's `globalSetup.js` independently maintains its own schema definition that diverges from `schema.sql`. A schema change requires updating both files manually, and there is no guarantee they stay in sync.

**Affected Files/Modules:**
- `backend/tests/setup/globalSetup.js` (duplicated schema)
- `schema.sql` (if it exists)

**Recommended Solution:** Adopt a migration tool (Flyway, Liquibase, or `node-pg-migrate`). Each schema change becomes a numbered migration file. Tests run migrations against the test DB instead of maintaining a parallel schema definition.

**Temporary Mitigation:** Mandate that any schema change updates both `schema.sql` and `globalSetup.js` in the same PR.

**Implementation Complexity:** High (1–2 days to migrate existing schema + set up tooling)  
**Recommended Phase:** Short-term — critical before the next schema change

---

### ARCH-03 · No Structured Logging
**Priority:** 🟡 LONG-TERM  
**Severity:** Medium  
**Risk Level:** LOW

**Impact:** All logging is `console.error('[module]', err.message)`. No log levels, no request correlation IDs, no structured JSON output. In production, logs are unqueryable and cannot be shipped to a log aggregator (Datadog, CloudWatch, Elastic) with useful context.

**Affected Files/Modules:**
- All route files, middleware, `lib/audit.js`

**Recommended Solution:** Introduce `pino` or `winston`. Structured logs with fields: `level`, `time`, `requestId`, `userId`, `action`, `error`. Pass a logger instance via `app.locals.logger`.

**Temporary Mitigation:** Add request ID middleware (`express-request-id`) and include it in console.error calls.

**Implementation Complexity:** Medium (1 day)  
**Recommended Phase:** Long-term

---

### ARCH-04 · No API Versioning
**Priority:** 🟡 LONG-TERM  
**Severity:** Low  
**Risk Level:** LOW

**Impact:** All routes are mounted at `/api/*` with no version prefix. Any breaking API change will break existing frontend clients immediately. The mobile/POS clients (which send batch tickets) are especially vulnerable as they cannot be force-updated instantly.

**Affected Files/Modules:**
- `backend/app.js` (all route mounts)

**Recommended Solution:** Introduce `/api/v1/` prefix for all routes. The current `/api/*` paths can remain as aliases with a deprecation header during transition.

**Temporary Mitigation:** Document that the API is v1 and must not have breaking changes without a version bump.

**Implementation Complexity:** Low (2 hours + frontend URL update)  
**Recommended Phase:** Long-term

---

### ARCH-05 · No Input Validation Framework
**Priority:** 🟡 LONG-TERM  
**Severity:** Medium  
**Risk Level:** LOW

**Impact:** Request validation is hand-rolled per route. Each route has its own ad-hoc `if (!field)` checks with inconsistent coverage. No schema-level type coercion, no shared reusable validators. Adding a new field to any endpoint requires auditing every route manually.

**Affected Files/Modules:**
- All route files

**Recommended Solution:** Introduce `zod` (preferred for TypeScript parity) or `joi` for request schema validation. Define schemas in `backend/schemas/`. Validation middleware parses and transforms `req.body` before it reaches route handlers.

**Temporary Mitigation:** Integration test suite provides regression coverage for current validation behavior.

**Implementation Complexity:** High (2–3 days to migrate all routes)  
**Recommended Phase:** Long-term

---

### ARCH-06 · Test Setup Does Not Run Migration Files
**Priority:** 🟠 SHORT-TERM  
**Severity:** High  
**Risk Level:** HIGH

**Impact:** `backend/tests/setup/globalSetup.js` defines the full DB schema inline rather than running the numbered migration files in `backend/migrations/`. Migration `004_notifications.sql` (notifications + workflow_events tables, added Phase 16) must be manually reflected in `globalSetup.js` or tests that touch those tables will fail with `relation does not exist`. This is the same root problem as TEST-01 / ARCH-02 but made more acute now that there are 4 migration files and the migration directory is the primary schema source of truth.

**Affected Files/Modules:**
- `backend/tests/setup/globalSetup.js`
- `backend/migrations/001_add_token_version.sql`
- `backend/migrations/002_analytics_tables.sql`
- `backend/migrations/003_finance_tables.sql`
- `backend/migrations/004_notifications.sql`

**Recommended Solution:** Replace the inline `CREATE TABLE` block in `globalSetup.js` with a loop that reads and executes each file from `backend/migrations/` in numeric order. This guarantees the test schema is always identical to the production schema.

**Temporary Mitigation:** PR checklist: any new migration file must be reflected in `globalSetup.js` in the same commit. The `backend/tests/helpers/db.js` TRUNCATE list must also be updated to include new tables.

**Implementation Complexity:** Low (2–3 hours)  
**Recommended Phase:** Short-term — required before any future schema change

---

### ARCH-07 · `settlement_periods.submitted_by` Type Mismatch
**Priority:** 🟠 SHORT-TERM  
**Severity:** Medium  
**Risk Level:** MEDIUM

**Impact:** `settlement_periods.submitted_by` is `INTEGER` (migration `003_finance_tables.sql`) while `users.id` is `VARCHAR(36)` (UUID). The FK relationship is broken at the type level — no FK constraint exists, and any attempt to notify the settlement submitter via `notify(pool, { userId: String(sp.submitted_by) })` silently fails because the cast integer string `'3'` will never match a UUID in `notifications.user_id`. Approved/disputed settlement notifications are silently dropped.

**Affected Files/Modules:**
- `backend/migrations/003_finance_tables.sql` (`settlement_periods.submitted_by INTEGER`)
- `backend/routes/finance.js` (settlement approve/dispute notify calls)
- `backend/lib/notifier.js` (`notify` function — receives wrong type)

**Recommended Solution:** Migrate `settlement_periods.submitted_by` to `VARCHAR(36)`. Add a proper FK to `users(id)`. Update `routes/finance.js` to remove the `String()` cast workaround.

**Temporary Mitigation:** Current `.catch()` wrappers prevent the type mismatch from crashing the route. Settlement submitters simply do not receive in-app notifications for approve/dispute actions until this is fixed.

**Implementation Complexity:** Low (2 hours — migration + update route + test)  
**Recommended Phase:** Short-term

---

## 6. Testing Debt

---

### TEST-01 · Test DB Schema Diverges from Production Schema
**Priority:** 🟠 SHORT-TERM  
**Severity:** High  
**Risk Level:** HIGH

**Impact:** `backend/tests/setup/globalSetup.js` defines the full DB schema independently, not by running `schema.sql`. The two schemas can drift silently. A column added to production `schema.sql` that isn't reflected in `globalSetup.js` means integration tests pass while production queries fail.

**Affected Files/Modules:**
- `backend/tests/setup/globalSetup.js`
- `schema.sql`

**Recommended Solution:** As part of ARCH-02 (migration system), the test setup should run migrations against the test DB rather than maintaining its own schema. Until then, add a CI step that diffs `globalSetup.js`'s `CREATE TABLE` statements against `schema.sql`.

**Temporary Mitigation:** PR checklist item: "Does this schema change update both `schema.sql` and `globalSetup.js`?"

**Implementation Complexity:** Dependent on ARCH-02  
**Recommended Phase:** Short-term

---

### TEST-02 · No Unit Tests for Business Logic Functions
**Priority:** 🟠 SHORT-TERM  
**Severity:** Medium  
**Risk Level:** MEDIUM

**Impact:** All pure functions — `expandBooking`, `validateBooking`, `privilegeError`, `generateParkId`, `dateSQL`, `prevDateSQL`, `pct`, `parkSQL` — are only tested indirectly through integration tests. A regression in payment proration math (`expandBooking`) or date range logic (`dateSQL`) will not be caught by a fast unit test; it requires a full DB-backed integration run.

**Affected Files/Modules:**
- `backend/routes/tickets.js` (expandBooking, validateBooking)
- `backend/routes/users.js` (privilegeError)
- `backend/routes/parks.js` (generateParkId)
- `backend/routes/dashboard.js` (dateSQL, prevDateSQL, pct, parkSQL)

**Recommended Solution:** Extract business logic to `services/` (see ARCH-01). Write unit tests for each pure function in `tests/unit/`.

**Temporary Mitigation:** Integration tests cover the happy path and several edge cases.

**Implementation Complexity:** Medium (4–6 hours after ARCH-01)  
**Recommended Phase:** Short-term

---

### TEST-03 · No Frontend Tests
**Priority:** 🟡 LONG-TERM  
**Severity:** Medium  
**Risk Level:** MEDIUM

**Impact:** The Next.js frontend has no Jest/Testing Library tests. All RBAC permission-gating, park-scoped filtering, and UI state management is untested. A change to the auth context or permission hook can break the entire UI silently.

**Affected Files/Modules:**
- `frontend/src/` (all components)

**Recommended Solution:** Add Jest + React Testing Library to the frontend. Priority test targets: `AuthProvider`, `usePermission` hook, `Sidebar` permission-gating, `FilterBar` park scoping, admin page forms.

**Temporary Mitigation:** Manual QA checklist per role (Super Admin, Park Manager, Cashier) before each deployment.

**Implementation Complexity:** High (3–5 days)  
**Recommended Phase:** Long-term

---

### TEST-04 · No Load / Performance Tests
**Priority:** 🟡 LONG-TERM  
**Severity:** Low  
**Risk Level:** LOW

**Impact:** Dashboard queries involve multi-table JOINs across potentially millions of ticket rows. No baseline performance data exists. A slow dashboard query under real production load will not be discovered until go-live.

**Affected Files/Modules:**
- `backend/routes/dashboard.js`
- `backend/routes/tickets.js` (GET)

**Recommended Solution:** Add k6 or Artillery load tests for dashboard endpoints and the ticket batch endpoint. Establish P95 latency baselines (<500ms for KPI aggregations).

**Temporary Mitigation:** Monitor query execution time via `EXPLAIN ANALYZE` on production data size estimates.

**Implementation Complexity:** Medium (1–2 days)  
**Recommended Phase:** Long-term

---

### TEST-05 · No Contract Tests for API Breaking Changes
**Priority:** 🟡 LONG-TERM  
**Severity:** Low  
**Risk Level:** LOW

**Impact:** The frontend and POS/mobile clients depend on specific response shapes. There are no contract tests (Pact or OpenAPI-based) to catch when a backend change silently removes or renames a field that clients rely on.

**Affected Files/Modules:**
- All route files

**Recommended Solution:** Generate an OpenAPI 3.0 spec from routes (e.g., `express-openapi-validator`). Run contract validation in CI. Alternatively, add Pact consumer-driven contract tests.

**Temporary Mitigation:** TypeScript typed API client shared between frontend and backend would catch these at compile time.

**Implementation Complexity:** High (2–3 days)  
**Recommended Phase:** Long-term

---

## 7. Analytics Debt

---

### ANA-01 · Analytics Tables are Pre-Aggregated With No ETL Job
**Priority:** ✅ RESOLVED — Phase 10 · `backend/scripts/etl-bootstrap.js`, `migrations/002_analytics_tables.sql`. Also fixed ANA-02 GROUP BY bug in `/demographics`. Live-query endpoints (kpis, hourly, heatmap, etc.) never needed ETL.  
**Severity:** Critical  
**Risk Level:** HIGH

**Impact:** The dashboard relies on pre-aggregated tables (`daily_stats`, `hourly_stats`, `demographics`, `revenue_by_demographic`, `revenue_by_category`, `revenue_by_source`, `revenue_by_payment`, `heatmap_data`, `weekend_weekday`, `quarterly_revenue`, `monthly_revenue`, `top_parks_metrics`, `revenue_trend`). There is no background job, cron, or trigger that populates these tables from the `tickets` table. Without population, every dashboard widget shows empty or zeroed data.

**Affected Files/Modules:**
- `backend/routes/dashboard.js` (all endpoints)
- Database schema (all analytics tables)

**Recommended Solution:** Implement a nightly (or hourly) aggregation job that reads from `tickets` and writes to all analytics tables. Use `pg_cron` (Postgres extension) or a Node.js cron job (`node-cron`). Consider a `materialized view` strategy for real-time analytics.

**Temporary Mitigation:** Manually seed analytics tables for demo/staging. Document the missing ETL dependency prominently.

**Implementation Complexity:** High (3–5 days for a complete ETL pipeline)  
**Recommended Phase:** Immediate — dashboard is non-functional without this

---

### ANA-02 · Table Name Mismatch — `visitor_demographics` vs `demographics`
**Priority:** ✅ RESOLVED — Phase 10 · `backend/routes/dashboard.js` — corrected table name and GROUP BY clause in `/demographics` endpoint  
**Severity:** Medium  
**Risk Level:** HIGH

**Impact:** The dashboard route queries a table named `visitor_demographics` in at least one endpoint, while the actual schema (confirmed by test setup) defines the table as `demographics`. This causes a 500 error on the demographics endpoint in production. Integration tests mask this because they accept non-401/403 responses.

**Affected Files/Modules:**
- `backend/routes/dashboard.js` (demographics endpoint)
- `backend/tests/setup/globalSetup.js` (defines `demographics` table)

**Recommended Solution:** Audit all dashboard queries for the correct table name. Run `\d visitor_demographics` and `\d demographics` against production DB to identify the canonical name. Standardize.

**Temporary Mitigation:** Add an explicit integration test that asserts the demographics endpoint returns 200 (not 500).

**Implementation Complexity:** Low (1 hour to audit + fix)  
**Recommended Phase:** Short-term

---

### ANA-03 · No Real-Time Ticket Data in Dashboard
**Priority:** 🟡 LONG-TERM  
**Severity:** Medium  
**Risk Level:** MEDIUM

**Impact:** Because analytics depend on pre-aggregated tables, tickets created today are not visible in dashboard KPIs until the aggregation job runs. For operations teams monitoring ticket sales during park hours, this creates a blind spot of up to 24 hours.

**Affected Files/Modules:**
- `backend/routes/dashboard.js` (`/today-stats` endpoint)

**Recommended Solution:** The `/today-stats` endpoint should query `tickets` directly for today's data (live), while historical periods use pre-aggregated tables. This hybrid approach is already partially implemented — extend it.

**Temporary Mitigation:** Ensure ETL job runs at least hourly for today's data.

**Implementation Complexity:** Medium (2–3 hours for today-stats; full live query approach is 1–2 days)  
**Recommended Phase:** Long-term

---

### ANA-04 · No Indexes Defined on Analytics Tables
**Priority:** 🟡 LONG-TERM  
**Severity:** Medium  
**Risk Level:** MEDIUM

**Impact:** Dashboard queries filter by `park_id`, `stat_date`, and date ranges on all analytics tables. Without covering indexes, these queries will perform full table scans as data grows.

**Affected Files/Modules:**
- Database schema (all analytics tables)

**Recommended Solution:** Add indexes: `CREATE INDEX ON daily_stats (park_id, stat_date)`. Audit all dashboard `WHERE` clauses and add composite indexes for each access pattern.

**Temporary Mitigation:** Monitor query performance via `pg_stat_statements`.

**Implementation Complexity:** Low (2 hours — migrations + EXPLAIN ANALYZE validation)  
**Recommended Phase:** Long-term

---

## 8. Finance / Governance Debt

---

### FIN-01 · Tax Calculation Not Implemented (CGST/SGST = 0)
**Priority:** 🟠 SHORT-TERM  
**Severity:** High  
**Risk Level:** HIGH (legal/compliance risk)

**Impact:** `expandBooking()` hardcodes `cgst_amount: 0, sgst_amount: 0` for all ticket rows. GST at the applicable rate (28% for amusement parks in India) is not calculated or stored. Financial reports derived from the `tickets` table will understate revenue. Tax filings will be incorrect.

**Affected Files/Modules:**
- `backend/routes/tickets.js:121-122` (expandBooking)

**Recommended Solution:** Add a `gst_rate` column to `parks` (or a global `settings` table). Calculate CGST = SGST = line_total × (gst_rate / 2). Store in `cgst_amount` and `sgst_amount` columns. Update `total_amount` to include GST.

**Temporary Mitigation:** Do not use the system for live ticket sales until this is resolved. Tax must be calculated externally.

**Implementation Complexity:** Medium (4–6 hours — schema + business logic + tests)  
**Recommended Phase:** Short-term — required before live ticket operations

---

### FIN-02 · No Ticket Cancellation / Refund Endpoint
**Priority:** ✅ RESOLVED — Phase 11+ · `backend/routes/refunds.js` — full refund request / approve / reject / process workflow with RBAC enforcement and audit trail  
**Severity:** High  
**Risk Level:** HIGH (operational risk)

**Impact:** The `tickets.status` field supports `'Cancelled'` but there is no `PATCH /api/tickets/:id/cancel` endpoint. Cashiers have no system mechanism to cancel a ticket or initiate a refund. Cancellations must be done via direct DB manipulation, leaving no audit trail.

**Affected Files/Modules:**
- `backend/routes/tickets.js` (missing endpoint)

**Recommended Solution:** Add `PATCH /api/tickets/:id/cancel` protected by `tickets.cancel` permission. Record `cancelled_by`, `cancelled_at`, `refund_amount`, and `cancellation_reason`. Log to audit trail.

**Temporary Mitigation:** Document the DB-level cancellation procedure. Require Super Admin authorization for all manual cancellations.

**Implementation Complexity:** Medium (4–6 hours)  
**Recommended Phase:** Short-term

---

### FIN-03 · Audit Log Has No Retention Policy
**Priority:** 🟡 LONG-TERM  
**Severity:** Medium  
**Risk Level:** MEDIUM

**Impact:** The `audit_log` table grows unbounded. There is no TTL, archival, or partitioning strategy. At enterprise scale, the audit log will become a performance bottleneck for queries and a storage cost concern. Regulatory requirements may mandate a specific retention period (e.g., 7 years for financial records).

**Affected Files/Modules:**
- `backend/lib/audit.js`
- `backend/routes/rbac.js` (`/audit-log` endpoint)
- Database schema (`audit_log` table)

**Recommended Solution:** Implement table partitioning by month (`PARTITION BY RANGE (created_at)`). Add a scheduled archival job that moves records older than the retention threshold to cold storage (S3 + Parquet) and deletes from the live table.

**Temporary Mitigation:** Add a monthly scheduled `DELETE FROM audit_log WHERE created_at < NOW() - INTERVAL '2 years'` until partitioning is implemented.

**Implementation Complexity:** High (1–2 days for partitioning + archival job)  
**Recommended Phase:** Long-term

---

### FIN-04 · No Cash Reconciliation Endpoint
**Priority:** 🟡 LONG-TERM  
**Severity:** Medium  
**Risk Level:** MEDIUM

**Impact:** There is no API endpoint for cashiers or park managers to reconcile the physical cash drawer against recorded `cash_amount` totals for a session/day. Cash variance (overage/shortage) cannot be recorded in the system.

**Affected Files/Modules:**
- Missing feature — no route exists

**Recommended Solution:** Add `GET /api/tickets/reconciliation?park_id=&date=` that returns total `cash_amount`, `upi_amount`, `card_amount` by payment mode for the period. Add a `POST /api/reconciliation` endpoint that records the physical count and calculates variance.

**Temporary Mitigation:** Park managers export ticket data and reconcile in a spreadsheet.

**Implementation Complexity:** Medium (4–6 hours)  
**Recommended Phase:** Long-term

---

### FIN-05 · No Fiscal Year Support in Analytics
**Priority:** 🟡 LONG-TERM  
**Severity:** Low  
**Risk Level:** LOW

**Impact:** `Quarterly` and `Yearly` date ranges are calendar-based (Jan–Dec). Indian fiscal year runs Apr–Mar. Finance teams reconciling with accounting systems will get mismatched totals.

**Affected Files/Modules:**
- `backend/routes/dashboard.js:27-35` (dateSQL)

**Recommended Solution:** Add a `fiscal_year_start_month` setting (default `4` for April). `Quarterly` and `Yearly` ranges respect the fiscal calendar when this setting is configured.

**Temporary Mitigation:** Document the calendar-year limitation. Finance teams use "Custom Range" for fiscal-year reports.

**Implementation Complexity:** Medium (4 hours)  
**Recommended Phase:** Long-term

---

### FIN-06 · No GST Compliance Report
**Priority:** 🟡 LONG-TERM  
**Severity:** Medium  
**Risk Level:** MEDIUM (legal risk post-FIN-01 fix)

**Impact:** Once CGST/SGST is implemented (FIN-01), there is no report endpoint that produces GST-compliant output (GSTIN, HSN code, tax invoice format required for returns filing).

**Affected Files/Modules:**
- Missing feature

**Recommended Solution:** Add `GET /api/reports/gst?period=&park_id=` that returns ticket data formatted for GSTR-1 filing. Include HSN code, taxable value, CGST rate/amount, SGST rate/amount, invoice number.

**Temporary Mitigation:** Dependent on FIN-01 being resolved first.

**Implementation Complexity:** Medium (1 day, dependent on FIN-01)  
**Recommended Phase:** Long-term (after FIN-01)

---

## 9. Notifications & Workflow Debt

---

### NOTIF-01 · Notification Delivery via Polling Only (No Push / WebSocket)
**Priority:** 🟡 LONG-TERM  
**Severity:** Medium  
**Risk Level:** LOW (operational efficiency)

**Impact:** `NotificationBell` polls `/api/notifications/unread-count` every 30 seconds via `setInterval`. At 50 concurrent sessions this generates ~100 DB queries per minute purely for badge counts. Latency to notification delivery is up to 30s. Real-time workflows (e.g., Finance Head approving a refund while the requester is online) have no immediate feedback loop.

**Affected Files/Modules:**
- `frontend/src/components/NotificationBell.jsx` (30s interval)
- `backend/routes/notifications.js` (`GET /unread-count`)

**Recommended Solution:** Implement SSE (Server-Sent Events) for notification push. SSE is HTTP-based, works through standard reverse proxies, and does not require WebSocket infrastructure. The client subscribes to `GET /api/notifications/stream`; the server pushes unread count updates on insert.

**Temporary Mitigation:** Current polling is acceptable for <100 concurrent users. Monitor DB query volume via `pg_stat_statements`. Reduce poll interval to 60s as a quick win if load is observed.

**Implementation Complexity:** Medium (1 day — SSE endpoint + frontend EventSource)  
**Recommended Phase:** Long-term

---

### NOTIF-02 · No Notification Retention / Cleanup Policy
**Priority:** 🟡 LONG-TERM  
**Severity:** Low  
**Risk Level:** LOW

**Impact:** The `notifications` and `workflow_events` tables have no TTL, partitioning, or archival strategy (same problem as FIN-03 for `audit_log`). At enterprise scale these tables will grow unbounded. `workflow_events` is an immutable log with no FK on `actor_id` — it can never be cleaned up via cascade and requires explicit maintenance.

**Affected Files/Modules:**
- `backend/migrations/004_notifications.sql` (both tables)
- `backend/lib/notifier.js`

**Recommended Solution:** Add a scheduled job that deletes `notifications` older than 90 days (read notifications) or 1 year (unread). For `workflow_events`, implement monthly range partitioning and cold-storage archival (same as FIN-03 recommendation). Consider a `retained_until` column on notifications for high-priority types.

**Temporary Mitigation:** Add a monthly `DELETE FROM notifications WHERE created_at < NOW() - INTERVAL '6 months' AND is_read = true` until partitioning is in place.

**Implementation Complexity:** Medium (4 hours for cleanup job, 1 day for partitioning)  
**Recommended Phase:** Long-term

---

### NOTIF-03 · No External Notification Delivery (Email / Push)
**Priority:** 🟡 LONG-TERM  
**Severity:** Medium  
**Risk Level:** MEDIUM (operational risk)

**Impact:** Finance approvers and park managers have no out-of-app notification channel. A pending refund request will not be surfaced to a Finance Head who is offline or not looking at the dashboard. In a multi-park enterprise, time-sensitive workflow items (settlement disputes, reconciliation exceptions) can sit unactioned for days.

**Affected Files/Modules:**
- `backend/lib/notifier.js` (`notifyByPermission`, `notify` functions — in-app only)

**Recommended Solution:** Add an optional email delivery layer to `notifier.js`. On insert, if the notification type is in a configurable `EMAIL_NOTIFY_TYPES` set, send via SMTP/SendGrid/SES. Add `email_sent_at` column to `notifications` for delivery tracking. Respect a `notification_preferences` user setting (opt-in/opt-out per type).

**Temporary Mitigation:** Document that Finance Heads should check the dashboard daily for pending actions. The `PendingActionsWidget` provides a count on the finance dashboard.

**Implementation Complexity:** Medium (1 day — email integration + preferences schema)  
**Recommended Phase:** Long-term

---

## 10. Consolidated Priority Matrix

### 🔴 Immediate Production Blockers
*Must be resolved before any production/public-facing deployment.*

| ID | Item | Complexity | Status |
|----|------|-----------|--------|
| SEC-01 | Hardcoded JWT secret fallback | Low | ✅ Fixed Phase 10 |
| SEC-02 | CORS allows all origins | Low | ✅ Fixed Phase 10 |
| SEC-03 | JWT cookie missing `Secure` flag | Trivial | ✅ Fixed Phase 10 |
| RBAC-01 | No JWT revocation / token blacklist | Medium | ✅ Fixed Phase 10 |
| ANA-01 | No ETL job — analytics tables empty | High | ✅ Fixed Phase 10 |

---

### 🟠 Short-Term Improvements
*Target: resolved within 2 sprints (4 weeks).*

| ID | Item | Complexity | Owner |
|----|------|-----------|-------|
| SEC-04 | Remove pre-migration permission bypass | Low | Backend |
| SEC-05 | Remove parkScope JWT fallback | Trivial | Backend |
| SEC-06 | Login rate limiting | Low | Backend |
| SEC-07 | Stop leaking raw DB errors to client | Low | Backend |
| RBAC-02 | Process-local permCache (multi-instance unsafe) | Medium | Backend |
| PERF-01 | parkScope DB query on every request | Medium | Backend |
| PERF-02 | Ticket batch — sequential inserts + no transaction | Medium | Backend |
| PERF-05 | Dashboard dateSQL string interpolation | Medium | Backend |
| UX-01 | Inconsistent error response schema | Medium | Backend |
| UX-05 | Delete buttons use wrong icon (`file` vs trash) | Trivial | Frontend |
| TEST-01 | Test DB schema diverges from production | Dependent on ARCH-02 | Backend |
| TEST-02 | No unit tests for business logic | Medium | Backend |
| ARCH-02 | No database migration system | High | Backend/DevOps |
| ARCH-06 | Test setup does not run migration files | Low | Backend |
| ARCH-07 | `settlement_periods.submitted_by` type mismatch | Low | Backend/DB |
| FIN-01 | CGST/SGST hardcoded to 0 | Medium | Backend |

---

### ✅ Recently Resolved (Phases 10–17)

| ID | Item | Resolved In |
|----|------|------------|
| SEC-01 | Hardcoded JWT secret fallback | Phase 10 |
| SEC-02 | CORS allows all origins | Phase 10 |
| SEC-03 | JWT cookie missing Secure flag | Phase 10 |
| RBAC-01 | No JWT revocation / token blacklist | Phase 10 |
| ANA-01 | No ETL job — analytics tables empty | Phase 10 |
| ANA-02 | `visitor_demographics` table name mismatch | Phase 10 |
| FIN-02 | No ticket cancellation / refund endpoint | Phase 11+ |

---

### 🟡 Long-Term Architectural Improvements
*Target: planned roadmap items, no active production risk.*

| ID | Item | Complexity | Owner |
|----|------|-----------|-------|
| RBAC-03 | GLOBAL_ROLES hardcoded in middleware | Medium | Backend |
| RBAC-04 | Role hierarchy implicit (ID-ordered) | Medium | Backend/DB |
| RBAC-05 | Super Admin immutability hardcoded as ID 1 | Low | Backend |
| RBAC-06 | No multi-factor authentication | High | Backend |
| PERF-03 | No DB connection pool configuration | Trivial | Backend |
| PERF-04 | No pagination on parks/roles endpoints | Low | Backend |
| UX-02 | No park archive / soft-delete | Medium | Full-stack |
| UX-03 | Weak password policy | Low | Backend |
| UX-04 | Park ID format not enforced | Low | Backend |
| ARCH-01 | Business logic in route handlers | High | Backend |
| ARCH-03 | No structured logging | Medium | Backend |
| ARCH-04 | No API versioning | Low | Backend |
| ARCH-05 | No input validation framework | High | Backend |
| TEST-03 | No frontend tests | High | Frontend |
| TEST-04 | No load/performance tests | Medium | Backend/QA |
| TEST-05 | No contract tests | High | Full-stack |
| ANA-03 | No real-time ticket data in dashboard | Medium | Backend |
| ANA-04 | No indexes on analytics tables | Low | DB |
| FIN-03 | Audit log has no retention policy | High | Backend/DB |
| FIN-04 | No cash reconciliation endpoint | Medium | Backend |
| FIN-05 | No fiscal year support | Medium | Backend |
| FIN-06 | No GST compliance report | Medium | Backend |
| NOTIF-01 | Notification polling only (no push/SSE) | Medium | Backend/Frontend |
| NOTIF-02 | No notification retention / cleanup policy | Medium | Backend/DB |
| NOTIF-03 | No external notification delivery (email/push) | Medium | Backend |

---

## Appendix A — Debt Item Count by Category

*Resolved items are excluded from active counts.*

| Category | Short-Term (active) | Long-Term | Total (active) |
|----------|---------------------|-----------|----------------|
| Security | 4 | 1 | 5 |
| RBAC/Auth | 1 | 4 | 5 |
| Performance | 3 | 3 | 6 |
| UX | 2 | 3 | 5 |
| Architecture | 3 | 4 | 7 |
| Testing | 2 | 3 | 5 |
| Analytics | 0 | 2 | 2 |
| Finance/Governance | 1 | 4 | 5 |
| Notifications/Workflow | 0 | 3 | 3 |
| **Total** | **16** | **27** | **43** |

*Resolved: SEC-01, SEC-02, SEC-03, RBAC-01, ANA-01, ANA-02, FIN-02 (7 items, all Phase 10–11)*

---

## Appendix B — Risk Register

| Risk | Likelihood | Impact | Debt Items |
|------|-----------|--------|------------|
| JWT secret exposed in source | ~~High~~ Mitigated | Critical | ✅ SEC-01 resolved |
| Privilege escalation via forged token | ~~Medium~~ Mitigated | Critical | ✅ SEC-01, RBAC-01 resolved |
| Unauthorized park data access | Low | High | SEC-05, RBAC-02 |
| Tax compliance failure (GST) | High | High | FIN-01, FIN-06 |
| Analytics dashboard shows no data | ~~High~~ Mitigated | High | ✅ ANA-01 resolved |
| Schema drift causes silent data corruption | Medium | High | ARCH-02, TEST-01, ARCH-06 |
| Revoked user retains access for 7 days | ~~Medium~~ Mitigated | Medium | ✅ RBAC-01 resolved |
| Permission bypass in pre-migration path | Low | Critical | SEC-04 |
| Settlement notifications silently dropped | Medium | Low | ARCH-07 |
| Finance workflow actions missed (no push) | Medium | Medium | NOTIF-01, NOTIF-03 |
| Notification table grows unbounded | Low | Medium | NOTIF-02, FIN-03 |
| Multi-instance permCache stale | Medium | High | RBAC-02 (pre-scaling) |

---

## Appendix C — Production Readiness Summary (Phase 17)

*Assessment as of 2026-05-20, branch `dashboard-redesign`.*

### What is production-ready

| Area | Status | Notes |
|------|--------|-------|
| Authentication (JWT + token version) | ✅ Ready | Hardened in Phase 10; revocation via tokenVersion |
| RBAC + permission enforcement | ✅ Ready | All routes guarded; Super Admin immutable; permCache with 5-min TTL |
| Park-scoped data isolation | ✅ Ready | `parkScope` middleware on all data endpoints |
| Ticket operations (CRUD + batch) | ✅ Ready | Full flow with audit trail; GST calc deferred (FIN-01) |
| Refund workflow | ✅ Ready | Request / approve / reject / process with RBAC and audit log |
| Settlement workflow | ✅ Ready | Submit / approve / dispute with finance audit trail |
| Cash reconciliation | ✅ Ready | `reconciliation_exceptions` + `/reconcile` endpoint |
| In-app notifications | ✅ Ready | Targeted per-user; polling; unread badge; mark-as-read |
| Workflow audit log | ✅ Ready | Immutable `workflow_events` table; Finance Audit Log UI |
| Finance dashboard + reporting | ✅ Ready | KPIs, settlements, refunds, reconciliation, audit log views |
| Analytics dashboard | ✅ Ready | ETL-seeded; live today-stats; multi-park filter |
| Responsive UI | ✅ Ready | Mobile bottom-nav; table scroll; bell visible on all breakpoints |
| Accessibility (a11y) | ✅ Ready | ConfirmModal focus trap + aria; NotificationDrawer role/aria; Escape keys |
| Loading / empty / error states | ✅ Ready | Skeleton rows, spinner, permission-denied, empty illustrations |
| Admin: Users, Parks, Roles | ✅ Ready | CRUD with RBAC gates; role permission matrix |
| Report Center + CSV/PDF export | ✅ Ready | All finance sections + analytics exportable |
| CORS + cookie security | ✅ Ready | Whitelisted origins; HttpOnly; Secure in production |

### Known gaps before go-live

| Priority | Gap | Debt Item |
|----------|-----|-----------|
| 🔴 Must fix | GST calculation hardcoded to 0 — tax filings will be wrong | FIN-01 |
| 🟠 Should fix | Login endpoint has no rate limiting — brute-force risk | SEC-06 |
| 🟠 Should fix | Raw DB error messages may leak schema info | SEC-07 |
| 🟠 Should fix | `settlement_periods.submitted_by` type mismatch — settle notifications broken | ARCH-07 |
| 🟠 Should fix | Test setup schema diverges from migration files | ARCH-06 |
| 🟠 Should fix | Delete buttons show file icon — wrong affordance | UX-05 |
| 🟡 Nice to have | Email/push notifications for finance approvers | NOTIF-03 |
| 🟡 Nice to have | Notification polling → SSE for real-time delivery | NOTIF-01 |

### Single-instance constraint

The system is production-ready for **single-instance deployment only**. `permCache` is in-process memory (RBAC-02). Horizontal scaling (PM2 cluster, Kubernetes replicas) requires a shared cache layer (Redis) before deployment.

---

*Document maintained by: Engineering / ZTech CRM team*  
*Last updated: Phase 17 — 2026-05-20*  
*Next review: Before production go-live / Phase 18*
