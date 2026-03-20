const { query } = require('./index');
const bcrypt = require('bcryptjs');

async function migrate() {
  console.log('Running migrations...');

  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('client', 'shareholder')),
      role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin', 'super_admin')),
      phone VARCHAR(50),
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS stocks (
      id SERIAL PRIMARY KEY,
      symbol VARCHAR(20) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      sector VARCHAR(100),
      current_price DECIMAL(12,4) DEFAULT 0,
      previous_close DECIMAL(12,4) DEFAULT 0,
      last_updated TIMESTAMP,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS relationships (
      id SERIAL PRIMARY KEY,
      shareholder_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      client_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS holdings (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      stock_id INTEGER REFERENCES stocks(id) ON DELETE CASCADE,
      quantity DECIMAL(14,4) NOT NULL DEFAULT 0,
      avg_buy_price DECIMAL(12,4) DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(user_id, stock_id)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS transactions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      stock_id INTEGER REFERENCES stocks(id) ON DELETE CASCADE,
      type VARCHAR(10) NOT NULL CHECK (type IN ('buy', 'sell')),
      quantity DECIMAL(14,4) NOT NULL,
      price DECIMAL(12,4) NOT NULL,
      total DECIMAL(14,4) NOT NULL,
      notes TEXT,
      executed_at TIMESTAMP DEFAULT NOW(),
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS fund_movements (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      type VARCHAR(15) NOT NULL CHECK (type IN ('deposit', 'withdrawal')),
      amount DECIMAL(14,4) NOT NULL,
      notes TEXT,
      executed_at TIMESTAMP DEFAULT NOW(),
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS balances (
      id SERIAL PRIMARY KEY,
      user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      cash_balance DECIMAL(14,4) DEFAULT 0,
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Add brokerage to stocks if not exists
  await query(`ALTER TABLE stocks ADD COLUMN IF NOT EXISTS brokerage DECIMAL(12,4) DEFAULT 0`);

  // Per-group settled flags
  await query(`ALTER TABLE stock_groups ADD COLUMN IF NOT EXISTS investment_settled BOOLEAN DEFAULT false`);
  await query(`ALTER TABLE stock_groups ADD COLUMN IF NOT EXISTS pnl_settled BOOLEAN DEFAULT false`);

  // Brokerage transactions (multiple per stock)
  await query(`
    CREATE TABLE IF NOT EXISTS brokerage_transactions (
      id SERIAL PRIMARY KEY,
      stock_id INTEGER REFERENCES stocks(id) ON DELETE CASCADE,
      label VARCHAR(100),
      amount DECIMAL(12,4) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Stock groups (transaction groups per stock)
  await query(`
    CREATE TABLE IF NOT EXISTS stock_groups (
      id SERIAL PRIMARY KEY,
      stock_id INTEGER REFERENCES stocks(id) ON DELETE CASCADE,
      label VARCHAR(100) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await query(`ALTER TABLE holdings ADD COLUMN IF NOT EXISTS group_id INTEGER REFERENCES stock_groups(id) ON DELETE SET NULL`);
  await query(`ALTER TABLE brokerage_transactions ADD COLUMN IF NOT EXISTS group_id INTEGER REFERENCES stock_groups(id) ON DELETE CASCADE`);

  // Add holder_user_id to stocks if not exists
  await query(`ALTER TABLE stocks ADD COLUMN IF NOT EXISTS holder_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL`);
  await query(`ALTER TABLE stocks ADD COLUMN IF NOT EXISTS investment_settled BOOLEAN DEFAULT false`);
  await query(`ALTER TABLE stocks ADD COLUMN IF NOT EXISTS pnl_settled BOOLEAN DEFAULT false`);

  // Brokerage per sell transaction
  await query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS brokerage DECIMAL(12,4) DEFAULT 0`);

  // Stockholder assigned to each transaction group
  await query(`ALTER TABLE stock_groups ADD COLUMN IF NOT EXISTS holder_id INTEGER REFERENCES users(id) ON DELETE SET NULL`);

  // Seed super admin if not exists
  const { rows } = await query(`SELECT id FROM users WHERE role = 'super_admin' LIMIT 1`);
  if (rows.length === 0) {
    const hash = await bcrypt.hash('Admin@1234', 10);
    await query(`
      INSERT INTO users (name, email, password_hash, user_type, role)
      VALUES ('Super Admin', 'admin@moneymatriz.com', $1, 'shareholder', 'super_admin')
    `, [hash]);
    console.log('Super admin seeded: admin@moneymatriz.com / Admin@1234');
  }

  console.log('Migrations complete.');
}

migrate().catch(err => { console.error(err); process.exit(1); });
