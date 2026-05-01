import { useState } from 'react';
import { Tv2, Sparkles, Link2, AlertCircle, ExternalLink, Download, ClipboardCopy, Upload, Check, FileJson, FileSpreadsheet } from 'lucide-react';
import api from '../../api';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const CATEGORIES = ['Other', 'Results', 'Buyback', 'Merger/Demerger', 'Order Win', 'Dividend', 'Market Update', 'IPO', 'Regulatory'];

const CATEGORY_COLORS = {
  'Results':         'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  'Buyback':         'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  'Merger/Demerger': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  'Order Win':       'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  'Dividend':        'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  'Market Update':   'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  'IPO':             'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
  'Regulatory':      'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  'Other':           'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

function ChangePill({ value }) {
  if (value == null || value === '') return <span className="text-gray-300 dark:text-gray-600">—</span>;
  const num = parseFloat(value);
  const pos = num >= 0;
  return (
    <span className={`font-semibold tabular-nums ${pos ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
      {pos ? '+' : ''}{num.toFixed(2)}%
    </span>
  );
}

function exportPDF(items, categories, today) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();

  // Header banner
  doc.setFillColor(22, 163, 74);
  doc.rect(0, 0, W, 18, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('Money Matriz', 14, 11);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('YouTube News Analysis', W - 14, 11, { align: 'right' });

  // Sub-header
  doc.setFillColor(240, 253, 244);
  doc.rect(0, 18, W, 10, 'F');
  doc.setTextColor(22, 101, 52);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(`Stock News Report — ${today}`, 14, 24.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`${items.length} news items`, W - 14, 24.5, { align: 'right' });

  // Table
  const rows = items.map((item, i) => {
    const chg = item.change_pct != null ? parseFloat(item.change_pct) : null;
    return [
      today,
      chg != null ? (chg >= 0 ? `+${chg.toFixed(2)}%` : `${chg.toFixed(2)}%`) : '—',
      item.company || 'Market',
      item.symbol || '—',
      item.headline ? `${item.headline}\n${item.summary || ''}` : (item.summary || ''),
      categories[i] || item.category || 'Other',
      item.price != null ? `₹${parseFloat(item.price).toLocaleString('en-IN')}` : '—',
    ];
  });

  autoTable(doc, {
    startY: 30,
    head: [['Date', 'Change', 'Company', 'Symbol', 'News', 'Category', 'Price']],
    body: rows,
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 2.5, overflow: 'linebreak', valign: 'top' },
    headStyles: { fillColor: [22, 163, 74], textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 18, halign: 'right' },
      2: { cellWidth: 30 },
      3: { cellWidth: 28 },
      4: { cellWidth: 'auto' },
      5: { cellWidth: 28 },
      6: { cellWidth: 20, halign: 'right' },
    },
    didParseCell(data) {
      if (data.section === 'body' && data.column.index === 1) {
        const v = data.cell.raw;
        if (v && v.startsWith('+')) data.cell.styles.textColor = [22, 163, 74];
        else if (v && v.startsWith('-')) data.cell.styles.textColor = [220, 38, 38];
      }
    },
    alternateRowStyles: { fillColor: [249, 250, 251] },
  });

  // Footer
  const pages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFontSize(7);
    doc.setTextColor(156, 163, 175);
    doc.text(`Money Matriz · Generated on ${today} · Page ${p} of ${pages}`, W / 2, doc.internal.pageSize.getHeight() - 5, { align: 'center' });
  }

  doc.save(`news-analysis-${today.replace(/\//g, '-')}.pdf`);
}

function exportExcel(items, categories, today) {
  const rows = items.map((item, i) => {
    const chg = item.change_pct != null ? parseFloat(item.change_pct) : null;
    return {
      Date: today,
      Company: item.company || 'Market',
      Symbol: item.symbol || '',
      'Change %': chg != null ? (chg >= 0 ? `+${chg.toFixed(2)}%` : `${chg.toFixed(2)}%`) : '',
      Price: item.price != null ? parseFloat(item.price) : '',
      Headline: item.headline || '',
      Summary: item.summary || '',
      Category: categories[i] || item.category || 'Other',
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 12 }, { wch: 28 }, { wch: 18 }, { wch: 10 },
    { wch: 10 }, { wch: 30 }, { wch: 60 }, { wch: 18 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'News Analysis');
  XLSX.writeFile(wb, `news-analysis-${today.replace(/\//g, '-')}.xlsx`);
}

const CLAUDE_PROMPT = `You are a financial news analyst. I will give you a Telugu stock market news video transcript. Extract ALL news items and return ONLY a JSON array — no explanation, no markdown, just raw JSON.

Each item in the array must have exactly these fields:
- "company": company name in English (use null for broad market news like Nifty, Sensex, gold, US Fed)
- "symbol": NSE/BSE symbol in format "NSE:SYMBOL" or "BSE:SYMBOL" (null if not mentioned)
- "change_pct": percentage change as a number like 2.45 or -1.18 (null if not mentioned)
- "price": stock price as a number (null if not mentioned)
- "headline": concise 4–6 word English headline
- "summary": 1–2 sentence English summary of the news
- "category": exactly one of — "Results", "Buyback", "Merger/Demerger", "Order Win", "Dividend", "Market Update", "IPO", "Regulatory", "Other"

Rules:
- Do NOT skip any company or news item, even if minor
- Translate all Telugu content to English
- Return ONLY the raw JSON array starting with [ and ending with ]
- No trailing commas, no comments, valid JSON only

Transcript:
[PASTE YOUR TRANSCRIPT HERE]`;

export default function NewsPage() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState({});
  const [error, setError] = useState('');
  const [videoId, setVideoId] = useState('');
  const [coverage, setCoverage] = useState(0);
  const [showImport, setShowImport] = useState(false);
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState('');
  const [copied, setCopied] = useState(false);
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  const [transcriptReady, setTranscriptReady] = useState(false);

  const generate = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError('');
    setItems([]);
    setCategories({});
    setVideoId('');
    setCoverage(0);
    try {
      const res = await api.post('/news/youtube', { url: url.trim() }, { timeout: 60000 });
      const fetched = res.data.items || [];
      setItems(fetched);
      const cats = {};
      fetched.forEach((item, i) => { cats[i] = item.category || 'Other'; });
      setCategories(cats);
      setVideoId(res.data.videoId || '');
      setCoverage(res.data.coveragePct || 0);
    } catch (e) {
      setError(e.response?.data?.error || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const [filledPrompt, setFilledPrompt] = useState('');

  const getTranscript = async () => {
    if (!url.trim()) return;
    setTranscriptLoading(true);
    setTranscriptReady(false);
    setError('');
    try {
      const res = await api.post('/news/transcript', { url: url.trim() }, { timeout: 30000 });
      const filled = CLAUDE_PROMPT.replace('[PASTE YOUR TRANSCRIPT HERE]', res.data.transcript);
      setFilledPrompt(filled);
      navigator.clipboard.writeText(filled);
      setTranscriptReady(true);
      setTimeout(() => setTranscriptReady(false), 4000);
    } catch (e) {
      setError(e.response?.data?.error || 'Could not fetch transcript.');
    } finally {
      setTranscriptLoading(false);
    }
  };

  const copyPrompt = () => {
    const text = filledPrompt || CLAUDE_PROMPT;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const importJson = () => {
    setJsonError('');
    try {
      const stripped = jsonText.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
      const parsed = JSON.parse(stripped);
      if (!Array.isArray(parsed)) { setJsonError('Must be a JSON array [ ... ]'); return; }
      const cats = {};
      parsed.forEach((item, i) => { cats[i] = item.category || 'Other'; });
      setItems(parsed);
      setCategories(cats);
      setVideoId('');
      setCoverage(0);
      setShowImport(false);
      setJsonText('');
    } catch {
      setJsonError('Invalid JSON — check for syntax errors and try again.');
    }
  };

  const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-brand-600 rounded-xl flex items-center justify-center flex-shrink-0">
          <Tv2 size={18} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">YouTube News Analyzer</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">Extract structured stock news from Telugu YouTube videos</p>
        </div>
      </div>

      {/* Input */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Link2 size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !loading && generate()}
              placeholder="https://www.youtube.com/watch?v=..."
              className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={generate}
            disabled={loading || !url.trim()}
            className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Analyzing…
              </>
            ) : (
              <>
                <Sparkles size={15} />
                Analyze
              </>
            )}
          </button>
          <button
            onClick={getTranscript}
            disabled={transcriptLoading || !url.trim()}
            className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap border border-gray-200 dark:border-gray-700"
          >
            {transcriptLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                Fetching…
              </>
            ) : transcriptReady ? (
              <>
                <Check size={15} className="text-green-500" />
                Prompt Copied!
              </>
            ) : (
              <>
                <ClipboardCopy size={15} />
                Get Transcript
              </>
            )}
          </button>
        </div>
      </div>

      {transcriptReady && (
        <div className="flex items-start gap-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl text-xs text-green-700 dark:text-green-400">
          <Check size={14} className="shrink-0 mt-0.5" />
          <span>Transcript fetched and prompt copied to clipboard. Paste it into <strong>Claude.ai</strong>, then copy the JSON output and use <strong>Paste JSON</strong> below.</span>
        </div>
      )}

      {/* Import / Claude prompt panel */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <FileJson size={14} className="text-gray-400" />
            <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">Import from Claude AI</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={copyPrompt}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              {copied ? <Check size={12} className="text-green-500" /> : <ClipboardCopy size={12} />}
              {copied ? 'Copied!' : 'Copy Prompt'}
            </button>
            <button
              onClick={() => { setShowImport(v => !v); setJsonError(''); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors"
            >
              <Upload size={12} />
              Paste JSON
            </button>
          </div>
        </div>
        {showImport && (
          <div className="p-4 space-y-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              1. Paste the YouTube URL above → click <strong>Get Transcript</strong> — this auto-copies the full prompt with transcript into your clipboard.<br />
              2. Open <strong>claude.ai</strong> → paste → send. Copy the JSON it returns.<br />
              3. Paste that JSON below and click <strong>Load Table</strong>.
            </p>
            <textarea
              value={jsonText}
              onChange={e => { setJsonText(e.target.value); setJsonError(''); }}
              placeholder='[{"company":"Reliance","symbol":"NSE:RELIANCE","change_pct":1.2,...}, ...]'
              rows={6}
              className="w-full px-3 py-2.5 text-xs font-mono border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-y"
            />
            {jsonError && (
              <p className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
                <AlertCircle size={13} />{jsonError}
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={importJson}
                disabled={!jsonText.trim()}
                className="px-4 py-2 text-xs font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors disabled:opacity-50"
              >
                Load Table
              </button>
              <button
                onClick={() => { setShowImport(false); setJsonText(''); setJsonError(''); }}
                className="px-4 py-2 text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-400">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Results table */}
      {items.length > 0 && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
          {/* Table header bar */}
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <Sparkles size={13} className="text-brand-500" />
              <span className="text-xs font-semibold text-brand-600 dark:text-brand-400">{items.length} news items extracted</span>
              {coverage > 0 && (
                <span className={`text-xs ${coverage < 80 ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-400'}`}>
                  · {coverage}% of video covered
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => exportExcel(items, categories, today)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
              >
                <FileSpreadsheet size={12} />
                Export Excel
              </button>
              <button
                onClick={() => exportPDF(items, categories, today)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors"
              >
                <Download size={12} />
                Export PDF
              </button>
              {videoId && (
                <a
                  href={`https://www.youtube.com/watch?v=${videoId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-brand-600 dark:text-gray-400 dark:hover:text-brand-400 transition-colors"
                >
                  <ExternalLink size={11} /> Watch original
                </a>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50">
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap">Date</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap">Change</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-500 dark:text-gray-400">Company</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-500 dark:text-gray-400">Symbol</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-500 dark:text-gray-400 min-w-[320px]">News</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-500 dark:text-gray-400">Category</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-gray-500 dark:text-gray-400">Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {items.map((item, i) => {
                  const chg = item.change_pct != null ? parseFloat(item.change_pct) : null;
                  const isPos = chg != null && chg >= 0;
                  const isNeg = chg != null && chg < 0;
                  const rowBg = isPos
                    ? 'bg-green-50/40 dark:bg-green-900/10'
                    : isNeg
                    ? 'bg-red-50/40 dark:bg-red-900/10'
                    : '';
                  const cat = categories[i] || 'Other';

                  return (
                    <tr key={i} className={`${rowBg} hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors`}>
                      <td className="px-3 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">{today}</td>
                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        <ChangePill value={item.change_pct} />
                      </td>
                      <td className="px-3 py-3 font-medium text-gray-900 dark:text-white whitespace-nowrap">
                        {item.company || <span className="text-gray-400 italic">Market</span>}
                      </td>
                      <td className="px-3 py-3 text-blue-600 dark:text-blue-400 font-mono whitespace-nowrap">
                        {item.symbol || '—'}
                      </td>
                      <td className="px-3 py-3 text-gray-700 dark:text-gray-300 leading-relaxed">
                        {item.headline && (
                          <p className="font-semibold text-gray-900 dark:text-white mb-0.5">{item.headline}</p>
                        )}
                        <p className="text-gray-500 dark:text-gray-400">{item.summary}</p>
                      </td>
                      <td className="px-3 py-3">
                        <select
                          value={cat}
                          onChange={e => setCategories(prev => ({ ...prev, [i]: e.target.value }))}
                          className={`text-xs px-2 py-1 rounded-md border-0 font-medium cursor-pointer focus:outline-none focus:ring-1 focus:ring-brand-500 ${CATEGORY_COLORS[cat] || CATEGORY_COLORS['Other']}`}
                        >
                          {CATEGORIES.map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-3 text-right font-medium text-gray-900 dark:text-white whitespace-nowrap">
                        {item.price != null ? `₹${parseFloat(item.price).toLocaleString('en-IN')}` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
