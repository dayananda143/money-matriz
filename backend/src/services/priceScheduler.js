const cron = require('node-cron');
const { query } = require('../db');

const YahooFinance = require('yahoo-finance2').default;
const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

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

async function refreshAllPrices() {
  const { rows: stocks } = await query(
    `SELECT id, symbol FROM stocks WHERE is_active = true ORDER BY symbol`
  );

  if (!stocks.length) return;

  console.log(`[PriceScheduler] Refreshing prices for ${stocks.length} active stocks...`);
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
        console.warn(`[PriceScheduler] No price found for ${stock.symbol}`);
      }
    } catch (err) {
      failed++;
      console.error(`[PriceScheduler] Error fetching ${stock.symbol}:`, err.message);
    }
  }

  console.log(`[PriceScheduler] Done — ${updated} updated, ${failed} failed`);
}

function isMarketOpen() {
  // Indian market hours: Mon–Fri 9:15 AM – 3:30 PM IST (UTC+5:30)
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const ist = new Date(now.getTime() + istOffset);
  const day = ist.getUTCDay(); // 0=Sun, 6=Sat
  if (day === 0 || day === 6) return false;
  const hours = ist.getUTCHours();
  const minutes = ist.getUTCMinutes();
  const totalMinutes = hours * 60 + minutes;
  return totalMinutes >= 9 * 60 + 15 && totalMinutes <= 15 * 60 + 30;
}

function start() {
  // Run every 15 minutes — guard with isMarketOpen to skip weekends/off hours
  cron.schedule('*/15 * * * *', async () => {
    if (!isMarketOpen()) return;
    try {
      await refreshAllPrices();
    } catch (err) {
      console.error('[PriceScheduler] Unexpected error:', err.message);
    }
  });

  console.log('[PriceScheduler] Scheduled — runs every 15 min during market hours (9:15–15:30 IST, Mon–Fri)');
}

module.exports = { start, refreshAllPrices };
