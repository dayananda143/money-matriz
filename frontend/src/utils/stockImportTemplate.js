import ExcelJS from 'exceljs';

// Columns, in order, for the "Import" sheet.
export const IMPORT_COLUMNS = [
  { key: 'investorEmail', header: 'Investor Email', width: 28 },
  { key: 'stockSymbol', header: 'Stock Symbol', width: 16 },
  { key: 'stockName', header: 'Stock Name (if new)', width: 24 },
  { key: 'sector', header: 'Sector', width: 16 },
  { key: 'currentPrice', header: 'Current Price', width: 14 },
  { key: 'transactionLabel', header: 'Transaction Label', width: 18 },
  { key: 'accountHolderEmail', header: 'Account Holder Email', width: 28 },
  { key: 'quantity', header: 'Quantity', width: 12 },
  { key: 'buyPrice', header: 'Buy Price', width: 12 },
  { key: 'buyDate', header: 'Buy Date (YYYY-MM-DD)', width: 20 },
  { key: 'brokerage', header: 'Brokerage', width: 12 },
  { key: 'notes', header: 'Notes', width: 24 },
];

// Builds and downloads the bulk-import Excel template.
// activeUsers: [{ email, ... }], activeStockSymbols: [string]
export async function downloadImportTemplate(activeUsers, activeStockSymbols) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Money Matriz';
  wb.created = new Date();

  const emails = [...new Set((activeUsers || []).map(u => u.email).filter(Boolean))].sort();
  const symbols = [...new Set((activeStockSymbols || []).filter(Boolean))].sort();

  // Hidden helper sheets (data validation source ranges)
  const emailSheet = wb.addWorksheet('Emails', { state: 'veryHidden' });
  emailSheet.addRows(emails.map(e => [e]));
  const symbolSheet = wb.addWorksheet('Symbols', { state: 'veryHidden' });
  symbolSheet.addRows(symbols.map(s => [s]));

  const sheet = wb.addWorksheet('Import');
  sheet.columns = IMPORT_COLUMNS.map(c => ({ header: c.header, key: c.key, width: c.width }));

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };
  });

  // One example row to illustrate the expected format
  sheet.addRow({
    investorEmail: 'investor@example.com',
    stockSymbol: 'RELIANCE',
    stockName: 'Reliance Industries (only needed if RELIANCE is a new symbol)',
    sector: 'Energy',
    currentPrice: 2500,
    transactionLabel: 'Default',
    accountHolderEmail: 'holder@example.com',
    quantity: 10,
    buyPrice: 2400,
    buyDate: '2026-01-15',
    brokerage: 0,
    notes: 'Example row — delete before importing',
  }).font = { italic: true, color: { argb: 'FF9CA3AF' } };

  const EMAIL_RANGE = `Emails!$A$1:$A$${Math.max(emails.length, 1)}`;
  const SYMBOL_RANGE = `Symbols!$A$1:$A$${Math.max(symbols.length, 1)}`;

  const FIRST_DATA_ROW = 3; // header (1) + example (2)
  const LAST_DATA_ROW = 500;

  for (let r = FIRST_DATA_ROW; r <= LAST_DATA_ROW; r++) {
    // Investor Email — dropdown, but allow free typing (allowBlank: true; not strict-enforced
    // beyond the standard Excel list validation, which ExcelJS/Excel always treats as a
    // hard error on save unless allowBlank covers empty cells — there's no "warning" mode
    // in the xlsx spec, so this is a plain list dropdown).
    sheet.getCell(`A${r}`).dataValidation = {
      type: 'list', allowBlank: true, formulae: [`=${EMAIL_RANGE}`],
      showErrorMessage: true, errorStyle: 'warning',
      error: 'Email not in the active users list — you can still type a custom one.',
    };
    // Stock Symbol — dropdown of existing symbols, but new symbols are valid too,
    // so this uses a non-blocking "warning" error style instead of "stop".
    sheet.getCell(`B${r}`).dataValidation = {
      type: 'list', allowBlank: true, formulae: [`=${SYMBOL_RANGE}`],
      showErrorMessage: true, errorStyle: 'warning',
      error: 'Not an existing symbol — that\'s fine if you are adding a new stock.',
    };
    // Account Holder Email — same as Investor Email
    sheet.getCell(`G${r}`).dataValidation = {
      type: 'list', allowBlank: true, formulae: [`=${EMAIL_RANGE}`],
      showErrorMessage: true, errorStyle: 'warning',
      error: 'Email not in the active users list — you can still type a custom one.',
    };
  }

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'stock_bulk_import_template.xlsx';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
