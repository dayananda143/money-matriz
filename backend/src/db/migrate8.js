const { query } = require('./index');

async function migrate() {
  // Tracks whether a shareholder has acknowledged a stock alert notification
  await query(`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS is_acknowledged BOOLEAN DEFAULT FALSE`);
  console.log('migrate8: notifications.is_acknowledged ready');
}

migrate().catch(e => { console.error(e); process.exit(1); });
