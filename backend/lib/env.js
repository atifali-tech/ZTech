'use strict';

/**
 * Validates required environment variables at process startup.
 * Call once from index.js before anything else runs.
 * Fails hard — never silently falls back to insecure defaults.
 */

const REQUIRED = [
  { key: 'JWT_SECRET',   hint: 'Generate with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"' },
  { key: 'DB_PASSWORD',  hint: 'PostgreSQL password for DB_USER' },
];

// In production, these must also be set explicitly.
const REQUIRED_IN_PRODUCTION = [
  { key: 'CORS_ORIGINS',  hint: 'Comma-separated list of allowed frontend origins, e.g. https://app.yourdomain.com' },
  { key: 'FRONTEND_URL',  hint: 'Primary frontend URL, e.g. https://app.yourdomain.com' },
];

const MIN_JWT_SECRET_LEN = 32;

// Values that indicate a placeholder secret was not replaced.
const PLACEHOLDER_PATTERNS = ['changeme', 'secret', 'example', 'placeholder', 'replace'];

function validateEnv() {
  const missing = REQUIRED.filter(({ key }) => !process.env[key]);

  if (process.env.NODE_ENV === 'production') {
    for (const item of REQUIRED_IN_PRODUCTION) {
      if (!process.env[item.key]) missing.push(item);
    }
  }

  if (missing.length) {
    console.error('');
    console.error('FATAL: Missing required environment variables:');
    for (const { key, hint } of missing) {
      console.error(`  ${key}  →  ${hint}`);
    }
    console.error('');
    console.error('  Copy backend/.env.example → backend/.env and fill in all values.');
    console.error('');
    process.exit(1);
  }

  const secret = process.env.JWT_SECRET;
  if (secret.length < MIN_JWT_SECRET_LEN) {
    console.error('');
    console.error(`FATAL: JWT_SECRET must be at least ${MIN_JWT_SECRET_LEN} characters (got ${secret.length}).`);
    console.error('  Generate a strong secret:');
    console.error('    node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"');
    console.error('');
    process.exit(1);
  }

  if (process.env.NODE_ENV === 'production') {
    for (const { key } of [...REQUIRED, ...REQUIRED_IN_PRODUCTION]) {
      const val = (process.env[key] || '').toLowerCase();
      if (PLACEHOLDER_PATTERNS.some(p => val.includes(p))) {
        console.error(`FATAL: ${key} looks like a development placeholder. Set a real value in production.`);
        process.exit(1);
      }
    }
  }
}

module.exports = { validateEnv };
