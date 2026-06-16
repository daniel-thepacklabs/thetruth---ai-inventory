import stockData from './finale-stock.json';
import salesData from './finale-sales.json';
import consumptionData from './finale-consumption.json';
import monthlyData from './finale-monthly.json';
import orderItemData from './finale-order-items.json';

function toCSV(rows) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(','),
    ...rows.map(r => headers.map(h => {
      const v = String(r[h] ?? '').replace(/"/g, '""');
      return v.includes(',') ? `"${v}"` : v;
    }).join(','))
  ];
  return lines.join('\n');
}

function buildStockCSV() {
  return toCSV(stockData.map(p => ({
    'Location': 'SFS-HQ',
    'Product ID': p.sku,
    'Description': p.desc,
    'On hand': p.onHand,
    'On order': p.onOrder,
    'Reserved': p.reserved,
  })));
}

function buildSalesCSV() {
  return toCSV(Object.entries(salesData).map(([pid, s]) => ({
    'Product ID': pid,
    'Sales last 90 days': s.s90,
    'Sales last 30 days': s.s30,
    'Sales last month': s.sLastMonth,
  })));
}

function buildConsumeCSV(days) {
  const src = days === 30 ? consumptionData.consume30 : consumptionData.consume90;
  const rows = Object.entries(src)
    .filter(([, qty]) => qty > 0)
    .map(([pid, qty]) => ({ 'Product ID': pid, 'Quantity sum': qty }));
  return rows.length ? toCSV(rows) : null;
}

function buildSalesOrderCSV() {
  const rows = [];
  const now = new Date();
  for (const [sku, s] of Object.entries(salesData)) {
    if (s.sThisMonth > 0) {
      rows.push({
        'Order date': new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10),
        'Status': 'Completed',
        'Category': '',
        'Product ID': sku,
        'Description': s.name,
        'Quantity': s.sThisMonth,
        'Unit price': '0',
        'Subtotal sum': '0',
      });
    }
    if (s.sLastMonth > 0) {
      rows.push({
        'Order date': new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10),
        'Status': 'Completed',
        'Category': '',
        'Product ID': sku,
        'Description': s.name,
        'Quantity': s.sLastMonth,
        'Unit price': '0',
        'Subtotal sum': '0',
      });
    }
    const prevMonths = (s.s90 - s.s30) / 2;
    if (prevMonths > 0) {
      for (let m = 2; m <= 3; m++) {
        rows.push({
          'Order date': new Date(now.getFullYear(), now.getMonth() - m, 1).toISOString().slice(0, 10),
          'Status': 'Completed',
          'Category': '',
          'Product ID': sku,
          'Description': s.name,
          'Quantity': Math.round(prevMonths),
          'Unit price': '0',
          'Subtotal sum': '0',
        });
      }
    }
  }
  return toCSV(rows);
}

export async function fetchAll() {
  const stock = buildStockCSV();
  const salesHistory = buildSalesCSV();
  const salesOrder = buildSalesOrderCSV();
  const consume = buildConsumeCSV(90);
  const consume30 = buildConsumeCSV(30);

  const withStock = stockData.filter(p => p.onHand > 0).length;
  const withSales = Object.keys(salesData).length;
  console.log(`Loaded ${stockData.length} products from Finale (${withStock} with stock, ${withSales} with sales)`);

  const productSalesData = (orderItemData.data || []).map(r => ({
    ...r,
    date: r.date || (r.month + '-01'),
    status: 'Completed',
    category: '',
  }));

  return { stock, salesHistory, consume, consume30, salesOrder, monthlyTotals: monthlyData.months || [], productSalesData };
}
