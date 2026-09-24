import ExcelJS from 'exceljs';

// The "Transaction Details" block — one value per field, applies to every investor
// row in the sheet (a bulk import represents one stock transaction: same stock,
// same account holder, same buy date, same brokerage, many investors).
// `cell` is the value cell address in the "Import" sheet.
// Stock Name, Sector and Current Price are intentionally not collected here — for a
// new symbol they're all auto-filled from Yahoo Finance during Preview. Transaction
// Label is not collected either — it's auto-generated on import as the next
// "Transaction N" for the stock, matching the manual "+ New Transaction" naming.
export const DETAIL_FIELDS = [
  { key: 'stockSymbol', label: 'Stock Symbol', cell: 'B2', required: true },
  { key: 'accountHolderEmail', label: 'Account Holder Email', cell: 'B3', required: true },
  { key: 'buyDate', label: 'Buy Date (YYYY-MM-DD)', cell: 'B5' },
  { key: 'brokerage', label: 'Brokerage', cell: 'B6' },
  { key: 'buyPrice', label: 'Buy Price', cell: 'B7', required: true },
];
const ACCOUNT_HOLDER_NAME_CELL = 'B4'; // auto-filled, display-only

// Columns for the per-investor table below the details block. The "(auto)" name
// column is display-only — formula-filled from the email next to it, purely so you
// can visually confirm you picked the right person. It is never read back on upload.
export const IMPORT_COLUMNS = [
  { key: 'investorEmail', header: 'Investor Email', width: 28 },
  { key: 'investorName', header: 'Investor Name (auto)', width: 22, auto: true },
  { key: 'amount', header: 'Amount (₹)', width: 14 },
  { key: 'notes', header: 'Notes', width: 24 },
];

export const TABLE_HEADER_ROW = 9; // row the investor-table header sits on
export const TABLE_FIRST_DATA_ROW = TABLE_HEADER_ROW + 1;

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

  const EMAIL_RANGE = `Users!$A$1:$A$${Math.max(userRows.length, 1)}`;
  const USERS_LOOKUP_RANGE = `Users!$A$1:$B$${Math.max(userRows.length, 1)}`;
  const SYMBOL_RANGE = `Symbols!$A$1:$A$${Math.max(symbols.length, 1)}`;

  const sheet = wb.addWorksheet('Import');
  sheet.getColumn(1).width = 34;
  sheet.getColumn(2).width = 30;
  IMPORT_COLUMNS.forEach((c, i) => { sheet.getColumn(i + 1).width = c.width; });

  // --- Transaction Details block (applies to every row below) ---
  const titleCell = sheet.getCell('A1');
  titleCell.value = 'Transaction Details (one value applies to the whole sheet)';
  titleCell.font = { bold: true };

  DETAIL_FIELDS.forEach(f => {
    const labelCell = sheet.getCell(`A${f.cell.slice(1)}`);
    labelCell.value = f.label + (f.required ? ' *' : '');
    labelCell.font = { bold: true, color: { argb: 'FF374151' } };
  });

  sheet.getCell('B2').dataValidation = {
    type: 'list', allowBlank: true, formulae: [`=${SYMBOL_RANGE}`],
    showErrorMessage: true, errorStyle: 'warning',
    error: 'Not an existing symbol — that\'s fine if you are adding a new stock.',
  };
  sheet.getCell('B3').dataValidation = {
    type: 'list', allowBlank: true, formulae: [`=${EMAIL_RANGE}`],
    showErrorMessage: true, errorStyle: 'warning',
    error: 'Email not in the active users list — you can still type a custom one.',
  };
  const holderNameCell = sheet.getCell(ACCOUNT_HOLDER_NAME_CELL);
  holderNameCell.value = { formula: `IFERROR(VLOOKUP(B3,${USERS_LOOKUP_RANGE},2,FALSE),"")` };
  holderNameCell.font = { italic: true, color: { argb: 'FF9CA3AF' } };
  sheet.getCell('A4').value = 'Account Holder Name (auto)';
  sheet.getCell('A4').font = { italic: true, color: { argb: 'FF9CA3AF' } };

  // --- Investor table ---
  const headerRow = sheet.getRow(TABLE_HEADER_ROW);
  IMPORT_COLUMNS.forEach((c, i) => { headerRow.getCell(i + 1).value = c.header; });
  headerRow.font = { bold: true };
  headerRow.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };
  });
  sheet.getCell(`${COL.amount}${TABLE_HEADER_ROW}`).note =
    'Leave Amount blank for any investor who did not take part in this transaction — their row is skipped on upload. Quantity is computed automatically from Amount ÷ Buy Price, same as the manual Add Investment flow.';

  // Every active investor gets a pre-filled row (email only — name auto-fills via
  // formula). Just fill in Amount for whoever actually invested, and leave it
  // blank for everyone else; blank rows are skipped on upload.
  userRows.forEach((u, i) => {
    const r = TABLE_FIRST_DATA_ROW + i;
    sheet.getCell(`${COL.investorEmail}${r}`).value = u.email;
  });

  const LAST_DATA_ROW = TABLE_FIRST_DATA_ROW + Math.max(userRows.length, 1) + 200; // + buffer for extra manual rows

  for (let r = TABLE_FIRST_DATA_ROW; r <= LAST_DATA_ROW; r++) {
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
