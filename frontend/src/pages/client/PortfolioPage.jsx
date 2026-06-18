import { useEffect, useState } from 'react';
import api from '../../api';
import { fmt, pnlColor, pnlSign } from '../../utils/format';
import { Table, Th, Td, EmptyRow } from '../../components/ui/Table';
import { SkeletonPageHeader, SkeletonStatCards, SkeletonTable } from '../../components/ui/Skeleton';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { ChevronLeft, ChevronRight, Search, Download, Columns } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import Modal from '../../components/ui/Modal';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function sortHoldings(rows, sort) {
  if (!sort?.key) return rows;
  return [...rows].sort((a, b) => {
    let av, bv;
    if (sort.key === 'symbol' || sort.key === 'stock_name') { av = a[sort.key] || ''; bv = b[sort.key] || ''; }
    else if (sort.key === 'pnl_percent' || sort.key === 'exited_pct') {
      const getPct = h => {
        const p = parseFloat(h.pnl_percent);
        if (!isNaN(p)) return p;
        const ba = parseFloat(h.total_buy_amount);
        return ba > 0 ? parseFloat(h.realized_pnl) / ba * 100 : 0;
      };
      av = getPct(a); bv = getPct(b);
    }
    else if (sort.key === 'first_buy_date' || sort.key === 'last_sell_date') {
      av = a[sort.key] ? new Date(a[sort.key]).getTime() : 0;
      bv = b[sort.key] ? new Date(b[sort.key]).getTime() : 0;
    }
    else { av = parseFloat(a[sort.key] || 0); bv = parseFloat(b[sort.key] || 0); }
    if (typeof av === 'string') return sort.dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    if (isNaN(av)) av = 0; if (isNaN(bv)) bv = 0;
    return sort.dir === 'asc' ? av - bv : bv - av;
  });
}

