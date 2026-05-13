const { query } = require('./index');

async function migrate() {
  await query(`
    CREATE TABLE IF NOT EXISTS webauthn_credentials (
      id               SERIAL PRIMARY KEY,
      credential_id    TEXT UNIQUE NOT NULL,
      user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      public_key       TEXT NOT NULL,
      counter          BIGINT NOT NULL DEFAULT 0,
      device_type      TEXT,
      backed_up        BOOLEAN DEFAULT FALSE,
      transports       TEXT DEFAULT '["internal"]',
      created_at       TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_webauthn_user ON webauthn_credentials(user_id)`);
  console.log('migrate6: webauthn_credentials table ready');
}

migrate().catch(e => { console.error(e); process.exit(1); });
