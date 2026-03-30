import { useState } from 'react';
import { Treemap, ResponsiveContainer } from 'recharts';
import { fmt, pnlColor, pnlSign } from '../../utils/format';

const HOLDING_COLORS = [
  '#6366f1','#3b82f6','#06b6d4','#14b8a6','#10b981','#84cc16',
  '#f59e0b','#f97316','#ef4444','#ec4899','#8b5cf6','#a855f7',
];

export default function HoldingsWidget({ holdings, radioName = 'holdingsView' }) {
  const [view, setView] = useState('current');
  const [hovered, setHovered] = useState(null);

  const active = (holdings || []).filter(h => parseFloat(h.quantity) > 0);
  if (!active.length) return null;

  const totalCurrentValue = active.reduce((s, h) => s + parseFloat(h.current_value), 0);
  const totalInvested = active.reduce((s, h) => s + parseFloat(h.quantity) * parseFloat(h.avg_buy_price), 0);
  const totalPnl = totalCurrentValue - totalInvested;
  const pnlPct = totalInvested > 0 ? totalPnl / totalInvested * 100 : 0;

  const treeData = active
    .map((h, i) => {
      const invested = parseFloat(h.quantity) * parseFloat(h.avg_buy_price);
      const current = parseFloat(h.current_value);
      const unrealized = parseFloat(h.unrealized_pnl);
      const displayValue = view === 'current' ? current : view === 'invested' ? invested : Math.abs(unrealized);
      return {
        name: h.symbol,
        value: Math.max(displayValue, 0.01),
        rawCurrent: current,
        rawInvested: invested,
        rawPnl: unrealized,
        color: view === 'pnl'
          ? (unrealized >= 0 ? '#10b981' : '#ef4444')
          : HOLDING_COLORS[i % HOLDING_COLORS.length],
      };
    })
    .sort((a, b) => b.value - a.value);

  const getHoveredLabel = () => {
    if (!hovered) return null;
    if (view === 'current') return `${hovered.name}  ${fmt.currency(hovered.rawCurrent)}`;
    if (view === 'invested') return `${hovered.name}  ${fmt.currency(hovered.rawInvested)}`;
    return `${hovered.name}  ${pnlSign(hovered.rawPnl)}${fmt.currency(hovered.rawPnl)}`;
  };

  const CustomContent = (props) => {
    const { x, y, width, height, name, color, rawCurrent, rawInvested, rawPnl } = props;
    if (!name || width < 2 || height < 2) return null;
    const isHovered = hovered?.name === name;
    return (
      <g
        onMouseEnter={() => setHovered({ name, rawCurrent, rawInvested, rawPnl })}
        onMouseLeave={() => setHovered(null)}
        style={{ cursor: 'pointer' }}
      >
        <rect
          x={x + 1} y={y + 1} width={width - 2} height={height - 2} rx={3}
          style={{ fill: color, opacity: hovered && !isHovered ? 0.55 : 1, transition: 'opacity 0.15s' }}
        />
        {width > 35 && height > 22 && (
          <text x={x + width / 2} y={y + height / 2}
            textAnchor="middle" dominantBaseline="middle"
            fill="white" fontSize={Math.min(11, width / 5)} fontWeight="700"
            style={{ pointerEvents: 'none' }}>
            {name}
          </text>
        )}
      </g>
    );
  };

  const hoveredLabel = getHoveredLabel();
  const footerValue = hovered
    ? (view === 'pnl'
        ? `${pnlSign(hovered.rawPnl)}${fmt.currency(hovered.rawPnl)}`
        : view === 'invested'
          ? fmt.currency(hovered.rawInvested)
          : fmt.currency(hovered.rawCurrent))
    : fmt.currency(totalCurrentValue);

  return (
    <div className="card p-5">
      {/* Header */}
      <div className="flex items-start gap-6 mb-4 flex-wrap">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Holdings ({active.length})</p>
          <p className={`text-3xl font-bold ${pnlColor(totalPnl)}`}>
            {pnlSign(totalPnl)}{fmt.compact(Math.abs(totalPnl))}
          </p>
          <p className={`text-sm font-medium ${pnlColor(pnlPct)}`}>{pnlSign(pnlPct)}{fmt.percent(pnlPct)}</p>
          <p className="text-xs text-gray-400 mt-0.5">P&amp;L</p>
        </div>
        <div className="border-l border-gray-200 dark:border-gray-700 pl-6 space-y-2">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Current value</p>
            <p className="text-base font-semibold text-gray-900 dark:text-white">{fmt.compact(totalCurrentValue)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Investment</p>
            <p className="text-base font-semibold text-gray-900 dark:text-white">{fmt.compact(totalInvested)}</p>
          </div>
        </div>
      </div>

      {/* Treemap */}
      <div style={{ height: 160 }}>
        <ResponsiveContainer width="100%" height="100%">
          <Treemap data={treeData} dataKey="value" content={<CustomContent />} isAnimationActive={false} aspectRatio={4 / 3} />
        </ResponsiveContainer>
      </div>

      {/* Tooltip strip */}
      <div className="mt-2 h-6 flex items-center">
        {hoveredLabel && (
          <p className="text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
            {hoveredLabel}
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-1 flex-wrap gap-2">
        <p className={`text-sm font-medium ${hovered && view === 'pnl' ? pnlColor(hovered.rawPnl) : 'text-gray-900 dark:text-white'}`}>
          {footerValue}
        </p>
        <div className="flex items-center gap-4">
          {[['current', 'Current value'], ['invested', 'Invested'], ['pnl', 'P&L']].map(([key, label]) => (
            <label key={key} className="flex items-center gap-1.5 cursor-pointer select-none">
              <input type="radio" name={radioName} value={key} checked={view === key}
                onChange={() => { setView(key); setHovered(null); }} className="accent-brand-600" />
              <span className="text-xs text-gray-600 dark:text-gray-400">{label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
