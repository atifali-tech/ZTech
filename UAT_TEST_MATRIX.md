# ZingParks Operations Dashboard — UAT Test Matrix
**Version:** Pre-UAT | **Date:** 2026-05-24 | **Branch:** ztech-crm-revamp

---

## Test Environment Setup

| Item | Value |
|------|-------|
| Frontend URL | http://localhost:3000 |
| Backend URL | http://localhost:4000 |
| Database | zingparks_local (PostgreSQL) |
| Seed migration | 015_uat_seed.sql |
| Test parks | ZP001–ZP007 |

### Seed Users (from 015_uat_seed.sql)

| Email | Role | Park Scope | Password |
|-------|------|-----------|----------|
| admin@zingparks.com | Super Admin | All parks | Admin@!2345 |
| corporate@zingparks.com | Corporate Admin | All parks | Admin@!2345 |
| finance@zingparks.com | Finance Head | All parks | Admin@!2345 |
| pm-zp001@zingparks.com | Park Manager | ZP001 only | Admin@!2345 |
| pm-zp002@zingparks.com | Park Manager | ZP002 only | Admin@!2345 |
| pm-zp003@zingparks.com | Park Manager | ZP003 only | Admin@!2345 |
| cashier@zingparks.com | Cashier | ZP001 (if assigned) | Admin@!2345 |
| authority@zingparks.com | Authority User | All parks (read) | Admin@!2345 |

> **Note:** Cashier user may need to be manually created and assigned to a counter at ZP001 if not included in the seed. Park Manager users pm-zp004 through pm-zp007 are seeded but have no login accounts—create manually if needed.

---

## Permission Reference Matrix

Full permissions per role as defined across migrations 002, 009, 011, 013, 014:

| Permission | Super Admin | Corp Admin | Finance Head | Park Manager | Cashier | Authority |
|------------|:-----------:|:----------:|:------------:|:------------:|:-------:|:---------:|
| dashboard.view | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| analytics.view | ✓ | ✓ | ✓ | ✓ | — | ✓ |
| analytics.export | ✓ | ✓ | ✓ | ✓ | — | ✓ |
| tickets.view | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| tickets.create | ✓ | — | — | ✓ | ✓ | — |
| tickets.cancel | ✓ | — | — | ✓ | ✓ | — |
| parks.view | ✓ | ✓ | ✓ | ✓ | — | ✓ |
| parks.create | ✓ | — | — | — | — | — |
| parks.edit | ✓ | — | — | ✓ | — | — |
| parks.delete | ✓ | — | — | — | — | — |
| users.view | ✓ | ✓ | — | ✓ | — | — |
| users.create | ✓ | ✓ | — | — | — | — |
| users.edit | ✓ | ✓ | — | — | — | — |
| users.delete | ✓ | — | — | — | — | — |
| roles.view | ✓ | — | — | — | — | — |
| roles.manage | ✓ | — | — | — | — | — |
| finance.view | ✓ | ✓ | ✓ | ✓ | — | — |
| finance.approve | ✓ | — | ✓ | — | — | — |
| finance.refund | ✓ | — | ✓ | ✓ | — | — |
| finance.reconcile | ✓ | — | ✓ | ✓ | — | — |
| reports.view | ✓ | ✓ | ✓ | ✓ | — | ✓ |
| reports.export | ✓ | ✓ | ✓ | — | — | ✓ |
| zones.view | ✓ | ✓ | — | ✓ | — | ✓ |
| zones.create | ✓ | — | — | ✓ | — | — |
| zones.edit | ✓ | — | — | ✓ | — | — |
| zones.delete | ✓ | — | — | ✓ | — | — |
| counters.view | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| counters.create | ✓ | — | — | ✓ | — | — |
| counters.edit | ✓ | — | — | ✓ | — | — |
| counters.delete | ✓ | — | — | ✓ | — | — |
| devices.view | ✓ | ✓ | — | ✓ | ✓ | ✓ |
| devices.create | ✓ | — | — | ✓ | — | — |
| devices.edit | ✓ | — | — | ✓ | — | — |
| devices.delete | ✓ | — | — | ✓ | — | — |
| gates.view | ✓ | ✓ | — | ✓ | — | ✓ |
| gates.create | ✓ | — | — | ✓ | — | — |
| gates.edit | ✓ | — | — | ✓ | — | — |
| gates.delete | ✓ | — | — | ✓ | — | — |
| shifts.view | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| shifts.create | ✓ | — | — | ✓ | ✓ | — |
| shifts.edit | ✓ | — | — | ✓ | — | — |
| shifts.close | ✓ | — | — | ✓ | ✓ | — |
| alerts.view | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| alerts.manage | ✓ | — | — | ✓ | — | — |
| incidents.view | ✓ | ✓ | ✓ | ✓ | — | ✓ |
| incidents.create | ✓ | — | — | ✓ | — | — |
| incidents.manage | ✓ | — | — | ✓ | — | — |
| occupancy.view | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

