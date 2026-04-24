import { useEffect, useState, useMemo } from 'react';
import { Search, ChevronLeft, ChevronRight, Columns, Download } from 'lucide-react';
import api from '../../api';
import { fmt } from '../../utils/format';
import { Table, Th, Td, EmptyRow } from '../../components/ui/Table';
import { SkeletonPageHeader, SkeletonTable } from '../../components/ui/Skeleton';
import { useAuth } from '../../contexts/AuthContext';
import Modal from '../../components/ui/Modal';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

function SortTh({ label, col, sort, onSort }) {
  const active = sort.key === col;
  return (
    <Th>
      <button onClick={() => onSort(col)} className="flex items-center gap-1 hover:text-brand-600 dark:hover:text-brand-400 transition-colors whitespace-nowrap">
        {label}
        <span className={`text-xs ${active ? 'text-brand-600 dark:text-brand-400' : 'text-gray-300 dark:text-gray-600'}`}>
          {active ? (sort.dir === 'asc' ? '▲' : '▼') : '▲▼'}
        </span>
      </button>
    </Th>
  );
}

const TX_COLS = ['type','stock','investor','qty','price','total','executed_by','notes'];
const TX_COL_LABEL = { type:'Type', stock:'Stock', investor:'Investor', qty:'Qty', price:'Price', total:'Total', executed_by:'Executed By', notes:'Notes' };

function curFY() {
  const now = new Date();
  return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
}
function fyLabel(y) { return `FY ${y}–${String(y + 1).slice(2)}`; }
function inFYRange(tx, startFY, endFY) {
  if (!tx.executed_at) return false;
  const d = new Date(tx.executed_at);
  const start = new Date(`${startFY}-04-01`);
  const end = new Date(`${endFY + 1}-03-31T23:59:59`);
  return d >= start && d <= end;
}

function buildFYList(txs) {
  const years = new Set();
  txs.forEach(t => {
    if (!t.executed_at) return;
    const d = new Date(t.executed_at);
    years.add(d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1);
  });
  return Array.from(years).sort((a, b) => b - a);
}

function FYPicker({ label, value, onChange, min, max }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">{label}</p>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => onChange(Math.max(min, value - 1))}
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-600 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 font-bold text-lg leading-none">−</button>
        <span className="flex-1 text-center text-sm font-semibold text-gray-900 dark:text-white">{fyLabel(value)}</span>
        <button type="button" onClick={() => onChange(Math.min(max, value + 1))}
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-600 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 font-bold text-lg leading-none">+</button>
      </div>
    </div>
  );
}

