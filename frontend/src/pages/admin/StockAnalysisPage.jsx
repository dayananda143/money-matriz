import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, TrendingUp, BarChart2, DollarSign, Activity, AlertCircle, ExternalLink,
         Copy, Check, ClipboardPaste, ChevronDown, ChevronUp, ShieldCheck, ShieldX, X,
         BookmarkPlus, Bookmark, Trash2, FileDown } from 'lucide-react';
import api from '../../api';
import { fmt } from '../../utils/format';

// ─── formatters ─────────────────────────────────────────────────────────────

function fmtLarge(v) {
  if (v == null) return '—';
  return fmt.compact(v);
}

function fmtVol(v) {
  if (v == null) return '—';
  if (v >= 1e7) return `${(v / 1e7).toFixed(2)}Cr`;
  if (v >= 1e5) return `${(v / 1e5).toFixed(2)}L`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return v.toLocaleString();
}

function fmtPct(v) {
  if (v == null) return '—';
  return `${(v * 100).toFixed(2)}%`;
}

function fmtNum(v, decimals = 2) {
  if (v == null || isNaN(v)) return '—';
  return Number(v).toFixed(decimals);
}

const RECO_LABEL  = { strong_buy: 'Strong Buy', buy: 'Buy', hold: 'Hold', underperform: 'Underperform', sell: 'Sell' };
const RECO_COLORS = {
  strong_buy:   'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800',
  buy:          'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800',
  hold:         'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800',
  underperform: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/30 border-rose-200 dark:border-rose-800',
  sell:         'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/30 border-rose-200 dark:border-rose-800',
};

const MOAT_LABELS = {
  brand_power: 'Brand Power', switching_costs: 'Switching Costs',
  cost_advantage: 'Cost Advantage', network_effects: 'Network Effects',
  patents_regulatory: 'Patents / Regulatory',
};

const DECISION_CONFIG = {
  buy:          { label: 'BUY',            color: 'bg-emerald-600',                    text: 'text-white', sub: 'Size position by conviction level' },
  watch:        { label: 'WATCH',          color: 'bg-amber-500',                      text: 'text-white', sub: 'Wait for better price or more clarity' },
  hard_no:      { label: 'HARD NO',        color: 'bg-rose-600',                       text: 'text-white', sub: 'Research more — Gate 1 or 3 failed' },
  do_not_buy:   { label: 'DO NOT BUY YET', color: 'bg-gray-700 dark:bg-gray-600',      text: 'text-white', sub: 'Cannot answer Gate 5 clearly enough' },
};

// ─── prompt builder ──────────────────────────────────────────────────────────

function buildPrompt(d) {
  const n = (v, dec = 2) => v != null ? Number(v).toFixed(dec) : 'N/A';
  const pct = (v) => v != null ? `${(v * 100).toFixed(2)}%` : 'N/A';
  const big = (v) => {
    if (v == null) return 'N/A';
    if (Math.abs(v) >= 1e7) return `₹${(v / 1e7).toFixed(2)}Cr`;
    if (Math.abs(v) >= 1e5) return `₹${(v / 1e5).toFixed(2)}L`;
    return `₹${v.toFixed(0)}`;
  };

  return `Analyze ${d.ticker} (${d.fetched_symbol || d.ticker}) using the 5-Gate Investment Framework below. Return ONLY valid JSON — no markdown, no explanation outside the JSON.

== COMPANY DATA (as of today) ==
Ticker: ${d.ticker}
Company: ${d.name}
Sector: ${d.sector ?? 'N/A'} | Industry: ${d.industry ?? 'N/A'}
Employees: ${d.employees?.toLocaleString() ?? 'N/A'}
Website: ${d.website ?? 'N/A'}

Price: ₹${n(d.price)} | Change: ${n(d.change_percent, 2)}%
Market Cap: ${big(d.market_cap)}
52W Range: ₹${n(d.week52_low)} – ₹${n(d.week52_high)}
Beta: ${n(d.beta)}

Valuation:
  P/E (TTM): ${n(d.pe_ttm)} | P/E (Forward): ${n(d.pe_forward)}
  PEG Ratio: ${n(d.peg_ratio)}
  EPS (TTM): ₹${n(d.eps_ttm)} | EPS (Forward): ₹${n(d.eps_forward)}
  Price/Book: ${n(d.price_to_book)}
  EV/Revenue: ${n(d.ev_to_revenue)} | EV/EBITDA: ${n(d.ev_to_ebitda)}

Financials (TTM):
  Revenue: ${big(d.total_revenue)} | Revenue Growth (YoY): ${pct(d.revenue_growth)}
  Gross Margin: ${pct(d.gross_margins)}
  Operating Margin: ${pct(d.operating_margins)}
  Net Margin: ${pct(d.profit_margins)}
  EBITDA: ${big(d.ebitda)}
  Free Cash Flow: ${big(d.free_cash_flow)}

Returns & Capital Structure:
  ROE: ${pct(d.return_on_equity)}
  ROA: ${pct(d.return_on_assets)}
  Debt/Equity: ${n(d.debt_to_equity)}
  Current Ratio: ${n(d.current_ratio)}

Dividends: Yield ${pct(d.dividend_yield)} | Rate ₹${n(d.dividend_rate)} | Payout ${pct(d.payout_ratio)}

Analyst Consensus: ${d.recommendation ?? 'N/A'} (${d.analyst_count ?? '?'} analysts)
Target Price: Low ₹${n(d.target_low)} | Mean ₹${n(d.target_mean)} | High ₹${n(d.target_high)}

== 5-GATE FRAMEWORK ==

Gate 1 — Business Understanding (binary pass/fail)
  - Can you explain the business in 2 sentences?
  - Do you understand who pays them and why?
  - Do you understand their cost structure?

Gate 2 — Business Quality Score (score each 1–5, need ≥18/25 total)
  - Revenue growth (3yr average CAGR — research if needed)
  - Profit margin trend (expanding=high score, shrinking=low)
  - Free cash flow consistency (3yr — research if needed)
  - ROE: above 15% healthy
  - Debt/Equity: below 1.5 preferred

Gate 3 — Competitive Moat
  Identify which exist: brand_power | switching_costs | cost_advantage | network_effects | patents_regulatory
  No moat = fail.

Gate 4 — Valuation Check (use data provided above)
  - Forward P/E vs industry average (research industry avg)
  - PEG ratio: below 1.5 reasonable
  - Price/FCF: compute as Market Cap / Free Cash Flow
  - EV/EBITDA: compare to industry

Gate 5 — Risk Assessment
  - What kills this company in 5 years?
  - What is a reasonable max loss % before selling?
  - What specific event triggers a sell?

== REQUIRED JSON STRUCTURE ==
Return exactly this structure, filling every field:

{
  "ticker": "${d.ticker}",
  "company": "${d.name}",
  "gate1": {
    "business_description": "2-sentence explanation of what they do",
    "who_pays": "who pays and why",
    "cost_structure": "main cost drivers",
    "pass": true
  },
  "gate2": {
    "revenue_growth": { "score": 4, "cagr_3yr": 0.08, "note": "brief note" },
    "margin_trend": { "score": 4, "direction": "expanding", "note": "brief note" },
    "fcf_consistency": { "score": 5, "note": "brief note" },
    "roe": { "score": 4, "value": 0.147, "note": "brief note" },
    "debt_equity": { "score": 3, "value": 1.76, "note": "brief note" },
    "total": 20,
    "pass": true
  },
  "gate3": {
    "moats": ["brand_power", "switching_costs"],
    "primary": "brand_power",
    "explanation": "why this moat is real and durable",
    "strength": "wide",
    "pass": true
  },
  "gate4": {
    "forward_pe": { "value": 28.5, "industry_avg": 22, "expensive": true, "note": "brief note" },
    "peg": { "value": 2.8, "expensive": true, "note": "brief note" },
    "price_fcf": { "value": 26, "expensive": false, "note": "brief note" },
    "ev_ebitda": { "value": 20.3, "industry_avg": 15, "expensive": true, "note": "brief note" },
    "verdict": "expensive",
    "pass": false
  },
  "gate5": {
    "kill_scenario": "specific 5-year threat",
    "max_loss_pct": 20,
    "sell_trigger": "specific measurable event",
    "pass": true
  },
  "decision": "watch",
  "conviction": "medium",
  "position_size": "none — wait for better entry",
  "summary": "2–3 sentence investment thesis and reasoning for the decision"
}

decision must be one of: buy | watch | hard_no | do_not_buy
conviction must be one of: high | medium | low
gate4 verdict must be one of: cheap | fairly_valued | expensive | very_expensive
gate3 strength must be one of: wide | narrow | none`;
}