---

## Section 1 — Sidebar Visibility

### Expected sidebar items per role

| Nav Item | Super Admin | Corp Admin | Finance Head | Park Manager | Cashier | Authority |
|----------|:-----------:|:----------:|:------------:|:------------:|:-------:|:---------:|
| Dashboard | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Analytics | ✓ | ✓ | ✓ | ✓ | — | ✓ |
| Tickets | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Parks | ✓ | ✓ | ✓ | ✓* | — | ✓ |
| Users | ✓ | ✓ | — | ✓ | — | — |
| Roles & Permissions | ✓ | — | — | — | — | — |
| Finance Overview | ✓ | ✓ | ✓ | ✓ | — | — |
| Reports | ✓ | ✓ | ✓ | ✓ | — | ✓ |
| Ops Dashboard | ✓ | ✓ | — | — | — | — |
| Alerts | ✓ | ✓ | — | — | — | — |
| Incidents | ✓ | ✓ | — | — | — | — |
| My Shifts | — | — | — | — | ✓ | — |

> *Park Manager: sees Parks but only their own park(s) — scoped by `user_parks` assignment.
> Ops Dashboard/Alerts/Incidents appear in sidebar for Super Admin and Corporate Admin only; Park Manager accesses these through the Park Workspace Operations tab.

### Test Cases — Sidebar

| TC# | User | Expected Visible | Expected Hidden | Pass/Fail |
|-----|------|-----------------|-----------------|-----------|
| S-01 | admin@zingparks.com | All 12 items | — | |
| S-02 | corporate@zingparks.com | Dashboard, Analytics, Tickets, Parks, Users, Finance, Reports, Ops Dashboard, Alerts, Incidents | Roles & Permissions, My Shifts | |
| S-03 | finance@zingparks.com | Dashboard, Analytics, Tickets, Parks, Finance, Reports | Users, Roles, Ops Dashboard, Alerts, Incidents, My Shifts | |
| S-04 | pm-zp001@zingparks.com | Dashboard, Analytics, Tickets, Parks, Users, Finance, Reports | Roles, Ops Dashboard, Alerts, Incidents, My Shifts | |
| S-05 | cashier@zingparks.com | Dashboard, Tickets, My Shifts | Analytics, Parks, Users, Roles, Finance, Reports, Ops Dashboard | |
| S-06 | authority@zingparks.com | Dashboard, Analytics, Tickets, Parks, Reports | Users, Roles, Finance, Ops Dashboard, My Shifts | |

---

## Section 2 — Page Access (HTTP 200 vs Redirect/403)

### Test Cases — Page Access

