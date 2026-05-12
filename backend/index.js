/**
 * ZingParks Operations Dashboard — Express API Server
 * Start: node index.js
 */

require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const { Pool }   = require('pg');

const app  = express();
const PORT = process.env.PORT || 4000;

// ─── Database pool ───────────────────────────────────────────────────────────
const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'zingparks',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD,
});

// Make pool available to all route handlers
app.locals.pool = pool;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  methods: ['GET'],
}));
app.use(express.json());

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/dashboard', require('./routes/dashboard'));

// Health check
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (err) {
    res.status(500).json({ status: 'error', database: err.message });
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────
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
