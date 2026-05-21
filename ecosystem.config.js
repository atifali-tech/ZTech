/**
 * PM2 process manager configuration.
 *
 * Development:  pm2 start ecosystem.config.js
 * Production:   pm2 start ecosystem.config.js --env production
 *
 * After deploying: pm2 save && pm2 startup
 * Monitor:         pm2 monit
 * Logs:            pm2 logs
 */

module.exports = {
  apps: [
    {
      name: 'backend',
      script: 'index.js',
      cwd: './backend',
      watch: false,
      instances: 1,         // RBAC-02: keep at 1 until Redis cache is in place
      exec_mode: 'fork',

      // ── Environment: development ──────────────────────────────────────────
      env: {
        NODE_ENV: 'development',
        PORT:     4000,
      },

      // ── Environment: production ──────────────────────────────────────────
      // Secrets must be set in the host environment or a .env file — never
      // hardcoded here. PM2 reads the host's process.env automatically.
      env_production: {
        NODE_ENV:    'production',
        PORT:        4000,
        TRUST_PROXY: '1',
      },

      // ── Reliability ───────────────────────────────────────────────────────
      max_memory_restart: '512M',
      restart_delay:      2000,
      max_restarts:       10,
      min_uptime:         '5s',

      // ── Logging ───────────────────────────────────────────────────────────
      log_date_format:  'YYYY-MM-DD HH:mm:ss Z',
      error_file:       './logs/backend-error.log',
      out_file:         './logs/backend-out.log',
      merge_logs:       true,
    },

    {
      name: 'frontend',
      script: 'node_modules/next/dist/bin/next',
      args: 'start',          // 'start' not 'dev' in production
      cwd: './frontend',
      watch: false,
      instances: 1,
      exec_mode: 'fork',

      env: {
        NODE_ENV: 'development',
        PORT:     3000,
      },

      env_production: {
        NODE_ENV: 'production',
        PORT:     3000,
      },

      max_memory_restart: '1G',
      restart_delay:      3000,
      max_restarts:       10,
      min_uptime:         '10s',

      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file:      './logs/frontend-error.log',
      out_file:        './logs/frontend-out.log',
      merge_logs:      true,
    },
  ],
};