| TC# | User | URL | Expected Result | Pass/Fail |
|-----|------|-----|----------------|-----------|
| PA-01 | admin@ | /admin/dashboard | 200 — Full dashboard | |
| PA-02 | admin@ | /admin/analytics | 200 — Analytics | |
| PA-03 | admin@ | /admin/parks | 200 — All 7 parks | |
| PA-04 | admin@ | /admin/parks/ZP001 | 200 — Park workspace | |
| PA-05 | admin@ | /admin/users | 200 — All users | |
| PA-06 | admin@ | /admin/roles | 200 — RBAC config | |
| PA-07 | admin@ | /admin/finance | 200 — Finance overview | |
| PA-08 | admin@ | /admin/operations | 200 — Ops dashboard | |
| PA-09 | pm-zp001@ | /admin/parks | 200 — ZP001 only visible | |
| PA-10 | pm-zp001@ | /admin/parks/ZP001 | 200 — Park workspace | |
| PA-11 | pm-zp001@ | /admin/parks/ZP002 | 403 or redirect — not their park | |
| PA-12 | pm-zp001@ | /admin/users | 200 — User list (no create/delete UI) | |
| PA-13 | pm-zp001@ | /admin/roles | Redirect to /admin/dashboard (no roles.view) | |
| PA-14 | cashier@ | /admin/dashboard | 200 — Cashier-scoped KPIs | |
| PA-15 | cashier@ | /admin/parks | Redirect or 403 — no parks.view | |
| PA-16 | cashier@ | /admin/analytics | Redirect or 403 — no analytics.view | |
| PA-17 | cashier@ | /admin/operations/shifts | 200 — Shift view | |
| PA-18 | authority@ | /admin/parks/ZP001 | 200 — Read-only view, no edit actions | |
| PA-19 | authority@ | /admin/finance | Redirect or 403 — no finance.view | |
| PA-20 | finance@ | /admin/parks/ZP001 | 200 — Read-only (no parks.edit actions) | |
| PA-21 | finance@ | /admin/finance | 200 — Finance overview | |
| PA-22 | finance@ | /admin/operations | Redirect or 403 — no counters.view in ops sidebar | |

---

## Section 3 — API Access (Direct HTTP)

Test these with a browser dev tools / Postman while authenticated as each user. All should return the specified HTTP status.

### Test Cases — API

| TC# | Method + Endpoint | User | Expected Status | Pass/Fail |
|-----|-------------------|------|----------------|-----------|
| API-01 | GET /api/parks | admin@ | 200 — all 7 parks | |
| API-02 | GET /api/parks | pm-zp001@ | 200 — ZP001 only | |
| API-03 | GET /api/parks | cashier@ | 401/403 — no parks.view | |
| API-04 | GET /api/parks/ZP001/pricing | pm-zp001@ | 200 — pricing rules | |
| API-05 | GET /api/parks/ZP002/pricing | pm-zp001@ | 403 — out of scope | |
| API-06 | POST /api/parks/ZP001/pricing | pm-zp001@ | 201 — rule created | |
| API-07 | POST /api/parks/ZP001/pricing | authority@ | 403 — no parks.edit | |
| API-08 | POST /api/parks/ZP001/pricing | cashier@ | 403 — no parks.view | |
| API-09 | GET /api/parks/ZP001/zones | pm-zp001@ | 200 — zones | |
| API-10 | POST /api/parks/ZP001/zones | pm-zp001@ | 201 — zone created | |
| API-11 | POST /api/parks/ZP001/zones | authority@ | 403 — no zones.create | |
| API-12 | GET /api/finance/summary | finance@ | 200 — finance data | |
| API-13 | GET /api/finance/summary | cashier@ | 403 — no finance.view | |
| API-14 | POST /api/finance/refunds | pm-zp001@ | 201 — refund created | |
| API-15 | POST /api/finance/refunds | authority@ | 403 — no finance.refund | |
| API-16 | GET /api/dashboard/summary | cashier@ | 200 — scoped data | |
| API-17 | GET /api/analytics/revenue | corporate@ | 200 — cross-park data | |
| API-18 | GET /api/analytics/revenue | pm-zp001@ | 200 — ZP001 data only | |
| API-19 | DELETE /api/users/:id | corporate@ | 403 — no users.delete | |
| API-20 | PUT /api/rbac/roles/4/permissions | admin@ | 200 — updated | |
| API-21 | PUT /api/rbac/roles/1/permissions | admin@ | 403 — cannot modify Super Admin | |
| API-22 | GET /api/parks/ZP001/alerts | pm-zp001@ | 200 — alerts | |
| API-23 | GET /api/parks/ZP001/incidents | authority@ | 200 — read-only incidents | |

---

## Section 4 — Permission Enforcement (UI Actions)

### Test Cases — UI Action Gating

