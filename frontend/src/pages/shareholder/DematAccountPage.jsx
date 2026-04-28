import { useEffect, useState } from 'react';
import api from '../../api';
import { fmt, pnlColor, pnlSign } from '../../utils/format';
import { Table, Th, Td, EmptyRow } from '../../components/ui/Table';
import { SkeletonPageHeader, SkeletonStatCards, SkeletonTable } from '../../components/ui/Skeleton';
import { Landmark, ChevronLeft, ChevronRight, Search, Download, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

function SortTh({ label, col, sort, onSort, children }) {
  const active = sort.key === col;
  return (
    <Th>
      <button onClick={() => onSort(col)} className="flex items-center gap-1 hover:text-brand-600 dark:hover:text-brand-400 transition-colors whitespace-nowrap">
        {label || children}
        <span className={`text-xs ${active ? 'text-brand-600 dark:text-brand-400' : 'text-gray-300 dark:text-gray-600'}`}>
          {active ? (sort.dir === 'asc' ? '▲' : '▼') : '▲▼'}
        </span>
      </button>
    </Th>
  );
}

const USER_TYPES = [
  { label: 'Employee',    filter: u => u.user_type === 'employee' },
  { label: 'Shareholder', filter: u => u.user_type === 'shareholder' },
  { label: 'Client',      filter: u => u.user_type === 'client' },
];

function getDefaultType(u) {
  if (u?.user_type === 'employee') return 'Employee';
  if (u?.user_type === 'shareholder') return 'Shareholder';
  if (u?.user_type === 'client') return 'Client';
  return 'Shareholder';
}

function DematContent({ userId, userName }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('active');
  const [sort, setSort] = useState({ key: 'symbol', dir: 'asc' });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    setData(null);
    const url = userId === 'me' ? '/stocks/my-demat' : `/stocks/demat/${userId}`;
    api.get(url)
      .then(r => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) return (
    <div className="space-y-6">
      <SkeletonStatCards count={4} />
      <SkeletonTable rows={6} cols={6} />
    </div>
  );

  const holdings = data || [];
  const activeHoldings = holdings.filter(h => parseFloat(h.total_bought) - parseFloat(h.total_sold) > 0);
  const exitedHoldings = holdings.filter(h => parseFloat(h.total_bought) - parseFloat(h.total_sold) <= 0);
  const displayed = tab === 'active' ? activeHoldings : exitedHoldings;
  const totalInvested = activeHoldings.reduce((s, h) => s + parseFloat(h.total_invested), 0);
  const totalCurrentValue = activeHoldings.reduce((s, h) => {
    const remaining = parseFloat(h.total_bought) - parseFloat(h.total_sold);
    return s + remaining * parseFloat(h.current_price);
  }, 0);

  const handleSort = (col) => {
    setSort(s => ({ key: col, dir: s.key === col && s.dir === 'desc' ? 'asc' : 'desc' }));
    setPage(1);
  };

  const getSortValue = (h, key) => {
    if (key === 'symbol') return h.symbol;
    if (key === 'group_label') return h.group_label;
    if (key === 'total_bought') return parseFloat(h.total_bought);
    if (key === 'remaining') return parseFloat(h.total_bought) - parseFloat(h.total_sold);
    if (key === 'total_invested') return parseFloat(h.total_invested);
    if (key === 'current_price') return parseFloat(h.current_price);
    if (key === 'current_value') return (parseFloat(h.total_bought) - parseFloat(h.total_sold)) * parseFloat(h.current_price);
    if (key === 'total_sell_amount') return parseFloat(h.total_sell_amount);
    if (key === 'investment_settled') return h.investment_settled ? 1 : 0;
    if (key === 'pnl_settled') return h.pnl_settled ? 1 : 0;
    return h[key] ?? '';
  };

  const filtered = displayed.filter(h => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return h.symbol?.toLowerCase().includes(q) || h.stock_name?.toLowerCase().includes(q);
  });

  const sorted = [...filtered].sort((a, b) => {
    const av = getSortValue(a, sort.key);
    const bv = getSortValue(b, sort.key);
    const numA = parseFloat(av), numB = parseFloat(bv);
    const isNum = !isNaN(numA) && !isNaN(numB);
    const cmp = isNum ? numA - numB : String(av).localeCompare(String(bv));
    return sort.dir === 'asc' ? cmp : -cmp;
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / limit));
  const paged = sorted.slice((page - 1) * limit, page * limit);

  const exportToPDF = async () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const now = new Date();

    // ── Color palette (matches portfolio PDF template) ──────────────
    const GREEN_DARK  = [22, 78, 45];
    const GREEN_MED   = [34, 120, 70];
    const GREEN_LIGHT = [220, 245, 230];
    const GREEN_PALE  = [240, 250, 244];
    const GOLD        = [192, 155, 60];
    const WHITE       = [255, 255, 255];
    const GRAY_DARK   = [50, 50, 50];
    const GRAY_MID    = [110, 110, 110];

    // ── White page background ───────────────────────────────────────
    doc.setFillColor(...WHITE);
    doc.rect(0, 0, W, H, 'F');

    // ── Dark green header banner ────────────────────────────────────
    const BANNER_H = 28;
    doc.setFillColor(...GREEN_DARK);
    doc.rect(0, 0, W, BANNER_H, 'F');

    // Gold accent line below banner
    doc.setFillColor(...GOLD);
    doc.rect(0, BANNER_H, W, 1, 'F');

    // ── Logo in banner (top-left) ───────────────────────────────────
    const loadLogo = () => new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width; canvas.height = img.height;
        canvas.getContext('2d').drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => resolve(null);
      img.src = '/logo.png';
    });

    const logoDataUrl = await loadLogo();
    // ── Title + icon centred in banner ──────────────────────────────
    const titleIconX = 88;
    const titleIconSize = 20;
    if (logoDataUrl) doc.addImage(logoDataUrl, 'PNG', titleIconX, 4, titleIconSize, titleIconSize);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(17);
    doc.setTextColor(...WHITE);
    doc.text('MONEY MATRIZ DEMAT REPORT', titleIconX + titleIconSize + 3, 12);

    doc.setFontSize(11);
    doc.setTextColor(...GOLD);
    const tabLabel = tab === 'active' ? 'ACTIVE HOLDINGS' : 'EXITED HOLDINGS';
    doc.text(tabLabel, titleIconX + titleIconSize + 3 + 60, 22, { align: 'center' });

    // ── User name strip ─────────────────────────────────────────────
    doc.setFillColor(...GREEN_PALE);
    doc.rect(0, BANNER_H + 1, W, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...GREEN_DARK);
    doc.text(`Holder : ${userName || '—'}`, 10, BANNER_H + 6.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...GRAY_MID);
    doc.text(`Generated on ${now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`, W - 10, BANNER_H + 6.5, { align: 'right' });

    // ── Summary panel (left) ────────────────────────────────────────
    const CONTENT_Y = BANNER_H + 10;
    const panelX = 6;
    const panelW = 64;
    const fmtPdf = n => `Rs. ${parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const fmtPct = n => `${n >= 0 ? '+' : ''}${parseFloat(n || 0).toFixed(2)}%`;

    const pnl = totalCurrentValue - totalInvested;
    const pnlPct = totalInvested > 0 ? pnl / totalInvested * 100 : 0;

    const summaryRows = [
      ['Total Stocks',   String(holdings.length)],
      ['Active',         String(activeHoldings.length)],
      ['Exited',         String(exitedHoldings.length)],
      ['Total Invested', fmtPdf(totalInvested)],
      ['Current Value',  fmtPdf(totalCurrentValue)],
      ['Unrealized P&L', fmtPct(pnlPct)],
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

    // ── Holdings table (right) ──────────────────────────────────────
    const tableX = panelX + panelW + 4;
    const tableW = W - tableX - 6;

    const activeHead = [['BUY DATE', 'STOCK', 'GROUP', 'QTY\nBOUGHT', 'QTY\nREM.', 'INVESTED', 'CURR.\nPRICE', 'CURR.\nVALUE', 'INV.\nSETTLED', 'P&L\nSETTLED']];
    const exitedHead = [['BUY DATE', 'SELL DATE', 'STOCK', 'GROUP', 'QTY\nBOUGHT', 'QTY\nREM.', 'INVESTED', 'CURR.\nPRICE', 'SELL\nAMOUNT', 'INV.\nSETTLED', 'P&L\nSETTLED']];

    const tableBody = sorted.map(h => {
      const remaining = parseFloat(h.total_bought) - parseFloat(h.total_sold);
      const currentValue = remaining * parseFloat(h.current_price);
      const base = [
        h.first_buy_date ? new Date(h.first_buy_date).toLocaleDateString('en-IN') : '—',
      ];
      if (tab === 'exited') base.push(h.last_sell_date ? new Date(h.last_sell_date).toLocaleDateString('en-IN') : '—');
      base.push(
        h.stock_name || h.symbol,
        h.group_label || '—',
        fmt.number(h.total_bought, 2),
        fmt.number(remaining, 2),
        fmtPdf(h.total_invested),
        fmtPdf(h.current_price),
      );
      if (tab === 'active') base.push(fmtPdf(currentValue));
      else base.push(parseFloat(h.total_sell_amount) > 0 ? fmtPdf(h.total_sell_amount) : '—');
      base.push(h.investment_settled ? 'Yes' : 'No', h.pnl_settled ? 'Yes' : 'No');
      return base;
    });

    autoTable(doc, {
      startY: CONTENT_Y,
      margin: { left: tableX },
      tableWidth: tableW,
      head: tab === 'active' ? activeHead : exitedHead,
      body: tableBody,
      theme: 'grid',
      headStyles: {
        fillColor: GREEN_DARK, textColor: WHITE, fontSize: 6.5, fontStyle: 'bold',
        halign: 'center', cellPadding: { top: 2.5, bottom: 2.5, left: 1, right: 1 },
        lineColor: GREEN_MED, lineWidth: 0.3,
      },
      bodyStyles: { fontSize: 6.8, cellPadding: { top: 1.8, bottom: 1.8, left: 1.5, right: 1.5 }, lineColor: [210, 230, 215], lineWidth: 0.2 },
      alternateRowStyles: { fillColor: GREEN_PALE },
      columnStyles: {
        0: { halign: 'center', cellWidth: 17 },
        1: { halign: tab === 'exited' ? 'center' : 'left', cellWidth: tab === 'exited' ? 17 : 'auto' },
      },
    });

    // ── Footer ──────────────────────────────────────────────────────
    doc.setFillColor(...GREEN_DARK);
    doc.rect(0, H - 8, W, 8, 'F');
    doc.setFillColor(...GOLD);
    doc.rect(0, H - 8, W, 0.8, 'F');
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    doc.setTextColor(...WHITE);
    doc.text('MONEY MATRIZ IS NOT REGISTERED BY SEBI', W / 2, H - 3, { align: 'center' });

    // ── Border around entire page ───────────────────────────────────
    doc.setDrawColor(...GREEN_DARK);
    doc.setLineWidth(0.5);
    doc.rect(0.5, 0.5, W - 1, H - 1, 'S');

    const name = (userName || 'holdings').replace(/\s+/g, '_').toLowerCase();
    doc.save(`demat_${tab}_${name}_${now.getFullYear()}.pdf`);
  };

  const exportToExcel = () => {
    const now = new Date();
    const activeHeaders = ['Stock', 'Stock Name', 'Sector', 'Group', 'Buy Date', 'Qty Bought', 'Qty Remaining', 'Total Invested', 'Current Price', 'Current Value', 'Inv. Settled', 'P&L Settled'];
    const exitedHeaders = ['Stock', 'Stock Name', 'Sector', 'Group', 'Buy Date', 'Sell Date', 'Qty Bought', 'Qty Remaining', 'Total Invested', 'Current Price', 'Sell Amount', 'Inv. Settled', 'P&L Settled'];

    const rows = sorted.map(h => {
      const remaining = parseFloat(h.total_bought) - parseFloat(h.total_sold);
      const currentValue = remaining * parseFloat(h.current_price);
      const base = {
        'Stock': h.symbol,
        'Stock Name': h.stock_name || '',
        'Sector': h.sector || '',
        'Group': h.group_label || '',
        'Buy Date': h.first_buy_date ? new Date(h.first_buy_date).toLocaleDateString('en-IN') : '',
      };
      if (tab === 'exited') base['Sell Date'] = h.last_sell_date ? new Date(h.last_sell_date).toLocaleDateString('en-IN') : '';
      base['Qty Bought'] = parseFloat(h.total_bought);
      base['Qty Remaining'] = remaining;
      base['Total Invested'] = parseFloat(h.total_invested);
      base['Current Price'] = parseFloat(h.current_price);
      if (tab === 'active') base['Current Value'] = parseFloat(currentValue.toFixed(2));
      else base['Sell Amount'] = parseFloat(h.total_sell_amount) || 0;
      base['Inv. Settled'] = h.investment_settled ? 'Yes' : 'No';
      base['P&L Settled'] = h.pnl_settled ? 'Yes' : 'No';
      return base;
    });

    const ws = XLSX.utils.json_to_sheet(rows, { header: tab === 'active' ? activeHeaders : exitedHeaders });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, tab === 'active' ? 'Active' : 'Exited');
    XLSX.writeFile(wb, `demat_${tab}_${(userName || 'holdings').replace(/\s+/g, '_').toLowerCase()}_${now.getFullYear()}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-xs text-gray-500">Total Stocks</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{holdings.length}</p>
          <p className="text-xs text-gray-400 mt-1">{activeHoldings.length} active</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500">Total Invested</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{fmt.currency(totalInvested)}</p>
          <p className="text-xs text-gray-400 mt-1">Amount deployed</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500">Current Value</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{fmt.currency(totalCurrentValue)}</p>
          <p className="text-xs text-gray-400 mt-1">Active holdings</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500">Unrealized P&amp;L</p>
          {(() => {
            const pnl = totalCurrentValue - totalInvested;
            const pct = totalInvested > 0 ? pnl / totalInvested * 100 : 0;
            return (
              <>
                <p className={`text-xl font-bold mt-1 ${pnlColor(pnl)}`}>{pnlSign(pnl)}{fmt.currency(pnl)}</p>
                {totalInvested > 0 && <p className={`text-xs mt-1 font-medium ${pnlColor(pct)}`}>{pnlSign(pct)}{fmt.percent(pct)}</p>}
              </>
            );
          })()}
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex-wrap gap-2">
          <div className="flex items-center gap-1">
            {[{ key: 'active', label: 'Active', count: activeHoldings.length }, { key: 'exited', label: 'Exited', count: exitedHoldings.length }].map(t => (
              <button key={t.key} onClick={() => { setTab(t.key); setPage(1); }}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${tab === t.key ? 'bg-brand-600 text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                {t.label} <span className={`text-xs ml-0.5 ${tab === t.key ? 'text-brand-200' : 'text-gray-400'}`}>{t.count}</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" placeholder="Search stock…" value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                className="pl-6 pr-2 py-1 text-xs border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-brand-500 w-36" />
            </div>
            <button onClick={exportToPDF} className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300">
              <Download size={12} /> PDF
            </button>
            <button onClick={exportToExcel} className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300">
              <Download size={12} /> Excel
            </button>
            <span className="text-xs text-gray-500 dark:text-gray-400">Show</span>
            <div className="flex rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden text-xs font-medium">
              {[5, 10, 20, 50].map(n => (
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
              <SortTh label="Stock" col="symbol" sort={sort} onSort={handleSort} />
              <SortTh label="Group" col="group_label" sort={sort} onSort={handleSort} />
              <SortTh label="Buy Date" col="first_buy_date" sort={sort} onSort={handleSort} />
              {tab === 'exited' && <SortTh label="Sell Date" col="last_sell_date" sort={sort} onSort={handleSort} />}
              <SortTh label="Qty Bought" col="total_bought" sort={sort} onSort={handleSort} />
              <SortTh label="Qty Remaining" col="remaining" sort={sort} onSort={handleSort} />
              <SortTh label="Total Invested" col="total_invested" sort={sort} onSort={handleSort} />
              <SortTh label="Current Price" col="current_price" sort={sort} onSort={handleSort} />
              {tab === 'active' && <SortTh label="Current Value" col="current_value" sort={sort} onSort={handleSort} />}
              {tab === 'exited' && <SortTh label="Sell Amount" col="total_sell_amount" sort={sort} onSort={handleSort} />}
              <SortTh label="Inv. Settled" col="investment_settled" sort={sort} onSort={handleSort} />
              <SortTh label="P&L Settled" col="pnl_settled" sort={sort} onSort={handleSort} />
            </tr>
          </thead>
          <tbody>
            {!paged.length && <EmptyRow cols={tab === 'exited' ? 11 : 10} message={`No ${tab} holdings found`} />}
            {paged.map(h => {
              const remaining = parseFloat(h.total_bought) - parseFloat(h.total_sold);
              const currentValue = remaining * parseFloat(h.current_price);
              return (
                <tr key={h.group_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <Td>
                    <span className="font-bold text-brand-600 dark:text-brand-400">{h.symbol}</span>
                    <p className="text-xs text-gray-400 mt-0.5">{h.stock_name}</p>
                    {h.sector && <p className="text-xs text-gray-400">{h.sector}</p>}
                  </Td>
                  <Td className="text-sm text-gray-700 dark:text-gray-300">{h.group_label}</Td>
                  <Td className="text-xs text-gray-500">{h.first_buy_date ? new Date(h.first_buy_date).toLocaleDateString('en-IN') : '—'}</Td>
                  {tab === 'exited' && <Td className="text-xs text-gray-500">{h.last_sell_date ? new Date(h.last_sell_date).toLocaleDateString('en-IN') : '—'}</Td>}
                  <Td className="font-medium">{fmt.number(h.total_bought, 2)}</Td>
                  <Td className="font-medium">{fmt.number(remaining, 2)}</Td>
                  <Td>{fmt.currency(h.total_invested)}</Td>
                  <Td className="font-medium">{fmt.currency(h.current_price)}</Td>
                  {tab === 'active' && <Td className="font-medium">{fmt.currency(currentValue)}</Td>}
                  {tab === 'exited' && <Td>{parseFloat(h.total_sell_amount) > 0 ? fmt.currency(h.total_sell_amount) : <span className="text-gray-400">—</span>}</Td>}
                  <Td><span className={h.investment_settled ? 'badge-green' : 'badge-gray'}>{h.investment_settled ? 'Yes' : 'No'}</span></Td>
                  <Td><span className={h.pnl_settled ? 'badge-green' : 'badge-gray'}>{h.pnl_settled ? 'Yes' : 'No'}</span></Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
        {totalPages > 1 && (
          <div className="flex justify-center px-4 py-3 border-t border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-1.5">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-25 disabled:cursor-not-allowed">
                <ChevronLeft size={14} />
              </button>
              {(() => {
                const range = [];
                for (let i = 1; i <= totalPages; i++) {
                  if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) range.push(i);
                }
                const out = []; let prev = null;
                for (const p of range) { if (prev !== null && p - prev > 1) out.push('...' + p); out.push(p); prev = p; }
                return out.map((p, i) => typeof p === 'string'
                  ? <span key={p + i} className="text-xs text-gray-300 dark:text-gray-600 px-1">…</span>
                  : <button key={p} onClick={() => setPage(p)}
                      className={`min-w-[28px] h-7 rounded-lg text-xs font-medium transition-colors ${p === page ? 'bg-brand-600 text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>{p}</button>
                );
              })()}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-25 disabled:cursor-not-allowed">
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DematAccountPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const isShareholder = user?.user_type === 'shareholder';
  const canViewOthers = isAdmin || isShareholder;

  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userType, setUserType] = useState(() => getDefaultType(user));

  useEffect(() => {
    if (!canViewOthers) return;
    setUsersLoading(true);
    api.get('/users').then(r => {
      const active = r.data.filter(u => u.is_active);
      setUsers(active);
      const self = active.find(u => u.id === user?.id);
      setSelectedUser(self || active[0] || null);
    }).catch(console.error).finally(() => setUsersLoading(false));
  }, []);

  useEffect(() => {
    if (!canViewOthers || !users.length) return;
    const typeDef = USER_TYPES.find(t => t.label === userType);
    const filtered = typeDef ? users.filter(typeDef.filter) : users;
    const self = filtered.find(u => u.id === user?.id);
    setSelectedUser(self || filtered[0] || null);
  }, [userType, users]);

  const typeDef = USER_TYPES.find(t => t.label === userType);
  const filteredUsers = canViewOthers ? (typeDef ? users.filter(typeDef.filter) : users) : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <ArrowLeft size={20} />
          </button>
          <div className="w-10 h-10 rounded-xl bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center">
            <Landmark size={20} className="text-brand-600 dark:text-brand-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Demat Account</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              {canViewOthers ? 'View any user\'s demat holdings · read only' : 'Your personal demat holdings'}
            </p>
          </div>
        </div>
        {canViewOthers && !usersLoading && (
          <div className="flex items-center gap-2">
            <select className="input w-36" value={userType} onChange={e => setUserType(e.target.value)}>
              {USER_TYPES.map(t => <option key={t.label} value={t.label}>{t.label}</option>)}
            </select>
            <select className="input w-52" value={selectedUser?.id || ''}
              onChange={e => setSelectedUser(filteredUsers.find(u => u.id === parseInt(e.target.value)))}>
              {!filteredUsers.length && <option value="">No users</option>}
              {filteredUsers.map(u => <option key={u.id} value={u.id}>{u.name}{u.id === user?.id ? ' (me)' : ''}</option>)}
            </select>
          </div>
        )}
      </div>

      {canViewOthers
        ? selectedUser
          ? <DematContent key={selectedUser.id} userId={selectedUser.id} userName={selectedUser.name} />
          : <p className="text-gray-400 text-sm">No user selected.</p>
        : <DematContent userId="me" userName={user?.name} />
      }
    </div>
  );
}
