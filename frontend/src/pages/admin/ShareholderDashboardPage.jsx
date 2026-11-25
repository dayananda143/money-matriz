import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, FileSpreadsheet, Info } from 'lucide-react';
import * as XLSX from 'xlsx';
import api from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import { fmt, pnlColor, pnlSign } from '../../utils/format';
import { Table, Th, Td, EmptyRow } from '../../components/ui/Table';
import { SkeletonPageHeader, SkeletonTable } from '../../components/ui/Skeleton';

const num = v => parseFloat(v || 0);

const HeadTip = ({ text }) => (
  <span title={text} className="inline-flex align-middle ml-1 cursor-help">
    <Info size={11} className="text-gray-400" />
  </span>
);

function StatTile({ label, value, sub, className = 'text-gray-900 dark:text-white' }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`text-xl font-bold mt-1 ${className}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

export default function ShareholderDashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const [shareholders, setShareholders] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/relationships/all-clients?scope=all&type=shareholder'),
      api.get('/relationships/all-clients?scope=all'),
    ]).then(([s, c]) => { setShareholders(s.data); setClients(c.data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Active clients managed by each shareholder
  const clientCounts = useMemo(() => {
    const m = {};
    clients.filter(c => c.is_active && c.shareholder_id).forEach(c => { m[c.shareholder_id] = (m[c.shareholder_id] || 0) + 1; });
    return m;
  }, [clients]);

  const rows = useMemo(() => shareholders
    .filter(s => s.is_active)
    .map(s => ({
      ...s,
      contributed: num(s.shares_contributed),
      invested: num(s.active_invested),
      portfolio: num(s.portfolio_value),
      unrealized: num(s.unrealized_pnl),
      realized: num(s.realized_pnl),
      // Same as the SIP page's Cash on Hand: SIP money not yet in stocks
      cashExcl: num(s.sip_net_invested) - num(s.active_invested),
      clientCount: clientCounts[s.id] || 0,
    }))
    .sort((a, b) => b.portfolio - a.portfolio), [shareholders, clientCounts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? rows.filter(r => r.name?.toLowerCase().includes(q) || r.email?.toLowerCase().includes(q)) : rows;
  }, [rows, search]);

  const totals = useMemo(() => rows.reduce((t, r) => ({
    contributed: t.contributed + r.contributed,
    invested: t.invested + r.invested,
    portfolio: t.portfolio + r.portfolio,
    unrealized: t.unrealized + r.unrealized,
    realized: t.realized + r.realized,
  }), { contributed: 0, invested: 0, portfolio: 0, unrealized: 0, realized: 0 }), [rows]);

  function exportExcel() {
    const data = filtered.map(r => ({
      Name: r.name,
      Email: r.email,
      'Clients Managed': r.clientCount,
      'Company Share Capital': r.contributed,
      Invested: r.invested,
      'Portfolio Value': r.portfolio,
      'Unrealized P/L': r.unrealized,
      'Realized P/L': r.realized,
      'Cash on Hand (excl. profits)': r.cashExcl,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Shareholders');
    XLSX.writeFile(wb, 'shareholder_dashboard.xlsx');
  }

  if (loading) return (
    <div className="space-y-6">
      <SkeletonPageHeader />
      <SkeletonTable rows={5} cols={6} />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Shareholder Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Overview of all {rows.length} active shareholders</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatTile label="Company Share Capital" value={fmt.currency(totals.contributed)} sub="Share contributions" />
        <StatTile label="Total Invested" value={fmt.currency(totals.invested)} sub="Active holdings cost" />
        <StatTile label="Portfolio Value" value={fmt.currency(totals.portfolio)} sub="At current prices" />
        <StatTile label="Unrealized P&L" className={pnlColor(totals.unrealized)}
          value={`${pnlSign(totals.unrealized)}${fmt.currency(totals.unrealized)}`}
          sub={totals.invested > 0 ? `${pnlSign(totals.unrealized)}${fmt.percent(Math.abs(totals.unrealized / totals.invested * 100))} of invested` : null} />
        <StatTile label="Realized P&L" className={pnlColor(totals.realized)}
          value={`${pnlSign(totals.realized)}${fmt.currency(totals.realized)}`}
          sub="From exited positions" />
      </div>

      <div className="card">
        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800 flex-wrap gap-2">
          <h2 className="font-semibold text-gray-900 dark:text-white">Shareholders</h2>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" placeholder="Search name or email…" value={search} onChange={e => setSearch(e.target.value)}
                className="pl-6 pr-2 py-1 text-xs border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-brand-500 w-44" />
            </div>
            <button onClick={exportExcel}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300">
              <FileSpreadsheet size={12} /> Excel
            </button>
          </div>
        </div>
        <Table>
          <thead>
            <tr>
              <Th>Shareholder</Th>
              <Th>Clients</Th>
              <Th>Company Share Capital</Th>
              <Th>Invested</Th>
              <Th>Portfolio</Th>
              <Th>Unrealized P&amp;L</Th>
              <Th>Realized P&amp;L</Th>
              <Th>Cash on Hand (excl. profits)<HeadTip text="Total SIP amount minus the cost of holdings still held. Same figure as Cash on Hand on the SIP page." /></Th>
            </tr>
          </thead>
          <tbody>
            {!filtered.length && <EmptyRow cols={8} message="No shareholders" />}
            {filtered.map(r => {
              const pct = r.invested > 0 ? r.unrealized / r.invested * 100 : 0;
              return (
                <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <Td>
                    {isAdmin
                      ? <Link to={`/clients/${r.id}`} className="font-medium text-brand-600 hover:text-brand-700 text-sm">{r.name}</Link>
                      : <span className="font-medium text-sm text-gray-900 dark:text-white">{r.name}</span>}
                    <p className="text-xs text-gray-400">{r.email}</p>
                  </Td>
                  <Td className="text-sm">{r.clientCount}</Td>
                  <Td className="text-sm">{fmt.currency(r.contributed)}</Td>
                  <Td className="text-sm">{fmt.currency(r.invested)}</Td>
                  <Td className="font-medium text-sm">{fmt.currency(r.portfolio)}</Td>
                  <Td className={`text-sm ${pnlColor(r.unrealized)}`}>
                    {pnlSign(r.unrealized)}{fmt.currency(r.unrealized)}
                    {r.invested > 0 && <span className="text-xs ml-1">({pnlSign(pct)}{fmt.percent(Math.abs(pct))})</span>}
                  </Td>
                  <Td className={`text-sm ${pnlColor(r.realized)}`}>{pnlSign(r.realized)}{fmt.currency(r.realized)}</Td>
                  <Td className={`text-sm ${pnlColor(r.cashExcl)}`}>{fmt.currency(r.cashExcl)}</Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </div>
    </div>
  );
}
