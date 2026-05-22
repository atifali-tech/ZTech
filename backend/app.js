'use strict';
const express      = require('express');
const cors         = require('cors');
const cookieParser = require('cookie-parser');
const helmet       = require('helmet');
const morgan       = require('morgan');

// SEC-02: Explicit allowed-origin list — never reflects all origins with credentials.
// Reads CORS_ORIGINS (comma-separated) or falls back to FRONTEND_URL.
// Development default: http://localhost:3000 only.
function buildCorsOptions() {
  const raw = process.env.CORS_ORIGINS || process.env.FRONTEND_URL || 'http://localhost:3000';
  const allowed = new Set(
    raw.split(',').map(o => o.trim()).filter(Boolean)
  );
  return {
    origin(origin, callback) {
      // No origin = same-origin request, mobile app, curl, or server-to-server — allow.
      if (!origin) return callback(null, true);
      if (allowed.has(origin)) return callback(null, true);
      callback(new Error(`CORS: origin '${origin}' is not allowed`));
    },
    credentials: true,
  };
}

module.exports = function createApp(pool) {
  const app = express();
  app.locals.pool = pool;

  // Security headers — sets X-Content-Type-Options, X-Frame-Options, HSTS, etc.
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // allow API consumers
    contentSecurityPolicy: false, // Next.js frontend manages its own CSP
  }));

  // Request logging: 'combined' in production (Apache format), 'dev' locally.
  if (process.env.NODE_ENV !== 'test') {
    app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
  }

  app.use(cors(buildCorsOptions()));
  app.use(express.json({ limit: '1mb' })); // SEC-08: prevent oversized payloads
  app.use(cookieParser());

  app.use('/api/auth',      require('./routes/auth'));
  app.use('/api/parks',     require('./routes/parks'));
  app.use('/api/users',     require('./routes/users'));
  app.use('/api/dashboard', require('./routes/dashboard'));
  app.use('/api/tickets',   require('./routes/tickets'));
  app.use('/api/rbac',      require('./routes/rbac'));
  app.use('/api/refunds',   require('./routes/refunds'));
  app.use('/api/finance',   require('./routes/finance'));
  app.use('/api/reports',        require('./routes/reports'));
  app.use('/api/notifications',  require('./routes/notifications'));
  app.use('/api/operations/zones',      require('./routes/zones'));
  app.use('/api/operations/gates',      require('./routes/gates'));
  app.use('/api/operations/devices',    require('./routes/devices'));
  app.use('/api/operations/counters',   require('./routes/counters'));
  app.use('/api/operations/shifts',     require('./routes/shifts'));
  app.use('/api/operations/occupancy',  require('./routes/occupancy'));
  app.use('/api/operations/alerts',     require('./routes/alerts'));
  app.use('/api/operations/incidents',  require('./routes/incidents'));
  app.use('/api/operations/dashboard',  require('./routes/opsDashboard'));

  app.get('/api/health', async (_req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({ status: 'ok', database: 'connected' });
    } catch (err) {
      res.status(500).json({ status: 'error', database: err.message });
    }
  });

  return app;
};
