/**
 * ZingParks Operations Dashboard — Express API Server
 * Start: node index.js
 */

require('dotenv').config();
const { validateEnv } = require('./lib/env');

// Fail-fast: validates JWT_SECRET, DB_PASSWORD, and NODE_ENV sanity before anything starts.
validateEnv();

const { Pool }  = require('pg');
const createApp = require('./app');

const PORT = process.env.PORT || 4000;

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'zingparks',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD,
});

const app = createApp(pool);

// Trust the first reverse-proxy hop so express-rate-limit reads the real client IP
// from X-Forwarded-For instead of the proxy's IP. Set TRUST_PROXY=1 in production.
if (process.env.TRUST_PROXY) {
  app.set('trust proxy', parseInt(process.env.TRUST_PROXY) || 1);
}

pool.connect()
  .then(() => {
    console.log('✅ PostgreSQL connected');
    app.listen(PORT, () => {
      console.log(`🚀 ZingParks API running at http://localhost:${PORT}`);
      console.log(`   Health check: http://localhost:${PORT}/api/health`);
    });
  })
  .catch(err => {
    console.error('❌ Failed to connect to PostgreSQL:', err.message);
    console.error('   Check your .env file — DB_PASSWORD, DB_NAME, DB_HOST, DB_PORT');
    process.exit(1);
  });