async function exportToPDF({ userName, portfolio, month, year, include = { active: true, exited: true }, charts = {}, sort = null }) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const monthName = MONTHS[month].slice(0, 3).toUpperCase();

  const GREEN_DARK  = [22, 78, 45];
  const GREEN_MED   = [34, 120, 70];
  const GREEN_LIGHT = [220, 245, 230];
  const GREEN_PALE  = [240, 250, 244];
  const GOLD        = [192, 155, 60];
  const WHITE       = [255, 255, 255];
  const GRAY_DARK   = [50, 50, 50];
  const GRAY_MID    = [110, 110, 110];

  doc.setFillColor(...WHITE);
  doc.rect(0, 0, W, H, 'F');

  const BANNER_H = 28;
  doc.setFillColor(...GREEN_DARK);
  doc.rect(0, 0, W, BANNER_H, 'F');
  doc.setFillColor(...GOLD);
  doc.rect(0, BANNER_H, W, 1, 'F');

  let logoDataUrl = null;
  try {
    logoDataUrl = await new Promise((resolve, reject) => {
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
    doc.addImage(logoDataUrl, 'PNG', 88, 4, 20, 20);
  } catch { /* skip logo */ }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(...WHITE);
  doc.text('MONEY MATRIZ MONTHLY REPORT', 111, 12);
  doc.setFontSize(11);
  doc.setTextColor(...GOLD);
  doc.text(`${MONTHS[month].toUpperCase()}  ${year}`, 171, 22, { align: 'center' });

  doc.setFillColor(...GREEN_PALE);
  doc.rect(0, BANNER_H + 1, W, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...GREEN_DARK);
  doc.text(`Client : ${userName || '—'}`, 10, BANNER_H + 6.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...GRAY_MID);
  doc.text(`Generated on ${fmt.date(new Date().toISOString())}`, W - 10, BANNER_H + 6.5, { align: 'right' });

  const holdings = portfolio?.holdings || [];
  const activeHoldings = holdings.filter(h => h.status === 'active');
  const exitedHoldings = holdings.filter(h => h.status === 'exited');
  const activeInvested  = activeHoldings.reduce((s, h) => s + parseFloat(h.quantity) * parseFloat(h.avg_buy_price), 0);
  const activeValue     = activeHoldings.reduce((s, h) => s + parseFloat(h.current_value), 0);
  const unrealizedPct   = activeInvested > 0 ? (activeValue - activeInvested) / activeInvested * 100 : 0;
  const exitedBuyAmount = exitedHoldings.reduce((s, h) => s + parseFloat(h.total_buy_amount), 0);
  const realizedPnl     = exitedHoldings.reduce((s, h) => s + parseFloat(h.realized_pnl), 0);
  const realizedPct     = exitedBuyAmount > 0 ? realizedPnl / exitedBuyAmount * 100 : 0;
  const fmtPdf = n => `Rs. ${parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtPct = n => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;

  const CONTENT_Y = BANNER_H + 10;
  const panelX = 6;
  const panelW = 64;

  const summaryRows = [
    ['SIP Net Invested', fmtPdf(portfolio?.sip_net_invested)],
    ['Invested Amount',  fmtPdf(activeInvested)],
    ['Portfolio Value',  fmtPdf(activeValue)],
    ['Unrealized P/L',  fmtPct(unrealizedPct)],
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

  const sumEndY = doc.lastAutoTable.finalY;
  doc.setFillColor(...GREEN_MED);
  doc.rect(panelX, CONTENT_Y, 1.5, sumEndY - CONTENT_Y, 'F');

  const tableX = panelX + panelW + 4;
  const tableW = W - tableX - 6;
  const allRows = sortHoldings([
    ...(include.active ? activeHoldings : []),
    ...(include.exited ? exitedHoldings : []),
  ], sort);

  const tableBody = allRows.map(h => {
    const isActive = h.status === 'active';
    const pnlPct = isActive
      ? parseFloat(h.pnl_percent)
      : (parseFloat(h.total_buy_amount) > 0 ? parseFloat(h.realized_pnl) / parseFloat(h.total_buy_amount) * 100 : 0);
    return [
      h.first_buy_date ? fmt.date(h.first_buy_date) : '—',
      h.stock_name || h.symbol,
      parseFloat(h.avg_buy_price).toFixed(2),
      parseFloat(h.total_buy_amount).toFixed(2),
      parseFloat(h.total_bought_quantity || h.quantity).toFixed(2),
      h.last_sell_date ? fmt.date(h.last_sell_date) : '',
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
    headStyles: { fillColor: GREEN_DARK, textColor: WHITE, fontSize: 6.5, fontStyle: 'bold', halign: 'center', cellPadding: { top: 2.5, bottom: 2.5, left: 1, right: 1 }, lineColor: GREEN_MED, lineWidth: 0.3 },
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

  // --- Charts page ---
  const parseHex = hex => {
    const h = hex.replace('#', '');
    return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
  };

  const selectedCharts = [];
  if (charts.allocation) {
    const items = [...activeHoldings]
      .sort((a, b) => parseFloat(b.current_value) - parseFloat(a.current_value))
      .map((h, i) => ({ label: h.symbol, value: parseFloat(h.current_value), color: COLORS[i % COLORS.length] }));
    if (items.length) selectedCharts.push({ title: 'Allocation', items });
  }
  if (charts.sector) {
    const sectorMap = {};
    activeHoldings.forEach(h => {
      const sector = h.sector || 'Other';
      sectorMap[sector] = (sectorMap[sector] || 0) + parseFloat(h.current_value);
    });
    const items = Object.entries(sectorMap)
      .sort((a, b) => b[1] - a[1])
      .map(([label, value], i) => ({ label, value, color: COLORS[i % COLORS.length] }));
    if (items.length) selectedCharts.push({ title: 'Sector Allocation', items });
  }
  if (charts.marketCap) {
    const capColors = { 'Large Cap': '#3b82f6', 'Mid Cap': '#10b981', 'Small Cap': '#f59e0b', 'Micro Cap': '#8b5cf6', 'Unclassified': '#6b7280' };
    const capMap = {};
    activeHoldings.forEach(h => {
      const cap = h.market_cap_category || 'Unclassified';
      capMap[cap] = (capMap[cap] || 0) + parseFloat(h.quantity) * parseFloat(h.avg_buy_price);
    });
    const items = Object.entries(capMap)
      .sort((a, b) => b[1] - a[1])
      .map(([label, value]) => ({ label, value, color: capColors[label] || '#06b6d4' }));
    if (items.length) selectedCharts.push({ title: 'Market Cap', items });
  }

  if (selectedCharts.length > 0) {
    doc.addPage();
    doc.setFillColor(...WHITE);
    doc.rect(0, 0, W, H, 'F');
    doc.setFillColor(...GREEN_DARK);
    doc.rect(0, 0, W, BANNER_H, 'F');
    doc.setFillColor(...GOLD);
    doc.rect(0, BANNER_H, W, 1, 'F');
    if (logoDataUrl) doc.addImage(logoDataUrl, 'PNG', 88, 4, 20, 20);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(17);
    doc.setTextColor(...WHITE);
    doc.text('MONEY MATRIZ MONTHLY REPORT', 111, 12);
    doc.setFontSize(11);
    doc.setTextColor(...GOLD);
    doc.text(`${MONTHS[month].toUpperCase()}  ${year}`, 171, 22, { align: 'center' });
    doc.setFillColor(...GREEN_PALE);
    doc.rect(0, BANNER_H + 1, W, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...GREEN_DARK);
    doc.text(`Client : ${userName || '—'}`, 10, BANNER_H + 6.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...GRAY_MID);
    doc.text(`Generated on ${fmt.date(new Date().toISOString())}`, W - 10, BANNER_H + 6.5, { align: 'right' });
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

    const drawPie = (cx, cy, r, items) => {
      const total = items.reduce((s, d) => s + d.value, 0);
      if (!total) return;
      let startAngle = -Math.PI / 2;
      items.forEach(item => {
        if (item.value <= 0) return;
        const sliceAngle = (item.value / total) * 2 * Math.PI;
        const steps = Math.max(30, Math.ceil(sliceAngle * r * 1.5));
        const pts = [{ x: cx, y: cy }];
        for (let i = 0; i <= steps; i++) {
          const a = startAngle + sliceAngle * i / steps;
          pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
        }
        const [cr, cg, cb] = parseHex(item.color);
        doc.setFillColor(cr, cg, cb);
        doc.setDrawColor(255, 255, 255);
        doc.setLineWidth(0.5);
        const segs = pts.slice(1).map((p, i2) => [p.x - pts[i2].x, p.y - pts[i2].y]);
        doc.lines(segs, pts[0].x, pts[0].y, [1, 1], 'FD', true);
        startAngle += sliceAngle;
      });
    };

    const chartContentY = BANNER_H + 10;
    const n = selectedCharts.length;
    const zoneW = (W - 20) / n;

    selectedCharts.forEach((chart, idx) => {
      const zoneX = 10 + idx * zoneW;
      const r = Math.min(32, zoneW * 0.27);
      const cx = zoneX + zoneW * 0.33;
      const cy = chartContentY + 52;
      const total = chart.items.reduce((s, d) => s + d.value, 0);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(...GREEN_DARK);
      doc.text(chart.title, zoneX + zoneW / 2, chartContentY + 8, { align: 'center' });
      doc.setFillColor(...GOLD);
      doc.rect(zoneX + zoneW / 2 - 18, chartContentY + 9.5, 36, 0.5, 'F');

      drawPie(cx, cy, r, chart.items);

      const legX = zoneX + zoneW * 0.65;
      let legY = cy - r + 4;
      const maxItems = Math.min(chart.items.length, 14);
      for (let i = 0; i < maxItems; i++) {
        const item = chart.items[i];
        const pct = total > 0 ? (item.value / total * 100).toFixed(1) : '0.0';
        const [cr, cg, cb] = parseHex(item.color);
        doc.setFillColor(cr, cg, cb);
        doc.rect(legX, legY - 2.5, 3, 3, 'F');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(...GRAY_DARK);
        const lbl = item.label.length > 16 ? item.label.slice(0, 15) + '…' : item.label;
        doc.text(lbl, legX + 5, legY);
        doc.setFont('helvetica', 'bold');
        doc.text(`${pct}%`, legX + zoneW * 0.32, legY, { align: 'right' });
        legY += 6;
      }
      if (chart.items.length > maxItems) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(6);
        doc.setTextColor(...GRAY_MID);
        doc.text(`+${chart.items.length - maxItems} more`, legX + 5, legY);
      }
    });
  }

  doc.save(`${(userName || 'portfolio').replace(/\s+/g, '_')}_report_${monthName}_${year}.pdf`);
}

function exportToExcel({ userName, active, exited, fy = null, sort = null }) {
  active  = sortHoldings(active,  sort);
  exited  = sortHoldings(exited,  sort);
  const fmtDate = d => d ? fmt.date(d) : '—';
  const fmtNum  = n => parseFloat(parseFloat(n || 0).toFixed(2));

  const activeRows = active.map(h => ({
    Symbol:          h.symbol,
    Name:            h.stock_name,
    Sector:          h.sector || '—',
    'Market Cap':    h.market_cap_category || '—',
    'Buy Date':      fmtDate(h.first_buy_date),
    Quantity:        fmtNum(h.quantity),
    'Avg Buy (₹)':   fmtNum(h.avg_buy_price),
    'Current Price (₹)': fmtNum(h.current_price),
    'Current Value (₹)': fmtNum(h.current_value),
    'Unrealized P&L (₹)': fmtNum(h.unrealized_pnl),
    'P&L %':         fmtNum(h.pnl_percent),
  }));

  const exitedRows = exited.map(h => {
    const buyAmt = parseFloat(h.total_buy_amount || 0);
    const pct    = buyAmt > 0 ? parseFloat(h.realized_pnl || 0) / buyAmt * 100 : 0;
    return {
      Symbol:           h.symbol,
      Name:             h.stock_name,
      Sector:           h.sector || '—',
      'Market Cap':     h.market_cap_category || '—',
      Shares:           fmtNum(h.total_bought_quantity),
      'Avg Buy (₹)':    fmtNum(h.avg_buy_price),
      'Amt Invested (₹)': fmtNum(h.total_buy_amount),
      'Buy Date':       fmtDate(h.first_buy_date),
      'Sell Date':      fmtDate(h.last_sell_date),
      'Realized P&L (₹)': fmtNum(h.realized_pnl),
      'P&L %':          fmtNum(pct),
    };
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(activeRows), 'Active Holdings');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(exitedRows), 'Exited Holdings');

  const fileName = `${(userName || 'portfolio').replace(/\s+/g, '_')}_holdings${fy ? `_${fy}` : ''}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

const COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6',
  '#06b6d4', '#f97316', '#ec4899', '#84cc16',
  '#14b8a6', '#a855f7', '#ef4444', '#0ea5e9',
];

function AllocationChart({ holdings, cash }) {
  const [activeIndex, setActiveIndex] = useState(null);

  const cashVal = parseFloat(cash || 0);
  const items = holdings
    .sort((a, b) => parseFloat(b.current_value) - parseFloat(a.current_value))
    .map((h, i) => ({ symbol: h.symbol, value: parseFloat(h.current_value), color: COLORS[i % COLORS.length] }));

  if (cashVal > 0) items.push({ symbol: 'CASH', value: cashVal, color: '#6b7280' });

  const total = items.reduce((s, d) => s + d.value, 0);
  const active = activeIndex !== null ? items[activeIndex] : null;

  if (!items.length) return null;

  return (
    <div className="card p-5">
      <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Allocation</h3>
      <div className="flex gap-5 items-center">
        {/* Donut */}
        <div className="relative shrink-0 w-36 h-36">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={items} dataKey="value" cx="50%" cy="50%"
                innerRadius={42} outerRadius={62} paddingAngle={2} strokeWidth={0}
                onMouseEnter={(_, i) => setActiveIndex(i)}
                onMouseLeave={() => setActiveIndex(null)}>
                {items.map((d, i) => (
                  <Cell key={i} fill={d.color}
                    opacity={activeIndex === null || activeIndex === i ? 1 : 0.2}
                    style={{ cursor: 'pointer', transition: 'opacity 0.15s' }} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          {/* Center label */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-2">
            {active ? (
              <>
                <p className="text-[11px] font-bold text-gray-900 dark:text-white leading-tight">{active.symbol}</p>
                <p className="text-sm font-bold leading-tight" style={{ color: active.color }}>
                  {total > 0 ? (Math.round(active.value / total * 1000) / 10) : 0}%
                </p>
                <p className="text-[9px] text-gray-400 leading-tight">{fmt.currency(active.value)}</p>
              </>
            ) : (
              <>
                <p className="text-[10px] text-gray-400">Total</p>
                <p className="text-sm font-bold text-gray-900 dark:text-white">{fmt.currency(total)}</p>
              </>
            )}
          </div>
        </div>

        {/* 2-col legend */}
        <div className="flex-1 min-w-0 grid grid-cols-2 gap-x-3 gap-y-1.5">
          {items.map((d, i) => (
            <div key={d.symbol}
              className="flex items-center gap-1.5 cursor-default rounded-md px-1.5 py-1 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors min-w-0"
              onMouseEnter={() => setActiveIndex(i)}
              onMouseLeave={() => setActiveIndex(null)}
              style={{ opacity: activeIndex !== null && activeIndex !== i ? 0.3 : 1, transition: 'opacity 0.15s' }}>
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
              <span className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate">{d.symbol}</span>
              <span className="text-[10px] text-gray-400 ml-auto shrink-0">
                {total > 0 ? (Math.round(d.value / total * 1000) / 10) : 0}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SectorChart({ holdings }) {
  const [activeIndex, setActiveIndex] = useState(null);

  const sectorMap = {};
  holdings.forEach(h => {
    const sector = h.sector || 'Other';
    sectorMap[sector] = (sectorMap[sector] || 0) + parseFloat(h.current_value);
  });

  const items = Object.entries(sectorMap)
    .sort((a, b) => b[1] - a[1])
    .map(([sector, value], i) => ({ symbol: sector, value, color: COLORS[i % COLORS.length] }));

  const total = items.reduce((s, d) => s + d.value, 0);
  const active = activeIndex !== null ? items[activeIndex] : null;

  if (!items.length) return null;

  return (
    <div className="card p-5">
      <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Sector Allocation</h3>
      <div className="flex gap-5 items-center">
        <div className="relative shrink-0 w-36 h-36">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={items} dataKey="value" cx="50%" cy="50%"
                innerRadius={42} outerRadius={62} paddingAngle={2} strokeWidth={0}
                onMouseEnter={(_, i) => setActiveIndex(i)}
                onMouseLeave={() => setActiveIndex(null)}>
                {items.map((d, i) => (
                  <Cell key={i} fill={d.color}
                    opacity={activeIndex === null || activeIndex === i ? 1 : 0.2}
                    style={{ cursor: 'pointer', transition: 'opacity 0.15s' }} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-2">
            {active ? (
              <>
                <p className="text-[10px] font-bold text-gray-900 dark:text-white leading-tight truncate w-full px-1">{active.symbol}</p>
                <p className="text-sm font-bold leading-tight" style={{ color: active.color }}>
                  {total > 0 ? (Math.round(active.value / total * 1000) / 10) : 0}%
                </p>
                <p className="text-[9px] text-gray-400 leading-tight">{fmt.currency(active.value)}</p>
              </>
            ) : (
              <>
                <p className="text-[10px] text-gray-400">Sectors</p>
                <p className="text-sm font-bold text-gray-900 dark:text-white">{items.length}</p>
              </>
            )}
          </div>
        </div>
        <div className="flex-1 min-w-0 grid grid-cols-2 gap-x-3 gap-y-1.5">
          {items.map((d, i) => (
            <div key={d.symbol}
              className="flex items-center gap-1.5 cursor-default rounded-md px-1.5 py-1 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors min-w-0"
              onMouseEnter={() => setActiveIndex(i)}
              onMouseLeave={() => setActiveIndex(null)}
              style={{ opacity: activeIndex !== null && activeIndex !== i ? 0.3 : 1, transition: 'opacity 0.15s' }}>
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
              <span className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">{d.symbol}</span>
              <span className="text-[10px] text-gray-400 ml-auto shrink-0">
                {total > 0 ? (Math.round(d.value / total * 1000) / 10) : 0}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const CAP_COLORS = {
  'Large Cap': '#3b82f6',
  'Mid Cap': '#10b981',
  'Small Cap': '#f59e0b',
  'Micro Cap': '#8b5cf6',
  'Unclassified': '#6b7280',
};

function MarketCapChart({ holdings }) {
  const [activeIndex, setActiveIndex] = useState(null);

  const capMap = {};
  holdings.forEach(h => {
    const cap = h.market_cap_category || 'Unclassified';
    capMap[cap] = (capMap[cap] || 0) + parseFloat(h.quantity) * parseFloat(h.avg_buy_price);
  });

  const items = Object.entries(capMap)
    .sort((a, b) => b[1] - a[1])
    .map(([cap, value]) => ({ symbol: cap, value, color: CAP_COLORS[cap] || '#06b6d4' }));

  const total = items.reduce((s, d) => s + d.value, 0);
  const active = activeIndex !== null ? items[activeIndex] : null;

  if (!items.length) return null;

  return (
    <div className="card p-5">
      <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Market Cap Allocation</h3>
      <div className="flex gap-5 items-center">
        <div className="relative shrink-0 w-36 h-36">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={items} dataKey="value" cx="50%" cy="50%"
                innerRadius={42} outerRadius={62} paddingAngle={2} strokeWidth={0}
                onMouseEnter={(_, i) => setActiveIndex(i)}
                onMouseLeave={() => setActiveIndex(null)}>
                {items.map((d, i) => (
                  <Cell key={i} fill={d.color}
                    opacity={activeIndex === null || activeIndex === i ? 1 : 0.2}
                    style={{ cursor: 'pointer', transition: 'opacity 0.15s' }} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-2">
            {active ? (
              <>
                <p className="text-[10px] font-bold text-gray-900 dark:text-white leading-tight truncate w-full px-1">{active.symbol}</p>
                <p className="text-sm font-bold leading-tight" style={{ color: active.color }}>
                  {total > 0 ? (Math.round(active.value / total * 1000) / 10) : 0}%
                </p>
                <p className="text-[9px] text-gray-400 leading-tight">{fmt.currency(active.value)}</p>
              </>
            ) : (
              <>
                <p className="text-[10px] text-gray-400">Cap Mix</p>
                <p className="text-sm font-bold text-gray-900 dark:text-white">{items.length}</p>
              </>
            )}
          </div>
        </div>
        <div className="flex-1 min-w-0 grid grid-cols-1 gap-y-1.5">
          {items.map((d, i) => (
            <div key={d.symbol}
              className="flex items-center gap-1.5 cursor-default rounded-md px-1.5 py-1 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors min-w-0"
              onMouseEnter={() => setActiveIndex(i)}
              onMouseLeave={() => setActiveIndex(null)}
              style={{ opacity: activeIndex !== null && activeIndex !== i ? 0.3 : 1, transition: 'opacity 0.15s' }}>
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
              <span className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">{d.symbol}</span>
              <span className="text-[10px] text-gray-400 ml-auto shrink-0">
                {total > 0 ? (Math.round(d.value / total * 1000) / 10) : 0}%
              </span>
              <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 shrink-0">{fmt.currency(d.value)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const PAGE_SIZES = [5, 10, 15, 20, 25];

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

const ACTIVE_COLS  = ['name','sector','buy_date','qty','avg_buy','current_price','current_value','pnl','pnl_pct'];
const EXITED_COLS  = ['name','sector','shares','avg_buy','amt_invested','buy_date','sell_date','realized_pnl','pnl_pct'];
const COL_LABEL    = { name:'Name', sector:'Sector', buy_date:'Buy Date', qty:'Qty', avg_buy:'Avg Buy', current_price:'Current Price', current_value:'Current Value', pnl:'P&L', pnl_pct:'P&L %', shares:'Shares', amt_invested:'Amt Invested', sell_date:'Sell Date', realized_pnl:'Realized P&L' };

const ALL_ACTIVE_COLS = ['name','sector','qty','avg_buy','current_price','current_value','pnl_pct'];
const ALL_EXITED_COLS = ['name','sector','shares','avg_buy','amt_invested','buy_date','sell_date','realized_pnl','pnl_pct'];

function HoldingsDetail({ userId, userName, hideExport = false }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('active');
  const [patHolding, setPatHolding] = useState(null);
  const [patTab, setPatTab] = useState('pat');
  const [sort, setSort] = useState({ key: 'first_buy_date', dir: 'desc' });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState('');
  const [visibleCols, setVisibleCols] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('portfolio_visible_cols') || '{}');
      return {
        active: saved.active ? new Set(saved.active) : new Set(ACTIVE_COLS),
        exited: saved.exited ? new Set(saved.exited) : new Set(EXITED_COLS),
      };
    } catch {
      return { active: new Set(ACTIVE_COLS), exited: new Set(EXITED_COLS) };
    }
  });
  const [colMenuOpen, setColMenuOpen] = useState(false);

  const cols = tab === 'active' ? ACTIVE_COLS : EXITED_COLS;
  const visible = visibleCols[tab];
  const toggleCol = (col) => {
    setVisibleCols(prev => {
      const next = new Set(prev[tab]);
      next.has(col) ? next.delete(col) : next.add(col);
      const updated = { ...prev, [tab]: next };
      localStorage.setItem('portfolio_visible_cols', JSON.stringify({
        active: [...updated.active],
        exited: [...updated.exited],
      }));
      return updated;
    });
  };
  const colCount = visible.size + 1; // +1 for symbol always shown
  const [exportDialog, setExportDialog] = useState(false);
  const [exportMonth, setExportMonth] = useState(new Date().getMonth());
  const [exportYear, setExportYear] = useState(new Date().getFullYear());
  const [exportInclude, setExportInclude] = useState({ active: true, exited: true });
  const [exportCharts, setExportCharts] = useState({ allocation: false, sector: false, marketCap: false });
  const [excelDialog, setExcelDialog] = useState(false);
  const [excelAll, setExcelAll] = useState(true);
  const [excelStartFY, setExcelStartFY] = useState('');
  const [excelEndFY, setExcelEndFY] = useState('');

  const handleSort = (col) => {
    setSort(s => ({ key: col, dir: s.key === col && s.dir === 'desc' ? 'asc' : 'desc' }));
    setPage(1);
  };

  useEffect(() => {
    setLoading(true);
    setData(null);
    api.get(`/portfolio/${userId}/summary`)
      .then(r => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) return (
    <div className="space-y-4">
      <SkeletonStatCards count={6} />
      <SkeletonTable rows={6} cols={9} />
    </div>
  );

  const active = data?.holdings?.filter(h => h.status === 'active') || [];
  const exited = data?.holdings?.filter(h => h.status === 'exited') || [];
  const realizedPnl = exited.reduce((s, h) => s + parseFloat(h.realized_pnl), 0);
  const activeInvested = active.reduce((s, h) => s + parseFloat(h.current_value) - parseFloat(h.unrealized_pnl), 0);
  const activeValue = active.reduce((s, h) => s + parseFloat(h.current_value), 0);
  const activeUnrealizedPnl = activeValue - activeInvested;

  return (
    <div className="space-y-4">
      {!hideExport && (
        <div className="flex justify-end gap-2">
          <button onClick={() => setExcelDialog(true)} className="btn-secondary text-sm flex items-center gap-1.5">
            <Download size={14} /> Export Excel
          </button>
          <button onClick={() => setExportDialog(true)} className="btn-secondary text-sm flex items-center gap-1.5">
            <Download size={14} /> Export PDF
          </button>
        </div>
      )}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <div className="card p-4">
          <p className="text-xs text-gray-500">SIP Amount</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{fmt.currency(data?.sip_net_invested)}</p>
          <p className="text-xs text-gray-400 mt-1">Total SIP deposits</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500">Amount Invested</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{fmt.currency(activeInvested)}</p>
          <p className="text-xs text-gray-400 mt-1">Cost basis (active)</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500">Portfolio Value</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{fmt.currency(data?.portfolio_value)}</p>
          <p className="text-xs text-gray-400 mt-1">Active holdings</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500">Cash Balance</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{fmt.currency(data?.cash_balance)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500">Unrealized P&L</p>
          <p className={`text-xl font-bold mt-1 ${pnlColor(activeUnrealizedPnl)}`}>
            {pnlSign(activeUnrealizedPnl)}{fmt.currency(activeUnrealizedPnl)}
          </p>
          <p className={`text-xs mt-1 ${pnlColor(activeInvested > 0 ? activeUnrealizedPnl / activeInvested * 100 : 0)}`}>
            {pnlSign(activeInvested > 0 ? activeUnrealizedPnl / activeInvested * 100 : 0)}{fmt.percent(Math.abs(activeInvested > 0 ? activeUnrealizedPnl / activeInvested * 100 : 0))}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500">Realized P&L</p>
          <p className={`text-xl font-bold mt-1 ${pnlColor(realizedPnl)}`}>
            {pnlSign(realizedPnl)}{fmt.currency(realizedPnl)}
          </p>
          <p className="text-xs text-gray-400 mt-1">Exited positions</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <AllocationChart holdings={active} cash={data?.cash_balance} />
        <SectorChart holdings={active} />
        <MarketCapChart holdings={active} />
      </div>

      {(() => {
        const rows = (tab === 'active' ? active : exited).filter(h => {
          if (!search.trim()) return true;
          const q = search.toLowerCase();
          return h.symbol?.toLowerCase().includes(q) || h.stock_name?.toLowerCase().includes(q);
        });
        const sorted = [...rows].sort((a, b) => {
          let av, bv;
          if (sort.key === 'symbol') { av = a.symbol; bv = b.symbol; }
          else if (sort.key === 'pnl_percent') { av = parseFloat(a.pnl_percent); bv = parseFloat(b.pnl_percent); }
          else if (sort.key === 'exited_pct') {
            const ba = parseFloat(a.total_buy_amount); const bb = parseFloat(b.total_buy_amount);
            av = ba > 0 ? parseFloat(a.realized_pnl) / ba * 100 : 0;
            bv = bb > 0 ? parseFloat(b.realized_pnl) / bb * 100 : 0;
          }
          else if (sort.key === 'first_buy_date' || sort.key === 'last_sell_date') {
            av = a[sort.key] ? new Date(a[sort.key]).getTime() : 0;
            bv = b[sort.key] ? new Date(b[sort.key]).getTime() : 0;
          }
          else { av = parseFloat(a[sort.key] || 0); bv = parseFloat(b[sort.key] || 0); }
          if (typeof av === 'string') return sort.dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
          return sort.dir === 'asc' ? av - bv : bv - av;
        });
        const totalPages = Math.max(1, Math.ceil(sorted.length / limit));
        const paged = sorted.slice((page - 1) * limit, page * limit);

        return (
          <div className="card">
            <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800 flex-wrap gap-2">
              <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 w-fit">
                <button onClick={() => { setTab('active'); setPage(1); setSort({ key: 'first_buy_date', dir: 'desc' }); }}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'active' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
                  Active <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400">{active.length}</span>
                </button>
                <button onClick={() => { setTab('exited'); setPage(1); setSort({ key: 'first_buy_date', dir: 'desc' }); }}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'exited' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
                  Exited <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400">{exited.length}</span>
                </button>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search stock…"
                    value={search}
                    onChange={e => { setSearch(e.target.value); setPage(1); }}
                    className="pl-6 pr-2 py-1 text-xs border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-brand-500 w-36"
                  />
                </div>
                <div className="relative">
                  <button onClick={() => setColMenuOpen(o => !o)}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300">
                    <Columns size={12} /> Columns <span className="text-brand-600 dark:text-brand-400">{visible.size}</span>
                  </button>
                  {colMenuOpen && (
                    <div className="absolute right-0 top-full mt-1 z-30 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg p-2 w-44">
                      {cols.map(col => (
                        <label key={col} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer text-xs text-gray-700 dark:text-gray-300">
                          <input type="checkbox" checked={visible.has(col)} onChange={() => toggleCol(col)}
                            className="rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
                          {COL_LABEL[col]}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Show</span>
                <div className="flex rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden text-xs font-medium">
                  {PAGE_SIZES.map(n => (
                    <button key={n} onClick={() => { setLimit(n); setPage(1); }}
                      className={`px-2.5 py-1 transition-colors ${limit === n ? 'bg-brand-600 text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {tab === 'active' ? (
              <Table>
                <thead><tr>
                  <SortTh label="Symbol" col="symbol" sort={sort} onSort={handleSort} />
                  {visible.has('name') && <Th>Name</Th>}
                  {visible.has('sector') && <Th>Sector</Th>}
                  {visible.has('buy_date') && <SortTh label="Buy Date" col="first_buy_date" sort={sort} onSort={handleSort} />}
                  {visible.has('qty') && <SortTh label="Qty" col="quantity" sort={sort} onSort={handleSort} />}
                  {visible.has('avg_buy') && <SortTh label="Avg Buy" col="avg_buy_price" sort={sort} onSort={handleSort} />}
                  {visible.has('current_price') && <SortTh label="Current Price" col="current_price" sort={sort} onSort={handleSort} />}
                  {visible.has('current_value') && <SortTh label="Current Value" col="current_value" sort={sort} onSort={handleSort} />}
                  {visible.has('pnl') && <SortTh label="P&L" col="unrealized_pnl" sort={sort} onSort={handleSort} />}
                  {visible.has('pnl_pct') && <SortTh label="P&L %" col="pnl_percent" sort={sort} onSort={handleSort} />}
                </tr></thead>
                <tbody>
                  {!paged.length && <EmptyRow cols={visible.size + 1} message="No active holdings" />}
                  {paged.map(h => (
                    <tr key={h.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <Td><span className="font-bold text-brand-600 dark:text-brand-400">{h.symbol}</span></Td>
                      {visible.has('name') && <Td>{h.stock_name}</Td>}
                      {visible.has('sector') && <Td><span className="badge-blue">{h.sector || '—'}</span>{h.market_cap_category && <span className="badge-purple ml-1">{h.market_cap_category}</span>}</Td>}
                      {visible.has('buy_date') && <Td className="text-xs text-gray-500">{h.first_buy_date ? fmt.date(h.first_buy_date) : '—'}</Td>}
                      {visible.has('qty') && <Td>{fmt.number(h.quantity, 2)}</Td>}
                      {visible.has('avg_buy') && <Td>{fmt.currency(h.avg_buy_price)}</Td>}
                      {visible.has('current_price') && <Td>{fmt.currency(h.current_price)}</Td>}
                      {visible.has('current_value') && <Td className="font-medium">{fmt.currency(h.current_value)}</Td>}
                      {visible.has('pnl') && <Td><span className={pnlColor(h.unrealized_pnl)}>{pnlSign(h.unrealized_pnl)}{fmt.currency(h.unrealized_pnl)}</span></Td>}
                      {visible.has('pnl_pct') && <Td><span className={pnlColor(h.pnl_percent)}>{pnlSign(h.pnl_percent)}{fmt.percent(h.pnl_percent)}</span></Td>}
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <Table>
                <thead><tr>
                  <SortTh label="Symbol" col="symbol" sort={sort} onSort={handleSort} />
                  {visible.has('name') && <Th>Name</Th>}
                  {visible.has('sector') && <Th>Sector</Th>}
                  {visible.has('shares') && <SortTh label="Shares" col="total_bought_quantity" sort={sort} onSort={handleSort} />}
                  {visible.has('avg_buy') && <SortTh label="Avg Buy" col="avg_buy_price" sort={sort} onSort={handleSort} />}
                  {visible.has('amt_invested') && <SortTh label="Amt Invested" col="total_buy_amount" sort={sort} onSort={handleSort} />}
                  {visible.has('buy_date') && <SortTh label="Buy Date" col="first_buy_date" sort={sort} onSort={handleSort} />}
                  {visible.has('sell_date') && <SortTh label="Sell Date" col="last_sell_date" sort={sort} onSort={handleSort} />}
                  {visible.has('realized_pnl') && <SortTh label="Realized P&L" col="realized_pnl" sort={sort} onSort={handleSort} />}
                  {visible.has('pnl_pct') && <SortTh label="P&L %" col="exited_pct" sort={sort} onSort={handleSort} />}
                </tr></thead>
                <tbody>
                  {!paged.length && <EmptyRow cols={visible.size + 1} message="No exited positions" />}
                  {paged.map(h => {
                    const buyAmt = parseFloat(h.total_buy_amount);
                    const pct = buyAmt > 0 ? (parseFloat(h.realized_pnl) / buyAmt * 100) : 0;
                    return (
                      <tr key={h.id} onClick={() => { setPatHolding(h); setPatTab('pat'); }} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer">
                        <Td><span className="font-bold text-gray-500 dark:text-gray-400">{h.symbol}</span></Td>
                        {visible.has('name') && <Td>{h.stock_name}</Td>}
                        {visible.has('sector') && <Td><span className="badge-blue">{h.sector || '—'}</span>{h.market_cap_category && <span className="badge-purple ml-1">{h.market_cap_category}</span>}</Td>}
                        {visible.has('shares') && <Td>{fmt.number(h.total_bought_quantity, 2)}</Td>}
                        {visible.has('avg_buy') && <Td>{fmt.currency(h.avg_buy_price)}</Td>}
                        {visible.has('amt_invested') && <Td>{fmt.currency(h.total_buy_amount)}</Td>}
                        {visible.has('buy_date') && <Td className="text-xs text-gray-500">{h.first_buy_date ? fmt.date(h.first_buy_date) : '—'}</Td>}
                        {visible.has('sell_date') && <Td className="text-xs text-gray-500">{h.last_sell_date ? fmt.date(h.last_sell_date) : '—'}</Td>}
                        {visible.has('realized_pnl') && <Td><span className={pnlColor(h.realized_pnl)}>{pnlSign(h.realized_pnl)}{fmt.currency(h.realized_pnl)}</span></Td>}
                        {visible.has('pnl_pct') && <Td><span className={pnlColor(pct)}>{pnlSign(pct)}{fmt.percent(pct)}</span></Td>}
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            )}

            {totalPages > 1 && (
              <div className="flex justify-center px-4 py-3 border-t border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-1.5">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                    className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-25 disabled:cursor-not-allowed">
                    <ChevronLeft size={14} />
                  </button>
                  {(() => {
                    const range = []; for (let i = 1; i <= totalPages; i++) if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) range.push(i);
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
        );
      })()}

      <Modal open={!!patHolding} onClose={() => setPatHolding(null)} title={patHolding ? `${patHolding.symbol} — ${patHolding.stock_name}` : ''}>
        {patHolding && (() => {
          const pnl = parseFloat(patHolding.realized_pnl || 0);
          const brokerage = parseFloat(patHolding.total_sell_brokerage || 0);
          const netProfit = pnl - brokerage;
          const days = patHolding.first_buy_date
            ? Math.floor(((patHolding.last_sell_date ? new Date(patHolding.last_sell_date) : new Date()) - new Date(patHolding.first_buy_date)) / 86400000)
            : 0;
          const taxRate = days > 365 ? 0.125 : 0.20;
          const tax = netProfit > 0 ? netProfit * taxRate : 0;
          const pat = netProfit > 0 ? netProfit - tax : 0;
          const shareholderTaking = pat * 0.30;
          const companyTaking = pat * 0.70;
          const investedAmount = parseFloat(patHolding.total_buy_amount || 0);
          const settlement = pnl >= 0
            ? investedAmount + shareholderTaking
            : investedAmount + pnl - brokerage;

          return (
            <div className="space-y-4">
              <div className="flex border-b border-gray-200 dark:border-gray-700">
                {['pat', 'settlement'].map(t => (
                  <button key={t} onClick={() => setPatTab(t)}
                    className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${patTab === t ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
                    {t === 'pat' ? 'PAT' : 'Settlement'}
                  </button>
                ))}
              </div>

              {patTab === 'pat' ? (
                <div className="space-y-2">
                  <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                    <span className="text-sm text-gray-500">Realized P/L</span>
                    <span className={`font-medium ${pnlColor(pnl)}`}>{pnlSign(pnl)}{fmt.currency(pnl)}</span>
                  </div>
                  {brokerage > 0 && (
                    <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                      <span className="text-sm text-gray-500">Brokerage</span>
                      <span className="font-medium text-red-500">−{fmt.currency(brokerage)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                    <span className="text-sm text-gray-500">Tax ({days > 365 ? 'LTCG 12.5%' : 'STCG 20%'})</span>
                    <span className="font-medium text-red-500">−{fmt.currency(tax)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-600">
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">PAT</span>
                    <span className={`font-bold ${pnlColor(pat)}`}>{fmt.currency(pat)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                    <span className="text-sm text-gray-700 dark:text-gray-300">Your Share <span className="text-xs text-gray-400">(30%)</span></span>
                    <span className="font-semibold text-blue-600">{fmt.currency(shareholderTaking)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm text-gray-700 dark:text-gray-300">Company Share <span className="text-xs text-gray-400">(70%)</span></span>
                    <span className="font-semibold text-purple-600">{fmt.currency(companyTaking)}</span>
                  </div>
                  <p className="text-xs text-gray-400 pt-1">{days} days held · {days > 365 ? 'Long-term' : 'Short-term'} capital gain</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {pnl >= 0 ? (
                    <>
                      <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                        <span className="text-sm text-gray-500">Invested Amount</span>
                        <span className="font-medium text-gray-900 dark:text-white">{fmt.currency(investedAmount)}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                        <span className="text-sm text-gray-700 dark:text-gray-300">Your Share <span className="text-xs text-gray-400">(30% of PAT)</span></span>
                        <span className="font-semibold text-blue-600">+{fmt.currency(shareholderTaking)}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-t-2 border-gray-200 dark:border-gray-600">
                        <span className="text-sm font-bold text-gray-900 dark:text-white">Total Settlement</span>
                        <span className="text-xl font-bold text-green-600">{fmt.currency(settlement)}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                        <span className="text-sm text-gray-500">Invested Amount</span>
                        <span className="font-medium text-gray-900 dark:text-white">{fmt.currency(investedAmount)}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                        <span className="text-sm text-gray-500">P/L (Loss)</span>
                        <span className="font-medium text-red-500">{fmt.currency(pnl)}</span>
                      </div>
                      {brokerage > 0 && (
                        <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                          <span className="text-sm text-gray-500">Brokerage</span>
                          <span className="font-medium text-red-500">−{fmt.currency(brokerage)}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center py-2 border-t-2 border-gray-200 dark:border-gray-600">
                        <span className="text-sm font-bold text-gray-900 dark:text-white">Total Settlement</span>
                        <span className={`text-xl font-bold ${pnlColor(settlement)}`}>{fmt.currency(settlement)}</span>
                      </div>
                    </>
                  )}
                </div>
              )}

              <button onClick={() => setPatHolding(null)} className="btn-secondary w-full">Close</button>
            </div>
          );
        })()}
      </Modal>

      <Modal open={excelDialog} onClose={() => setExcelDialog(false)} title="Export Excel" size="sm">
        {(() => {
          const now = new Date();
          const curFY = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
          const minFY = 2015;
          const startFY = parseInt(excelStartFY) || curFY;
          const endFY   = parseInt(excelEndFY)   || curFY;
          const doExport = () => {
            let filteredActive = active;
            let filteredExited = exited;
            if (!excelAll) {
              const start = new Date(`${startFY}-04-01`);
              const end   = new Date(`${endFY + 1}-03-31T23:59:59`);
              filteredActive = active.filter(h => {
                const d = h.first_buy_date ? new Date(h.first_buy_date) : null;
                return d && d >= start && d <= end;
              });
              filteredExited = exited.filter(h => {
                const d = h.last_sell_date ? new Date(h.last_sell_date) : null;
                return d && d >= start && d <= end;
              });
            }
            const fyLabel = excelAll ? null : startFY === endFY
              ? `FY${startFY}-${String(startFY + 1).slice(2)}`
              : `FY${startFY}-${String(endFY + 1).slice(2)}`;
            exportToExcel({ userName, active: filteredActive, exited: filteredExited, fy: fyLabel, sort });
            setExcelDialog(false);
          };

          const YearPicker = ({ label, value, onChange, min, max }) => (
            <div>
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">{label}</p>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => onChange(Math.max(min, value - 1))}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-600 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 font-bold text-lg leading-none">−</button>
                <span className="flex-1 text-center text-sm font-semibold text-gray-900 dark:text-white">
                  FY {value}–{String(value + 1).slice(2)}
                </span>
                <button type="button" onClick={() => onChange(Math.min(max, value + 1))}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-600 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 font-bold text-lg leading-none">+</button>
              </div>
            </div>
          );

          return (
            <div className="space-y-4">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={excelAll} onChange={e => setExcelAll(e.target.checked)} className="accent-brand-600 w-4 h-4" />
                <span className="text-sm text-gray-700 dark:text-gray-300">All years</span>
              </label>
              {!excelAll && (
                <div className="space-y-3">
                  <YearPicker label="Start FY" value={startFY} min={minFY} max={endFY}
                    onChange={v => setExcelStartFY(String(v))} />
                  <YearPicker label="End FY" value={endFY} min={startFY} max={curFY + 1}
                    onChange={v => setExcelEndFY(String(v))} />
                </div>
              )}
              <p className="text-xs text-gray-400">Active: filtered by buy date · Exited: filtered by sell date</p>
              <div className="flex gap-3 pt-1">
                <button onClick={() => setExcelDialog(false)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={doExport} className="btn-primary flex-1 flex items-center justify-center gap-1.5">
                  <Download size={14} /> Download
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>

      <Modal open={exportDialog} onClose={() => setExportDialog(false)} title="Export PDF Report" size="sm">
        <div className="space-y-4">
          <div>
            <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Include holdings</p>
            <div className="flex items-center gap-5">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={exportInclude.active} onChange={e => setExportInclude(p => ({ ...p, active: e.target.checked }))} className="accent-brand-600 w-4 h-4" />
                <span className="text-sm text-gray-700 dark:text-gray-300">Active stocks</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={exportInclude.exited} onChange={e => setExportInclude(p => ({ ...p, exited: e.target.checked }))} className="accent-brand-600 w-4 h-4" />
                <span className="text-sm text-gray-700 dark:text-gray-300">Exited stocks</span>
              </label>
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Include charts</p>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={exportCharts.allocation} onChange={e => setExportCharts(p => ({ ...p, allocation: e.target.checked }))} className="accent-brand-600 w-4 h-4" />
                <span className="text-sm text-gray-700 dark:text-gray-300">Allocation</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={exportCharts.sector} onChange={e => setExportCharts(p => ({ ...p, sector: e.target.checked }))} className="accent-brand-600 w-4 h-4" />
                <span className="text-sm text-gray-700 dark:text-gray-300">Sector Allocation</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={exportCharts.marketCap} onChange={e => setExportCharts(p => ({ ...p, marketCap: e.target.checked }))} className="accent-brand-600 w-4 h-4" />
                <span className="text-sm text-gray-700 dark:text-gray-300">Market Cap Allocation</span>
              </label>
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={() => setExportDialog(false)} className="btn-secondary flex-1">Cancel</button>
            <button disabled={!exportInclude.active && !exportInclude.exited} onClick={() => {
              setExportDialog(false);
              exportToPDF({ userName, portfolio: data, month: exportMonth, year: exportYear, include: exportInclude, charts: exportCharts, sort }).catch(console.error);
            }} className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
              <Download size={14} /> Export
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

const USER_TYPES = [
  { label: 'All',         filter: null },
  { label: 'Employee',    filter: u => u.user_type === 'employee' },
  { label: 'Shareholder', filter: u => u.user_type === 'shareholder' },
  { label: 'Client',      filter: u => u.user_type === 'client' },
];

function allHoldingSortValue(r, col, tab) {
  if (tab === 'active') {
    switch (col) {
      case 'symbol': return r.symbol;
      case 'name': return r.stock_name || '';
      case 'sector': return r.sector || '';
      case 'qty': return parseFloat(r.quantity || 0);
      case 'avg_buy': return parseFloat(r.avg_buy_price || 0);
      case 'current_price': return parseFloat(r.current_price || 0);
      case 'current_value': return parseFloat(r.current_value || 0);
      case 'pnl_pct': {
        const invested = parseFloat(r.quantity || 0) * parseFloat(r.avg_buy_price || 0);
        return invested > 0 ? parseFloat(r.unrealized_pnl || 0) / invested * 100 : 0;
      }
      default: return 0;
    }
  }
  switch (col) {
    case 'symbol': return r.symbol;
    case 'name': return r.stock_name || '';
    case 'sector': return r.sector || '';
    case 'shares': return parseFloat(r.total_bought_quantity || 0);
    case 'avg_buy': return parseFloat(r.avg_buy_price || 0);
    case 'amt_invested': return parseFloat(r.total_buy_amount || 0);
    case 'buy_date': return r.first_buy_date ? new Date(r.first_buy_date).getTime() : 0;
    case 'sell_date': return r.last_sell_date ? new Date(r.last_sell_date).getTime() : 0;
    case 'realized_pnl': return parseFloat(r.realized_pnl || 0);
    case 'pnl_pct': {
      const buyAmt = parseFloat(r.total_buy_amount || 0);
      return buyAmt > 0 ? parseFloat(r.realized_pnl || 0) / buyAmt * 100 : 0;
    }
    default: return 0;
  }
}

function AllHoldingsView() {
  const [data, setData] = useState({ active: [], exited: [] });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('active');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState({ key: 'current_value', dir: 'desc' });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [colMenuOpen, setColMenuOpen] = useState(false);
  const [visibleCols, setVisibleCols] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('all_holdings_visible_cols') || '{}');
      return {
        active: saved.active ? new Set(saved.active) : new Set(ALL_ACTIVE_COLS),
        exited: saved.exited ? new Set(saved.exited) : new Set(ALL_EXITED_COLS),
      };
    } catch {
      return { active: new Set(ALL_ACTIVE_COLS), exited: new Set(ALL_EXITED_COLS) };
    }
  });

  useEffect(() => {
    api.get('/dashboard/all-holdings')
      .then(r => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const active = data.active || [];
  const exited = data.exited || [];
  const cols = tab === 'active' ? ALL_ACTIVE_COLS : ALL_EXITED_COLS;
  const visible = visibleCols[tab];
  const colCount = visible.size + 1; // +1 for symbol, always shown

  const toggleCol = (col) => {
    setVisibleCols(prev => {
      const next = new Set(prev[tab]);
      next.has(col) ? next.delete(col) : next.add(col);
      const updated = { ...prev, [tab]: next };
      localStorage.setItem('all_holdings_visible_cols', JSON.stringify({
        active: [...updated.active],
        exited: [...updated.exited],
      }));
      return updated;
    });
  };

  const switchTab = (t) => {
    setTab(t);
    setPage(1);
    setSort({ key: t === 'active' ? 'current_value' : 'sell_date', dir: 'desc' });
  };

  const handleSort = (col) => {
    setSort(s => ({ key: col, dir: s.key === col && s.dir === 'desc' ? 'asc' : 'desc' }));
    setPage(1);
  };

  const rows = tab === 'active' ? active : exited;
  const filtered = rows.filter(r =>
    !search || r.symbol.toLowerCase().includes(search.toLowerCase()) || (r.stock_name || '').toLowerCase().includes(search.toLowerCase())
  );
  const sorted = [...filtered].sort((a, b) => {
    const av = allHoldingSortValue(a, sort.key, tab);
    const bv = allHoldingSortValue(b, sort.key, tab);
    if (typeof av === 'string') return sort.dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    return sort.dir === 'asc' ? av - bv : bv - av;
  });
  const totalPages = Math.max(1, Math.ceil(sorted.length / limit));
  const paged = sorted.slice((page - 1) * limit, page * limit);

  const totalValue    = active.reduce((s, r) => s + parseFloat(r.current_value || 0), 0);
  const totalInvested = active.reduce((s, r) => s + parseFloat(r.quantity || 0) * parseFloat(r.avg_buy_price || 0), 0);
  const totalPnl      = active.reduce((s, r) => s + parseFloat(r.unrealized_pnl || 0), 0);
  const totalPnlPct   = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;

  if (loading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Stocks',    value: active.length, isNum: false },
          { label: 'Total Invested',  value: fmt.compact(totalInvested), isNum: false },
          { label: 'Portfolio Value', value: fmt.compact(totalValue), isNum: false },
          { label: 'Unrealized P/L',  value: `${totalPnlPct >= 0 ? '+' : ''}${totalPnlPct.toFixed(2)}%`, isNum: true, pnl: totalPnlPct },
        ].map(c => (
          <div key={c.label} className="card p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{c.label}</p>
            <p className={`text-lg font-bold ${c.isNum ? (c.pnl >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400') : 'text-gray-900 dark:text-white'}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <AllocationChart holdings={active} cash={0} />
        <SectorChart holdings={active} />
        <MarketCapChart holdings={active} />
      </div>

      <div className="card">
        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800 flex-wrap gap-2">
          <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 w-fit">
            <button onClick={() => switchTab('active')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'active' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
              Active <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400">{active.length}</span>
            </button>
            <button onClick={() => switchTab('exited')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'exited' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
              Exited <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400">{exited.length}</span>
            </button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search symbol or name…"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                className="pl-6 pr-2 py-1 text-xs border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-brand-500 w-44"
              />
            </div>
            <div className="relative">
              <button onClick={() => setColMenuOpen(o => !o)}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300">
                <Columns size={12} /> Columns <span className="text-brand-600 dark:text-brand-400">{visible.size}</span>
              </button>
              {colMenuOpen && (
                <div className="absolute right-0 top-full mt-1 z-30 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg p-2 w-44">
                  {cols.map(col => (
                    <label key={col} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer text-xs text-gray-700 dark:text-gray-300">
                      <input type="checkbox" checked={visible.has(col)} onChange={() => toggleCol(col)}
                        className="rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
                      {COL_LABEL[col]}
                    </label>
                  ))}
                </div>
              )}
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Show</span>
            <div className="flex rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden text-xs font-medium">
              {PAGE_SIZES.map(n => (
                <button key={n} onClick={() => { setLimit(n); setPage(1); }}
                  className={`px-2.5 py-1 transition-colors ${limit === n ? 'bg-brand-600 text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>

        {tab === 'active' ? (
          <Table>
            <thead><tr>
              <SortTh label="Symbol" col="symbol" sort={sort} onSort={handleSort} />
              {visible.has('name') && <Th>Name</Th>}
              {visible.has('sector') && <Th>Sector</Th>}
              {visible.has('qty') && <SortTh label="Qty" col="qty" sort={sort} onSort={handleSort} />}
              {visible.has('avg_buy') && <SortTh label="Avg Buy" col="avg_buy" sort={sort} onSort={handleSort} />}
              {visible.has('current_price') && <SortTh label="Current Price" col="current_price" sort={sort} onSort={handleSort} />}
              {visible.has('current_value') && <SortTh label="Current Value" col="current_value" sort={sort} onSort={handleSort} />}
              {visible.has('pnl_pct') && <SortTh label="P&L %" col="pnl_pct" sort={sort} onSort={handleSort} />}
            </tr></thead>
            <tbody>
              {!paged.length && <EmptyRow cols={colCount} message="No active holdings" />}
              {paged.map(r => {
                const invested = parseFloat(r.quantity) * parseFloat(r.avg_buy_price);
                const pnlPct = invested > 0 ? (parseFloat(r.unrealized_pnl || 0) / invested) * 100 : 0;
                return (
                  <tr key={r.symbol} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <Td><span className="font-bold text-brand-600 dark:text-brand-400">{r.symbol}</span></Td>
                    {visible.has('name') && <Td>{r.stock_name || '—'}</Td>}
                    {visible.has('sector') && <Td><span className="badge-blue">{r.sector || '—'}</span>{r.market_cap_category && <span className="badge-purple ml-1">{r.market_cap_category}</span>}</Td>}
                    {visible.has('qty') && <Td>{fmt.number(r.quantity, 2)}</Td>}
                    {visible.has('avg_buy') && <Td>{fmt.currency(r.avg_buy_price)}</Td>}
                    {visible.has('current_price') && <Td>{fmt.currency(r.current_price)}</Td>}
                    {visible.has('current_value') && <Td className="font-medium">{fmt.currency(r.current_value)}</Td>}
                    {visible.has('pnl_pct') && <Td><span className={pnlColor(pnlPct)}>{pnlSign(pnlPct)}{fmt.percent(Math.abs(pnlPct))}</span></Td>}
                  </tr>
                );
              })}
            </tbody>
          </Table>
        ) : (
          <Table>
            <thead><tr>
              <SortTh label="Symbol" col="symbol" sort={sort} onSort={handleSort} />
              {visible.has('name') && <Th>Name</Th>}
              {visible.has('sector') && <Th>Sector</Th>}
              {visible.has('shares') && <SortTh label="Shares" col="shares" sort={sort} onSort={handleSort} />}
              {visible.has('avg_buy') && <SortTh label="Avg Buy" col="avg_buy" sort={sort} onSort={handleSort} />}
              {visible.has('amt_invested') && <SortTh label="Amt Invested" col="amt_invested" sort={sort} onSort={handleSort} />}
              {visible.has('buy_date') && <SortTh label="Buy Date" col="buy_date" sort={sort} onSort={handleSort} />}
              {visible.has('sell_date') && <SortTh label="Sell Date" col="sell_date" sort={sort} onSort={handleSort} />}
              {visible.has('realized_pnl') && <SortTh label="Realized P&L" col="realized_pnl" sort={sort} onSort={handleSort} />}
              {visible.has('pnl_pct') && <SortTh label="P&L %" col="pnl_pct" sort={sort} onSort={handleSort} />}
            </tr></thead>
            <tbody>
              {!paged.length && <EmptyRow cols={colCount} message="No exited positions" />}
              {paged.map(r => {
                const buyAmt = parseFloat(r.total_buy_amount || 0);
                const realizedPnl = parseFloat(r.realized_pnl || 0);
                const pct = buyAmt > 0 ? (realizedPnl / buyAmt * 100) : 0;
                return (
                  <tr key={r.symbol} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <Td><span className="font-bold text-gray-500 dark:text-gray-400">{r.symbol}</span></Td>
                    {visible.has('name') && <Td>{r.stock_name || '—'}</Td>}
                    {visible.has('sector') && <Td><span className="badge-blue">{r.sector || '—'}</span>{r.market_cap_category && <span className="badge-purple ml-1">{r.market_cap_category}</span>}</Td>}
                    {visible.has('shares') && <Td>{fmt.number(r.total_bought_quantity, 2)}</Td>}
                    {visible.has('avg_buy') && <Td>{fmt.currency(r.avg_buy_price)}</Td>}
                    {visible.has('amt_invested') && <Td>{fmt.currency(r.total_buy_amount)}</Td>}
                    {visible.has('buy_date') && <Td className="text-xs text-gray-500">{r.first_buy_date ? fmt.date(r.first_buy_date) : '—'}</Td>}
                    {visible.has('sell_date') && <Td className="text-xs text-gray-500">{r.last_sell_date ? fmt.date(r.last_sell_date) : '—'}</Td>}
                    {visible.has('realized_pnl') && <Td><span className={pnlColor(realizedPnl)}>{pnlSign(realizedPnl)}{fmt.currency(realizedPnl)}</span></Td>}
                    {visible.has('pnl_pct') && <Td><span className={pnlColor(pct)}>{pnlSign(pct)}{fmt.percent(Math.abs(pct))}</span></Td>}
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}

        {totalPages > 1 && (
          <div className="flex justify-center px-4 py-3 border-t border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-1.5">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-25 disabled:cursor-not-allowed">
                <ChevronLeft size={14} />
              </button>
              {(() => {
                const range = []; for (let i = 1; i <= totalPages; i++) if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) range.push(i);
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

function getDefaultType(u) {
  if (u?.user_type === 'employee') return 'Employee';
  if (u?.user_type === 'shareholder') return 'Shareholder';
  if (u?.user_type === 'client') return 'Client';
  return 'Shareholder';
}

export default function PortfolioPage() {
  const { user } = useAuth();
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

  // When type changes, try to keep self selected; otherwise pick first of that type
  useEffect(() => {
    if (!canViewOthers || !users.length) return;
    if (userType === 'All') return;
    const typeDef = USER_TYPES.find(t => t.label === userType);
    const filtered = typeDef?.filter ? users.filter(typeDef.filter) : users;
    const self = filtered.find(u => u.id === user?.id);
    setSelectedUser(self || filtered[0] || null);
  }, [userType, users]);

  if (canViewOthers) {
    const isAll = userType === 'All';
    const typeDef = USER_TYPES.find(t => t.label === userType);
    const filteredUsers = (!isAll && typeDef?.filter) ? users.filter(typeDef.filter) : users;

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Portfolio</h1>
            <p className="text-gray-500 text-sm mt-1">{isAll ? 'All stocks across all portfolios' : 'View any user\'s portfolio · read only'}</p>
          </div>
          {!usersLoading && (
            <div className="flex items-center gap-2">
              <select className="input w-36" value={userType} onChange={e => setUserType(e.target.value)}>
                {USER_TYPES.map(t => (
                  <option key={t.label} value={t.label}>{t.label}</option>
                ))}
              </select>
              {!isAll && (
                <select className="input w-52" value={selectedUser?.id || ''} onChange={e => setSelectedUser(filteredUsers.find(u => u.id === parseInt(e.target.value)))}>
                  {!filteredUsers.length && <option value="">No users</option>}
                  {filteredUsers.map(u => (
                    <option key={u.id} value={u.id}>{u.name}{u.id === user?.id ? ' (me)' : ''}</option>
                  ))}
                </select>
              )}
            </div>
          )}
        </div>
        {isAll
          ? <AllHoldingsView />
          : selectedUser && <HoldingsDetail userId={selectedUser.id} userName={selectedUser.name} hideExport={userType === 'Client'} />
        }
      </div>
    );
  }

  return <OwnPortfolioView userName={user?.name} />;
}

function OwnPortfolioView({ userName }) {
  const [view, setView] = useState('mine');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Portfolio</h1>
          <p className="text-gray-500 text-sm mt-1">{view === 'all' ? 'All stocks across all portfolios' : 'Detailed holdings breakdown'}</p>
        </div>
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 w-fit">
          <button onClick={() => setView('mine')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${view === 'mine' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
            Mine
          </button>
          <button onClick={() => setView('all')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${view === 'all' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
            All
          </button>
        </div>
      </div>
      {view === 'all' ? <AllHoldingsView /> : <HoldingsDetail userId="me" userName={userName} />}
    </div>
  );
}
