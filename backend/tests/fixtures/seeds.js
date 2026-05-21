'use strict';

const PARKS = [
  { id: 'TP001', name: 'Test Park Alpha', city: 'Mumbai',  state: 'Maharashtra', color_hex: '#FF5733', capacity: 500 },
  { id: 'TP002', name: 'Test Park Beta',  city: 'Pune',    state: 'Maharashtra', color_hex: '#33FF57', capacity: 300 },
  { id: 'TP003', name: 'Test Park Gamma', city: 'Delhi',   state: 'Delhi',       color_hex: '#3357FF', capacity: 800 },
];

// Canonical user definitions used to seed each test file.
// loginAs() creates these on demand — EMAIL uniqueness is enforced.
const USERS = [
  { name: 'Super Admin',    email: 'superadmin@test.com',  role: 'Super Admin',    roleId: 1, password: 'testpass123' },
  { name: 'Corp Admin',     email: 'corpadmin@test.com',   role: 'Corporate Admin', roleId: 2, password: 'testpass123' },
  { name: 'Finance Head',   email: 'finance@test.com',     role: 'Finance Head',   roleId: 3, password: 'testpass123' },
  { name: 'Park Manager',   email: 'manager@test.com',     role: 'Park Manager',   roleId: 4, password: 'testpass123' },
  { name: 'Cashier',        email: 'cashier@test.com',     role: 'Cashier',        roleId: 5, password: 'testpass123' },
  { name: 'Authority User', email: 'authority@test.com',   role: 'Authority User', roleId: 6, password: 'testpass123' },
];

const ROLE_IDS = {
  'Super Admin': 1, 'Corporate Admin': 2, 'Finance Head': 3,
  'Park Manager': 4, 'Cashier': 5, 'Authority User': 6,
};

// Minimal valid ticket body for POST /api/tickets
function makeTicket(overrides = {}) {
  return {
    ticket_id:       `T${Date.now().toString(36)}${Math.random().toString(36).slice(2, 4)}`.toUpperCase().slice(0, 20),
    park_id:         'TP001',
    visitor_summary: { total_adults: 2, total_children: 0, total_toddlers: 0, total_seniors: 0 },
    price_map:       { adult: 500, child: 300, toddler: 200, senior: 400 },
    total_amount:    1000,
    cash_amount:     1000,
    upi_amount:      0,
    card_amount:     0,
    payment_mode:    'Cash',
    source:          'Counter',
    ...overrides,
  };
}

module.exports = { PARKS, USERS, ROLE_IDS, makeTicket };