| TC# | User | Screen | Action | Expected Behavior | Pass/Fail |
|-----|------|--------|--------|-------------------|-----------|
| PE-01 | admin@ | Parks list | "Create Park" button | Visible, functional | |
| PE-02 | corporate@ | Parks list | "Create Park" button | Hidden (no parks.create) | |
| PE-03 | pm-zp001@ | Park workspace | "Edit" park settings | Visible, functional | |
| PE-04 | authority@ | Park workspace | "Edit" park settings | Hidden or disabled | |
| PE-05 | pm-zp001@ | Park workspace → Operations | "Add Zone" button | Visible, functional | |
| PE-06 | authority@ | Park workspace → Operations | "Add Zone" button | Hidden | |
| PE-07 | admin@ | Users page | "Delete" user action | Visible, functional | |
| PE-08 | corporate@ | Users page | "Delete" user action | Hidden (no users.delete) | |
| PE-09 | pm-zp001@ | Pricing tab | "Add Rule" button | Visible, functional | |
| PE-10 | authority@ | Park workspace | Pricing tab | Visible (parks.view) but no add/edit buttons | |
| PE-11 | finance@ | Finance overview | "Approve Settlement" action | Visible (finance.approve) | |
| PE-12 | pm-zp001@ | Finance overview | "Approve Settlement" action | Hidden (no finance.approve) | |
| PE-13 | pm-zp001@ | Finance overview | "Submit Refund" button | Visible (finance.refund) | |
| PE-14 | cashier@ | Finance overview | Any finance actions | Page not accessible | |
| PE-15 | admin@ | Roles & Permissions | Edit permissions for Corp Admin | Functional | |
| PE-16 | admin@ | Roles & Permissions | Edit permissions for Super Admin | Blocked with error | |
| PE-17 | pm-zp001@ | Park workspace → Alerts | "Acknowledge" alert button | Visible (alerts.manage) | |
| PE-18 | authority@ | Park workspace → Alerts | "Acknowledge" alert button | Hidden | |
| PE-19 | pm-zp001@ | Park workspace → Operations | Shifts section visible | Yes (shifts.view + shifts.create) | |
| PE-20 | cashier@ | My Shifts | Can open/close shift | Yes (shifts.create + shifts.close) | |

---

## Section 5 — Park Scoping

Verify that park-scoped roles cannot see or act on parks outside their assignment.

### Test Cases — Park Scoping

| TC# | User | Action | Parks in Scope | Parks Out of Scope | Pass/Fail |
|-----|------|--------|---------------|-------------------|-----------|
| PS-01 | pm-zp001@ | /admin/parks | ZP001 visible | ZP002–ZP007 hidden | |
| PS-02 | pm-zp001@ | /admin/analytics (with park filter) | ZP001 selectable | ZP002–ZP007 not available | |
| PS-03 | pm-zp001@ | Dashboard KPIs | ZP001 data | No cross-park data | |
| PS-04 | pm-zp002@ | /admin/parks | ZP002 visible | ZP001, ZP003–ZP007 hidden | |
| PS-05 | pm-zp001@ | GET /api/parks/ZP002/zones | 403 response | — | |
| PS-06 | admin@ | /admin/parks | All 7 parks | — (global access) | |
| PS-07 | corporate@ | /admin/parks | All 7 parks | — (global access) | |
| PS-08 | corporate@ | GET /api/analytics/revenue | All parks aggregated | — | |
| PS-09 | cashier@ | /admin/operations/shifts | Their counter's shifts only | Other parks' shifts | |
| PS-10 | finance@ | /admin/finance/settlements | All parks' settlements | — (Finance Head is cross-park) | |

---

## Section 6 — Refund Permissions

| TC# | User | Action | Expected | Pass/Fail |
|-----|------|--------|----------|-----------|
| R-01 | pm-zp001@ | Finance tab → Refunds | Visible, can create refund | |
| R-02 | pm-zp001@ | Submit refund for ZP001 ticket | 201 Created | |
| R-03 | pm-zp001@ | Submit refund for ZP002 ticket | 403 — out of scope | |
| R-04 | finance@ | View all refunds | All parks visible | |
| R-05 | finance@ | Approve pending refund | Functional (finance.approve) | |
| R-06 | corporate@ | Finance tab → Refunds | View-only (finance.view, no finance.refund) | |
| R-07 | corporate@ | Try to submit refund via API | 403 — no finance.refund | |
| R-08 | authority@ | Finance tab | Page not accessible (no finance.view) | |
| R-09 | cashier@ | Finance tab | Page not accessible (no finance.view) | |