async function exportToPDF({ txs, title, visibleCols, isAdmin }) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  const GREEN_DARK = [22, 78, 45];
  const GREEN_PALE = [240, 250, 244];
  const GOLD = [192, 155, 60];
  const WHITE = [255, 255, 255];

  doc.setFillColor(...WHITE);
  doc.rect(0, 0, W, H, 'F');

  const BANNER_H = 28;
  doc.setFillColor(...GREEN_DARK);
  doc.rect(0, 0, W, BANNER_H, 'F');
  doc.setFillColor(...GOLD);
  doc.rect(0, BANNER_H, W, 1, 'F');

  try {
    const logoDataUrl = await new Promise((resolve, reject) => {
      const img = new Image(); img.crossOrigin = 'anonymous';
      img.onload = () => { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; c.getContext('2d').drawImage(img, 0, 0); resolve(c.toDataURL('image/png')); };
      img.onerror = reject; img.src = '/logo.png';
    });
    doc.addImage(logoDataUrl, 'PNG', 4, 3, 22, 22);
    doc.addImage(logoDataUrl, 'PNG', 88, 4, 20, 20);
  } catch {}

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(...WHITE);
  doc.text('MONEY MATRIZ — TRANSACTIONS', 112, 12);
  doc.setFontSize(11);
  doc.setTextColor(...GOLD);
  doc.text(title.toUpperCase(), 112 + 70, 22, { align: 'center' });

  doc.setFillColor(...GREEN_PALE);
  doc.rect(0, BANNER_H + 1, W, 7, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(110, 110, 110);
  doc.text(`Generated: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`, W - 10, BANNER_H + 6, { align: 'right' });
  doc.setFontSize(8);
  doc.setTextColor(...GREEN_DARK);
  doc.text(`Transactions Report`, 10, BANNER_H + 6);

  const head = ['Date'];
  if (visibleCols.has('type')) head.push('Type');
  if (visibleCols.has('stock')) head.push('Symbol', 'Name');
  if (isAdmin && visibleCols.has('investor')) head.push('Investor');
  if (visibleCols.has('qty')) head.push('Qty');
  if (visibleCols.has('price')) head.push('Price');
  if (visibleCols.has('total')) head.push('Total');
  if (visibleCols.has('executed_by')) head.push('Executed By');
  if (visibleCols.has('notes')) head.push('Notes');

  const body = txs.map(t => {
    const row = [fmt.datetime(t.executed_at)];
    if (visibleCols.has('type')) row.push((t.type || '').toUpperCase());
    if (visibleCols.has('stock')) { row.push(t.symbol || ''); row.push(t.stock_name || ''); }
    if (isAdmin && visibleCols.has('investor')) row.push(t.user_name || '');
    if (visibleCols.has('qty')) row.push(fmt.number(t.quantity, 2));
    if (visibleCols.has('price')) row.push(fmt.currency(t.price));
    if (visibleCols.has('total')) row.push(fmt.currency(t.total));
    if (visibleCols.has('executed_by')) row.push(t.executed_by_name || '—');
    if (visibleCols.has('notes')) row.push(t.notes || '—');
    return row;
  });

  autoTable(doc, {
    startY: BANNER_H + 10,
    head: [head],
    body,
    theme: 'grid',
    headStyles: { fillColor: GREEN_DARK, textColor: WHITE, fontSize: 6.5, fontStyle: 'bold', halign: 'center', cellPadding: { top: 2.5, bottom: 2.5, left: 1.5, right: 1.5 }, lineColor: [34, 120, 70], lineWidth: 0.3 },
    bodyStyles: { fontSize: 6.8, cellPadding: { top: 1.8, bottom: 1.8, left: 1.5, right: 1.5 }, lineColor: [210, 230, 215], lineWidth: 0.2 },
    alternateRowStyles: { fillColor: GREEN_PALE },
    didParseCell: (data) => {
      if (data.section === 'body' && head[data.column.index] === 'Type') {
        data.cell.styles.textColor = data.cell.raw === 'BUY' ? [0, 140, 60] : [200, 30, 30];
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  doc.setFillColor(...GREEN_DARK);
  doc.rect(0, H - 8, W, 8, 'F');
  doc.setFillColor(...GOLD);
  doc.rect(0, H - 8, W, 0.8, 'F');
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(...WHITE);
  doc.text('MONEY MATRIZ IS NOT REGISTERED BY SEBI', W / 2, H - 3, { align: 'center' });
  doc.setDrawColor(...GREEN_DARK);
  doc.setLineWidth(0.5);
  doc.rect(0.5, 0.5, W - 1, H - 1, 'S');

  doc.save(`transactions_${title.replace(/[\s·]+/g, '_').toLowerCase()}.pdf`);
}

function exportToExcel({ txs, title, visibleCols, isAdmin }) {
  const rows = txs.map(t => {
    const row = { 'Date': fmt.datetime(t.executed_at) };
    if (visibleCols.has('type')) row['Type'] = (t.type || '').toUpperCase();
    if (visibleCols.has('stock')) { row['Symbol'] = t.symbol || ''; row['Stock Name'] = t.stock_name || ''; }
    if (isAdmin && visibleCols.has('investor')) row['Investor'] = t.user_name || '';
    if (visibleCols.has('qty')) row['Qty'] = parseFloat(t.quantity);
    if (visibleCols.has('price')) row['Price'] = parseFloat(t.price);
    if (visibleCols.has('total')) row['Total'] = parseFloat(t.total);
    if (visibleCols.has('executed_by')) row['Executed By'] = t.executed_by_name || '';
    if (visibleCols.has('notes')) row['Notes'] = t.notes || '';
    return row;
  });
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
  XLSX.writeFile(wb, `transactions_${title.replace(/[\s·]+/g, '_').toLowerCase()}.xlsx`);
}

export default function TransactionsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  const [txs, setTxs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [sort, setSort] = useState({ key: 'executed_at', dir: 'desc' });
  const [visibleCols, setVisibleCols] = useState(() => {
    try { const s = JSON.parse(localStorage.getItem('transactions_visible_cols') || 'null'); return s ? new Set(s) : new Set(TX_COLS); } catch { return new Set(TX_COLS); }
  });
  const [colMenuOpen, setColMenuOpen] = useState(false);
  const toggleCol = col => setVisibleCols(prev => {
    const next = new Set(prev); next.has(col) ? next.delete(col) : next.add(col);
    localStorage.setItem('transactions_visible_cols', JSON.stringify([...next])); return next;
  });
  const toggleableCols = isAdmin ? TX_COLS : TX_COLS.filter(c => c !== 'investor');

  // PDF export dialog state
  const [pdfDialog, setPdfDialog] = useState(false);
  const [pdfAllYears, setPdfAllYears] = useState(false);
  const [pdfStartFY, setPdfStartFY] = useState(curFY());
  const [pdfEndFY, setPdfEndFY] = useState(curFY());
  const [pdfInvestors, setPdfInvestors] = useState(new Set()); // empty = all
  const [pdfType, setPdfType] = useState('all');

  // Excel export dialog state
  const [xlsDialog, setXlsDialog] = useState(false);
  const [xlsAllYears, setXlsAllYears] = useState(false);
  const [xlsStartFY, setXlsStartFY] = useState(curFY());
  const [xlsEndFY, setXlsEndFY] = useState(curFY());
  const [xlsInvestors, setXlsInvestors] = useState(new Set()); // empty = all
  const [xlsType, setXlsType] = useState('all');

  const handleSort = (col) => {
    setSort(s => ({ key: col, dir: s.key === col && s.dir === 'desc' ? 'asc' : 'desc' }));
    setPage(1);
  };

  useEffect(() => {
    const url = isAdmin
      ? '/portfolio/all/transactions?limit=2000'
      : '/portfolio/me/transactions?limit=2000';
    api.get(url)
      .then(r => setTxs(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const fyList = useMemo(() => buildFYList(txs), [txs]);
  const minFY = useMemo(() => fyList.length ? Math.min(...fyList) : 2015, [fyList]);

  const investors = useMemo(() => {
    const map = {};
    txs.forEach(t => { if (t.user_id && t.user_name) map[t.user_id] = t.user_name; });
    return Object.entries(map).sort((a, b) => a[1].localeCompare(b[1]));
  }, [txs]);

  // Apply export filters to get export rows
  function applyExportFilters(allYears, startFY, endFY, selectedInvestors, type) {
    return txs.filter(t => {
      if (!allYears && !inFYRange(t, startFY, endFY)) return false;
      if (isAdmin && selectedInvestors.size > 0 && !selectedInvestors.has(String(t.user_id))) return false;
      if (type !== 'all' && t.type !== type) return false;
      return true;
    });
  }

  function buildExportTitle(allYears, startFY, endFY, selectedInvestors, type) {
    const parts = [];
    if (!allYears) {
      parts.push(startFY === endFY
        ? `FY${startFY}-${String(startFY + 1).slice(2)}`
        : `FY${startFY}-${String(endFY + 1).slice(2)}`);
    }
    if (isAdmin && selectedInvestors.size > 0) {
      if (selectedInvestors.size === 1) {
        const name = investors.find(([id]) => selectedInvestors.has(id))?.[1];
        if (name) parts.push(name);
      } else {
        parts.push(`${selectedInvestors.size} Investors`);
      }
    }
    if (type !== 'all') parts.push(type.toUpperCase());
    return parts.length ? parts.join(' · ') : 'All Transactions';
  }

  const filtered = useMemo(() => {
    return txs
      .filter(t => filter === 'all' || t.type === filter)
      .filter(t => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (
          (t.symbol || '').toLowerCase().includes(q) ||
          (t.stock_name || '').toLowerCase().includes(q) ||
          (t.user_name || '').toLowerCase().includes(q) ||
          (t.notes || '').toLowerCase().includes(q)
        );
      });
  }, [txs, filter, search]);

  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    const av = a[sort.key] ?? '';
    const bv = b[sort.key] ?? '';
    const numA = parseFloat(av), numB = parseFloat(bv);
    const isNum = !isNaN(numA) && !isNaN(numB);
    const cmp = isNum ? numA - numB : String(av).localeCompare(String(bv));
    return sort.dir === 'asc' ? cmp : -cmp;
  }), [filtered, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / limit));
  const paginated = sorted.slice((page - 1) * limit, page * limit);
  const colCount = isAdmin ? 9 : 8;

  if (loading) return (
    <div className="space-y-6">
      <SkeletonPageHeader />
      <SkeletonTable rows={8} cols={colCount} />
    </div>
  );

  const paginationRange = () => {
    const range = [];
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) range.push(i);
    }
    const withEllipsis = [];
    let prev = null;
    for (const p of range) {
      if (prev !== null && p - prev > 1) withEllipsis.push('...' + p);
      withEllipsis.push(p);
      prev = p;
    }
    return withEllipsis;
  };

  const toggleInvestor = (id, selectedInvestors, setSelectedInvestors) => {
    const next = new Set(selectedInvestors);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedInvestors(next);
  };

  const ExportFilters = ({ allYears, setAllYears, startFY, setStartFY, endFY, setEndFY, selectedInvestors, setSelectedInvestors, type, setType }) => {
    const [investorSearch, setInvestorSearch] = useState('');
    const filteredInvestors = investors.filter(([, name]) => name.toLowerCase().includes(investorSearch.toLowerCase()));
    return (
    <div className="space-y-4">
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input type="checkbox" checked={allYears} onChange={e => setAllYears(e.target.checked)} className="accent-brand-600 w-4 h-4" />
        <span className="text-sm text-gray-700 dark:text-gray-300">All financial years</span>
      </label>
      {!allYears && (
        <div className="space-y-3">
          <FYPicker label="Start FY" value={startFY} onChange={v => { setStartFY(v); if (v > endFY) setEndFY(v); }} min={minFY} max={endFY} />
          <FYPicker label="End FY" value={endFY} onChange={v => { setEndFY(v); if (v < startFY) setStartFY(v); }} min={startFY} max={curFY() + 1} />
        </div>
      )}
      {isAdmin && investors.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
              Investors {selectedInvestors.size > 0 && <span className="text-brand-600 dark:text-brand-400">({selectedInvestors.size} selected)</span>}
            </p>
            {selectedInvestors.size > 0 && (
              <button type="button" onClick={() => setSelectedInvestors(new Set())}
                className="text-xs text-brand-600 dark:text-brand-400 hover:underline">Clear</button>
            )}
          </div>
          <div className="relative mb-1.5">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={investorSearch} onChange={e => setInvestorSearch(e.target.value)}
              placeholder="Search investors…"
              className="w-full pl-7 pr-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <div className="max-h-36 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700/50">
            {filteredInvestors.length === 0
              ? <p className="px-3 py-2 text-xs text-gray-400">No investors found</p>
              : filteredInvestors.map(([id, name]) => (
              <label key={id} className="flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer select-none">
                <input type="checkbox" checked={selectedInvestors.has(id)}
                  onChange={() => toggleInvestor(id, selectedInvestors, setSelectedInvestors)}
                  className="rounded border-gray-300 text-brand-600 focus:ring-brand-500 w-3.5 h-3.5" />
                <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{name}</span>
              </label>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-1">Leave unchecked to include all investors</p>
        </div>
      )}
      <div>
        <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Transaction Type</p>
        <div className="flex gap-2">
          {['all', 'buy', 'sell'].map(t => (
            <button key={t} type="button" onClick={() => setType(t)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors capitalize ${type === t ? 'bg-brand-600 border-brand-600 text-white' : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
              {t === 'all' ? 'All' : t.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
    </div>
  ); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Transactions</h1>
          <p className="text-gray-500 text-sm mt-1">
            {isAdmin ? 'All platform transactions' : 'All buy / sell activity'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setXlsDialog(true)} className="btn-secondary text-sm flex items-center gap-1.5">
            <Download size={14} /> Export Excel
          </button>
          <button onClick={() => setPdfDialog(true)} className="btn-secondary text-sm flex items-center gap-1.5">
            <Download size={14} /> Export PDF
          </button>
        </div>
      </div>

      <div className="card">
        {/* Header: tabs + controls */}
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700">
          <div className="flex">
            {[
              { key: 'all',  label: 'All',  count: txs.length },
              { key: 'buy',  label: 'Buy',  count: txs.filter(t => t.type === 'buy').length },
              { key: 'sell', label: 'Sell', count: txs.filter(t => t.type === 'sell').length },
            ].map(tab => (
              <button key={tab.key} onClick={() => { setFilter(tab.key); setPage(1); }}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${filter === tab.key ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
                {tab.label}
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${filter === tab.key ? 'bg-brand-100 dark:bg-brand-900/30 text-brand-600' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>{tab.count}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 mb-1 pr-2">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                className="pl-8 pr-3 py-1 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-brand-500 w-44"
                placeholder="Search stock, investor…"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
            <div className="relative">
              <button onClick={() => setColMenuOpen(o => !o)}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300">
                <Columns size={12} /> Columns <span className="text-brand-600 dark:text-brand-400">{visibleCols.size}</span>
              </button>
              {colMenuOpen && (
                <div className="absolute right-0 top-full mt-1 z-30 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg p-2 w-44">
                  {toggleableCols.map(col => (
                    <label key={col} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer text-xs text-gray-700 dark:text-gray-300">
                      <input type="checkbox" checked={visibleCols.has(col)} onChange={() => toggleCol(col)} className="rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
                      {TX_COL_LABEL[col]}
                    </label>
                  ))}
                </div>
              )}
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Show</span>
            <div className="flex rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden text-xs font-medium">
              {[5, 10, 15, 20, 25].map(n => (
                <button key={n} onClick={() => { setLimit(n); setPage(1); }}
                  className={`px-2.5 py-1 transition-colors ${limit === n ? 'bg-brand-600 text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>

        <Table>
          <thead>
            <tr>
              <SortTh label="Date" col="executed_at" sort={sort} onSort={handleSort} />
              {visibleCols.has('type') && <SortTh label="Type" col="type" sort={sort} onSort={handleSort} />}
              {visibleCols.has('stock') && <SortTh label="Stock" col="symbol" sort={sort} onSort={handleSort} />}
              {isAdmin && visibleCols.has('investor') && <SortTh label="Investor" col="user_name" sort={sort} onSort={handleSort} />}
              {visibleCols.has('qty') && <SortTh label="Qty" col="quantity" sort={sort} onSort={handleSort} />}
              {visibleCols.has('price') && <SortTh label="Price" col="price" sort={sort} onSort={handleSort} />}
              {visibleCols.has('total') && <SortTh label="Total" col="total" sort={sort} onSort={handleSort} />}
              {visibleCols.has('executed_by') && <SortTh label="Executed By" col="executed_by_name" sort={sort} onSort={handleSort} />}
              {visibleCols.has('notes') && <Th>Notes</Th>}
            </tr>
          </thead>
          <tbody>
            {!paginated.length && <EmptyRow cols={visibleCols.size + 1} message="No transactions found" />}
            {paginated.map(t => (
              <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <Td>{fmt.datetime(t.executed_at)}</Td>
                {visibleCols.has('type') && <Td><span className={t.type === 'buy' ? 'badge-green' : 'badge-red'}>{t.type.toUpperCase()}</span></Td>}
                {visibleCols.has('stock') && <Td><span className="font-medium">{t.symbol}</span><span className="text-gray-400 text-xs ml-1">{t.stock_name}</span></Td>}
                {isAdmin && visibleCols.has('investor') && <Td><p className="font-medium text-gray-900 dark:text-white">{t.user_name}</p><p className="text-xs text-gray-400">{t.user_type}</p></Td>}
                {visibleCols.has('qty') && <Td>{fmt.number(t.quantity, 2)}</Td>}
                {visibleCols.has('price') && <Td>{fmt.currency(t.price)}</Td>}
                {visibleCols.has('total') && <Td className="font-medium">{fmt.currency(t.total)}</Td>}
                {visibleCols.has('executed_by') && <Td className="text-gray-500">{t.executed_by_name || '—'}</Td>}
                {visibleCols.has('notes') && <Td className="text-gray-500 text-xs">{t.notes || '—'}</Td>}
              </tr>
            ))}
          </tbody>
        </Table>

        {totalPages > 1 && (
          <div className="flex justify-center px-4 py-3 border-t border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-1.5">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-25 disabled:cursor-not-allowed transition-colors">
                <ChevronLeft size={14} />
              </button>
              {paginationRange().map((p, i) =>
                typeof p === 'string'
                  ? <span key={p + i} className="text-xs text-gray-300 dark:text-gray-600 px-1">…</span>
                  : <button key={p} onClick={() => setPage(p)}
                      className={`min-w-[28px] h-7 rounded-lg text-xs font-medium transition-colors ${p === page ? 'bg-brand-600 text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                      {p}
                    </button>
              )}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-25 disabled:cursor-not-allowed transition-colors">
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* PDF Export Modal */}
      <Modal open={pdfDialog} onClose={() => setPdfDialog(false)} title="Export PDF" size="sm">
        <div className="space-y-4">
          <ExportFilters
            allYears={pdfAllYears} setAllYears={setPdfAllYears}
            startFY={pdfStartFY} setStartFY={setPdfStartFY}
            endFY={pdfEndFY} setEndFY={setPdfEndFY}
            selectedInvestors={pdfInvestors} setSelectedInvestors={setPdfInvestors}
            type={pdfType} setType={setPdfType}
          />
          <div className="flex gap-3 pt-1">
            <button onClick={() => setPdfDialog(false)} className="btn-secondary flex-1">Cancel</button>
            <button onClick={() => {
              const rows = applyExportFilters(pdfAllYears, pdfStartFY, pdfEndFY, pdfInvestors, pdfType);
              const title = buildExportTitle(pdfAllYears, pdfStartFY, pdfEndFY, pdfInvestors, pdfType);
              setPdfDialog(false);
              exportToPDF({ txs: rows, title, visibleCols, isAdmin }).catch(console.error);
            }} className="btn-primary flex-1 flex items-center justify-center gap-1.5">
              <Download size={14} /> Export
            </button>
          </div>
        </div>
      </Modal>

      {/* Excel Export Modal */}
      <Modal open={xlsDialog} onClose={() => setXlsDialog(false)} title="Export Excel" size="sm">
        <div className="space-y-4">
          <ExportFilters
            allYears={xlsAllYears} setAllYears={setXlsAllYears}
            startFY={xlsStartFY} setStartFY={setXlsStartFY}
            endFY={xlsEndFY} setEndFY={setXlsEndFY}
            selectedInvestors={xlsInvestors} setSelectedInvestors={setXlsInvestors}
            type={xlsType} setType={setXlsType}
          />
          <div className="flex gap-3 pt-1">
            <button onClick={() => setXlsDialog(false)} className="btn-secondary flex-1">Cancel</button>
            <button onClick={() => {
              const rows = applyExportFilters(xlsAllYears, xlsStartFY, xlsEndFY, xlsInvestors, xlsType);
              const title = buildExportTitle(xlsAllYears, xlsStartFY, xlsEndFY, xlsInvestors, xlsType);
              setXlsDialog(false);
              exportToExcel({ txs: rows, title, visibleCols, isAdmin });
            }} className="btn-primary flex-1 flex items-center justify-center gap-1.5">
              <Download size={14} /> Download
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
