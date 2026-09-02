#!/usr/bin/env node
/**
 * Build valuation-history.json entry from Finale's Inventory Valuation Excel export.
 *
 * Usage:
 *   node scripts/build-valuation.cjs <path-to-xlsx> <period>
 *   e.g. node scripts/build-valuation.cjs ~/Downloads/InventoryValuationByLocationInUnitsWDetail.xlsx 2026-10
 *
 * The script reads the Excel export (which uses average cost), aggregates across
 * locations, and outputs JSON to paste into src/data/valuation-history.json.
 */
const fs = require('fs');
const path = require('path');

const xlsxPath = process.argv[2];
const period = process.argv[3];

if (!xlsxPath || !period) {
  console.error('Usage: node scripts/build-valuation.cjs <xlsx-path> <YYYY-MM>');
  process.exit(1);
}

if (!/^\d{4}-\d{2}$/.test(period)) {
  console.error('Period must be YYYY-MM format');
  process.exit(1);
}

let XLSX;
try {
  XLSX = require('xlsx');
} catch {
  console.error('Installing xlsx package...');
  require('child_process').execSync('npm install xlsx', { stdio: 'inherit' });
  XLSX = require('xlsx');
}

const wb = XLSX.readFile(xlsxPath);
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws);

// Column names from Finale export
const COL_PRODUCT = 'Product ID';
const COL_CATEGORY = 'Category';
const COL_QTY = 'Units Qoh';
const COL_VALUE = 'Total Value';
const COL_STATUS = 'Product Status';

// Aggregate by product (across locations)
const byProduct = {};
for (const row of rows) {
  const pid = String(row[COL_PRODUCT] || '').trim();
  if (!pid) continue;
  const status = String(row[COL_STATUS] || '').trim();
  if (status === 'Discontinued') continue;

  if (!byProduct[pid]) {
    byProduct[pid] = {
      category: String(row[COL_CATEGORY] || 'UNKNOWN').trim().toUpperCase(),
      qty: 0,
      value: 0,
    };
  }
  byProduct[pid].qty += parseFloat(String(row[COL_QTY] || '0').replace(/,/g, '')) || 0;
  byProduct[pid].value += parseFloat(String(row[COL_VALUE] || '0').replace(/,/g, '')) || 0;
}

// Build category structure matching valuation-history.json format
// { "CATEGORY": { "subcategory": [qty, value, {products: {"pid": [qty, val]}}] } }
const categories = {};
let grandTotal = 0;

for (const [pid, data] of Object.entries(byProduct)) {
  const cat = data.category || 'UNKNOWN';
  if (!categories[cat]) categories[cat] = {};

  // Use "all" as subcategory (Finale export doesn't have subcategories)
  const sub = 'all';
  if (!categories[cat][sub]) {
    categories[cat][sub] = [0, 0, { products: {} }];
  }

  categories[cat][sub][0] += Math.round(data.qty);
  categories[cat][sub][1] += Math.round(data.value * 100) / 100;
  categories[cat][sub][2].products[pid] = [Math.round(data.qty), Math.round(data.value * 100) / 100];
  grandTotal += data.value;
}

// Round subcategory totals
for (const cat of Object.values(categories)) {
  for (const sub of Object.values(cat)) {
    sub[0] = Math.round(sub[0]);
    sub[1] = Math.round(sub[1] * 100) / 100;
  }
}

const MONTH_LABELS = ['','January','February','March','April','May','June','July','August','September','October','November','December'];
const [, mm] = period.split('-').map(Number);
const label = `${MONTH_LABELS[mm]} ${period.slice(0,4)}`;

const entry = {
  l: label,
  g: Math.round(grandTotal * 100) / 100,
  c: categories,
};

console.log(`\nPeriod: ${period} (${label})`);
console.log(`Grand Total: $${grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
console.log(`Products: ${Object.keys(byProduct).length}`);
console.log(`Categories: ${Object.keys(categories).join(', ')}`);
console.log('\n--- JSON entry (paste into valuation-history.json) ---\n');
console.log(`"${period}": ${JSON.stringify(entry, null, 2)}`);

// Optionally auto-update the file
const historyPath = path.join(__dirname, '..', 'src', 'data', 'valuation-history.json');
if (fs.existsSync(historyPath)) {
  const history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
  history[period] = entry;
  fs.writeFileSync(historyPath, JSON.stringify(history, null, 2) + '\n');
  console.log(`\n✅ Updated ${historyPath}`);
} else {
  console.log(`\n⚠️  Could not find ${historyPath} — paste the JSON manually`);
}