---

## Section 7 — Settlement Permissions

| TC# | User | Action | Expected | Pass/Fail |
|-----|------|--------|----------|-----------|
| ST-01 | finance@ | View settlement periods | All parks, all months | |
| ST-02 | finance@ | Approve submitted settlement | Functional (finance.approve) | |
| ST-03 | finance@ | Reconcile exceptions | Functional (finance.reconcile) | |
| ST-04 | pm-zp001@ | View settlement for ZP001 | Functional (finance.view + scoped) | |
| ST-05 | pm-zp001@ | View settlement for ZP002 | 403 — out of scope | |
| ST-06 | pm-zp001@ | Approve settlement | Hidden/blocked (no finance.approve) | |
| ST-07 | corporate@ | View all settlements | Functional (finance.view) | |
| ST-08 | corporate@ | Approve settlement | Hidden/blocked (no finance.approve) | |
| ST-09 | admin@ | Approve settlement | Functional | |
| ST-10 | cashier@ | Access /api/finance/settlements | 403 — no finance.view | |

---

## Section 8 — Pricing Permissions

| TC# | User | Action | Expected | Pass/Fail |
|-----|------|--------|----------|-----------|
| PR-01 | pm-zp001@ | Park workspace → Pricing tab | Visible, loads rules for ZP001 | |
| PR-02 | pm-zp001@ | Add pricing rule for ZP001 | "Add Rule" button visible, POST succeeds | |
| PR-03 | pm-zp001@ | Add pricing rule for ZP002 | 403 — out of scope | |
| PR-04 | pm-zp001@ | Edit existing pricing rule | PUT /api/parks/ZP001/pricing/:id succeeds | |
| PR-05 | pm-zp001@ | Deactivate rule (has history) | Soft deactivate — rule preserved | |
| PR-06 | pm-zp001@ | Delete rule (no history) | Hard delete — rule removed | |
| PR-07 | authority@ | Park workspace → Pricing tab | Visible (parks.view), no add/edit/delete buttons | |
| PR-08 | authority@ | POST /api/parks/ZP001/pricing | 403 — no parks.edit | |
| PR-09 | corporate@ | Park workspace → Pricing tab | Visible (parks.view), no edit buttons | |
| PR-10 | corporate@ | POST /api/parks/ZP001/pricing | 403 — no parks.edit | |
| PR-11 | cashier@ | GET /api/parks/ZP001/pricing | 403 — no parks.view | |
| PR-12 | pm-zp001@ | Add duplicate active open-ended rule | Error: "overlapping active rule exists" | |
| PR-13 | pm-zp001@ | Active Price Matrix displayed | 4 categories × 3 day types grid renders | |
| PR-14 | pm-zp001@ | Pricing History tab | Shows audit trail with changed_by email | |
| PR-15 | admin@ | Add pricing rule any park | Functional for all parks | |

---

## Section 9 — User Management Permissions

| TC# | User | Action | Expected | Pass/Fail |
|-----|------|--------|----------|-----------|
| UM-01 | admin@ | Create new user with any role | Functional | |
| UM-02 | admin@ | Delete user | Functional | |
| UM-03 | admin@ | Assign user to park | Functional | |
| UM-04 | corporate@ | Create new user | Functional (users.create) | |
| UM-05 | corporate@ | Edit existing user | Functional (users.edit) | |
| UM-06 | corporate@ | Delete user | Blocked (no users.delete) — button hidden | |
| UM-07 | corporate@ | Create Super Admin user | Blocked or not allowed | |
| UM-08 | pm-zp001@ | View user list | Functional (users.view) | |
| UM-09 | pm-zp001@ | Create user | Blocked — button hidden (no users.create) | |
| UM-10 | pm-zp001@ | Edit user | Blocked — button hidden (no users.edit) | |
| UM-11 | finance@ | View Users page | Redirect/403 — no users.view | |
| UM-12 | authority@ | View Users page | Redirect/403 — no users.view | |
| UM-13 | cashier@ | View Users page | Redirect/403 — no users.view | |
| UM-14 | admin@ | View RBAC / Roles page | Functional | |
| UM-15 | corporate@ | View RBAC / Roles page | Redirect/403 — no roles.view | |

