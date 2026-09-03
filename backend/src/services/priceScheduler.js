const cron = require('node-cron');
const { query } = require('../db');
const { tracked } = require('./cronTracker');

const YahooFinance = require('yahoo-finance2').default;
const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

// Set by index.js so scheduler can emit socket events
let _io = null;
function setIo(io) { _io = io; }

async function fetchLivePrice(symbol) {
  const base = symbol.toUpperCase().trim();
  const isNumeric = /^\d+$/.test(base);
  const candidates = isNumeric
    ? [base + '.BO', base + '.NS', base]
    : [base + '.NS', base + '.BO', base];

  for (const sym of candidates) {
    try {
      const q = await yf.quote(sym, {}, { validateResult: false });
      if (q?.regularMarketPrice) return q.regularMarketPrice;
    } catch {}
  }
  return null;
}

// Get all shareholder user IDs to notify
async function getShareholderIds() {
  const { rows } = await query(
    `SELECT id FROM users WHERE user_type = 'shareholder' AND is_active = TRUE`
  );
  return rows.map(r => r.id);
}

async function checkAndFireAlerts(stockId, price) {
  const { rows: alerts } = await query(
    `SELECT * FROM stock_alerts WHERE stock_id = $1 AND is_active = TRUE`,
    [stockId]
  );
  if (!alerts.length) return;

  const alert = alerts[0];
  const { rows: [stock] } = await query(`SELECT symbol, name FROM stocks WHERE id = $1`, [stockId]);
  const shareholderIds = await getShareholderIds();
  if (!shareholderIds.length) return;

  const triggeredAlerts = [];

  if (alert.stop_loss && price <= parseFloat(alert.stop_loss)) {
    triggeredAlerts.push({
      type: 'stop_loss',
      message: `${stock.symbol} hit stop loss ₹${parseFloat(alert.stop_loss).toFixed(2)} — current price ₹${price.toFixed(2)}`,
    });
  }

  if (alert.target && price >= parseFloat(alert.target)) {
    triggeredAlerts.push({
      type: 'target',
      message: `${stock.symbol} hit target ₹${parseFloat(alert.target).toFixed(2)} — current price ₹${price.toFixed(2)}`,
    });
  }

  for (const triggered of triggeredAlerts) {
    // Deduplicate: skip if a notification of this type for this stock was already sent today
    const { rows: existing } = await query(`
      SELECT 1 FROM notifications
      WHERE stock_id = $1 AND type = $2
        AND created_at >= CURRENT_DATE
        AND created_at < CURRENT_DATE + INTERVAL '1 day'
      LIMIT 1
    `, [stockId, triggered.type]);

    if (existing.length > 0) {
      console.log(`[Alerts] ${triggered.type} for ${stock.symbol} already notified today — skipping`);
      continue;
    }

    // Insert notification for every shareholder
    const inserted = await Promise.all(
      shareholderIds.map(uid =>
        query(`
          INSERT INTO notifications (user_id, stock_id, alert_id, type, message, triggered_price)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING *
        `, [uid, stockId, alert.id, triggered.type, triggered.message, price])
      )
    );

    // Emit real-time event to each connected shareholder
    if (_io) {
      for (let i = 0; i < shareholderIds.length; i++) {
        const notif = inserted[i].rows[0];
        _io.to(`user:${shareholderIds[i]}`).emit('notification', {
          ...notif,
          symbol: stock.symbol,
          stock_name: stock.name,
        });
      }
    }

    console.log(`[Alerts] ${triggered.type} triggered for ${stock.symbol} at ₹${price}`);
  }
}

