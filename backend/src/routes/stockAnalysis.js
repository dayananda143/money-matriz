const router = require('express').Router();
const { authenticate, requireRole } = require('../middleware/auth');
const YahooFinance = require('yahoo-finance2').default;

const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Resolve an Indian ticker: try NSE (.NS) then BSE (.BO) then as-is
async function resolveSymbol(raw) {
  let base = raw.toUpperCase().trim();
  const bseMatch = base.match(/^(?:BOM|BSE):(.+)$/);
  if (bseMatch) base = bseMatch[1];
  const isNumeric = /^\d+$/.test(base);
  const candidates = isNumeric ? [base + '.BO', base + '.NS', base] : [base + '.NS', base + '.BO', base];
  for (const sym of candidates) {
    try {
      const q = await yf.quote(sym, {}, { validateResult: false });
      if (q?.regularMarketPrice) return sym;
    } catch {}
  }
  return null;
}

// GET /stock-analysis/:ticker (admin only)
router.get('/:ticker', authenticate, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const inputTicker = req.params.ticker.toUpperCase().trim();

    const hit = cache.get(inputTicker);
    if (hit && Date.now() - hit.t < CACHE_TTL) return res.json(hit.data);

    const symbol = await resolveSymbol(inputTicker);
    if (!symbol) {
      return res.status(400).json({ error: `Could not fetch analysis for "${inputTicker}". Check the ticker symbol.` });
    }

    const [summary, quote] = await Promise.all([
      yf.quoteSummary(symbol,
        { modules: ['price', 'summaryDetail', 'defaultKeyStatistics', 'financialData', 'assetProfile'] },
        { validateResult: false }
      ),
      yf.quote(symbol, {}, { validateResult: false }),
    ]);

    const p = summary.price ?? {};
    const sd = summary.summaryDetail ?? {};
    const ks = summary.defaultKeyStatistics ?? {};
    const fd = summary.financialData ?? {};
    const ap = summary.assetProfile ?? {};

    const currentPrice = p.regularMarketPrice ?? quote.regularMarketPrice ?? null;

    const data = {
      // Identity
      ticker: inputTicker,
      fetched_symbol: symbol,
      name: p.shortName || p.longName || quote.shortName || inputTicker,
      sector: ap.sector ?? null,
      industry: ap.industry ?? null,
      description: ap.longBusinessSummary ?? null,
      website: ap.website ?? null,
      employees: ap.fullTimeEmployees ?? null,

      // Price
      price: currentPrice,
      change: p.regularMarketChange ?? quote.regularMarketChange ?? null,
      change_percent: p.regularMarketChangePercent ?? quote.regularMarketChangePercent ?? null,
      previous_close: p.regularMarketPreviousClose ?? quote.regularMarketPreviousClose ?? null,
      open: p.regularMarketOpen ?? quote.regularMarketOpen ?? null,
      day_high: p.regularMarketDayHigh ?? quote.regularMarketDayHigh ?? null,
      day_low: p.regularMarketDayLow ?? quote.regularMarketDayLow ?? null,
      market_cap: p.marketCap ?? quote.marketCap ?? null,
      currency: p.currency ?? quote.currency ?? 'INR',

      // Valuation fundamentals
      pe_ttm: sd.trailingPE ?? null,
      pe_forward: sd.forwardPE ?? null,
      peg_ratio: ks.pegRatio ?? null,
      eps_ttm: ks.trailingEps ?? null,
      eps_forward: ks.forwardEps ?? null,
      price_to_book: ks.priceToBook ?? null,
      book_value: ks.bookValue ?? null,
      enterprise_value: ks.enterpriseValue ?? null,
      ev_to_revenue: ks.enterpriseToRevenue ?? null,
      ev_to_ebitda: ks.enterpriseToEbitda ?? null,

      // Financials
      total_revenue: fd.totalRevenue ?? null,
      revenue_growth: fd.revenueGrowth ?? null,
      gross_margins: fd.grossMargins ?? null,
      operating_margins: fd.operatingMargins ?? null,
      profit_margins: fd.profitMargins ?? null,
      ebitda: fd.ebitda ?? null,
      free_cash_flow: fd.freeCashflow ?? null,
      operating_cash_flow: fd.operatingCashflow ?? null,

      // Returns & leverage
      return_on_equity: fd.returnOnEquity ?? null,
      return_on_assets: fd.returnOnAssets ?? null,
      debt_to_equity: fd.debtToEquity ?? null,
      current_ratio: fd.currentRatio ?? null,

      // Dividend
      dividend_rate: sd.dividendRate ?? null,
      dividend_yield: sd.dividendYield ?? null,
      payout_ratio: sd.payoutRatio ?? null,

      // Technical
      week52_high: sd.fiftyTwoWeekHigh ?? quote.fiftyTwoWeekHigh ?? null,
      week52_low: sd.fiftyTwoWeekLow ?? quote.fiftyTwoWeekLow ?? null,
      week52_change: ks['52WeekChange'] ?? null,
      sma_50: p.fiftyDayAverage ?? quote.fiftyDayAverage ?? null,
      sma_200: p.twoHundredDayAverage ?? quote.twoHundredDayAverage ?? null,
      beta: sd.beta ?? null,
      volume: p.regularMarketVolume ?? quote.regularMarketVolume ?? null,
      avg_volume: sd.averageVolume ?? sd.averageVolume10days ?? quote.averageDailyVolume3Month ?? null,
      short_float: ks.shortPercentOfFloat ?? null,
      shares_outstanding: ks.sharesOutstanding ?? null,
      float_shares: ks.floatShares ?? null,

      // Analyst targets
      target_high: fd.targetHighPrice ?? null,
      target_low: fd.targetLowPrice ?? null,
      target_mean: fd.targetMeanPrice ?? null,
      target_median: fd.targetMedianPrice ?? null,
      recommendation: fd.recommendationKey ?? null,
      analyst_count: fd.numberOfAnalystOpinions ?? null,
    };

    const payload = { data };
    cache.set(inputTicker, { data: payload, t: Date.now() });
    res.json(payload);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: `Could not fetch analysis for "${req.params.ticker}". Check the ticker symbol.` });
  }
});

module.exports = router;