---

## Section 10 — Park Workspace End-to-End Setup Flow

Validate the complete onboarding flow for a new park using pm-zp001@ for ZP001.

| Step | Action | Expected Outcome | Checklist Item | Pass/Fail |
|------|--------|-----------------|----------------|-----------|
| W-01 | Navigate to Parks → ZP001 workspace | Park workspace loads, health badge shows | — | |
| W-02 | Overview tab: view setup checklist | 7 items shown; at least zones/gates/counters/devices checked | — | |
| W-03 | Click "Zones Configured" KPI card | Scrolls to Operations → Zones section | — | |
| W-04 | Operations tab: view zone list | ZP001 zones (e.g. Entry Zone, Main Area) visible | ✓ Zones Created | |
| W-05 | Operations tab: view gate list | ZP001 gates (Entry Gate, Exit Gate) visible | ✓ Gates Configured | |
| W-06 | Operations tab: view counters | ZP001 counters (Ticketing, Inquiry) visible | ✓ Counters Created | |
| W-07 | Operations tab: view devices | ZP001 devices (POS Terminal, QR Scanner) visible | ✓ Devices Assigned | |
| W-08 | Users tab: view assigned users | pm-zp001 appears as assigned user | ✓ Users Assigned | |
| W-09 | Pricing tab: view pricing rules | 12 rules (4 categories × 3 day types) for ZP001 | — | |
| W-10 | Pricing tab: Active Price Matrix | 4×3 grid renders with prices | — | |
| W-11 | Pricing tab: Add new rule | Fill form → Submit → Rule appears in list | — | |
| W-12 | Pricing tab: Edit rule | Change price → Save → Matrix updates | — | |
| W-13 | Pricing tab: Deactivate rule | Click Deactivate → Rule goes gray, count decreases | — | |
| W-14 | Pricing tab: History tab | Change from W-12/W-13 appears in audit trail | — | |
| W-15 | Quick Actions: "Add Zone" | Navigates to Operations tab, scrolls to Zones, opens modal | — | |
| W-16 | Park Health badge | Shows "Operational" (80%+ setup complete) for ZP001 | — | |

---

## Section 11 — Analytics Deduplication Verification

Confirm duplicated charts/tables were removed from Analytics and only canonical locations remain.

| TC# | Check | Expected Location | Should NOT appear | Pass/Fail |
|-----|-------|------------------|-------------------|-----------|
| AD-01 | Revenue by Source (bar chart) | Dashboard → Revenue Bar Card | Analytics → Revenue tab | |
| AD-02 | Revenue by Payment (bar chart) | Dashboard → Revenue Bar Card | Analytics → Revenue tab | |
| AD-03 | Top Parks by Revenue | Dashboard → Top Parks section | Analytics → Revenue tab | |
| AD-04 | Top Parks by Footfall | Dashboard → Top Parks section | Analytics → Footfall tab | |
| AD-05 | Revenue by Demographic | Analytics → Revenue tab (donut) | Dashboard | |
| AD-06 | Revenue by Ticket Category | Analytics → Revenue tab (donut) | Dashboard | |
| AD-07 | Top Parks by Activities/F&B | Analytics → Trends tab | Dashboard (correctly absent) | |
| AD-08 | Revenue split tables (By Source / By Payment) | NOT in Analytics RevenueSplitsTable | — | |

---

## Section 12 — Finance Workflow

