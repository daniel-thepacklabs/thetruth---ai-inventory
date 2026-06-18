import salesData from './finale-sales.json';
import consumptionData from './finale-consumption.json';
import monthlyData from './finale-monthly.json';
import orderItemData from './finale-order-items.json';

const ACCOUNT = import.meta.env.VITE_FINALE_ACCOUNT || 'deltamunchies';
const KEY = import.meta.env.VITE_FINALE_API_KEY;
const SECRET = import.meta.env.VITE_FINALE_API_SECRET;
const AUTH = KEY && SECRET ? 'Basic ' + btoa(`${KEY}:${SECRET}`) : null;
const num = v => parseFloat(String(v || '0').replace(/,/g, '')) || 0;

async function gql(query) {
  const r = await fetch('/finale-api/graphql', {
    method: 'POST',
    headers: { Authorization: AUTH, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!r.ok) throw new Error(`GraphQL ${r.status}: ${await r.text()}`);
  const d = await r.json();
  if (d.errors) throw new Error('GraphQL errors: ' + JSON.stringify(d.errors));
  return d.data;
}

async function fetchLiveProducts() {
  const PAGE = 200;
  let all = [];
  let cursor = null;

  while (true) {
    const afterClause = cursor ? `, after: "${cursor}"` : '';
    const q = `{
      productViewConnection(first: ${PAGE}${afterClause}) {
        pageInfo { hasNextPage endCursor }
        edges {
          node {
            productId
            description
            category
            status
            stockQuantityOnHandUnits
            stockReservationsUnits
            stockOnOrderUnits
            stockAvailableToPromiseUnits
            stockRemainingAfterReservationsUnits
            sfsOnHand: stockColumnQuantityOnHandUnitsDeltamunchiesapifacility100857
            sfsReserved: stockColumnReservationsUnitsDeltamunchiesapifacility100857
            sfsOnOrder: stockColumnOnOrderUnitsDeltamunchiesapifacility100857
            salesLast7Days
            salesLast30Days
            salesLast60Days
            salesLast90Days
            salesLast180Days
            salesLastMonth
            salesThisMonth
            consumptionQuantity
            lastPurchaseLandedCostPerUnit
          }
        }
      }
    }`;

    const data = await gql(q);
    const conn = data.productViewConnection;
    all.push(...conn.edges.map(e => e.node));
    console.log(`  Live sync: ${all.length} products fetched...`);

    if (!conn.pageInfo.hasNextPage) break;
    cursor = conn.pageInfo.endCursor;
  }
  return all;
}

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

function buildSalesCSV(products) {
  const rows = [];
  for (const p of products) {
    if (p.status !== 'Active') continue;
    const s30 = num(p.salesLast30Days);
    const s60 = num(p.salesLast60Days);
    const s90 = num(p.salesLast90Days);
    const sLastMonth = num(p.salesLastMonth);
    const sThisMonth = num(p.salesThisMonth);
    if (s30 || s60 || s90 || sLastMonth || sThisMonth) {
      rows.push({
        'Product ID': p.productId,
        'Sales last 90 days': s90,
        'Sales last 30 days': s30,
        'Sales last month': sLastMonth,
      });
    }
  }
  return toCSV(rows);
}

function buildConsumeCSV(days) {
  const src = days === 30 ? consumptionData.consume30 : consumptionData.consume90;
  const rows = Object.entries(src)
    .filter(([, qty]) => qty > 0)
    .map(([pid, qty]) => ({ 'Product ID': pid, 'Quantity sum': qty }));
  return rows.length ? toCSV(rows) : null;
}

function buildSalesOrderCSV(products) {
  const now = new Date();
  const rows = [];
  for (const p of products) {
    if (p.status !== 'Active') continue;
    const sThisMonth = num(p.salesThisMonth);
    const sLastMonth = num(p.salesLastMonth);
    const s30 = num(p.salesLast30Days);
    const s90 = num(p.salesLast90Days);
    if (sThisMonth > 0) {
      rows.push({
        'Order date': new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10),
        'Status': 'Completed',
        'Category': '',
        'Product ID': p.productId,
        'Description': p.description,
        'Quantity': sThisMonth,
        'Unit price': '0',
        'Subtotal sum': '0',
      });
    }
    if (sLastMonth > 0) {
      rows.push({
        'Order date': new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10),
        'Status': 'Completed',
        'Category': '',
        'Product ID': p.productId,
        'Description': p.description,
        'Quantity': sLastMonth,
        'Unit price': '0',
        'Subtotal sum': '0',
      });
    }
    const prevMonths = (s90 - s30) / 2;
    if (prevMonths > 0) {
      for (let m = 2; m <= 3; m++) {
        rows.push({
          'Order date': new Date(now.getFullYear(), now.getMonth() - m, 1).toISOString().slice(0, 10),
          'Status': 'Completed',
          'Category': '',
          'Product ID': p.productId,
          'Description': p.description,
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
  if (!AUTH) {
    console.warn('No Finale API credentials — using static data');
    return fetchAllStatic();
  }

  console.log('Fetching live data from Finale API...');
  const products = await fetchLiveProducts();
  const active = products.filter(p => p.status === 'Active');

  const stock = toCSV(active.map(p => ({
    'Location': 'SFS-HQ',
    'Product ID': p.productId,
    'Description': p.description,
    'On hand': num(p.sfsOnHand) || 0,
    'On order': num(p.sfsOnOrder) || 0,
    'Reserved': num(p.sfsReserved) || 0,
  })));

  const salesHistory = buildSalesCSV(products);
  const salesOrder = buildSalesOrderCSV(products);
  const consume = buildConsumeCSV(90);
  const consume30 = buildConsumeCSV(30);

  const withStock = active.filter(p => num(p.sfsOnHand) > 0).length;
  const withSales = active.filter(p => num(p.salesLast30Days) > 0 || num(p.salesLastMonth) > 0).length;
  console.log(`Live: ${active.length} active products, ${withStock} with stock, ${withSales} with sales`);

  const productSalesData = (orderItemData.data || []).map(r => ({
    ...r,
    date: r.date || (r.month + '-01'),
    status: 'Completed',
    category: '',
  }));

  return { stock, salesHistory, consume, consume30, salesOrder, monthlyTotals: monthlyData.months || [], productSalesData };
}

async function fetchAllStatic() {
  const stockData = (await import('./finale-stock.json')).default;
  const stock = toCSV(stockData.map(p => ({
    'Location': 'SFS-HQ',
    'Product ID': p.sku,
    'Description': p.desc,
    'On hand': p.onHand,
    'On order': p.onOrder,
    'Reserved': p.reserved,
  })));
  const salesHistory = toCSV(Object.entries(salesData).map(([pid, s]) => ({
    'Product ID': pid,
    'Sales last 90 days': s.s90,
    'Sales last 30 days': s.s30,
    'Sales last month': s.sLastMonth,
  })));
  const consume = buildConsumeCSV(90);
  const consume30 = buildConsumeCSV(30);
  const salesOrder = toCSV([]);
  const productSalesData = (orderItemData.data || []).map(r => ({
    ...r,
    date: r.date || (r.month + '-01'),
    status: 'Completed',
    category: '',
  }));
  return { stock, salesHistory, consume, consume30, salesOrder, monthlyTotals: monthlyData.months || [], productSalesData };
}
