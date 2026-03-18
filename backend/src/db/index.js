const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5, idleTimeoutMillis: 30000, connectionTimeoutMillis: 2000 });

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

module.exports = { query: (text, params) => pool.query(text, params), pool };