// ─── shared UI ───────────────────────────────────────────────────────────────

function StatRow({ label, value, positive, sub }) {
  const valClass = positive === true
    ? 'text-emerald-600 dark:text-emerald-400'
    : positive === false
    ? 'text-rose-600 dark:text-rose-400'
    : 'text-gray-900 dark:text-white';
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-100 dark:border-gray-700 last:border-0">
      <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
      <div className="text-right">
        <span className={`text-sm font-semibold tabular-nums ${valClass}`}>{value}</span>
        {sub && <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function SectionCard({ title, Icon, children }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80">
        <Icon size={14} className="text-brand-500" />
        <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{title}</h3>
      </div>
      <div className="px-5 divide-y divide-gray-100 dark:divide-gray-700">{children}</div>
    </div>
  );
}

function Week52Bar({ price, low, high }) {
  if (price == null || low == null || high == null || high === low) return null;
  const pct = Math.max(0, Math.min(100, ((price - low) / (high - low)) * 100));
  return (
    <div className="py-3 border-b border-gray-100 dark:border-gray-700">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm text-gray-500 dark:text-gray-400">52-Week Range</span>
        <span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums">{fmt.currency(low)} – {fmt.currency(high)}</span>
      </div>
      <div className="relative h-2 bg-gray-100 dark:bg-gray-700 rounded-full">
        <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-rose-400 to-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
        <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-brand-600 border-2 border-white dark:border-gray-800 rounded-full shadow" style={{ left: `calc(${pct}% - 6px)` }} />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[10px] text-gray-400">52W Low</span>
        <span className="text-[10px] text-brand-500 font-medium">{fmt.currency(price)}</span>
        <span className="text-[10px] text-gray-400">52W High</span>
      </div>
    </div>
  );
}

function MAvgRow({ label, price, ma }) {
  if (ma == null) return null;
  const diff = price && ma ? ((price - ma) / ma) * 100 : null;
  const isAbove = diff != null && diff >= 0;
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-100 dark:border-gray-700 last:border-0">
      <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
      <div className="text-right">
        <span className="text-sm font-semibold tabular-nums text-gray-900 dark:text-white">{fmt.currency(ma)}</span>
        {diff != null && (
          <p className={`text-[11px] mt-0.5 font-medium tabular-nums ${isAbove ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {isAbove ? '+' : ''}{diff.toFixed(2)}% vs price
          </p>
        )}
      </div>
    </div>
  );
}

function TargetBar({ price, low, high, mean }) {
  if (low == null || high == null || mean == null) return null;
  const total = high - low;
  if (total <= 0) return null;
  const pricePct = Math.max(0, Math.min(100, ((price - low) / total) * 100));
  const meanPct  = Math.max(0, Math.min(100, ((mean  - low) / total) * 100));
  const upside = price ? ((mean - price) / price) * 100 : null;
  return (
    <div className="py-3 border-b border-gray-100 dark:border-gray-700">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm text-gray-500 dark:text-gray-400">Analyst Target Range</span>
        {upside != null && (
          <span className={`text-xs font-semibold tabular-nums ${upside >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {upside >= 0 ? '+' : ''}{upside.toFixed(1)}% potential
          </span>
        )}
      </div>
      <div className="relative h-2 bg-gray-100 dark:bg-gray-700 rounded-full mt-2">
        <div className="absolute inset-y-0 left-0 bg-blue-100 dark:bg-blue-900/40 rounded-full" style={{ width: '100%' }} />
        <div className="absolute top-1/2 -translate-y-1/2 w-2.5 h-4 bg-brand-500 rounded-sm" style={{ left: `calc(${meanPct}% - 5px)` }} />
        <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-gray-700 dark:bg-white border-2 border-white dark:border-gray-800 rounded-full shadow" style={{ left: `calc(${pricePct}% - 6px)` }} />
      </div>
      <div className="flex justify-between mt-1.5">
        <span className="text-[10px] text-gray-400">{fmt.currency(low)} low</span>
        <span className="text-[10px] text-brand-500 font-medium">Mean {fmt.currency(mean)}</span>
        <span className="text-[10px] text-gray-400">{fmt.currency(high)} high</span>
      </div>
    </div>
  );
}

// ─── skeleton ────────────────────────────────────────────────────────────────

function S({ className = '' }) {
  return <div className={`animate-pulse rounded bg-gray-200 dark:bg-gray-700 ${className}`} />;
}

function AnalysisSkeleton() {
  return (
    <div className="space-y-5">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <S className="h-6 w-48 mb-2" /><S className="h-4 w-32 mb-4" />
        <div className="flex gap-4"><S className="h-8 w-28" /><S className="h-8 w-20" /></div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {[0,1].map((i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-3">
            <S className="h-3 w-24 mb-4" />
            {Array.from({ length: 6 }).map((_, j) => (
              <div key={j} className="flex justify-between"><S className="h-3 w-28" /><S className="h-3 w-20" /></div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── 5-gate prompt section ───────────────────────────────────────────────────

function PromptSection({ d, onResults }) {
  const [copied, setCopied] = useState(false);
  const [jsonText, setJsonText] = useState('');
  const [parseError, setParseError] = useState('');
  const [open, setOpen] = useState(true);

  function handleCopy() {
    navigator.clipboard.writeText(buildPrompt(d)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleLoad() {
    setParseError('');
    try {
      const parsed = JSON.parse(jsonText.trim());
      if (!parsed.gate1 || !parsed.gate2 || !parsed.gate3 || !parsed.gate4 || !parsed.gate5) {
        setParseError('JSON is missing gate fields. Make sure you copied the full response from Claude.');
        return;
      }
      onResults(parsed);
    } catch {
      setParseError('Invalid JSON. Copy the full response from Claude and paste it exactly as-is.');
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <span className="w-6 h-6 rounded-full bg-brand-600 text-white text-xs font-bold flex items-center justify-center shrink-0">5</span>
          <span className="text-sm font-semibold text-gray-900 dark:text-white">5-Gate Framework Analysis</span>
          <span className="text-xs text-gray-400 dark:text-gray-500">· copy prompt → paste into Claude → upload results</span>
        </div>
        {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </button>

      {open && (
        <div className="border-t border-gray-100 dark:border-gray-700 p-5 space-y-5">
          <div className="space-y-2">
            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Step 1 — Copy this prompt and paste it into Claude
            </p>
            <div className="relative">
              <textarea
                readOnly
                value={buildPrompt(d)}
                rows={6}
                className="w-full text-xs font-mono text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 resize-none focus:outline-none"
              />
              <button
                onClick={handleCopy}
                className={`absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  copied
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
                    : 'bg-brand-600 hover:bg-brand-700 text-white'
                }`}
              >
                {copied ? <><Check size={12} /> Copied!</> : <><Copy size={12} /> Copy Prompt</>}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Step 2 — Paste Claude's JSON response here
            </p>
            <textarea
              value={jsonText}
              onChange={(e) => { setJsonText(e.target.value); setParseError(''); }}
              placeholder={'{\n  "ticker": "' + d.ticker + '",\n  "gate1": { ... },\n  ...\n}'}
              rows={7}
              className="w-full text-xs font-mono text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            {parseError && (
              <p className="flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400">
                <AlertCircle size={12} />{parseError}
              </p>
            )}
            <button
              onClick={handleLoad}
              disabled={!jsonText.trim()}
              className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              <ClipboardPaste size={15} />
              Load Gate Results
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── gate result components ──────────────────────────────────────────────────

function PassBadge({ pass }) {
  return pass
    ? <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1 rounded-full"><ShieldCheck size={11} />Pass</span>
    : <span className="flex items-center gap-1 text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 px-2.5 py-1 rounded-full"><ShieldX size={11} />Fail</span>;
}

function GateHeader({ number, title, pass }) {
  return (
    <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80">
      <div className="flex items-center gap-2.5">
        <span className={`w-6 h-6 rounded-full text-white text-xs font-bold flex items-center justify-center shrink-0 ${pass ? 'bg-emerald-500' : 'bg-rose-500'}`}>{number}</span>
        <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{title}</h3>
      </div>
      <PassBadge pass={pass} />
    </div>
  );
}

function ScoreDots({ score }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map((i) => (
        <div key={i} className={`w-2.5 h-2.5 rounded-full ${i <= score ? 'bg-brand-500' : 'bg-gray-200 dark:bg-gray-600'}`} />
      ))}
    </div>
  );
}

function Gate1Card({ g }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <GateHeader number={1} title="Business Understanding" pass={g.pass} />
      <div className="p-5 space-y-3">
        <div><p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">What they do</p><p className="text-sm text-gray-700 dark:text-gray-300">{g.business_description}</p></div>
        <div><p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Who pays &amp; why</p><p className="text-sm text-gray-700 dark:text-gray-300">{g.who_pays}</p></div>
        <div><p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Cost structure</p><p className="text-sm text-gray-700 dark:text-gray-300">{g.cost_structure}</p></div>
      </div>
    </div>
  );
}

function Gate2Card({ g }) {
  const rows = [
    { label: 'Revenue Growth (3yr CAGR)', key: 'revenue_growth', sub: g.revenue_growth?.cagr_3yr != null ? `${(g.revenue_growth.cagr_3yr * 100).toFixed(1)}%` : null },
    { label: 'Profit Margin Trend', key: 'margin_trend', sub: g.margin_trend?.direction },
    { label: 'FCF Consistency', key: 'fcf_consistency', sub: null },
    { label: 'Return on Equity', key: 'roe', sub: g.roe?.value != null ? `${(g.roe.value * 100).toFixed(1)}%` : null },
    { label: 'Debt / Equity', key: 'debt_equity', sub: g.debt_equity?.value != null ? g.debt_equity.value.toFixed(2) : null },
  ];
  const total = g.total ?? 0;
  const passing = total >= 18;
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <GateHeader number={2} title="Business Quality Score" pass={g.pass} />
      <div className="px-5 divide-y divide-gray-100 dark:divide-gray-700">
        {rows.map(({ label, key, sub }) => {
          const item = g[key];
          return (
            <div key={key} className="flex items-center justify-between py-2.5">
              <div className="min-w-0">
                <p className="text-sm text-gray-700 dark:text-gray-300">{label}</p>
                {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
                {item?.note && <p className="text-[11px] text-gray-400 mt-0.5 italic">{item.note}</p>}
              </div>
              <div className="flex items-center gap-2 ml-4 shrink-0">
                <ScoreDots score={item?.score ?? 0} />
                <span className="text-sm font-bold text-gray-900 dark:text-white tabular-nums w-4 text-right">{item?.score ?? '?'}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div className={`flex items-center justify-between px-5 py-3 border-t ${passing ? 'border-emerald-100 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-900/20' : 'border-rose-100 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-900/20'}`}>
        <span className={`text-xs font-bold uppercase tracking-wide ${passing ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
          {passing ? '✓ Minimum cleared (≥18)' : '✗ Below minimum (≥18 required)'}
        </span>
        <span className={`text-lg font-bold tabular-nums ${passing ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>{total}/25</span>
      </div>
    </div>
  );
}

function Gate3Card({ g }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <GateHeader number={3} title="Competitive Moat" pass={g.pass} />
      <div className="p-5 space-y-4">
        <div className="flex flex-wrap gap-2">
          {(g.moats ?? []).map((m) => (
            <span key={m} className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${m === g.primary ? 'bg-brand-600 text-white border-brand-600' : 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800'}`}>
              {MOAT_LABELS[m] ?? m}
            </span>
          ))}
          {g.strength && (
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
              g.strength === 'wide'   ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' :
              g.strength === 'narrow' ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800'  :
                                        'bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800'
            }`}>
              {g.strength === 'wide' ? 'Wide Moat' : g.strength === 'narrow' ? 'Narrow Moat' : 'No Moat'}
            </span>
          )}
        </div>
        {g.explanation && <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{g.explanation}</p>}
      </div>
    </div>
  );
}

function Gate4Card({ g }) {
  const metrics = [
    { label: 'Forward P/E', key: 'forward_pe', extra: g.forward_pe?.industry_avg ? `Industry avg: ${g.forward_pe.industry_avg}x` : null },
    { label: 'PEG Ratio', key: 'peg', extra: 'Threshold: <1.5' },
    { label: 'Price / FCF', key: 'price_fcf', extra: null },
    { label: 'EV / EBITDA', key: 'ev_ebitda', extra: g.ev_ebitda?.industry_avg ? `Industry avg: ${g.ev_ebitda.industry_avg}x` : null },
  ];
  const verdictColors = {
    cheap: 'text-emerald-600 dark:text-emerald-400',
    fairly_valued: 'text-blue-600 dark:text-blue-400',
    expensive: 'text-amber-600 dark:text-amber-400',
    very_expensive: 'text-rose-600 dark:text-rose-400',
  };
  const verdictLabel = { cheap: 'Cheap', fairly_valued: 'Fairly Valued', expensive: 'Expensive', very_expensive: 'Very Expensive' };
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <GateHeader number={4} title="Valuation Check" pass={g.pass} />
      <div className="px-5 divide-y divide-gray-100 dark:divide-gray-700">
        {metrics.map(({ label, key, extra }) => {
          const item = g[key];
          return (
            <div key={key} className="flex items-start justify-between py-2.5 gap-3">
              <div className="min-w-0">
                <p className="text-sm text-gray-700 dark:text-gray-300">{label}</p>
                {extra && <p className="text-[11px] text-gray-400 mt-0.5">{extra}</p>}
                {item?.note && <p className="text-[11px] text-gray-400 mt-0.5 italic">{item.note}</p>}
              </div>
              <div className="text-right shrink-0">
                <span className="text-sm font-bold tabular-nums text-gray-900 dark:text-white">{item?.value != null ? item.value.toFixed(1) + 'x' : '—'}</span>
                {item?.expensive != null && (
                  <p className={`text-[11px] mt-0.5 font-semibold ${item.expensive ? 'text-rose-500 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                    {item.expensive ? 'Expensive' : 'Reasonable'}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {g.verdict && (
        <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700">
          <span className={`text-sm font-bold ${verdictColors[g.verdict] ?? 'text-gray-600'}`}>
            Overall: {verdictLabel[g.verdict] ?? g.verdict}
          </span>
        </div>
      )}
    </div>
  );
}

function Gate5Card({ g }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <GateHeader number={5} title="Risk Assessment" pass={g.pass} />
      <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-5">
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">What kills it in 5 years?</p>
          <p className="text-sm text-gray-700 dark:text-gray-300">{g.kill_scenario ?? '—'}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Max acceptable loss</p>
          <p className="text-2xl font-bold text-rose-600 dark:text-rose-400 tabular-nums">{g.max_loss_pct != null ? `${g.max_loss_pct}%` : '—'}</p>
          <p className="text-xs text-gray-400 mt-0.5">before selling regardless</p>
        </div>
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Specific sell trigger</p>
          <p className="text-sm text-gray-700 dark:text-gray-300">{g.sell_trigger ?? '—'}</p>
        </div>
      </div>
    </div>
  );
}

// ─── saved analyses (backend) ────────────────────────────────────────────────

function useSavedAnalyses() {
  const [saved, setSaved] = useState([]);

  const reload = useCallback(() => {
    api.get('/gate-analyses').then(r => setSaved(r.data)).catch(() => setSaved([]));
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const save = useCallback((ticker, company, decision, results) => {
    api.post('/gate-analyses', { ticker, company, decision, results }).then(reload);
  }, [reload]);

  const remove = useCallback((id) => {
    api.delete(`/gate-analyses/${id}`).then(reload);
  }, [reload]);

  return { saved, save, remove };
}

const DECISION_DOT = {
  buy:        'bg-emerald-500',
  watch:      'bg-amber-500',
  hard_no:    'bg-rose-500',
  do_not_buy: 'bg-gray-500',
};

function SavedAnalysesList({ saved, onLoad, onDelete }) {
  if (saved.length === 0) return null;
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80">
        <Bookmark size={13} className="text-brand-500" />
        <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Saved Analyses</span>
        <span className="ml-1 text-xs font-semibold text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded-full">{saved.length}</span>
      </div>
      <div className="divide-y divide-gray-100 dark:divide-gray-700">
        {saved.map((s) => {
          const cfg = DECISION_CONFIG[s.decision] ?? DECISION_CONFIG.watch;
          const dot = DECISION_DOT[s.decision] ?? 'bg-gray-400';
          const date = new Date(s.savedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
          return (
            <div key={s.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-900 dark:text-white">{s.ticker}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full text-white ${cfg.color}`}>{cfg.label}</span>
                  </div>
                  <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">{s.company} · {date}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0 ml-3">
                <button
                  onClick={() => onLoad(s)}
                  className="px-3 py-1.5 text-xs font-semibold text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/30 rounded-lg transition-colors"
                >
                  Load
                </button>
                <button
                  onClick={() => onDelete(s.id)}
                  className="p-1.5 text-gray-400 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GateResults({ results, onClear, onSave, isSaved }) {
  const cfg = DECISION_CONFIG[results.decision] ?? DECISION_CONFIG.watch;
  const gates = [results.gate1?.pass, results.gate2?.pass, results.gate3?.pass, results.gate4?.pass, results.gate5?.pass];

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-5 py-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            {gates.map((pass, i) => (
              <div key={i} className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border ${pass ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' : 'bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800'}`}>
                {pass ? <ShieldCheck size={11} /> : <ShieldX size={11} />}
                G{i + 1}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onSave}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                isSaved
                  ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30'
                  : 'text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/30'
              }`}
            >
              {isSaved ? <><Check size={12} /> Saved</> : <><BookmarkPlus size={12} /> Save</>}
            </button>
            <button onClick={onClear} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
              <X size={12} /> Clear
            </button>
          </div>
        </div>
      </div>

      <div className={`rounded-xl px-6 py-5 ${cfg.color}`}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className={`text-xs font-bold uppercase tracking-widest opacity-80 ${cfg.text}`}>Final Decision</p>
            <p className={`text-3xl font-black mt-0.5 ${cfg.text}`}>{cfg.label}</p>
            <p className={`text-sm mt-1 opacity-80 ${cfg.text}`}>{cfg.sub}</p>
          </div>
          <div className="text-right">
            <p className={`text-xs font-bold uppercase tracking-wider opacity-70 ${cfg.text}`}>Conviction</p>
            <p className={`text-lg font-bold capitalize mt-0.5 ${cfg.text}`}>{results.conviction ?? '—'}</p>
            {results.position_size && (
              <p className={`text-xs mt-1 opacity-70 ${cfg.text}`}>Position: {results.position_size}</p>
            )}
          </div>
        </div>
        {results.summary && (
          <p className={`text-sm mt-4 leading-relaxed opacity-90 border-t border-white/20 pt-4 ${cfg.text}`}>{results.summary}</p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Gate1Card g={results.gate1} />
        <Gate2Card g={results.gate2} />
        <Gate3Card g={results.gate3} />
        <Gate4Card g={results.gate4} />
      </div>
      <Gate5Card g={results.gate5} />
    </div>
  );
}

// ─── pdf export ──────────────────────────────────────────────────────────────

function metricRow(label, value, color = '') {
  return `<tr><td style="padding:6px 8px;color:#6b7280;font-size:12px;border-bottom:1px solid #f3f4f6">${label}</td><td style="padding:6px 8px;font-size:12px;font-weight:600;text-align:right;border-bottom:1px solid #f3f4f6${color ? ';color:' + color : ''}">${value ?? '—'}</td></tr>`;
}

function sectionTable(title, rows) {
  return `
    <div style="break-inside:avoid;margin-bottom:16px">
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
        <div style="padding:8px 12px;border-bottom:1px solid #e5e7eb;background:#f3f4f6">
          <span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#6b7280">${title}</span>
        </div>
        <table style="width:100%;border-collapse:collapse;background:#fff">${rows}</table>
      </div>
    </div>`;
}

function gateBlock(num, title, pass, content) {
  const color = pass ? '#059669' : '#dc2626';
  const bg    = pass ? '#ecfdf5' : '#fef2f2';
  return `
    <div style="break-inside:avoid;margin-bottom:12px;border:1px solid ${pass ? '#a7f3d0' : '#fecaca'};border-radius:8px;overflow:hidden">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:${bg};border-bottom:1px solid ${pass ? '#a7f3d0' : '#fecaca'}">
        <div style="display:flex;align-items:center;gap:8px">
          <span style="width:20px;height:20px;border-radius:50%;background:${color};color:#fff;font-size:10px;font-weight:700;display:inline-flex;align-items:center;justify-content:center">${num}</span>
          <span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#374151">${title}</span>
        </div>
        <span style="font-size:10px;font-weight:700;color:${color}">${pass ? '✓ PASS' : '✗ FAIL'}</span>
      </div>
      <div style="padding:12px;background:#fff;font-size:12px;color:#374151">${content}</div>
    </div>`;
}

function exportAnalysisPDF(d, gateResults) {
  const n  = (v, dec = 2) => v != null ? Number(v).toFixed(dec) : '—';
  const pct = (v) => v != null ? `${(v * 100).toFixed(2)}%` : '—';
  const big = (v) => {
    if (v == null) return '—';
    const abs = Math.abs(v);
    if (abs >= 1e7) return `₹${(v / 1e7).toFixed(2)}Cr`;
    if (abs >= 1e5) return `₹${(v / 1e5).toFixed(2)}L`;
    return `₹${v.toFixed(2)}`;
  };

  const valuation = [
    metricRow('P/E (Trailing)',  n(d.pe_ttm)),
    metricRow('P/E (Forward)',   n(d.pe_forward)),
    metricRow('PEG Ratio',       n(d.peg_ratio)),
    metricRow('EPS (TTM)',       d.eps_ttm != null ? `₹${n(d.eps_ttm)}` : '—', d.eps_ttm >= 0 ? '#059669' : '#dc2626'),
    metricRow('EPS (Forward)',   d.eps_forward != null ? `₹${n(d.eps_forward)}` : '—', d.eps_forward >= 0 ? '#059669' : '#dc2626'),
    metricRow('Price / Book',    n(d.price_to_book)),
    metricRow('EV / Revenue',    n(d.ev_to_revenue)),
    metricRow('EV / EBITDA',     n(d.ev_to_ebitda)),
  ].join('');

  const financials = [
    metricRow('Revenue (TTM)',    big(d.total_revenue)),
    metricRow('Revenue Growth',  pct(d.revenue_growth), d.revenue_growth >= 0 ? '#059669' : '#dc2626'),
    metricRow('Gross Margin',    pct(d.gross_margins)),
    metricRow('Operating Margin',pct(d.operating_margins), d.operating_margins >= 0 ? '#059669' : '#dc2626'),
    metricRow('Net Margin',      pct(d.profit_margins), d.profit_margins >= 0 ? '#059669' : '#dc2626'),
    metricRow('Free Cash Flow',  big(d.free_cash_flow), d.free_cash_flow >= 0 ? '#059669' : '#dc2626'),
    metricRow('EBITDA',          big(d.ebitda)),
  ].join('');

  const returns = [
    metricRow('Return on Equity', pct(d.return_on_equity), d.return_on_equity >= 0 ? '#059669' : '#dc2626'),
    metricRow('Return on Assets', pct(d.return_on_assets), d.return_on_assets >= 0 ? '#059669' : '#dc2626'),
    metricRow('Debt / Equity',    n(d.debt_to_equity)),
    metricRow('Current Ratio',    n(d.current_ratio)),
    metricRow('Beta',             n(d.beta)),
    metricRow('Dividend Yield',   pct(d.dividend_yield)),
    metricRow('Payout Ratio',     pct(d.payout_ratio)),
  ].join('');

  const technicals = [
    metricRow('52W Range',  d.week52_low != null ? `₹${n(d.week52_low)} – ₹${n(d.week52_high)}` : '—'),
    metricRow('50-Day MA',  d.sma_50 != null ? `₹${n(d.sma_50)}` : '—'),
    metricRow('200-Day MA', d.sma_200 != null ? `₹${n(d.sma_200)}` : '—'),
    metricRow('Day Range',  d.day_low != null ? `₹${n(d.day_low)} – ₹${n(d.day_high)}` : '—'),
    metricRow('Volume',     d.volume != null ? Number(d.volume).toLocaleString() : '—'),
    metricRow('Avg Volume', d.avg_volume != null ? Number(d.avg_volume).toLocaleString() : '—'),
    metricRow('52W Change', pct(d.week52_change), d.week52_change >= 0 ? '#059669' : '#dc2626'),
    metricRow('Analyst Target', d.target_mean != null ? `₹${n(d.target_mean)} (${n(d.target_low)}–${n(d.target_high)})` : '—'),
  ].join('');

  let gateSection = '';
  if (gateResults) {
    const cfg = DECISION_CONFIG[gateResults.decision] ?? DECISION_CONFIG.watch;
    const decisionColors = { buy: '#059669', watch: '#d97706', hard_no: '#dc2626', do_not_buy: '#4b5563' };
    const dc = decisionColors[gateResults.decision] ?? '#4b5563';

    const g1 = gateResults.gate1;
    const g2 = gateResults.gate2;
    const g3 = gateResults.gate3;
    const g4 = gateResults.gate4;
    const g5 = gateResults.gate5;

    const scoreDotsHTML = (score) => [1,2,3,4,5].map(i =>
      `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${i <= score ? '#3b82f6' : '#e5e7eb'};margin-right:2px"></span>`
    ).join('');

    const gate1content = `
      <p style="margin:0 0 6px"><strong>What they do:</strong> ${g1?.business_description ?? '—'}</p>
      <p style="margin:0 0 6px"><strong>Who pays &amp; why:</strong> ${g1?.who_pays ?? '—'}</p>
      <p style="margin:0"><strong>Cost structure:</strong> ${g1?.cost_structure ?? '—'}</p>`;

    const gate2rows = ['revenue_growth','margin_trend','fcf_consistency','roe','debt_equity'].map((key) => {
      const labels = { revenue_growth: 'Revenue Growth (3yr CAGR)', margin_trend: 'Profit Margin Trend', fcf_consistency: 'FCF Consistency', roe: 'Return on Equity', debt_equity: 'Debt / Equity' };
      const item = g2?.[key];
      return `<div style="display:flex;align-items:center;justify-content:space-between;padding:4px 0;border-bottom:1px solid #f3f4f6">
        <span>${labels[key]}</span>
        <span>${scoreDotsHTML(item?.score ?? 0)} <strong>${item?.score ?? '?'}/5</strong></span>
      </div>`;
    }).join('');
    const gate2content = `${gate2rows}<div style="margin-top:8px;font-weight:700;color:${g2?.pass ? '#059669' : '#dc2626'}">Total: ${g2?.total ?? '?'}/25 — ${g2?.pass ? 'PASS (≥18)' : 'FAIL (<18)'}</div>`;

    const moatLabels = { brand_power: 'Brand Power', switching_costs: 'Switching Costs', cost_advantage: 'Cost Advantage', network_effects: 'Network Effects', patents_regulatory: 'Patents/Regulatory' };
    const gate3content = `
      <p style="margin:0 0 6px"><strong>Moats:</strong> ${(g3?.moats ?? []).map(m => moatLabels[m] ?? m).join(', ') || '—'}</p>
      <p style="margin:0 0 6px"><strong>Primary:</strong> ${moatLabels[g3?.primary] ?? g3?.primary ?? '—'} · <strong>Strength:</strong> ${g3?.strength ?? '—'}</p>
      <p style="margin:0">${g3?.explanation ?? ''}</p>`;

    const verdictLabel = { cheap: 'Cheap', fairly_valued: 'Fairly Valued', expensive: 'Expensive', very_expensive: 'Very Expensive' };
    const gate4rows = [
      ['Forward P/E', g4?.forward_pe, g4?.forward_pe?.industry_avg ? `Industry avg: ${g4.forward_pe.industry_avg}x` : ''],
      ['PEG Ratio',   g4?.peg,        'Threshold: <1.5'],
      ['Price / FCF', g4?.price_fcf,  ''],
      ['EV / EBITDA', g4?.ev_ebitda,  g4?.ev_ebitda?.industry_avg ? `Industry avg: ${g4.ev_ebitda.industry_avg}x` : ''],
    ].map(([label, item, extra]) =>
      `<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #f3f4f6">
        <span>${label}${extra ? `<br><small style="color:#9ca3af">${extra}</small>` : ''}</span>
        <span><strong>${item?.value != null ? item.value.toFixed(1) + 'x' : '—'}</strong>${item?.expensive != null ? `<br><small style="color:${item.expensive ? '#dc2626' : '#059669'}">${item.expensive ? 'Expensive' : 'Reasonable'}</small>` : ''}</span>
      </div>`
    ).join('');
    const gate4content = gate4rows + (g4?.verdict ? `<div style="margin-top:8px;font-weight:700">Overall: ${verdictLabel[g4.verdict] ?? g4.verdict}</div>` : '');

    const gate5content = `
      <p style="margin:0 0 6px"><strong>What kills it in 5 years:</strong> ${g5?.kill_scenario ?? '—'}</p>
      <p style="margin:0 0 6px"><strong>Max acceptable loss:</strong> ${g5?.max_loss_pct != null ? g5.max_loss_pct + '%' : '—'}</p>
      <p style="margin:0"><strong>Sell trigger:</strong> ${g5?.sell_trigger ?? '—'}</p>`;

    gateSection = `
      <div style="margin-top:20px">
        <h2 style="font-size:14px;font-weight:700;margin:0 0 12px;color:#111827;border-bottom:2px solid #e5e7eb;padding-bottom:6px">5-Gate Framework Analysis</h2>
        <div style="background:${dc};color:#fff;border-radius:8px;padding:16px;margin-bottom:16px;break-inside:avoid">
          <div style="display:flex;justify-content:space-between;align-items:start">
            <div>
              <p style="margin:0;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;opacity:.8">Final Decision</p>
              <p style="margin:4px 0 2px;font-size:24px;font-weight:900">${cfg.label}</p>
              <p style="margin:0;font-size:12px;opacity:.8">${cfg.sub}</p>
            </div>
            <div style="text-align:right">
              <p style="margin:0;font-size:10px;font-weight:700;text-transform:uppercase;opacity:.8">Conviction</p>
              <p style="margin:4px 0;font-size:16px;font-weight:700;text-transform:capitalize">${gateResults.conviction ?? '—'}</p>
              ${gateResults.position_size ? `<p style="margin:0;font-size:11px;opacity:.8">Position: ${gateResults.position_size}</p>` : ''}
            </div>
          </div>
          ${gateResults.summary ? `<p style="margin:12px 0 0;font-size:12px;opacity:.9;border-top:1px solid rgba(255,255,255,.3);padding-top:12px">${gateResults.summary}</p>` : ''}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          ${gateBlock(1, 'Business Understanding', g1?.pass, gate1content)}
          ${gateBlock(2, 'Business Quality Score', g2?.pass, gate2content)}
          ${gateBlock(3, 'Competitive Moat', g3?.pass, gate3content)}
          ${gateBlock(4, 'Valuation Check', g4?.pass, gate4content)}
        </div>
        ${gateBlock(5, 'Risk Assessment', g5?.pass, gate5content)}
      </div>`;
  }

  const changeSign = d.change >= 0 ? '+' : '';
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${d.ticker} — Stock Analysis</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 13px; color: #111827; background: #fff; padding: 24px; }
    @media print {
      body { padding: 0; }
      @page { margin: 15mm 12mm; size: A4; }
    }
  </style>
</head>
<body>
  <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid #e5e7eb">
    <div>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <h1 style="font-size:20px;font-weight:800;color:#111827">${d.name}</h1>
        <span style="font-size:11px;font-weight:700;padding:2px 8px;background:#dbeafe;color:#1d4ed8;border-radius:20px">${d.ticker}</span>
      </div>
      ${d.sector || d.industry ? `<p style="color:#6b7280;font-size:12px;margin-top:3px">${[d.sector, d.industry].filter(Boolean).join(' · ')}</p>` : ''}
      ${d.employees ? `<p style="color:#9ca3af;font-size:11px;margin-top:2px">${d.employees.toLocaleString()} employees</p>` : ''}
    </div>
    <div style="text-align:right">
      <p style="font-size:22px;font-weight:800;color:#111827">₹${n(d.price)}</p>
      ${d.change != null ? `<p style="font-size:12px;font-weight:600;color:${d.change >= 0 ? '#059669' : '#dc2626'}">${changeSign}₹${n(d.change)} (${changeSign}${n(d.change_percent, 2)}%)</p>` : ''}
      ${d.market_cap ? `<p style="font-size:11px;color:#9ca3af;margin-top:2px">Mkt Cap ${big(d.market_cap)}</p>` : ''}
      <p style="font-size:10px;color:#d1d5db;margin-top:4px">Generated ${new Date().toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })}</p>
    </div>
  </div>

  ${d.description ? `<p style="font-size:12px;color:#4b5563;margin-bottom:16px;line-height:1.6">${d.description}</p>` : ''}

  <h2 style="font-size:13px;font-weight:700;margin-bottom:10px;color:#111827;border-bottom:2px solid #e5e7eb;padding-bottom:5px">Fundamentals &amp; Technicals</h2>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:4px">
    ${sectionTable('Valuation', valuation)}
    ${sectionTable('Financials (TTM)', financials)}
    ${sectionTable('Returns & Risk', returns)}
    ${sectionTable('Technicals & Price Levels', technicals)}
  </div>

  ${gateSection}
</body>
</html>`;

  const w = window.open('', '_blank');
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 400);
}

// ─── page ────────────────────────────────────────────────────────────────────

export default function StockAnalysisPage() {
  const [inputVal, setInputVal]         = useState('');
  const [lookupTicker, setLookupTicker] = useState('');
  const [lookupQuote, setLookupQuote]   = useState(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError]   = useState(false);
  const [activeTicker, setActiveTicker] = useState('');
  const [d, setD]                       = useState(null);
  const [isLoading, setIsLoading]       = useState(false);
  const [isError, setIsError]           = useState(false);
  const [errorMsg, setErrorMsg]         = useState('');
  const [gateResults, setGateResults]   = useState(null);
  const [savedJustNow, setSavedJustNow] = useState(false);
  const inputRef = useRef(null);
  const { saved, save, remove } = useSavedAnalyses();

  // Debounce: resolve company name 400ms after user stops typing
  useEffect(() => {
    if (!inputVal.trim()) { setLookupTicker(''); setLookupQuote(null); setLookupError(false); return; }
    const t = setTimeout(() => setLookupTicker(inputVal.trim().toUpperCase()), 400);
    return () => clearTimeout(t);
  }, [inputVal]);

  useEffect(() => {
    if (!lookupTicker) return;
    setLookupLoading(true);
    setLookupError(false);
    api.get(`/stocks/lookup?symbol=${encodeURIComponent(lookupTicker)}`)
      .then(r => setLookupQuote(r.data))
      .catch(() => { setLookupQuote(null); setLookupError(true); })
      .finally(() => setLookupLoading(false));
  }, [lookupTicker]);

  const resolvedName = lookupQuote?.name && lookupQuote?.price != null ? lookupQuote.name : null;
  const canAnalyze = !!resolvedName && !lookupLoading;

  useEffect(() => {
    if (!activeTicker) return;
    setIsLoading(true);
    setIsError(false);
    api.get(`/stock-analysis/${encodeURIComponent(activeTicker)}`)
      .then(r => setD(r.data.data))
      .catch(err => { setIsError(true); setErrorMsg(err.message); setD(null); })
      .finally(() => setIsLoading(false));
  }, [activeTicker]);

  function handleSearch(e) {
    e.preventDefault();
    const t = inputVal.trim().toUpperCase();
    if (t && canAnalyze) { setActiveTicker(t); setGateResults(null); setSavedJustNow(false); }
  }

  function handleSave() {
    if (!gateResults || !d) return;
    save(d.ticker, d.name, gateResults.decision, gateResults);
    setSavedJustNow(true);
  }

  function handleLoadSaved(entry) {
    setActiveTicker(entry.ticker);
    setInputVal(entry.ticker);
    setGateResults(entry.results);
    setSavedJustNow(true);
  }

  const isPositive = d && d.change != null && d.change >= 0;
  const changeColor = isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400';
  const recoKey = d?.recommendation?.toLowerCase();

  return (
    <div className="space-y-5 w-full">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Stock Analysis</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Fundamentals, technicals, and 5-Gate framework for Indian stocks</p>
      </div>

      <SavedAnalysesList saved={saved} onLoad={handleLoadSaved} onDelete={remove} />

      <div className="space-y-1.5 w-full">
        <form onSubmit={handleSearch} className="flex items-center gap-3 w-full">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              ref={inputRef}
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value.toUpperCase())}
              placeholder="Enter NSE/BSE ticker (e.g. RELIANCE, TCS, INFY)"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
          </div>

          <button
            type="submit"
            disabled={!canAnalyze || isLoading}
            className="px-7 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors shrink-0"
          >
            {isLoading ? 'Loading…' : 'Analyze'}
          </button>
        </form>

        {lookupLoading && inputVal && (
          <p className="pl-1 text-xs text-gray-400 animate-pulse">Looking up…</p>
        )}
        {resolvedName && !lookupLoading && (
          <p className="flex items-center gap-1.5 pl-1 text-xs text-gray-500 dark:text-gray-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
            {resolvedName}
          </p>
        )}
        {(lookupError || (lookupQuote && !resolvedName)) && inputVal && !lookupLoading && (
          <p className="flex items-center gap-1.5 pl-1 text-xs text-rose-500 dark:text-rose-400">
            <AlertCircle size={11} /> Invalid ticker
          </p>
        )}
      </div>

      {isError && (
        <div className="flex items-center gap-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl px-4 py-3 text-sm text-rose-700 dark:text-rose-400">
          <AlertCircle size={16} className="shrink-0" />
          {errorMsg || 'Could not fetch data. Check the ticker symbol.'}
        </div>
      )}

      {isLoading && <AnalysisSkeleton />}

      {d && !isLoading && (
        <div className="space-y-5">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white truncate">{d.name}</h3>
                  <span className="text-xs font-bold px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-full">{d.ticker}</span>
                  {d.website && (
                    <a href={d.website} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-brand-500 transition-colors">
                      <ExternalLink size={13} />
                    </a>
                  )}
                </div>
                {(d.sector || d.industry) && <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">{[d.sector, d.industry].filter(Boolean).join(' · ')}</p>}
                {d.employees && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{d.employees.toLocaleString()} employees</p>}
              </div>
              <div className="text-right shrink-0">
                <p className="text-3xl font-bold text-gray-900 dark:text-white tabular-nums">{d.price != null ? fmt.currency(d.price) : '—'}</p>
                {d.change != null && (
                  <p className={`text-sm font-semibold tabular-nums mt-0.5 ${changeColor}`}>
                    {d.change >= 0 ? '+' : ''}{fmt.currency(d.change)} ({d.change >= 0 ? '+' : ''}{fmtNum(d.change_percent, 2)}%)
                  </p>
                )}
                {d.market_cap && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Mkt Cap {fmtLarge(d.market_cap)}</p>}
                <button
                  onClick={() => exportAnalysisPDF(d, gateResults)}
                  className="mt-2 flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  <FileDown size={13} /> Export PDF
                </button>
              </div>
            </div>
            {d.description && <p className="text-sm text-gray-500 dark:text-gray-400 mt-4 leading-relaxed line-clamp-3">{d.description}</p>}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <SectionCard title="Valuation" Icon={DollarSign}>
              <StatRow label="P/E (Trailing)" value={fmtNum(d.pe_ttm)} />
              <StatRow label="P/E (Forward)" value={fmtNum(d.pe_forward)} />
              <StatRow label="PEG Ratio" value={fmtNum(d.peg_ratio)} />
              <StatRow label="EPS (TTM)" value={d.eps_ttm != null ? fmt.currency(d.eps_ttm) : '—'} positive={d.eps_ttm != null ? d.eps_ttm >= 0 : undefined} />
              <StatRow label="EPS (Forward)" value={d.eps_forward != null ? fmt.currency(d.eps_forward) : '—'} positive={d.eps_forward != null ? d.eps_forward >= 0 : undefined} />
              <StatRow label="Price / Book" value={fmtNum(d.price_to_book)} />
              <StatRow label="EV / Revenue" value={fmtNum(d.ev_to_revenue)} />
              <StatRow label="EV / EBITDA" value={fmtNum(d.ev_to_ebitda)} />
            </SectionCard>

            <SectionCard title="Financials" Icon={BarChart2}>
              <StatRow label="Revenue (TTM)" value={fmtLarge(d.total_revenue)} />
              <StatRow label="Revenue Growth" value={d.revenue_growth != null ? fmtPct(d.revenue_growth) : '—'} positive={d.revenue_growth != null ? d.revenue_growth >= 0 : undefined} />
              <StatRow label="Gross Margin" value={d.gross_margins != null ? fmtPct(d.gross_margins) : '—'} />
              <StatRow label="Operating Margin" value={d.operating_margins != null ? fmtPct(d.operating_margins) : '—'} positive={d.operating_margins != null ? d.operating_margins >= 0 : undefined} />
              <StatRow label="Net Margin" value={d.profit_margins != null ? fmtPct(d.profit_margins) : '—'} positive={d.profit_margins != null ? d.profit_margins >= 0 : undefined} />
              <StatRow label="Free Cash Flow" value={fmtLarge(d.free_cash_flow)} positive={d.free_cash_flow != null ? d.free_cash_flow >= 0 : undefined} />
              <StatRow label="EBITDA" value={fmtLarge(d.ebitda)} />
            </SectionCard>

            <SectionCard title="Returns & Risk" Icon={TrendingUp}>
              <StatRow label="Return on Equity" value={d.return_on_equity != null ? fmtPct(d.return_on_equity) : '—'} positive={d.return_on_equity != null ? d.return_on_equity >= 0 : undefined} />
              <StatRow label="Return on Assets" value={d.return_on_assets != null ? fmtPct(d.return_on_assets) : '—'} positive={d.return_on_assets != null ? d.return_on_assets >= 0 : undefined} />
              <StatRow label="Debt / Equity" value={d.debt_to_equity != null ? fmtNum(d.debt_to_equity) : '—'} positive={d.debt_to_equity != null ? d.debt_to_equity < 100 : undefined} />
              <StatRow label="Current Ratio" value={fmtNum(d.current_ratio)} />
              <StatRow label="Beta" value={fmtNum(d.beta)} />
              <StatRow label="Short Float" value={d.short_float != null ? fmtPct(d.short_float) : '—'} />
              <StatRow label="Dividend Yield" value={d.dividend_yield != null ? fmtPct(d.dividend_yield) : '—'} />
              <StatRow label="Payout Ratio" value={d.payout_ratio != null ? fmtPct(d.payout_ratio) : '—'} />
            </SectionCard>

            <SectionCard title="Technicals & Price Levels" Icon={Activity}>
              <Week52Bar price={d.price} low={d.week52_low} high={d.week52_high} />
              <MAvgRow label="50-Day MA" price={d.price} ma={d.sma_50} />
              <MAvgRow label="200-Day MA" price={d.price} ma={d.sma_200} />
              {d.target_low != null && <TargetBar price={d.price} low={d.target_low} high={d.target_high} mean={d.target_mean} />}
              <StatRow label="Day Range" value={d.day_low != null && d.day_high != null ? `${fmt.currency(d.day_low)} – ${fmt.currency(d.day_high)}` : '—'} />
              <StatRow label="Volume" value={fmtVol(d.volume)} sub={d.avg_volume ? `Avg ${fmtVol(d.avg_volume)}` : undefined} />
              <StatRow label="52W Change" value={d.week52_change != null ? fmtPct(d.week52_change) : '—'} positive={d.week52_change != null ? d.week52_change >= 0 : undefined} />
              {recoKey && (
                <div className="flex items-center justify-between py-2.5">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Analyst Rating</span>
                  <div className="text-right">
                    <span className={`inline-block text-xs font-bold px-2.5 py-1 rounded-full border ${RECO_COLORS[recoKey] ?? 'text-gray-600 bg-gray-50 border-gray-200'}`}>{RECO_LABEL[recoKey] ?? recoKey}</span>
                    {d.analyst_count && <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">{d.analyst_count} analysts</p>}
                  </div>
                </div>
              )}
            </SectionCard>
          </div>

          {gateResults
            ? <GateResults results={gateResults} onClear={() => { setGateResults(null); setSavedJustNow(false); }} onSave={handleSave} isSaved={savedJustNow} />
            : <PromptSection d={d} onResults={(r) => { setGateResults(r); setSavedJustNow(false); }} />
          }
        </div>
      )}

      {!activeTicker && !isLoading && (
        <div className="text-center py-20 text-gray-400 dark:text-gray-500">
          <Activity size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium text-gray-500 dark:text-gray-400">Enter a ticker above to get started</p>
          <p className="text-sm mt-1">Supports any NSE/BSE-listed stock (RELIANCE, TCS, INFY…)</p>
        </div>
      )}
    </div>
  );
}
