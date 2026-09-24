import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Download, Upload, Loader } from 'lucide-react';
import api from '../../api';
import Modal from '../ui/Modal';
import { fmt } from '../../utils/format';
import { downloadImportTemplate, DETAIL_FIELDS, TABLE_HEADER_ROW } from '../../utils/stockImportTemplate';

const badge = (label, tone) => (
  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
    tone === 'new' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
      : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
  }`}>
    {label}
  </span>
);

export default function BulkImportModal({ open, onClose, stocks, onImported }) {
  const [step, setStep] = useState('start'); // start | preview | done
  const [parsedRows, setParsedRows] = useState([]);
  const [previewResults, setPreviewResults] = useState([]);
  const [commitResults, setCommitResults] = useState([]);
  const [downloading, setDownloading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  const reset = () => {
    setStep('start');
    setParsedRows([]);
    setPreviewResults([]);
    setCommitResults([]);
    setError('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const close = () => { reset(); onClose(); };

  const handleDownloadTemplate = async () => {
    setDownloading(true);
    setError('');
    try {
      const { data: users } = await api.get('/users');
      const activeUsers = users.filter(u => u.is_active);
      const activeSymbols = stocks.filter(s => s.is_active).map(s => s.symbol);
      await downloadImportTemplate(activeUsers, activeSymbols);
    } catch (err) {
      setError(err.message || 'Failed to build template');
    } finally {
      setDownloading(false);
    }
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setParsing(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellDates: true });
      const sheet = wb.Sheets['Import'] || wb.Sheets[wb.SheetNames[0]];
      if (!sheet) throw new Error('No "Import" sheet found in the uploaded file');

      // Transaction Details block — single values that apply to every investor row.
      const cellVal = (addr) => {
        const c = sheet[addr];
        if (!c) return '';
        return String(c.w ?? c.v ?? '').trim();
      };
      const details = Object.fromEntries(DETAIL_FIELDS.map(f => [f.key, cellVal(f.cell)]));
      const missingDetail = DETAIL_FIELDS.find(f => f.required && !details[f.key]);
      if (missingDetail) throw new Error(`"${missingDetail.label.replace(' *', '')}" is required at the top of the sheet`);

      // Investor table — only rows where Amount is filled and > 0 are uploaded; the
      // template pre-lists every active investor, so most rows are expected to be left
      // blank and should be silently skipped, not flagged as errors. Quantity is
      // computed server-side from Amount ÷ Buy Price, same as the manual Add
      // Investment flow (so exact rupee amounts are preserved rather than drifting
      // from a rounded quantity).
      const raw = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false, range: TABLE_HEADER_ROW - 1 });
      const rows = raw
        .filter(r => parseFloat(r['Amount (₹)']) > 0)
        .map(r => ({
          investorEmail: String(r['Investor Email'] || '').trim(),
          stockSymbol: details.stockSymbol,
          accountHolderEmail: details.accountHolderEmail,
          amount: r['Amount (₹)'] || '',
          buyPrice: details.buyPrice,
          buyDate: details.buyDate,
          brokerage: details.brokerage,
          notes: details.notes,
        }));

      if (!rows.length) throw new Error('No investor rows with an Amount filled in were found');

      setParsedRows(rows);
      const { data } = await api.post('/stocks/bulk-import/preview', { rows });
      setPreviewResults(data.results);
      setStep('preview');
    } catch (err) {
      setError(err.message || 'Failed to parse/preview file');
    } finally {
      setParsing(false);
    }
  };

  const validCount = previewResults.filter(r => r.status === 'ok').length;

  const handleCommit = async () => {
    setError('');
    setCommitting(true);
    try {
      const validRows = previewResults
        .filter(r => r.status === 'ok')
        .map(r => parsedRows[r.row - 1]);
      const { data } = await api.post('/stocks/bulk-import/commit', { rows: validRows });
      setCommitResults(data.results);
      setStep('done');
    } catch (err) {
      setError(err.message || 'Import failed');
    } finally {
      setCommitting(false);
    }
  };

  const handleDone = () => {
    onImported();
    close();
  };

  return (
    <Modal open={open} onClose={close} title="Bulk Import Investments" size="xl">
      <div className="space-y-4">
        {error && <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm">{error}</div>}

        {step === 'start' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Import many investments from one transaction at once. Fill in the Stock Symbol,
              Buy Price, Account Holder, Buy Date, Brokerage and Notes once at the top of the
              sheet — they apply to every row (a new symbol's name/sector are looked up
              automatically during preview, no need to type them). Below that, the template
              pre-fills a row for every active investor; just add the Amount (₹) they're investing
              for whoever took part and leave it blank for everyone else — blank rows are skipped
              automatically on upload, and Quantity is computed for you from Amount ÷ Buy Price.
            </p>
            <div className="flex flex-col gap-3">
              <button type="button" onClick={handleDownloadTemplate} disabled={downloading}
                className="btn-secondary flex items-center justify-center gap-2">
                {downloading ? <Loader size={16} className="animate-spin" /> : <Download size={16} />}
                {downloading ? 'Preparing...' : '1. Download Template'}
              </button>
              <label className="btn-primary flex items-center justify-center gap-2 cursor-pointer">
                {parsing ? <Loader size={16} className="animate-spin" /> : <Upload size={16} />}
                {parsing ? 'Parsing...' : '2. Upload Filled Template'}
                <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
                  onChange={handleFile} disabled={parsing} />
              </label>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm text-blue-700 dark:text-blue-400">
              <strong>{validCount}</strong> of {previewResults.length} row{previewResults.length !== 1 ? 's' : ''} ready to import.
              {previewResults.length - validCount > 0 && (
                <span className="text-red-600 dark:text-red-400"> {previewResults.length - validCount} row(s) have errors and will be skipped.</span>
              )}
            </div>
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-x-auto max-h-96">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                  <tr>
                    {['Row', 'Investor', 'Stock', 'Group', 'Account Holder', 'Amount', 'Qty', 'Buy Price', 'Status'].map(h => (
                      <th key={h} className="px-2 py-2 text-left font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {previewResults.map(r => {
                    const input = parsedRows[r.row - 1];
                    const isError = r.status === 'error';
                    return (
                      <tr key={r.row} className={isError ? 'bg-red-50 dark:bg-red-900/10' : ''}>
                        <td className="px-2 py-1.5 text-gray-500">{r.row}</td>
                        <td className="px-2 py-1.5 text-gray-800 dark:text-gray-200 whitespace-nowrap">{r.plan?.investorName || input?.investorEmail || '—'}</td>
                        <td className="px-2 py-1.5 whitespace-nowrap">
                          {r.plan ? (
                            <span className="flex items-center gap-1" title={r.plan.stockAction === 'new' ? `Verified on Yahoo Finance as "${r.plan.stockName || r.plan.symbol}"` : undefined}>
                              {r.plan.symbol} {badge(r.plan.stockAction === 'new' ? 'new · verified' : 'existing', r.plan.stockAction === 'new' ? 'new' : 'existing')}
                            </span>
                          ) : (input?.stockSymbol || '—')}
                        </td>
                        <td className="px-2 py-1.5 whitespace-nowrap">
                          {r.plan ? (
                            <span className="flex items-center gap-1">
                              {r.plan.label} {badge(r.plan.groupAction === 'new' ? 'new' : 'existing', r.plan.groupAction === 'new' ? 'new' : 'existing')}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-2 py-1.5 text-gray-800 dark:text-gray-200 whitespace-nowrap">{r.plan?.accountHolderName || input?.accountHolderEmail || '—'}</td>
                        <td className="px-2 py-1.5 whitespace-nowrap">{input?.amount ? fmt.currency(input.amount) : '—'}</td>
                        <td className="px-2 py-1.5 whitespace-nowrap">{r.plan?.quantity ?? '—'}</td>
                        <td className="px-2 py-1.5 whitespace-nowrap">{input?.buyPrice ? fmt.currency(input.buyPrice) : '—'}</td>
                        <td className="px-2 py-1.5 whitespace-nowrap">
                          {isError ? (
                            <span className="text-red-600 dark:text-red-400" title={r.error}>❌ {r.error}</span>
                          ) : (
                            <span className="text-green-600 dark:text-green-400">✅ OK</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={reset} className="btn-secondary flex-1">Start Over</button>
              <button type="button" onClick={handleCommit} disabled={committing || validCount === 0} className="btn-primary flex-1">
                {committing ? 'Importing...' : `Confirm & Import (${validCount})`}
              </button>
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="space-y-4">
            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-sm text-green-700 dark:text-green-400">
              {commitResults.filter(r => r.status === 'success').length} of {commitResults.length} row{commitResults.length !== 1 ? 's' : ''} imported successfully.
            </div>
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-x-auto max-h-96">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                  <tr>
                    {['Row', 'Status', 'Created', 'Error'].map(h => (
                      <th key={h} className="px-2 py-2 text-left font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {commitResults.map(r => (
                    <tr key={r.row} className={r.status === 'error' ? 'bg-red-50 dark:bg-red-900/10' : ''}>
                      <td className="px-2 py-1.5 text-gray-500">{r.row}</td>
                      <td className="px-2 py-1.5">
                        {r.status === 'success'
                          ? <span className="text-green-600 dark:text-green-400">✅ Success</span>
                          : <span className="text-red-600 dark:text-red-400">❌ Failed</span>}
                      </td>
                      <td className="px-2 py-1.5 text-gray-500 whitespace-nowrap">
                        {r.created?.stock && 'Stock '}{r.created?.group && 'Group'}{!r.created?.stock && !r.created?.group && '—'}
                      </td>
                      <td className="px-2 py-1.5 text-red-500">{r.error || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={handleDone} className="btn-primary flex-1">Done</button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
