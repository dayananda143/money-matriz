require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const { query } = require('./index');

async function migrate2() {
  console.log('Running migration 2...');

  // Create platform_config table
  await query(`
    CREATE TABLE IF NOT EXISTS platform_config (
      id SERIAL PRIMARY KEY,
      key VARCHAR(100) UNIQUE NOT NULL,
      values JSONB NOT NULL DEFAULT '[]',
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Seed default user_types if not exists
  await query(`
    INSERT INTO platform_config (key, values)
    VALUES ('user_types', '["client", "shareholder"]')
    ON CONFLICT (key) DO NOTHING
  `);

  // Seed default roles if not exists
  await query(`
    INSERT INTO platform_config (key, values)
    VALUES ('roles', '["user", "admin", "super_admin"]')
    ON CONFLICT (key) DO NOTHING
  `);

  // Drop CHECK constraints on users table so new types/roles work
  // Get constraint names first
  const { rows: constraints } = await query(`
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'users'::regclass AND contype = 'c'
    AND conname LIKE '%user_type%' OR (conrelid = 'users'::regclass AND contype = 'c' AND conname LIKE '%role%')
  `);

  for (const c of constraints) {
    await query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS "${c.conname}"`);
    console.log(`Dropped constraint: ${c.conname}`);
  }

  console.log('Migration 2 complete.');
}

migrate2().catch(err => { console.error(err); process.exit(1); });
