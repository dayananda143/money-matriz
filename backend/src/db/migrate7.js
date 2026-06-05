const { query } = require('./index');

async function migrate() {
  // Stock alerts: stop loss and target per stock (set by admin/shareholder)
  await query(`
    CREATE TABLE IF NOT EXISTS stock_alerts (
      id          SERIAL PRIMARY KEY,
      stock_id    INTEGER NOT NULL REFERENCES stocks(id) ON DELETE CASCADE,
      stop_loss   DECIMAL(12,4),
      target      DECIMAL(12,4),
      created_by  INTEGER REFERENCES users(id),
      is_active   BOOLEAN DEFAULT TRUE,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      updated_at  TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(stock_id)
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_stock_alerts_stock ON stock_alerts(stock_id)`);

  // Notifications sent to users when stop_loss or target is hit
  await query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id               SERIAL PRIMARY KEY,
      user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      stock_id         INTEGER REFERENCES stocks(id) ON DELETE SET NULL,
      alert_id         INTEGER REFERENCES stock_alerts(id) ON DELETE SET NULL,
      type             VARCHAR(20) NOT NULL CHECK (type IN ('stop_loss', 'target')),
      message          TEXT NOT NULL,
      triggered_price  DECIMAL(12,4),
      is_read          BOOLEAN DEFAULT FALSE,
      created_at       TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read)`);

  console.log('migrate7: stock_alerts and notifications tables ready');
}

migrate().catch(e => { console.error(e); process.exit(1); });
