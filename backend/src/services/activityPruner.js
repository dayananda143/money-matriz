const cron = require('node-cron');
const { query } = require('../db');
const { tracked } = require('./cronTracker');

// How long entries are kept. Price refreshes are the scheduler re-quoting two dozen
// stocks every 15 minutes — roughly nine in ten rows, and of no interest once the
// next quote lands — so they go sooner than the record of what people did.
const RETENTION_DAYS = parseInt(process.env.ACTIVITY_RETENTION_DAYS, 10) || 365;
const PRICE_RETENTION_DAYS = parseInt(process.env.ACTIVITY_PRICE_RETENTION_DAYS, 10) || 90;

const PRICE_ONLY = `(table_name = 'stocks' AND changed_fields IS NOT NULL
  AND changed_fields <@ ARRAY['current_price','previous_close','last_updated']::text[])`;

const BATCH = 5000;

// Deleted in batches so a large backlog never becomes one long transaction holding
// locks. Each pass stops when it clears fewer rows than the batch size.
async function deleteOlderThan(days, extraCondition) {
  let removed = 0;
  for (;;) {
    const { rowCount } = await query(
      `DELETE FROM activity_log WHERE id IN (
         SELECT id FROM activity_log
         WHERE created_at < NOW() - ($1 || ' days')::interval
           ${extraCondition ? `AND ${extraCondition}` : ''}
         ORDER BY id LIMIT ${BATCH}
       )`,
      [String(days)]
    );
    removed += rowCount;
    if (rowCount < BATCH) return removed;
  }
}

async function prune() {
  // Price noise first, so the general sweep has less to walk through.
  const prices = await deleteOlderThan(PRICE_RETENTION_DAYS, PRICE_ONLY);
  const rest = await deleteOlderThan(RETENTION_DAYS, null);
  const total = prices + rest;
  if (total) {
    console.log(`[ActivityPruner] removed ${total} entries (${prices} price refreshes, ${rest} older than ${RETENTION_DAYS} days)`);
  }
  return { prices, rest, total };
}

function start() {
  // Noon server time. Indian market hours fall at 23:45–06:00 here, so this never
  // overlaps the price scheduler.
  cron.schedule('0 12 * * *', () => tracked('Activity log pruning', prune));
  console.log(`[ActivityPruner] Scheduled daily at 12:00 — keeping ${RETENTION_DAYS} days, price refreshes ${PRICE_RETENTION_DAYS} days`);
}

module.exports = { start, prune };

// Also runnable on its own — `node src/services/activityPruner.js` — so the same
// code can be driven by system cron, or run by hand to clear a backlog now.
if (require.main === module) {
  prune()
    .then(({ total }) => {
      console.log(total ? `[ActivityPruner] done` : '[ActivityPruner] nothing to remove');
      process.exit(0);
    })
    .catch((err) => { console.error('[ActivityPruner] failed:', err.message); process.exit(1); });
}
