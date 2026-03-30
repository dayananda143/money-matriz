import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, TrendingUp, Wallet, Pencil, Trash2, Copy, ChevronLeft, ChevronRight, Search, Download } from 'lucide-react';
import api from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import { fmt, pnlColor, pnlSign } from '../../utils/format';
import { Table, Th, Td, EmptyRow } from '../../components/ui/Table';
import { SkeletonPageHeader, SkeletonStatCards, SkeletonFilterPills, SkeletonTable } from '../../components/ui/Skeleton';
import Modal from '../../components/ui/Modal';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

async function exportToPDF({ client, portfolio, funds, month, year }) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const monthName = MONTHS[month].slice(0, 3).toUpperCase();

  // Color palette
  const GREEN_DARK  = [22, 78, 45];
  const GREEN_MED   = [34, 120, 70];
  const GREEN_LIGHT = [220, 245, 230];
  const GREEN_PALE  = [240, 250, 244];
  const GOLD        = [192, 155, 60];
  const WHITE       = [255, 255, 255];
  const GRAY_DARK   = [50, 50, 50];
  const GRAY_MID    = [110, 110, 110];
  const GRAY_LIGHT  = [245, 245, 245];

  // ── White page background ──────────────────────────────────────
  doc.setFillColor(...WHITE);
  doc.rect(0, 0, W, H, 'F');

  // ── Dark green header banner ───────────────────────────────────
  const BANNER_H = 28;
  doc.setFillColor(...GREEN_DARK);
  doc.rect(0, 0, W, BANNER_H, 'F');

  // Gold accent line below banner
  doc.setFillColor(...GOLD);
  doc.rect(0, BANNER_H, W, 1, 'F');

  // ── Logo in banner ─────────────────────────────────────────────
  try {
    const logoDataUrl = await new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width; canvas.height = img.height;
        canvas.getContext('2d').drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = reject;
      img.src = '/logo.png';
    });
    doc.addImage(logoDataUrl, 'PNG', 4, 3, 22, 22);
  } catch {
    doc.setFillColor(...WHITE);
    doc.circle(15, 14, 10, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...GREEN_DARK);
    doc.text('MM', 15, 17, { align: 'center' });
  }

  // ── Title + icon together, centred in banner ───────────────────
  // Icon sits just left of the title text
  const titleIconX = 88;  // icon left edge
  const titleIconSize = 20;
  try {
    const logoDataUrl2 = await new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width; canvas.height = img.height;
        canvas.getContext('2d').drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = reject;
      img.src = '/logo.png';
    });
    doc.addImage(logoDataUrl2, 'PNG', titleIconX, 4, titleIconSize, titleIconSize);
  } catch { /* skip */ }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(...WHITE);
  doc.text(`MONEY MATRIZ MONTHLY REPORT`, titleIconX + titleIconSize + 3, 12);

  // Month + year — centred under the title+icon group
  doc.setFontSize(11);
  doc.setTextColor(...GOLD);
  doc.text(`${MONTHS[month].toUpperCase()}  ${year}`, titleIconX + titleIconSize + 3 + 60, 22, { align: 'center' });

  // ── Client name strip ──────────────────────────────────────────
  doc.setFillColor(...GREEN_PALE);
  doc.rect(0, BANNER_H + 1, W, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...GREEN_DARK);
  doc.text(`Client : ${client?.name || '—'}`, 10, BANNER_H + 6.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...GRAY_MID);
  doc.text(`Generated on ${new Date().toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}`, W - 10, BANNER_H + 6.5, { align: 'right' });

  // ── Compute summary data ───────────────────────────────────────
  const holdings = portfolio?.holdings || [];
  const activeHoldings = holdings.filter(h => h.status === 'active');
  const exitedHoldings = holdings.filter(h => h.status === 'exited');
  const totalDeposited   = funds.filter(f => f.type === 'deposit').reduce((s, f) => s + parseFloat(f.amount), 0);
  const activeInvested   = activeHoldings.reduce((s, h) => s + parseFloat(h.quantity) * parseFloat(h.avg_buy_price), 0);
  const activeValue      = activeHoldings.reduce((s, h) => s + parseFloat(h.current_value), 0);
  const unrealizedPct    = activeInvested > 0 ? (activeValue - activeInvested) / activeInvested * 100 : 0;
  const exitedBuyAmount  = exitedHoldings.reduce((s, h) => s + parseFloat(h.total_buy_amount), 0);
  const realizedPnl      = exitedHoldings.reduce((s, h) => s + parseFloat(h.realized_pnl), 0);
  const realizedPct      = exitedBuyAmount > 0 ? realizedPnl / exitedBuyAmount * 100 : 0;
  const schemeLabel      = client?.scheme ? client.scheme.split(',').map(s => s.trim().replace(/_/g, ' ')).join(', ') : '—';
  const fmtPdf           = n => `Rs. ${parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtPct           = (n) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;

  // ── Summary panel (left) ───────────────────────────────────────
  const CONTENT_Y = BANNER_H + 10;
  const panelX = 6;
  const panelW = 64;

  const summaryRows = [
    ['Total Amount',    fmtPdf(totalDeposited)],
    ['Invested Amount', fmtPdf(activeInvested)],
    ['Scheme',          schemeLabel],
    ['Current P/L',     fmtPct(unrealizedPct)],
    ['Realized P/L',    fmtPct(realizedPct)],
  ];

  autoTable(doc, {
    startY: CONTENT_Y,
    margin: { left: panelX },
    tableWidth: panelW,
    head: [],
    body: summaryRows,
    theme: 'plain',
    styles: { fontSize: 8, cellPadding: 3, overflow: 'linebreak', lineColor: [210, 230, 215], lineWidth: 0.3 },
    columnStyles: {
      0: { fillColor: GREEN_DARK, textColor: WHITE, fontStyle: 'bold', cellWidth: 30 },
      1: { fillColor: GREEN_LIGHT, textColor: GRAY_DARK, fontStyle: 'bold', cellWidth: 34, halign: 'right' },
    },
    didParseCell: (data) => {
      if (data.column.index === 1 && typeof data.cell.raw === 'string' && data.cell.raw.includes('%')) {
        const n = parseFloat(data.cell.raw);
        if (!isNaN(n)) {
          data.cell.styles.textColor = n >= 0 ? [0, 140, 60] : [200, 30, 30];
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
  });

  // Green left accent bar on summary
  const sumEndY = doc.lastAutoTable.finalY;
  doc.setFillColor(...GREEN_MED);
  doc.rect(panelX, CONTENT_Y, 1.5, sumEndY - CONTENT_Y, 'F');

  // ── Holdings table (right) ─────────────────────────────────────
  const tableX = panelX + panelW + 4;
  const tableW = W - tableX - 6;
  const allRows = [...activeHoldings, ...exitedHoldings];

  const tableBody = allRows.map(h => {
    const isActive = h.status === 'active';
    const pnlPct = isActive
      ? parseFloat(h.pnl_percent)
      : (parseFloat(h.total_buy_amount) > 0 ? parseFloat(h.realized_pnl) / parseFloat(h.total_buy_amount) * 100 : 0);
    return [
      h.first_buy_date  ? new Date(h.first_buy_date).toLocaleDateString('en-IN')  : '—',
      h.stock_name || h.symbol,
      parseFloat(h.avg_buy_price).toFixed(2),
      parseFloat(h.total_buy_amount).toFixed(2),
      parseFloat(h.total_bought_quantity || h.quantity).toFixed(2),
      h.last_sell_date  ? new Date(h.last_sell_date).toLocaleDateString('en-IN')  : '',
      parseFloat(h.avg_sell_price) > 0 ? parseFloat(h.avg_sell_price).toFixed(2) : '',
      `${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%`,
    ];
  });

  autoTable(doc, {
    startY: CONTENT_Y,
    margin: { left: tableX },
    tableWidth: tableW,
    head: [['BUY DATE', 'NAME', 'BOUGHT\nPRICE', 'INVESTED\nAMOUNT', 'QTY', 'SELL DATE', 'SOLD\nPRICE', 'P/L%']],
    body: tableBody,
    theme: 'grid',
    headStyles: {
      fillColor: GREEN_DARK,
      textColor: WHITE,
      fontSize: 6.5,
      fontStyle: 'bold',
      halign: 'center',
      cellPadding: { top: 2.5, bottom: 2.5, left: 1, right: 1 },
      lineColor: GREEN_MED,
      lineWidth: 0.3,
    },
    bodyStyles: { fontSize: 6.8, cellPadding: { top: 1.8, bottom: 1.8, left: 1.5, right: 1.5 }, lineColor: [210, 230, 215], lineWidth: 0.2 },
    alternateRowStyles: { fillColor: GREEN_PALE },
    columnStyles: {
      0: { halign: 'center', cellWidth: 17 },
      1: { halign: 'left',   cellWidth: 'auto' },
      2: { halign: 'right',  cellWidth: 18 },
      3: { halign: 'right',  cellWidth: 22 },
      4: { halign: 'center', cellWidth: 14 },
      5: { halign: 'center', cellWidth: 17 },
      6: { halign: 'right',  cellWidth: 18 },
      7: { halign: 'right',  cellWidth: 14 },
    },
    didParseCell: (data) => {
      if (data.column.index === 7 && data.section === 'body') {
        const n = parseFloat(data.cell.raw);
        if (!isNaN(n)) {
          data.cell.styles.textColor = n >= 0 ? [0, 140, 60] : [200, 30, 30];
          data.cell.styles.fontStyle = 'bold';
        }
      }
      // Highlight exited rows (have sell date) slightly
      if (data.section === 'body' && data.column.index === 5 && data.cell.raw) {
        data.cell.styles.textColor = GRAY_MID;
      }
    },
  });

  // ── Footer ─────────────────────────────────────────────────────
  doc.setFillColor(...GREEN_DARK);
  doc.rect(0, H - 8, W, 8, 'F');
  doc.setFillColor(...GOLD);
  doc.rect(0, H - 8, W, 0.8, 'F');
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(...WHITE);
  doc.text('MONEY MATRIZ IS NOT REGISTERED BY SEBI', W / 2, H - 3, { align: 'center' });

  // ── Thin border around entire page ────────────────────────────
  doc.setDrawColor(...GREEN_DARK);
  doc.setLineWidth(0.5);
  doc.rect(0.5, 0.5, W - 1, H - 1, 'S');

  doc.save(`${client?.name?.replace(/\s+/g, '_') || 'client'}_report_${monthName}_${year}.pdf`);
}

function SortTh({ label, col, sort, onSort }) {
  const active = sort.key === col;
  return (
    <Th>
      <button onClick={() => onSort(col)} className="flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
        {label}
        <span className="flex flex-col leading-none">
          <span className={`text-[8px] ${active && sort.dir === 'asc' ? 'text-brand-600' : 'text-gray-300 dark:text-gray-600'}`}>▲</span>
          <span className={`text-[8px] ${active && sort.dir === 'desc' ? 'text-brand-600' : 'text-gray-300 dark:text-gray-600'}`}>▼</span>
        </span>
      </button>
    </Th>
  );
}

export default function ClientDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const [portfolio, setPortfolio] = useState(null);
  const [client, setClient] = useState(null);
  const [isMyClient, setIsMyClient] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [funds, setFunds] = useState([]);
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const TABS = ['holdings', 'transactions', 'funds'];
  const tab = TABS.includes(searchParams.get('tab')) ? searchParams.get('tab') : 'holdings';
  const setTab = (t) => setSearchParams({ tab: t }, { replace: true });
  const [holdingsTab, setHoldingsTab] = useState('active');
  const [holdingsPage, setHoldingsPage] = useState(1);
  const [holdingsLimit, setHoldingsLimit] = useState(10);
  const [holdingsSearch, setHoldingsSearch] = useState('');
  const [holdingsSort, setHoldingsSort] = useState({ key: 'current_value', dir: 'desc' });
  const [txSort, setTxSort] = useState({ key: 'executed_at', dir: 'desc' });
  const [txPage, setTxPage] = useState(1);
  const [txLimit, setTxLimit] = useState(10);
  const [txSearch, setTxSearch] = useState('');
  const [tradeModal, setTradeModal] = useState(false);
  const [fundModal, setFundModal] = useState(false);
  const [tradeForm, setTradeForm] = useState({ stock_id: '', type: 'buy', quantity: '', price: '', notes: '' });
  const [fundForm, setFundForm] = useState({ type: 'deposit', amount: '', notes: '', date: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editFundModal, setEditFundModal] = useState(false);
  const [editFundId, setEditFundId] = useState(null);
  const [editFundForm, setEditFundForm] = useState({ type: 'deposit', amount: '', notes: '', date: '' });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [deleteFundId, setDeleteFundId] = useState(null);
  const [toast, setToast] = useState(null);
  const [exportDialog, setExportDialog] = useState(false);
  const [exportMonth, setExportMonth] = useState(new Date().getMonth());
  const [exportYear, setExportYear] = useState(new Date().getFullYear());

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get(`/portfolio/${id}/summary`),
      api.get(`/portfolio/${id}/transactions?limit=100`),
      api.get(`/portfolio/${id}/funds`),
      api.get('/stocks'),
      api.get(`/users/${id}`),
      isAdmin ? Promise.resolve(null) : api.get('/relationships/shareholder/me'),
    ]).then(([p, t, f, s, u, rel]) => {
      setPortfolio(p.data);
      setTransactions(t.data);
      setFunds(f.data);
      setStocks(s.data);
      setClient(u.data);
      if (rel) setIsMyClient(rel.data.some(c => c.id === parseInt(id)));
    }).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(load, [id]);

  const submitTrade = async (e) => {
    e.preventDefault(); setError(''); setSaving(true);
    try {
      await api.post(`/portfolio/${id}/trade`, { ...tradeForm, quantity: parseFloat(tradeForm.quantity), price: parseFloat(tradeForm.price) });
      setTradeModal(false); load(); showToast('Trade executed successfully');
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };

  const submitFund = async (e) => {
    e.preventDefault(); setError(''); setSaving(true);
    try {
      await api.post(`/portfolio/${id}/funds`, { ...fundForm, amount: parseFloat(fundForm.amount), executed_at: fundForm.date || undefined });
      setFundModal(false); load(); showToast('Fund movement added');
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };

  const openEditFund = (f) => {
    setEditFundId(f.id);
    const dateStr = f.executed_at ? new Date(f.executed_at).toISOString().slice(0, 10) : '';
    setEditFundForm({ type: f.type, amount: parseFloat(f.amount).toFixed(2), notes: f.notes || '', date: dateStr });
    setEditError('');
    setEditFundModal(true);
  };

  const openCopyFund = (f) => {
    setFundForm({ type: f.type, amount: String(f.amount), notes: f.notes || '', date: '' });
    setError('');
    setFundModal(true);
  };

  const submitEditFund = async (e) => {
    e.preventDefault(); setEditError(''); setEditSaving(true);
    try {
      await api.put(`/portfolio/${id}/funds/${editFundId}`, { ...editFundForm, amount: parseFloat(editFundForm.amount), executed_at: editFundForm.date || undefined });
      setEditFundModal(false); load(); showToast('Fund movement updated');
    } catch (err) { setEditError(err.response?.data?.error || err.message); } finally { setEditSaving(false); }
  };

  const deleteFund = async () => {
    try {
      await api.delete(`/portfolio/${id}/funds/${deleteFundId}`);
      setDeleteFundId(null);
      load(); showToast('Fund movement deleted');
    } catch (err) { alert(err.response?.data?.error || err.message); }
  };

  if (loading) return (
    <div className="space-y-6">
      <SkeletonPageHeader />
      <SkeletonStatCards count={6} cols="grid-cols-2 sm:grid-cols-3 lg:grid-cols-6" />
      <SkeletonFilterPills count={3} />
      <SkeletonTable rows={6} cols={7} />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{client?.name || 'Client Portfolio'}</h1>
          <p className="text-sm text-gray-500">{client?.email || 'Detailed view and management'}</p>
        </div>
        <div className="ml-auto flex gap-2">
          <button onClick={() => setExportDialog(true)}
            className="btn-secondary text-sm flex items-center gap-1.5">
            <Download size={14} /> Export PDF
          </button>
          {(isAdmin || isMyClient) && (
            <>
              <button onClick={() => { setFundModal(true); setError(''); setFundForm({ type: 'deposit', amount: '', notes: '' }); }} className="btn-secondary text-sm">
                Add Funds
              </button>
              {isAdmin && (
                <button onClick={() => { setTradeModal(true); setError(''); setTradeForm({ stock_id: '', type: 'buy', quantity: '', price: '', notes: '' }); }} className="btn-primary text-sm">
                  + Trade
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {(() => {
        const activeHoldings = (portfolio?.holdings || []).filter(h => h.status === 'active');
        const exitedHoldings = (portfolio?.holdings || []).filter(h => h.status === 'exited');
        const activeInvested = activeHoldings.reduce((s, h) => s + parseFloat(h.quantity) * parseFloat(h.avg_buy_price), 0);
        const unrealizedPnl = (portfolio?.portfolio_value || 0) - activeInvested;
        const realizedPnl = exitedHoldings.reduce((s, h) => s + parseFloat(h.realized_pnl), 0);
        const givenFunds = funds.reduce((s, f) => s + (f.type === 'deposit' ? parseFloat(f.amount) : -parseFloat(f.amount)), 0);
        return (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="card p-5">
              <p className="text-sm text-gray-500">Given Funds</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{fmt.currency(givenFunds)}</p>
              <p className="text-xs text-gray-400 mt-1">Deposits − withdrawals</p>
            </div>
            <div className="card p-5">
              <p className="text-sm text-gray-500">Amount Invested</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{fmt.currency(activeInvested)}</p>
              <p className="text-xs text-gray-400 mt-1">Active holdings</p>
            </div>
            <div className="card p-5">
              <p className="text-sm text-gray-500">Portfolio Value</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{fmt.currency(portfolio?.portfolio_value)}</p>
            </div>
            <div className="card p-5">
              <p className="text-sm text-gray-500">Cash Balance</p>
              <p className={`text-xl font-bold mt-1 ${pnlColor(givenFunds - activeInvested + realizedPnl)}`}>{fmt.currency(givenFunds - activeInvested + realizedPnl)}</p>
            </div>
            <div className="card p-5">
              <p className="text-sm text-gray-500">Unrealized P&L</p>
              <p className={`text-xl font-bold mt-1 ${pnlColor(unrealizedPnl)}`}>
                {pnlSign(unrealizedPnl)}{fmt.currency(unrealizedPnl)}
              </p>
              {activeInvested > 0 && (
                <p className={`text-xs mt-1 font-medium ${pnlColor(unrealizedPnl)}`}>
                  {pnlSign(unrealizedPnl)}{fmt.percent(Math.abs(unrealizedPnl / activeInvested * 100))}
                </p>
              )}
            </div>
            <div className="card p-5">
              <p className="text-sm text-gray-500">Realized P&L</p>
              <p className={`text-xl font-bold mt-1 ${pnlColor(realizedPnl)}`}>
                {pnlSign(realizedPnl)}{fmt.currency(realizedPnl)}
              </p>
              <p className="text-xs text-gray-400 mt-1">Exited positions</p>
            </div>
          </div>
        );
      })()}

      <div className="flex gap-2">
        {['holdings', 'transactions', ...(isAdmin || isMyClient ? ['funds'] : [])].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${tab === t ? 'bg-brand-600 text-white' : 'btn-secondary'}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'holdings' && (() => {
        const activeHoldings = (portfolio?.holdings || []).filter(h => h.status === 'active');
        const exitedHoldings = (portfolio?.holdings || []).filter(h => h.status === 'exited');
        const searchLower = holdingsSearch.toLowerCase();
        const handleSort = (col) => {
          setHoldingsSort(s => ({ key: col, dir: s.key === col && s.dir === 'desc' ? 'asc' : 'desc' }));
          setHoldingsPage(1);
        };
        const base = (holdingsTab === 'active' ? activeHoldings : exitedHoldings)
          .filter(h => !holdingsSearch || h.symbol.toLowerCase().includes(searchLower) || h.stock_name.toLowerCase().includes(searchLower));
        const all = [...base].sort((a, b) => {
          const av = a[holdingsSort.key] ?? '';
          const bv = b[holdingsSort.key] ?? '';
          const numA = parseFloat(av), numB = parseFloat(bv);
          const isNum = !isNaN(numA) && !isNaN(numB);
          const cmp = isNum ? numA - numB : String(av).localeCompare(String(bv));
          return holdingsSort.dir === 'asc' ? cmp : -cmp;
        });
        const totalPages = Math.max(1, Math.ceil(all.length / holdingsLimit));
        const paged = all.slice((holdingsPage - 1) * holdingsLimit, holdingsPage * holdingsLimit);
        return (
          <div className="card">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <button onClick={() => { setHoldingsTab('active'); setHoldingsPage(1); setHoldingsSearch(''); setHoldingsSort({ key: 'current_value', dir: 'desc' }); }}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${holdingsTab === 'active' ? 'bg-brand-600 text-white' : 'btn-secondary'}`}>
                  Active <span className={`ml-1 text-xs ${holdingsTab === 'active' ? 'text-brand-200' : 'text-gray-400'}`}>{activeHoldings.length}</span>
                </button>
                <button onClick={() => { setHoldingsTab('exited'); setHoldingsPage(1); setHoldingsSearch(''); setHoldingsSort({ key: 'realized_pnl', dir: 'desc' }); }}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${holdingsTab === 'exited' ? 'bg-brand-600 text-white' : 'btn-secondary'}`}>
                  Exited <span className={`ml-1 text-xs ${holdingsTab === 'exited' ? 'text-brand-200' : 'text-gray-400'}`}>{exitedHoldings.length}</span>
                </button>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    className="pl-7 pr-3 py-1 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-brand-500 w-36"
                    placeholder="Search stocks…"
                    value={holdingsSearch}
                    onChange={e => { setHoldingsSearch(e.target.value); setHoldingsPage(1); }}
                  />
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400">Show</span>
                <div className="flex rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden text-xs font-medium">
                  {[5, 10, 20, 50].map(n => (
                    <button key={n} onClick={() => { setHoldingsLimit(n); setHoldingsPage(1); }}
                      className={`px-2.5 py-1 transition-colors ${holdingsLimit === n ? 'bg-brand-600 text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {holdingsTab === 'active' ? (
              <Table>
                <thead><tr>
                  <SortTh label="Symbol" col="symbol" sort={holdingsSort} onSort={handleSort} />
                  <Th>Name</Th>
                  <SortTh label="Qty" col="quantity" sort={holdingsSort} onSort={handleSort} />
                  <SortTh label="Avg Buy" col="avg_buy_price" sort={holdingsSort} onSort={handleSort} />
                  <SortTh label="Current" col="current_price" sort={holdingsSort} onSort={handleSort} />
                  <SortTh label="Bought Value" col="total_buy_amount" sort={holdingsSort} onSort={handleSort} />
                  <SortTh label="Current Value" col="current_value" sort={holdingsSort} onSort={handleSort} />
                  <SortTh label="P&L" col="unrealized_pnl" sort={holdingsSort} onSort={handleSort} />
                </tr></thead>
                <tbody>
                  {!paged.length && <EmptyRow cols={8} message="No active holdings" />}
                  {paged.map(h => (
                    <tr key={h.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <Td><span className="font-bold text-brand-600 dark:text-brand-400">{h.symbol}</span></Td>
                      <Td>{h.stock_name}</Td>
                      <Td>{fmt.number(h.quantity, 2)}</Td>
                      <Td>{fmt.currency(h.avg_buy_price)}</Td>
                      <Td>{fmt.currency(h.current_price)}</Td>
                      <Td className="font-medium">{fmt.currency(h.total_buy_amount)}</Td>
                      <Td className="font-medium">{fmt.currency(h.current_value)}</Td>
                      <Td><span className={pnlColor(h.unrealized_pnl)}>{pnlSign(h.unrealized_pnl)}{fmt.currency(h.unrealized_pnl)} ({pnlSign(h.pnl_percent)}{fmt.percent(h.pnl_percent)})</span></Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <Table>
                <thead><tr>
                  <SortTh label="Symbol" col="symbol" sort={holdingsSort} onSort={handleSort} />
                  <Th>Name</Th>
                  <SortTh label="Qty Bought" col="total_bought_quantity" sort={holdingsSort} onSort={handleSort} />
                  <SortTh label="Avg Buy" col="avg_buy_price" sort={holdingsSort} onSort={handleSort} />
                  <SortTh label="Invested" col="total_buy_amount" sort={holdingsSort} onSort={handleSort} />
                  <SortTh label="Realized P&L" col="realized_pnl" sort={holdingsSort} onSort={handleSort} />
                </tr></thead>
                <tbody>
                  {!paged.length && <EmptyRow cols={6} message="No exited holdings" />}
                  {paged.map(h => (
                    <tr key={h.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <Td><span className="font-bold text-brand-600 dark:text-brand-400">{h.symbol}</span></Td>
                      <Td>{h.stock_name}</Td>
                      <Td>{fmt.number(h.total_bought_quantity, 2)}</Td>
                      <Td>{fmt.currency(h.avg_buy_price)}</Td>
                      <Td>{fmt.currency(h.total_buy_amount)}</Td>
                      <Td><span className={pnlColor(h.realized_pnl)}>{pnlSign(h.realized_pnl)}{fmt.currency(h.realized_pnl)}</span></Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
            {totalPages > 1 && (
              <div className="flex justify-center px-4 py-3 border-t border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-1.5">
                  <button onClick={() => setHoldingsPage(p => Math.max(1, p - 1))} disabled={holdingsPage <= 1}
                    className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-25 disabled:cursor-not-allowed">
                    <ChevronLeft size={14} />
                  </button>
                  {(() => {
                    const range = [];
                    for (let i = 1; i <= totalPages; i++) {
                      if (i === 1 || i === totalPages || (i >= holdingsPage - 1 && i <= holdingsPage + 1)) range.push(i);
                    }
                    const out = []; let prev = null;
                    for (const p of range) { if (prev !== null && p - prev > 1) out.push('...' + p); out.push(p); prev = p; }
                    return out.map((p, i) => typeof p === 'string'
                      ? <span key={p + i} className="text-xs text-gray-300 dark:text-gray-600 px-1">…</span>
                      : <button key={p} onClick={() => setHoldingsPage(p)}
                          className={`min-w-[28px] h-7 rounded-lg text-xs font-medium transition-colors ${p === holdingsPage ? 'bg-brand-600 text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>{p}</button>
                    );
                  })()}
                  <button onClick={() => setHoldingsPage(p => Math.min(totalPages, p + 1))} disabled={holdingsPage >= totalPages}
                    className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-25 disabled:cursor-not-allowed">
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {tab === 'transactions' && (() => {
        const handleTxSort = (col) => {
          setTxSort(s => ({ key: col, dir: s.key === col && s.dir === 'desc' ? 'asc' : 'desc' }));
          setTxPage(1);
        };
        const filtered = transactions.filter(t => {
          if (!txSearch.trim()) return true;
          const q = txSearch.toLowerCase();
          return t.symbol?.toLowerCase().includes(q) || t.type?.toLowerCase().includes(q);
        });
        const sorted = [...filtered].sort((a, b) => {
          const av = a[txSort.key] ?? '';
          const bv = b[txSort.key] ?? '';
          const numA = parseFloat(av), numB = parseFloat(bv);
          const isNum = !isNaN(numA) && !isNaN(numB);
          const cmp = isNum ? numA - numB : String(av).localeCompare(String(bv));
          return txSort.dir === 'asc' ? cmp : -cmp;
        });
        const totalPages = Math.max(1, Math.ceil(sorted.length / txLimit));
        const paged = sorted.slice((txPage - 1) * txLimit, txPage * txLimit);
        return (
          <div className="card">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex-wrap gap-2">
              <h3 className="font-semibold text-sm text-gray-900 dark:text-white">Transactions</h3>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search stock or type…"
                    value={txSearch}
                    onChange={e => { setTxSearch(e.target.value); setTxPage(1); }}
                    className="pl-6 pr-2 py-1 text-xs border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-brand-500 w-44"
                  />
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400">Show</span>
                <div className="flex rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden text-xs font-medium">
                  {[5, 10, 20, 50].map(n => (
                    <button key={n} onClick={() => { setTxLimit(n); setTxPage(1); }}
                      className={`px-2.5 py-1 transition-colors ${txLimit === n ? 'bg-brand-600 text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <Table>
              <thead><tr>
                <SortTh label="Date" col="executed_at" sort={txSort} onSort={handleTxSort} />
                <SortTh label="Type" col="type" sort={txSort} onSort={handleTxSort} />
                <SortTh label="Stock" col="symbol" sort={txSort} onSort={handleTxSort} />
                <SortTh label="Qty" col="quantity" sort={txSort} onSort={handleTxSort} />
                <SortTh label="Price" col="price" sort={txSort} onSort={handleTxSort} />
                <SortTh label="Total" col="total" sort={txSort} onSort={handleTxSort} />
                <Th>Notes</Th>
              </tr></thead>
              <tbody>
                {!paged.length && <EmptyRow cols={7} message="No transactions" />}
                {paged.map(t => (
                  <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <Td>{fmt.datetime(t.executed_at)}</Td>
                    <Td><span className={t.type === 'buy' ? 'badge-green' : 'badge-red'}>{t.type.toUpperCase()}</span></Td>
                    <Td><span className="font-medium">{t.symbol}</span></Td>
                    <Td>{fmt.number(t.quantity, 2)}</Td>
                    <Td>{fmt.currency(t.price)}</Td>
                    <Td className="font-medium">{fmt.currency(t.total)}</Td>
                    <Td className="text-gray-500 text-xs">{t.notes || '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            {totalPages > 1 && (
              <div className="flex justify-center px-4 py-3 border-t border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-1.5">
                  <button onClick={() => setTxPage(p => Math.max(1, p - 1))} disabled={txPage <= 1}
                    className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-25 disabled:cursor-not-allowed">
                    <ChevronLeft size={14} />
                  </button>
                  {(() => {
                    const range = [];
                    for (let i = 1; i <= totalPages; i++) {
                      if (i === 1 || i === totalPages || (i >= txPage - 1 && i <= txPage + 1)) range.push(i);
                    }
                    const out = []; let prev = null;
                    for (const p of range) { if (prev !== null && p - prev > 1) out.push('...' + p); out.push(p); prev = p; }
                    return out.map((p, i) => typeof p === 'string'
                      ? <span key={p + i} className="text-xs text-gray-300 dark:text-gray-600 px-1">…</span>
                      : <button key={p} onClick={() => setTxPage(p)}
                          className={`min-w-[28px] h-7 rounded-lg text-xs font-medium transition-colors ${p === txPage ? 'bg-brand-600 text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>{p}</button>
                    );
                  })()}
                  <button onClick={() => setTxPage(p => Math.min(totalPages, p + 1))} disabled={txPage >= totalPages}
                    className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-25 disabled:cursor-not-allowed">
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {tab === 'funds' && (isAdmin || isMyClient) && (
        <div className="card">
          <Table>
            <thead><tr><Th>Date</Th><Th>Type</Th><Th>Amount</Th><Th>Notes</Th><Th></Th></tr></thead>
            <tbody>
              {!funds.length && <EmptyRow cols={5} message="No fund movements" />}
              {funds.map(f => (
                <tr key={f.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 group">
                  <Td>{fmt.date(f.executed_at)}</Td>
                  <Td><span className={f.type === 'deposit' ? 'badge-green' : 'badge-red'}>{f.type.toUpperCase()}</span></Td>
                  <Td className="font-medium">{fmt.currency(f.amount)}</Td>
                  <Td className="text-gray-500 text-xs">{f.notes || '—'}</Td>
                  <Td>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEditFund(f)} className="p-1.5 text-gray-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-lg transition-colors" title="Edit">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => openCopyFund(f)} className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors" title="Copy">
                        <Copy size={13} />
                      </button>
                      <button onClick={() => setDeleteFundId(f.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title="Delete">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}

      {/* Export PDF Dialog */}
      <Modal open={exportDialog} onClose={() => setExportDialog(false)} title="Export PDF Report" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Select the month and year for the report.</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Month</label>
              <select className="input w-full" value={exportMonth} onChange={e => setExportMonth(parseInt(e.target.value))}>
                {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Year</label>
              <input type="number" className="input w-full" value={exportYear} min="2000" max="2100"
                onChange={e => setExportYear(parseInt(e.target.value))} />
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={() => setExportDialog(false)} className="btn-secondary flex-1">Cancel</button>
            <button onClick={() => {
              setExportDialog(false);
              exportToPDF({ client, portfolio, funds, month: exportMonth, year: exportYear }).catch(console.error);
            }} className="btn-primary flex-1 flex items-center justify-center gap-2">
              <Download size={14} /> Export
            </button>
          </div>
        </div>
      </Modal>

      {/* Trade Modal */}
      <Modal open={tradeModal} onClose={() => setTradeModal(false)} title="Execute Trade">
        <form onSubmit={submitTrade} className="space-y-4">
          {error && <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm">{error}</div>}
          <div>
            <label className="label">Stock</label>
            <select className="input" value={tradeForm.stock_id} onChange={e => setTradeForm(f => ({ ...f, stock_id: e.target.value }))} required>
              <option value="">Select stock...</option>
              {stocks.map(s => <option key={s.id} value={s.id}>{s.symbol} — {s.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Type</label>
              <select className="input" value={tradeForm.type} onChange={e => setTradeForm(f => ({ ...f, type: e.target.value }))}>
                <option value="buy">Buy</option>
                <option value="sell">Sell</option>
              </select>
            </div>
            <div>
              <label className="label">Quantity</label>
              <input type="number" className="input" placeholder="0" min="0" step="0.01" value={tradeForm.quantity} onChange={e => setTradeForm(f => ({ ...f, quantity: e.target.value }))} required />
            </div>
          </div>
          <div>
            <label className="label">Price per Share (₹)</label>
            <input type="number" className="input" placeholder="0.00" min="0" step="0.01" value={tradeForm.price} onChange={e => setTradeForm(f => ({ ...f, price: e.target.value }))} required />
          </div>
          <div>
            <label className="label">Notes (optional)</label>
            <input type="text" className="input" placeholder="Trade notes..." value={tradeForm.notes} onChange={e => setTradeForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setTradeModal(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'Executing...' : 'Execute Trade'}</button>
          </div>
        </form>
      </Modal>

      {/* Edit Fund Modal */}
      <Modal open={editFundModal} onClose={() => setEditFundModal(false)} title="Edit Fund">
        <form onSubmit={submitEditFund} className="space-y-4">
          {editError && <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm">{editError}</div>}
          <div>
            <label className="label">Type</label>
            <select className="input" value={editFundForm.type} onChange={e => setEditFundForm(f => ({ ...f, type: e.target.value }))}>
              <option value="deposit">Deposit</option>
              <option value="withdrawal">Withdrawal</option>
            </select>
          </div>
          <div>
            <label className="label">Amount (₹)</label>
            <input type="number" className="input" placeholder="0.00" min="0" step="0.01" value={editFundForm.amount} onChange={e => setEditFundForm(f => ({ ...f, amount: e.target.value }))} required />
          </div>
          <div>
            <label className="label">Date (optional)</label>
            <input type="date" className="input" value={editFundForm.date} onChange={e => setEditFundForm(f => ({ ...f, date: e.target.value }))} />
          </div>
          <div>
            <label className="label">Notes (optional)</label>
            <input type="text" className="input" placeholder="Notes..." value={editFundForm.notes} onChange={e => setEditFundForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setEditFundModal(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={editSaving} className="btn-primary flex-1">{editSaving ? 'Saving...' : 'Save Changes'}</button>
          </div>
        </form>
      </Modal>

      {/* Fund Modal */}
      <Modal open={fundModal} onClose={() => { setFundModal(false); setFundForm({ type: 'deposit', amount: '', notes: '', date: '' }); }} title="Add Funds">
        <form onSubmit={submitFund} className="space-y-4">
          {error && <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm">{error}</div>}
          <div>
            <label className="label">Type</label>
            <select className="input" value={fundForm.type} onChange={e => setFundForm(f => ({ ...f, type: e.target.value }))}>
              <option value="deposit">Deposit</option>
              <option value="withdrawal">Withdrawal</option>
            </select>
          </div>
          <div>
            <label className="label">Amount (₹)</label>
            <input type="number" className="input" placeholder="0.00" min="0" step="0.01" value={fundForm.amount} onChange={e => setFundForm(f => ({ ...f, amount: e.target.value }))} required />
          </div>
          <div>
            <label className="label">Date (optional)</label>
            <input type="date" className="input" value={fundForm.date} onChange={e => setFundForm(f => ({ ...f, date: e.target.value }))} />
          </div>
          <div>
            <label className="label">Notes (optional)</label>
            <input type="text" className="input" placeholder="Notes..." value={fundForm.notes} onChange={e => setFundForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setFundModal(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'Processing...' : 'Confirm'}</button>
          </div>
        </form>
      </Modal>

      {/* Delete Fund Confirm */}
      <Modal open={!!deleteFundId} onClose={() => setDeleteFundId(null)} title="Delete Fund Movement">
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">Are you sure you want to delete this fund movement? The balance will be reversed.</p>
          <div className="flex gap-3 pt-1">
            <button onClick={() => setDeleteFundId(null)} className="btn-secondary flex-1">Cancel</button>
            <button onClick={deleteFund} className="flex-1 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors">Delete</button>
          </div>
        </div>
      </Modal>

      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-4 py-3 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-xl shadow-lg text-sm font-medium">
          <span className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
          {toast}
        </div>
      )}
    </div>
  );
}
