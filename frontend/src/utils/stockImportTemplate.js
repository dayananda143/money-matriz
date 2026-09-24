import ExcelJS from 'exceljs';

// Columns, in order, for the "Import" sheet. The two "(auto)" name columns are
// display-only — they're formula-filled from the email typed/picked next to them,
// purely so you can visually confirm you picked the right person. They are never
// read back during upload; only the *Email columns are sent to the backend.
export const IMPORT_COLUMNS = [
  { key: 'investorEmail', header: 'Investor Email', width: 28 },
  { key: 'investorName', header: 'Investor Name (auto)', width: 22, auto: true },
  { key: 'stockSymbol', header: 'Stock Symbol', width: 16 },
  { key: 'stockName', header: 'Stock Name (if new)', width: 24 },
  { key: 'sector', header: 'Sector', width: 16 },
  { key: 'currentPrice', header: 'Current Price', width: 14 },
  { key: 'transactionLabel', header: 'Transaction Label', width: 18 },
  { key: 'accountHolderEmail', header: 'Account Holder Email', width: 28 },
  { key: 'accountHolderName', header: 'Account Holder Name (auto)', width: 24, auto: true },
  { key: 'quantity', header: 'Quantity', width: 12 },
  { key: 'buyPrice', header: 'Buy Price', width: 12 },
  { key: 'buyDate', header: 'Buy Date (YYYY-MM-DD)', width: 20 },
  { key: 'brokerage', header: 'Brokerage', width: 12 },
  { key: 'notes', header: 'Notes', width: 24 },
];

// 1-based column index -> spreadsheet letter (A, B, ..., Z, AA, ...)
function colLetter(index) {
  let n = index, s = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

const COL = Object.fromEntries(IMPORT_COLUMNS.map((c, i) => [c.key, colLetter(i + 1)]));

// Builds and downloads the bulk-import Excel template.
// activeUsers: [{ email, name, ... }], activeStockSymbols: [string]
export async function downloadImportTemplate(activeUsers, activeStockSymbols) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Money Matriz';
  wb.created = new Date();

  const userRows = [...new Map((activeUsers || [])
    .filter(u => u.email)
    .map(u => [u.email.toLowerCase(), { email: u.email, name: u.name || '' }])).values()]
    .sort((a, b) => a.email.localeCompare(b.email));
  const symbols = [...new Set((activeStockSymbols || []).filter(Boolean))].sort();

  // Hidden helper sheets (data validation + name-lookup source ranges)
  const usersSheet = wb.addWorksheet('Users', { state: 'veryHidden' });
  usersSheet.addRows(userRows.map(u => [u.email, u.name]));
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

  const EMAIL_RANGE = `Users!$A$1:$A$${Math.max(userRows.length, 1)}`;
  const USERS_LOOKUP_RANGE = `Users!$A$1:$B$${Math.max(userRows.length, 1)}`;
  const SYMBOL_RANGE = `Symbols!$A$1:$A$${Math.max(symbols.length, 1)}`;

  const FIRST_DATA_ROW = 3; // header (1) + example (2)
  const LAST_DATA_ROW = 500;

  for (let r = FIRST_DATA_ROW; r <= LAST_DATA_ROW; r++) {
    // Investor Email — dropdown, but allow free typing (allowBlank: true; not strict-enforced
    // beyond the standard Excel list validation, which ExcelJS/Excel always treats as a
    // hard error on save unless allowBlank covers empty cells — there's no "warning" mode
    // in the xlsx spec, so this is a plain list dropdown).
    sheet.getCell(`${COL.investorEmail}${r}`).dataValidation = {
      type: 'list', allowBlank: true, formulae: [`=${EMAIL_RANGE}`],
      showErrorMessage: true, errorStyle: 'warning',
      error: 'Email not in the active users list — you can still type a custom one.',
    };
    // Auto-filled name next to the email, so you can visually confirm the right
    // person was picked. Read-only in spirit (not locked/protected, just formula-driven).
    const invNameCell = sheet.getCell(`${COL.investorName}${r}`);
    invNameCell.value = { formula: `IFERROR(VLOOKUP(${COL.investorEmail}${r},${USERS_LOOKUP_RANGE},2,FALSE),"")` };
    invNameCell.font = { italic: true, color: { argb: 'FF9CA3AF' } };

    // Stock Symbol — dropdown of existing symbols, but new symbols are valid too,
    // so this uses a non-blocking "warning" error style instead of "stop".
    sheet.getCell(`${COL.stockSymbol}${r}`).dataValidation = {
      type: 'list', allowBlank: true, formulae: [`=${SYMBOL_RANGE}`],
      showErrorMessage: true, errorStyle: 'warning',
      error: 'Not an existing symbol — that\'s fine if you are adding a new stock.',
    };

    // Account Holder Email — same as Investor Email, with its own auto-filled name.
    sheet.getCell(`${COL.accountHolderEmail}${r}`).dataValidation = {
      type: 'list', allowBlank: true, formulae: [`=${EMAIL_RANGE}`],
      showErrorMessage: true, errorStyle: 'warning',
      error: 'Email not in the active users list — you can still type a custom one.',
    };
    const holderNameCell = sheet.getCell(`${COL.accountHolderName}${r}`);
    holderNameCell.value = { formula: `IFERROR(VLOOKUP(${COL.accountHolderEmail}${r},${USERS_LOOKUP_RANGE},2,FALSE),"")` };
    holderNameCell.font = { italic: true, color: { argb: 'FF9CA3AF' } };
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
