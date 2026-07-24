const { query } = require('./index');

async function migrate() {
  await query(`
    CREATE TABLE IF NOT EXISTS gate_analyses (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      ticker VARCHAR(20) NOT NULL,
      company VARCHAR(255),
      decision VARCHAR(20),
      results_json JSONB NOT NULL,
      saved_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(user_id, ticker)
    )
  `);
  console.log('migrate9: gate_analyses ready');
}

migrate().catch(e => { console.error(e); process.exit(1); });
