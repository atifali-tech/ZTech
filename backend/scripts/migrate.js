'use strict';
/**
 * Migration runner — executes all numbered SQL files in backend/migrations/
 * in lexicographic order and records each run in a `schema_migrations` table.
 *
 * Usage:
 *   node scripts/migrate.js              — run all pending migrations
 *   node scripts/migrate.js --status     — list applied / pending migrations
 *   node scripts/migrate.js --dry-run    — print what would run, no DB writes
 *
 * Safe to run repeatedly — already-applied migrations are skipped.
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs       = require('fs');
const path     = require('path');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');
const DRY_RUN        = process.argv.includes('--dry-run');
const STATUS_ONLY    = process.argv.includes('--status');

async function run() {
  const pool = new Pool({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME     || 'zingparks',
    user:     process.env.DB_USER     || 'postgres',
    password: process.env.DB_PASSWORD,
  });

  const client = await pool.connect();
  try {
    // Ensure tracking table exists (idempotent)
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename   TEXT        PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Collect migration files in order
    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => /^\d+.*\.sql$/.test(f))
      .sort();

    if (files.length === 0) {
      console.log('No migration files found in', MIGRATIONS_DIR);
      return;
    }

    // Fetch already-applied migrations
    const { rows: applied } = await client.query('SELECT filename FROM schema_migrations');
    const appliedSet = new Set(applied.map(r => r.filename));

    const pending = files.filter(f => !appliedSet.has(f));

    if (STATUS_ONLY) {
      console.log('\nMigration status:');
      for (const f of files) {
        const status = appliedSet.has(f) ? '✅ applied' : '⏳ pending';
        console.log(`  ${status}  ${f}`);
      }
      console.log('');
      return;
    }

    if (pending.length === 0) {
      console.log('✅ All migrations are up to date.');
      return;
    }

    console.log(`Running ${pending.length} pending migration(s)${DRY_RUN ? ' [DRY RUN — no writes]' : ''}:\n`);

    for (const filename of pending) {
      const filepath = path.join(MIGRATIONS_DIR, filename);
      const sql      = fs.readFileSync(filepath, 'utf8');

      console.log(`  → ${filename}`);

      if (DRY_RUN) continue;

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (filename) VALUES ($1)',
          [filename]
        );
        await client.query('COMMIT');
        console.log(`     ✅ applied`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`     ❌ FAILED: ${err.message}`);
        console.error('     Migration rolled back. Fix the SQL and re-run.');
        process.exit(1);
      }
    }

    if (!DRY_RUN) {
      console.log('\n✅ All migrations applied successfully.');
    }
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => {
  console.error('Migration runner error:', err.message);
  process.exit(1);
});