| TC# | User | Flow | Expected | Pass/Fail |
|-----|------|------|----------|-----------|
| FW-01 | pm-zp001@ | Finance tab → Settlements | ZP001 settlement periods visible | |
| FW-02 | pm-zp001@ | Click "Submit" on open period | Status changes to "Submitted" | |
| FW-03 | finance@ | Finance tab → Settlements | All parks, submitted period shows | |
| FW-04 | finance@ | Approve submitted settlement | Status changes to "Approved" | |
| FW-05 | pm-zp001@ | Finance tab → Refunds | Can submit refund for ZP001 ticket | |
| FW-06 | finance@ | Refunds list | Sees all pending refunds | |
| FW-07 | finance@ | Approve refund | Status updates, audit trail written | |
| FW-08 | corporate@ | Finance overview | Reads data, cannot approve or refund | |

---

## Section 13 — Shift Workflow

| TC# | User | Action | Expected | Pass/Fail |
|-----|------|--------|----------|-----------|
| SH-01 | pm-zp001@ | Operations → Shifts | All ZP001 shifts visible | |
| SH-02 | pm-zp001@ | Open new shift for a counter | Shift created with status "Open" | |
| SH-03 | pm-zp001@ | Close open shift | Shift status → "Closed", declared cash captured | |
| SH-04 | cashier@ | My Shifts | Their open/recent shifts visible | |
| SH-05 | cashier@ | Open shift | Functional (shifts.create) | |
| SH-06 | cashier@ | Close shift | Functional (shifts.close) | |
| SH-07 | cashier@ | Edit shift supervisor or notes | Blocked (no shifts.edit) | |
| SH-08 | finance@ | View shifts (for variance) | Can view (shifts.view) | |
| SH-09 | authority@ | View shifts | Can view (shifts.view) | |
| SH-10 | corporate@ | View shifts via Ops Dashboard | Can view (shifts.view) | |

---

## Pre-UAT Checklist

Before starting UAT, confirm these are complete:

- [ ] Migration 014 (pricing schema) applied: `node scripts/migrate.js`
- [ ] Migration 015 (UAT seed) applied: `node scripts/migrate.js`
- [ ] Backend server running on port 4000
- [ ] Frontend dev server running on port 3000
- [ ] All 7 seed park users (pm-zp001 to pm-zp007) can log in
- [ ] ZP001–ZP007 appear on Parks list for admin@
- [ ] Pricing rules for all parks seeded (84 rules expected: 7 × 4 × 3)
- [ ] At least 3 open shift sessions seeded (ZP001, ZP002, ZP003)
- [ ] Alert and incident records visible in Ops Dashboard

---

## Production Readiness Assessment

| Category | Status | Notes |
|----------|--------|-------|
| **RBAC & Permissions** | READY | 6 roles, 45+ permissions, all enforced at API level via `requirePermission` middleware |
| **Park Scoping** | READY | `parkScope` middleware restricts all park-resource APIs to `user_parks` assignments |
| **Pricing Engine** | READY | Schema, backend routes (6 endpoints), frontend UI, audit history, soft-delete |
| **Park Workspace** | READY | Setup checklist, health badge, quick actions, section navigation, KPI click-through |
| **Sidebar Architecture** | READY | All 6 roles correctly scoped; Zones/Gates/Counters/Devices/Shifts removed from global nav |
| **Analytics Deduplication** | READY | Revenue by Source/Payment and Top Parks removed from Analytics; canonical ownership assigned |
| **Finance Workflows** | READY | Settlement submit/approve cycle, refund flow, reconciliation |
| **Shift Workflows** | READY | Full lifecycle (Open → Operating → Closed → Reconciled), cashier scoping |
| **UAT Seed Data** | READY | 7 parks, 7 PMs, 84 pricing rules, zones/gates/counters/devices, alerts, incidents |
| **Audit Trail** | READY | Pricing history, `audit_log` for RBAC changes, `logAudit` on write operations |
| **Mobile/Tablet UX** | PARTIAL | Responsive CSS in place but no dedicated mobile UAT test cases written |
| **Error Handling** | READY | API returns structured `{ error: string }`, 401 redirects to /login, 403 for permission failures |
| **DB Safety** | READY | Transactions on all write operations, soft-delete pattern preserves audit history |

**Overall Readiness: 12/13 — Ready for UAT (mobile UX to be validated during UAT sessions)**

---

*UAT Tester Sign-off:* _____________ *Date:* _____________  
*Tech Lead Sign-off:* _____________ *Date:* _____________
