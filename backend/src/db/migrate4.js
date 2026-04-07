require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const { query } = require('./index');

async function migrate4() {
  console.log('Running migration 4...');

  await query(`
    CREATE TABLE IF NOT EXISTS trade_requests (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      stock_symbol VARCHAR(20) NOT NULL,
      stock_name VARCHAR(255),
      quantity DECIMAL(14,4) NOT NULL,
      buy_price DECIMAL(12,4) NOT NULL,
      amount DECIMAL(14,4) NOT NULL,
      notes TEXT,
      status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
      rejection_reason TEXT,
      reviewed_by INTEGER REFERENCES users(id),
      reviewed_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  console.log('Migration 4 complete — trade_requests table created.');
}

migrate4().catch(err => { console.error(err); process.exit(1); });
