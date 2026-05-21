# ZTech CRM — Database Operations Guide
**System:** ZingParks Operations CRM  
**Database:** PostgreSQL 15  
**Last updated:** 2026-05-21

---

## Table of Contents

1. [Running Migrations](#1-running-migrations)
2. [Automated Backups](#2-automated-backups)
3. [Manual Backup](#3-manual-backup)
4. [Restore from Backup](#4-restore-from-backup)
5. [Restore Validation](#5-restore-validation)
6. [Health Checks](#6-health-checks)
7. [Maintenance Tasks](#7-maintenance-tasks)

---

## 1. Running Migrations

The migration runner lives at `backend/scripts/migrate.js`. It tracks applied migrations in a `schema_migrations` table and is safe to run multiple times.

### Check migration status
```bash
cd backend
npm run migrate:status
```
Output shows each file as `✅ applied` or `⏳ pending`.

### Dry run (no DB writes)
```bash
npm run migrate:dry-run
```
Prints which files would be applied without executing them.

### Apply all pending migrations
```bash
npm run migrate
```

### Adding a new migration

1. Create a numbered SQL file in `backend/migrations/`:
   ```
   005_add_feature.sql
   ```
2. Use `IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` to make it idempotent.
3. Test locally: `npm run migrate:dry-run` then `npm run migrate`.
4. Update `backend/tests/setup/globalSetup.js` if any new tables need to be in the test schema — or rely on the automatic migration execution at the bottom of `globalSetup.js`.

### Migration file naming convention
```
NNN_short_description.sql
```
- `NNN` is zero-padded (001, 002, …) to ensure correct lexicographic sort order.
- Description uses underscores, lowercase.

---

## 2. Automated Backups

### Setup (cron on Linux)

Save the following as `/opt/zingparks/backend/scripts/backup.sh` and make it executable:

```bash
#!/usr/bin/env bash
# Backup script for ZingParks PostgreSQL database.
# Schedule: daily at 02:00 via cron.
# Add to crontab: 0 2 * * * /opt/zingparks/backend/scripts/backup.sh >> /var/log/zingparks-backup.log 2>&1

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/zingparks}"
DB_NAME="${DB_NAME:-zingparks}"
DB_USER="${DB_USER:-postgres}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="zingparks_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting backup: $FILENAME"
pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "${BACKUP_DIR}/${FILENAME}"
echo "[$(date)] Backup complete: $(du -sh "${BACKUP_DIR}/${FILENAME}" | cut -f1)"

# Rotate: delete backups older than RETENTION_DAYS
find "$BACKUP_DIR" -name "zingparks_*.sql.gz" -mtime "+${RETENTION_DAYS}" -delete
echo "[$(date)] Rotation complete. Backups older than ${RETENTION_DAYS} days removed."

# Verify the backup is readable
gunzip -t "${BACKUP_DIR}/${FILENAME}" && echo "[$(date)] Backup integrity verified." \
  || { echo "[$(date)] ERROR: Backup file is corrupt!"; exit 1; }
```

```bash
chmod +x /opt/zingparks/backend/scripts/backup.sh

# Install cron entry (runs daily at 02:00)
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/zingparks/backend/scripts/backup.sh >> /var/log/zingparks-backup.log 2>&1") | crontab -
```

### Docker deployment backup
```bash
# Run from host — pipes directly from container
docker exec <postgres-container> pg_dump -U postgres zingparks \
  | gzip > /var/backups/zingparks/zingparks_$(date +%Y%m%d_%H%M%S).sql.gz
```

Add to host crontab for scheduled execution.

### Backup storage recommendations

| Environment | Retention | Storage Target |
|-------------|-----------|---------------|
| Production | 30 days daily + 12 months monthly | Object storage (S3/R2/GCS) |
| Staging | 7 days daily | Local disk |
| Development | As needed | Local disk |

For offsite replication, `aws s3 cp` or `rclone` the backup files to object storage after creation.

---

## 3. Manual Backup

```bash
# Full database dump (plain SQL, gzipped)
pg_dump -U postgres -h localhost zingparks | gzip > zingparks_manual_$(date +%Y%m%d).sql.gz

# Single table dump (e.g., audit_log for compliance)
pg_dump -U postgres -h localhost -t audit_log zingparks | gzip > audit_log_$(date +%Y%m%d).sql.gz

# Schema only (no data — useful for diffing)
pg_dump -U postgres -h localhost --schema-only zingparks > schema_$(date +%Y%m%d).sql
```

---

## 4. Restore from Backup

> ⚠️ **Restoring overwrites all current data.** Always verify you have the correct backup file and that nobody is actively using the system.

### Full restore (destroys and recreates database)

```bash
# 1. Stop the application
pm2 stop all   # or: docker compose -f docker-compose.prod.yml stop backend frontend

# 2. Drop and recreate the database
sudo -u postgres psql -c "DROP DATABASE IF EXISTS zingparks;"
sudo -u postgres psql -c "CREATE DATABASE zingparks;"

# 3. Restore
gunzip -c /var/backups/zingparks/zingparks_20260521_020000.sql.gz \
  | psql -U postgres zingparks

# 4. Re-run migrations (ensures schema is up to date if restoring from older backup)
cd /opt/zingparks/backend
npm run migrate

# 5. Restart the application
pm2 start ecosystem.config.js --env production
```

### Partial restore (single table)

```bash
# Restore only the audit_log (e.g., after accidental truncation)
gunzip -c audit_log_20260521.sql.gz | psql -U postgres zingparks
```

### Docker deployment restore

```bash
docker compose -f docker-compose.prod.yml stop backend frontend

gunzip -c /var/backups/zingparks/zingparks_20260521_020000.sql.gz \
  | docker exec -i <postgres-container> psql -U postgres -d zingparks

docker compose -f docker-compose.prod.yml run --rm backend node scripts/migrate.js
docker compose -f docker-compose.prod.yml start backend frontend
```

---

## 5. Restore Validation

After any restore, run these checks:

```bash
# 1. Row count sanity (compare against known baseline)
psql -U postgres zingparks -c "
  SELECT 'parks'      AS tbl, COUNT(*) FROM parks
  UNION ALL SELECT 'users',   COUNT(*) FROM users
  UNION ALL SELECT 'tickets', COUNT(*) FROM tickets
  UNION ALL SELECT 'roles',   COUNT(*) FROM roles;
"

# 2. Migration status
cd /opt/zingparks/backend && npm run migrate:status

# 3. API health check
curl http://localhost:4000/api/health
# Expected: {"status":"ok","database":"connected"}

# 4. Verify Super Admin login works (test with known credentials)
curl -X POST http://localhost:4000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@zingparks.com","password":"your_admin_password"}'
```

---

## 6. Health Checks

### API health endpoint
```bash
curl http://localhost:4000/api/health
```
Returns `{"status":"ok","database":"connected"}` on success, or `{"status":"error","database":"..."}` with the DB error message if PostgreSQL is unreachable.

### PostgreSQL connectivity
```bash
# Direct check
psql -U postgres -h localhost -c "SELECT 1;"

# Check active connections
psql -U postgres -c "SELECT count(*) FROM pg_stat_activity WHERE datname = 'zingparks';"

# Check slow queries (> 5s)
psql -U postgres zingparks -c "
  SELECT pid, now() - pg_stat_activity.query_start AS duration, query
  FROM pg_stat_activity
  WHERE state = 'active' AND (now() - pg_stat_activity.query_start) > interval '5 seconds';
"
```

### Disk space (PostgreSQL data directory)
```bash
# Check database size
psql -U postgres -c "SELECT pg_size_pretty(pg_database_size('zingparks'));"

# Check largest tables
psql -U postgres zingparks -c "
  SELECT relname, pg_size_pretty(pg_total_relation_size(relid))
  FROM pg_catalog.pg_statio_user_tables
  ORDER BY pg_total_relation_size(relid) DESC
  LIMIT 10;
"
```

---

## 7. Maintenance Tasks

### VACUUM ANALYZE (run weekly or after large data loads)
```bash
psql -U postgres zingparks -c "VACUUM ANALYZE;"
```

### Clear old notifications (manual, until NOTIF-02 is resolved)
```bash
psql -U postgres zingparks -c "
  DELETE FROM notifications
  WHERE is_read = TRUE AND created_at < NOW() - INTERVAL '90 days';
"
```

### Clear old audit_log entries (manual, until FIN-03 retention policy is implemented)
```bash
# Preview rows that would be deleted
psql -U postgres zingparks -c "
  SELECT COUNT(*) FROM audit_log WHERE created_at < NOW() - INTERVAL '2 years';
"

# Delete (run after verification)
psql -U postgres zingparks -c "
  DELETE FROM audit_log WHERE created_at < NOW() - INTERVAL '2 years';
"
```

### Reindex after large deletes
```bash
psql -U postgres zingparks -c "REINDEX DATABASE zingparks;"
```
