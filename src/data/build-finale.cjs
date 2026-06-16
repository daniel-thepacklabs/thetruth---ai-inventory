/**
 * Fetches all product, stock, sales, and consumption data from Finale's GraphQL API.
 * Generates JSON files consumed by the dashboard.
 *
 * Usage: node src/data/build-finale.cjs
 * Requires: VITE_FINALE_API_KEY, VITE_FINALE_API_SECRET, VITE_FINALE_ACCOUNT in .env
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const ACCOUNT = process.env.VITE_FINALE_ACCOUNT || 'deltamunchies';
const KEY = process.env.VITE_FINALE_API_KEY;
const SECRET = process.env.VITE_FINALE_API_SECRET;
if (!KEY || !SECRET) { console.error('Missing VITE_FINALE_API_KEY / VITE_FINALE_API_SECRET in .env'); process.exit(1); }

const AUTH = 'Basic ' + Buffer.from(`${KEY}:${SECRET}`).toString('base64');
const num = v => parseFloat(String(v || '0').replace(/,/g, '')) || 0;
const GQL_URL = `https://app.finaleinventory.com/${ACCOUNT}/api/graphql`;
const REST_URL = `https://app.finaleinventory.com/${ACCOUNT}/api`;

async function gql(query) {
  const r = await fetch(GQL_URL, {
    method: 'POST',
    headers: { Authorization: AUTH, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!r.ok) throw new Error(`GraphQL ${r.status}: ${await r.text()}`);
  const d = await r.json();
  if (d.errors) throw new Error('GraphQL errors: ' + JSON.stringify(d.errors));
  return d.data;
}

async function rest(path) {
  const r = await fetch(`${REST_URL}${path}`, {
    headers: { Authorization: AUTH, 'Content-Type': 'application/json' },
  });
  if (!r.ok) throw new Error(`REST ${path} ${r.status}: ${r.statusText}`);
  return r.json();
}

// ── Fetch all products with stock + sales via GraphQL (paginated) ──
async function fetchAllProducts() {
  const PAGE = 200;
  let all = [];
  let cursor = null;
  let page = 0;

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
    const nodes = conn.edges.map(e => e.node);
    all.push(...nodes);
    page++;
    process.stdout.write(`\r  Products: ${all.length} fetched (page ${page})...`);

    if (!conn.pageInfo.hasNextPage) break;
    cursor = conn.pageInfo.endCursor;
  }
  console.log(`\r  Products: ${all.length} total                    `);
  return all;
}

// ── Fetch consumption via stockHistory GraphQL (paginated) ──
async function fetchConsumption(beginDate, endDate) {
  const PAGE = 500;
  let all = [];
  let cursor = null;
  let page = 0;

  while (true) {
    const afterClause = cursor ? `, after: "${cursor}"` : '';
    const q = `{
      stockHistoryViewConnection(first: ${PAGE}${afterClause}, transactionType: "Build", recordDate: { begin: "${beginDate}", end: "${endDate}" }) {
        pageInfo { hasNextPage endCursor }
        edges {
          node {
            transactionType
            transactionUpdateType
            transactionDescription
            stockType
            quantity
            unitsOut
            recordDate
            product { productId }
          }
        }
      }
    }`;

    const data = await gql(q);
    const conn = data.stockHistoryViewConnection;
    const nodes = conn.edges.map(e => e.node);
    all.push(...nodes);
    page++;
    process.stdout.write(`\r  Consumption (${beginDate}-${endDate}): ${all.length} records (page ${page})...`);

    if (!conn.pageInfo.hasNextPage) break;
    cursor = conn.pageInfo.endCursor;
  }
  console.log(`\r  Consumption (${beginDate}-${endDate}): ${all.length} total                    `);
  return all;
}

// ── Aggregate consumption by product ──
function aggregateConsumption(records) {
  const byProduct = {};
  for (const r of records) {
    const rawQty = num(r.quantity || 0);
    if (rawQty >= 0) continue;
    if (r.transactionUpdateType !== 'Build consume started') continue;
    if (r.stockType !== 'In stock') continue;
    const pid = r.product?.productId || 'unknown';
    byProduct[pid] = (byProduct[pid] || 0) + Math.abs(rawQty);
  }
  return byProduct;
}

// ── Fetch monthly sales totals from order headers (12 months) ──
async function fetchMonthlyTotals() {
  const PAGE = 200;
  let cursor = null;
  let all = [];
  let page = 0;
  const beginDate = new Date();
  beginDate.setMonth(beginDate.getMonth() - 11);
  beginDate.setDate(1);
  const begin = `${beginDate.getMonth() + 1}/1/${beginDate.getFullYear()}`;

  while (true) {
    const afterClause = cursor ? `, after: "${cursor}"` : '';
    const q = `{
      orderViewConnection(first: ${PAGE}${afterClause}, orderDate: { begin: "${begin}" }) {
        pageInfo { hasNextPage endCursor }
        edges {
          node {
            orderDate
            type
            status
            subtotal
            totalUnits
          }
        }
      }
    }`;

    const data = await gql(q);
    const conn = data.orderViewConnection;
    all.push(...conn.edges.map(e => e.node));
    page++;
    process.stdout.write(`\r  Orders: ${all.length} fetched (page ${page})...`);

    if (!conn.pageInfo.hasNextPage) break;
    cursor = conn.pageInfo.endCursor;
  }

  const sales = all.filter(o => o.type === 'Sale' && o.status !== 'Canceled');
  const byMonth = {};
  sales.forEach(o => {
    const parts = o.orderDate.split('/');
    const m = parts[2] + '-' + parts[0].padStart(2, '0');
    if (!byMonth[m]) byMonth[m] = { period: m, revenue: 0, units: 0, orders: 0 };
    byMonth[m].revenue += num(o.subtotal);
    byMonth[m].units += num(o.totalUnits);
    byMonth[m].orders++;
  });

  const months = Object.values(byMonth).sort((a, b) => a.period.localeCompare(b.period));
  console.log(`\r  Orders: ${all.length} total, ${sales.length} completed sales, ${months.length} months`);
  return months;
}

// ── Main ──
(async () => {
  const outDir = path.resolve(__dirname);
  const now = new Date();

  console.log('Fetching data from Finale API...\n');

  // 1. Products with stock + sales
  console.log('1. Products (stock + sales + consumption):');
  const products = await fetchAllProducts();

  // Build stock JSON
  const stockData = products
    .filter(p => p.status === 'Active')
    .map(p => ({
      sku: p.productId,
      desc: p.description,
      category: p.category,
      onHand: num(p.stockQuantityOnHandUnits) || 0,
      reserved: num(p.stockReservationsUnits) || 0,
      onOrder: num(p.stockOnOrderUnits) || 0,
      available: num(p.stockAvailableToPromiseUnits) || 0,
      remaining: num(p.stockRemainingAfterReservationsUnits) || 0,
      cost: num(p.lastPurchaseLandedCostPerUnit) || 0,
    }));

  // Build sales history JSON
  const salesData = {};
  for (const p of products) {
    if (p.status !== 'Active') continue;
    const s30 = num(p.salesLast30Days) || 0;
    const s60 = num(p.salesLast60Days) || 0;
    const s90 = num(p.salesLast90Days) || 0;
    const sLastMonth = num(p.salesLastMonth) || 0;
    const sThisMonth = num(p.salesThisMonth) || 0;
    if (s30 || s60 || s90 || sLastMonth || sThisMonth) {
      salesData[p.productId] = {
        name: p.description,
        s7: num(p.salesLast7Days) || 0,
        s30,
        s60: s60 - s30,
        s90,
        s180: num(p.salesLast180Days) || 0,
        sLastMonth,
        sThisMonth,
        r30: 0, r60: 0, // revenue not available in this query
      };
    }
  }

  // Build inventory JSON
  const inventoryData = { inventory: {}, onOrder: {} };
  for (const p of products) {
    if (p.status !== 'Active') continue;
    const onHand = num(p.stockQuantityOnHandUnits) || 0;
    const onOrder = num(p.stockOnOrderUnits) || 0;
    const reserved = num(p.stockReservationsUnits) || 0;
    if (onHand || onOrder || reserved) {
      inventoryData.inventory[p.productId] = { onHand, onOrder, reserved };
      if (onOrder) inventoryData.onOrder[p.productId] = onOrder;
    }
  }

  // 2. Consumption data (30d and 90d)
  console.log('\n2. Consumption (30 day):');
  const d30End = `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()}`;
  const d30Start = new Date(now);
  d30Start.setDate(d30Start.getDate() - 30);
  const d30Begin = `${d30Start.getMonth() + 1}/${d30Start.getDate()}/${d30Start.getFullYear()}`;
  const consume30Raw = await fetchConsumption(d30Begin, d30End);
  const consume30 = aggregateConsumption(consume30Raw);

  console.log('\n3. Consumption (90 day):');
  const d90Start = new Date(now);
  d90Start.setDate(d90Start.getDate() - 90);
  const d90Begin = `${d90Start.getMonth() + 1}/${d90Start.getDate()}/${d90Start.getFullYear()}`;
  const consume90Raw = await fetchConsumption(d90Begin, d30End);
  const consume90 = aggregateConsumption(consume90Raw);

  // Build consumption JSON (same format as existing finale-consumption.json)
  const consumptionData = { consume90, consume30, onOrder: inventoryData.onOrder };

  // 3. Monthly sales totals
  console.log('\n4. Monthly sales totals (12 months):');
  const monthlyTotals = await fetchMonthlyTotals();

  // 4. Write output files
  console.log('\n5. Writing JSON files...');

  const write = (name, data) => {
    const fp = path.join(outDir, name);
    fs.writeFileSync(fp, JSON.stringify(data, null, 2));
    console.log(`  ${name}: ${JSON.stringify(data).length.toLocaleString()} bytes`);
  };

  write('finale-stock.json', stockData);
  write('finale-sales.json', salesData);
  write('finale-inventory.json', inventoryData);
  write('finale-consumption.json', consumptionData);
  write('finale-monthly.json', { months: monthlyTotals });

  // Summary
  const activeProducts = products.filter(p => p.status === 'Active').length;
  const withStock = stockData.filter(s => s.onHand > 0).length;
  const withSales = Object.keys(salesData).length;
  const consumed90Count = Object.keys(consume90).length;
  const consumed30Count = Object.keys(consume30).length;

  console.log(`\n✓ Done! ${activeProducts} active products, ${withStock} with stock on hand`);
  console.log(`  ${withSales} with sales history, ${consumed90Count} consumed (90d), ${consumed30Count} consumed (30d)`);
  console.log(`  ${monthlyTotals.length} months of sales data`);
  console.log(`  Generated: ${new Date().toISOString()}`);
})();
