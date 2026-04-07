require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const { query } = require('./index');

async function migrate3() {
  console.log('Running migration 3...');

  // Create user_schemes table for per-scheme active status
  await query(`
    CREATE TABLE IF NOT EXISTS user_schemes (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      scheme VARCHAR(100) NOT NULL,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(user_id, scheme)
    )
  `);

  // Migrate existing scheme data from users.scheme column
  const { rows: clients } = await query(`
    SELECT id, scheme FROM users WHERE scheme IS NOT NULL AND scheme != '' AND user_type = 'client'
  `);

  for (const client of clients) {
    const schemes = client.scheme.split(',').map(s => s.trim()).filter(Boolean);
    for (const scheme of schemes) {
      await query(`
        INSERT INTO user_schemes (user_id, scheme, is_active)
        VALUES ($1, $2, true)
        ON CONFLICT (user_id, scheme) DO NOTHING
      `, [client.id, scheme]);
    }
  }

  console.log(`Migrated scheme data for ${clients.length} clients.`);
  console.log('Migration 3 complete.');
}

migrate3().catch(err => { console.error(err); process.exit(1); });
