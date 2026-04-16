require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const { query } = require('./index');

async function migrate5() {
  console.log('Running migration 5...');

  await query(`
    CREATE TABLE IF NOT EXISTS idea_comments (
      id SERIAL PRIMARY KEY,
      idea_id INTEGER NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  console.log('Migration 5 complete — idea_comments table created.');
}

migrate5().catch(err => { console.error(err); process.exit(1); });
