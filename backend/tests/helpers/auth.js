'use strict';
const jwt    = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { randomUUID: uuid } = require('crypto');

const SECRET = process.env.JWT_SECRET || 'zingparks_dev_secret_change_in_prod';

const ROLE_IDS = {
  'Super Admin': 1, 'Corporate Admin': 2, 'Finance Head': 3,
  'Park Manager': 4, 'Cashier': 5, 'Authority User': 6,
};

function generateToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: '1h' });
}

// Creates (or upserts) a test user in the DB and returns a signed token + user details.
// The user is created with a known password so login tests can call /api/auth/login directly.
async function loginAs(pool, roleName, overrides = {}) {
  const roleId = ROLE_IDS[roleName];
  if (!roleId) throw new Error(`Unknown role: ${roleName}`);

  const id    = overrides.id    || uuid();
  const email = overrides.email || `${roleName.toLowerCase().replace(/ /g, '.')}.${id.slice(0, 6)}@test.com`;
  const name  = overrides.name  || `${roleName} User`;
  const hash  = await bcrypt.hash(overrides.password || 'testpass123', 10);

  await pool.query(
    `INSERT INTO users (id, name, email, password_hash, role, role_id)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (email) DO UPDATE
       SET role_id = EXCLUDED.role_id, role = EXCLUDED.role
     RETURNING id`,
    [id, name, email, hash, roleName, roleId]
  );

  // Re-fetch actual id (in case of ON CONFLICT update)
  const { rows } = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  const userId = rows[0].id;

  const payload = {
    id: userId, email, name, role: roleName, roleId,
    parkId: null, parkIds: [],
  };
  return { token: generateToken(payload), id: userId, email, name, roleId, roleName };
}

module.exports = { generateToken, loginAs, ROLE_IDS };
