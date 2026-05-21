/**
 * RBAC Migration — run once: node backend/db/migrate-rbac.js
 * Safe to re-run (idempotent).
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'zingparks',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD,
});

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── 1. Roles ──────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id          SERIAL PRIMARY KEY,
        name        VARCHAR(50)  UNIQUE NOT NULL,
        description TEXT
      )
    `);
    console.log('✅ roles table ready');

    // ── 2. Permissions ────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS permissions (
        id    SERIAL PRIMARY KEY,
        name  VARCHAR(100) UNIQUE NOT NULL,
        label VARCHAR(150)
      )
    `);
    console.log('✅ permissions table ready');

    // ── 3. Role → Permission mapping ──────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS role_permissions (
        role_id       INT REFERENCES roles(id) ON DELETE CASCADE,
        permission_id INT REFERENCES permissions(id) ON DELETE CASCADE,
        PRIMARY KEY (role_id, permission_id)
      )
    `);
    console.log('✅ role_permissions table ready');

    // ── 4. User → Parks (multi-park support) ──────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_parks (
        user_id VARCHAR(36) REFERENCES users(id) ON DELETE CASCADE,
        park_id VARCHAR(10) REFERENCES parks(id) ON DELETE CASCADE,
        PRIMARY KEY (user_id, park_id)
      )
    `);
    console.log('✅ user_parks table ready');

    // ── 5. Audit log ──────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id          BIGSERIAL PRIMARY KEY,
        actor_id    VARCHAR(36),
        actor_email VARCHAR(150),
        action      VARCHAR(100) NOT NULL,
        target_type VARCHAR(50),
        target_id   VARCHAR(100),
        meta        JSONB,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_log_actor    ON audit_log (actor_id);
      CREATE INDEX IF NOT EXISTS idx_audit_log_action   ON audit_log (action);
      CREATE INDEX IF NOT EXISTS idx_audit_log_created  ON audit_log (created_at DESC);
    `);
    console.log('✅ audit_log table ready');

    // ── 6. Add role_id + capacity to users / parks ────────────────────────────
    await client.query(`ALTER TABLE users  ADD COLUMN IF NOT EXISTS role_id  INT REFERENCES roles(id) ON DELETE SET NULL`);
    await client.query(`ALTER TABLE parks  ADD COLUMN IF NOT EXISTS capacity INT`);
    console.log('✅ schema columns extended');

    // ── 7. Seed roles (fixed IDs via explicit inserts) ────────────────────────
    const roleRows = [
      [1, 'Super Admin',     'Full system access across all parks'],
      [2, 'Corporate Admin', 'Cross-park analytics and user management'],
      [3, 'Finance Head',    'Revenue, finance data, and approvals'],
      [4, 'Park Manager',    'Single or multi-park operational management'],
      [5, 'Cashier',         'Ticket sales and daily operations'],
      [6, 'Authority User',  'Read-only regulatory and audit access'],
    ];
    for (const [id, name, description] of roleRows) {
      await client.query(
        `INSERT INTO roles (id, name, description) VALUES ($1, $2, $3)
         ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description`,
        [id, name, description]
      );
    }
    // Ensure sequence is ahead of seeded IDs
    await client.query(`SELECT setval('roles_id_seq', (SELECT MAX(id) FROM roles))`);
    console.log('✅ roles seeded');

    // ── 8. Seed permissions ───────────────────────────────────────────────────
    const permRows = [
      ['dashboard.view',   'View Dashboard'],
      ['analytics.view',   'View Analytics'],
      ['analytics.export', 'Export Analytics Data'],
      ['tickets.view',     'View Tickets'],
      ['tickets.create',   'Create Tickets'],
      ['tickets.cancel',   'Cancel Tickets'],
      ['parks.view',       'View Parks'],
      ['parks.create',     'Create Parks'],
      ['parks.edit',       'Edit Parks'],
      ['parks.delete',     'Delete Parks'],
      ['users.view',       'View Users'],
      ['users.create',     'Create Users'],
      ['users.edit',       'Edit Users'],
      ['users.delete',     'Delete Users'],
      ['roles.view',       'View Roles & Permissions'],
      ['roles.manage',     'Manage Role Permissions'],
      ['finance.view',     'View Finance Data'],
      ['finance.approve',  'Approve Finance Actions'],
      ['reports.view',     'View Reports'],
      ['reports.export',   'Export Reports'],
    ];
    for (const [name, label] of permRows) {
      await client.query(
        `INSERT INTO permissions (name, label) VALUES ($1, $2)
         ON CONFLICT (name) DO UPDATE SET label = EXCLUDED.label`,
        [name, label]
      );
    }
    console.log('✅ permissions seeded');

    // ── 9. Build permission lookup map ────────────────────────────────────────
    const { rows: permList } = await client.query('SELECT id, name FROM permissions');
    const pid = Object.fromEntries(permList.map(p => [p.name, p.id]));

    // ── 10. Seed role_permissions ─────────────────────────────────────────────
    const ALL = permList.map(p => p.id);
    const rolePerms = {
      1: ALL,  // Super Admin: everything
      2: ['dashboard.view','analytics.view','analytics.export','tickets.view',
          'parks.view','users.view','users.create','users.edit',
          'finance.view','reports.view','reports.export'].map(n => pid[n]),
      3: ['dashboard.view','analytics.view','analytics.export',
          'tickets.view','finance.view','finance.approve',
          'reports.view','reports.export'].map(n => pid[n]),
      4: ['dashboard.view','analytics.view','tickets.view','tickets.create',
          'tickets.cancel','parks.view','parks.edit',
          'users.view','reports.view'].map(n => pid[n]),
      5: ['dashboard.view','tickets.view','tickets.create'].map(n => pid[n]),
      6: ['dashboard.view','analytics.view','parks.view','reports.view'].map(n => pid[n]),
    };
    for (const [roleId, permIds] of Object.entries(rolePerms)) {
      for (const permId of permIds) {
        await client.query(
          `INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [parseInt(roleId), permId]
        );
      }
    }
    console.log('✅ role_permissions seeded');

    // ── 11. Migrate users.park_id → user_parks ────────────────────────────────
    await client.query(`
      INSERT INTO user_parks (user_id, park_id)
      SELECT id, park_id FROM users WHERE park_id IS NOT NULL
      ON CONFLICT DO NOTHING
    `);
    console.log('✅ existing park_id migrated to user_parks');

    // ── 12. Assign role_id to existing users based on role string ─────────────
    const roleMappings = [
      ['Super Admin',  1],
      ['Corporate Admin', 2],
      ['Finance Head', 3],
      ['Park Manager', 4],
      ['Park Admin',   4],  // old name → Park Manager
      ['Cashier',      5],
      ['Authority User', 6],
    ];
    for (const [roleName, roleId] of roleMappings) {
      await client.query(
        `UPDATE users SET role_id = $1 WHERE LOWER(role) = LOWER($2) AND role_id IS NULL`,
        [roleId, roleName]
      );
    }
    // Default unmatched to Cashier
    await client.query(`UPDATE users SET role_id = 5 WHERE role_id IS NULL`);
    console.log('✅ users.role_id populated');

    await client.query('COMMIT');
    console.log('\n🎉 RBAC migration complete.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(() => process.exit(1));