async function refreshAllPrices() {
  // Refresh stocks flagged active, plus any stock still held (quantity > 0) by someone —
  // is_active only controls whether a stock is offered for new trades, not whether it needs live pricing.
  const { rows: stocks } = await query(`
    SELECT DISTINCT s.id, s.symbol
    FROM stocks s
    WHERE s.is_active = true
       OR EXISTS (SELECT 1 FROM holdings h WHERE h.stock_id = s.id AND h.quantity > 0)
    ORDER BY s.symbol
  `);

  if (!stocks.length) return;

  console.log(`[PriceScheduler] Refreshing prices for ${stocks.length} stocks...`);
  let updated = 0;
  let failed = 0;

  for (const stock of stocks) {
    try {
      const price = await fetchLivePrice(stock.symbol);
      if (price) {
        await query(
          `UPDATE stocks SET previous_close = current_price, current_price = $1, last_updated = NOW() WHERE id = $2`,
          [price, stock.id]
        );
        updated++;
        await checkAndFireAlerts(stock.id, price);
      } else {
        failed++;
        console.warn(`[PriceScheduler] No price found for ${stock.symbol}`);
      }
    } catch (err) {
      failed++;
      console.error(`[PriceScheduler] Error fetching ${stock.symbol}:`, err.message);
    }
  }

  console.log(`[PriceScheduler] Done — ${updated} updated, ${failed} failed`);
}

// Stocks with no active holdings and not flagged active — fully exited positions.
// Their current_price is only shown on the admin Stocks page, not in any portfolio view,
// so they're refreshed far less often than held/active stocks.
async function refreshExitedPrices() {
  const { rows: stocks } = await query(`
    SELECT s.id, s.symbol
    FROM stocks s
    WHERE s.is_active = false
      AND NOT EXISTS (SELECT 1 FROM holdings h WHERE h.stock_id = s.id AND h.quantity > 0)
    ORDER BY s.symbol
  `);

  if (!stocks.length) return;

  console.log(`[PriceScheduler] Refreshing prices for ${stocks.length} exited stocks...`);
  let updated = 0;
  let failed = 0;

  for (const stock of stocks) {
    try {
      const price = await fetchLivePrice(stock.symbol);
      if (price) {
        await query(
          `UPDATE stocks SET previous_close = current_price, current_price = $1, last_updated = NOW() WHERE id = $2`,
          [price, stock.id]
        );
        updated++;
      } else {
        failed++;
      }
    } catch (err) {
      failed++;
      console.error(`[PriceScheduler] Error fetching exited stock ${stock.symbol}:`, err.message);
    }
  }

  console.log(`[PriceScheduler] Exited refresh done — ${updated} updated, ${failed} failed`);
}

const MARKET_OPEN_MIN  = 9 * 60 + 15;
const MARKET_CLOSE_MIN = 15 * 60 + 30;

function getISTMinutesOfDay() {
  // Indian market hours: Mon–Fri 9:15 AM – 3:30 PM IST (UTC+5:30)
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const ist = new Date(now.getTime() + istOffset);
  const day = ist.getUTCDay(); // 0=Sun, 6=Sat
  const totalMinutes = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  return { day, totalMinutes };
}

function isMarketOpen() {
  const { day, totalMinutes } = getISTMinutesOfDay();
  if (day === 0 || day === 6) return false;
  return totalMinutes >= MARKET_OPEN_MIN && totalMinutes <= MARKET_CLOSE_MIN;
}

// True only on the 15-min tick that lands on market open or market close
function isExitedRefreshTime() {
  const { totalMinutes } = getISTMinutesOfDay();
  return totalMinutes === MARKET_OPEN_MIN || totalMinutes === MARKET_CLOSE_MIN;
}

function start() {
  // Run every 15 minutes — guard with isMarketOpen to skip weekends/off hours
  cron.schedule('*/15 * * * *', async () => {
    if (!isMarketOpen()) return;
    await tracked('Price refresh', async () => {
      await refreshAllPrices();
      if (isExitedRefreshTime()) {
        await refreshExitedPrices();
      }
    });
  });

  console.log('[PriceScheduler] Scheduled — active/held stocks every 15 min, exited stocks at market open & close, Mon–Fri (9:15–15:30 IST)');
}

module.exports = { start, refreshAllPrices, refreshExitedPrices, setIo };
