import salesData from './finale-sales.json';
import consumptionData from './finale-consumption.json';
import monthlyData from './finale-monthly.json';
import orderItemData from './finale-order-items.json';
import priceMapsData from './price-maps.json';

const ACCOUNT = import.meta.env.VITE_FINALE_ACCOUNT || 'deltamunchies';
const KEY = import.meta.env.VITE_FINALE_API_KEY;
const SECRET = import.meta.env.VITE_FINALE_API_SECRET;
const AUTH = KEY && SECRET ? 'Basic ' + btoa(`${KEY}:${SECRET}`) : null;
const num = v => parseFloat(String(v || '0').replace(/,/g, '')) || 0;

async function gql(query, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const r = await fetch('/finale-api/graphql', {
        method: 'POST',
        headers: { Authorization: AUTH, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      if (r.status === 429 || r.status >= 500) {
        if (attempt < retries) {
          const wait = attempt * 2000;
          console.warn(`GraphQL ${r.status}, retrying in ${wait}ms (attempt ${attempt}/${retries})...`);
          await new Promise(resolve => setTimeout(resolve, wait));
          continue;
        }
      }
      if (!r.ok) throw new Error(`GraphQL ${r.status}: ${await r.text()}`);
      const d = await r.json();
      if (d.errors) throw new Error('GraphQL errors: ' + JSON.stringify(d.errors));
      return d.data;
    } catch (err) {
      if (attempt < retries && (err.name === 'TypeError' || err.message.includes('Failed to fetch'))) {
        const wait = attempt * 2000;
        console.warn(`Fetch error: ${err.message}, retrying in ${wait}ms (attempt ${attempt}/${retries})...`);
        await new Promise(resolve => setTimeout(resolve, wait));
        continue;
      }
      throw err;
    }
  }
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

function buildConsumeCSV(days, liveProducts) {
  const src = days === 30 ? consumptionData.consume30 : consumptionData.consume90;
  const merged = { ...src };
  if (liveProducts && days === 90) {
    for (const p of liveProducts) {
      const qty = num(p.consumptionQuantity);
      if (qty > 0) {
        merged[p.productId] = qty;
      }
    }
  }
  const rows = Object.entries(merged)
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

async function fetchMonthRevenue(year, month) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const begin = `${month}/1/${year}`;
  const end = `${month}/${daysInMonth}/${year}`;
  let cursor = null, revenue = 0, units = 0, orders = 0;
  while (true) {
    const afterClause = cursor ? `, after: "${cursor}"` : '';
    const q = `{ orderViewConnection(first: 1000${afterClause}, orderDate: { begin: "${begin}", end: "${end}" }) { pageInfo { hasNextPage endCursor } edges { node { status subtotal totalUnits type } } } }`;
    const data = await gql(q);
    const conn = data.orderViewConnection;
    conn.edges.forEach(e => {
      const n = e.node;
      if (n.type !== 'Sale' || (n.status !== 'Completed' && n.status !== 'Committed')) return;
      revenue += parseFloat((n.subtotal || '0').replace(/,/g, ''));
      units += parseInt(n.totalUnits || 0);
      orders++;
    });
    if (!conn.pageInfo.hasNextPage) break;
    cursor = conn.pageInfo.endCursor;
  }
  return { revenue: Math.round(revenue * 100) / 100, units, orders };
}

async function fetchMonthReturns(year, month) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const begin = `${month}/1/${year}`;
  const end = `${month}/${daysInMonth}/${year}`;
  let cursor = null, returns = 0;
  while (true) {
    const afterClause = cursor ? `, after: "${cursor}"` : '';
    const q = `{ returnViewConnection(first: 1000${afterClause}, returnDate: { begin: "${begin}", end: "${end}" }) { pageInfo { hasNextPage endCursor } edges { node { subtotal } } } }`;
    const data = await gql(q);
    const conn = data.returnViewConnection;
    conn.edges.forEach(e => {
      returns += parseFloat((e.node.subtotal || '0').replace(/,/g, ''));
    });
    if (!conn.pageInfo.hasNextPage) break;
    cursor = conn.pageInfo.endCursor;
  }
  return Math.round(returns * 100) / 100;
}

async function fetchShipmentsByState(beginDate, endDate) {
  let cursor = null;
  const byStateMonth = {};
  while (true) {
    const afterClause = cursor ? `, after: "${cursor}"` : '';
    const q = `{ shipmentViewConnection(first: 1000${afterClause}, shipDate: { begin: "${beginDate}", end: "${endDate}" }) { pageInfo { hasNextPage endCursor } edges { node { type status shipDate subtotal totalUnits product { productId } shipTo { stateRegion } } } } }`;
    const data = await gql(q);
    const conn = data.shipmentViewConnection;
    conn.edges.forEach(e => {
      const n = e.node;
      if (n.type !== 'Sale' || n.status !== 'Shipped') return;
      const st = (n.shipTo && n.shipTo.stateRegion) || 'Unknown';
      const d = new Date(n.shipDate);
      const period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const amt = parseFloat((n.subtotal || '0').replace(/,/g, ''));
      const units = parseInt(n.totalUnits || 0);
      const pid = n.product ? n.product.productId : 'Unknown';
      const key = `${st}|${period}`;
      if (!byStateMonth[key]) byStateMonth[key] = { state: st, period, revenue: 0, units: 0, shipments: 0, products: {} };
      byStateMonth[key].revenue += amt;
      byStateMonth[key].units += units;
      byStateMonth[key].shipments++;
      if (pid !== 'Multiple products') {
        if (!byStateMonth[key].products[pid]) byStateMonth[key].products[pid] = { revenue: 0, units: 0 };
        byStateMonth[key].products[pid].revenue += amt;
        byStateMonth[key].products[pid].units += units;
      }
    });
    if (!conn.pageInfo.hasNextPage) break;
    cursor = conn.pageInfo.endCursor;
  }
  return byStateMonth;
}

function buildAvgPriceMap() {
  const byPid = {};
  (orderItemData.data || []).forEach(r => {
    if (r.subtotal > 0 && r.qty > 0) {
      if (!byPid[r.pid]) byPid[r.pid] = { totalSub: 0, totalQty: 0 };
      byPid[r.pid].totalSub += r.subtotal;
      byPid[r.pid].totalQty += r.qty;
    }
  });
  const priceMap = {};
  for (const [pid, d] of Object.entries(byPid)) {
    priceMap[pid] = Math.round((d.totalSub / d.totalQty) * 100) / 100;
  }
  return priceMap;
}

function estimatePrice(pid, priceMap, shopify, wholesale) {
  const direct = priceMap[pid] || wholesale[pid] || shopify[pid];
  if (direct) return direct;
  const p = (pid || '').toUpperCase();
  const packMatch = p.match(/(-\d+PK|-2P)$/);
  if (!packMatch) return 0;
  const packSize = p.includes('-10PK') ? 10 : p.includes('-8PK') ? 8 : p.includes('-6PK') ? 6 : p.includes('-5PK') ? 5 : 2;
  const singlePid = pid.replace(/(-\d+PK|-2P)$/, '-01');
  const singlePrice = priceMap[singlePid] || wholesale[singlePid] || shopify[singlePid];
  if (singlePrice) return singlePrice * packSize * 0.7;
  return 0;
}

function buildLiveSalesItems(products, period, priceMap) {
  const shopify = priceMapsData.shopify || {};
  const wholesale = priceMapsData.wholesale || {};
  const items = [];
  const field = period === getCurrentPeriod() ? 'salesThisMonth' : 'salesLastMonth';
  for (const p of products) {
    if (p.status !== 'Active') continue;
    const qty = num(p[field]);
    if (qty <= 0) continue;
    const price = estimatePrice(p.productId, priceMap, shopify, wholesale);
    items.push({
      month: period,
      date: period + '-15',
      pid: p.productId,
      desc: p.description || '',
      qty,
      price,
      subtotal: Math.round(qty * price * 100) / 100,
    });
  }
  return items;
}

function getCurrentPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function getPrevPeriod() {
  const now = new Date();
  return now.getMonth() === 0
    ? `${now.getFullYear() - 1}-12`
    : `${now.getFullYear()}-${String(now.getMonth()).padStart(2, '0')}`;
}

async function fetchLiveMonthlyData(products) {
  const staticMonths = monthlyData.months || [];
  const staticItems = orderItemData.data || [];
  const curPeriod = getCurrentPeriod();
  const prevPeriod = getPrevPeriod();
  const livePeriods = [prevPeriod, curPeriod];

  const months = staticMonths.filter(m => !livePeriods.includes(m.period));
  const salesItems = staticItems.filter(r => !livePeriods.includes(r.month));

  const priceMap = buildAvgPriceMap();

  for (const period of livePeriods) {
    const [y, m] = period.split('-').map(Number);
    console.log(`  Fetching live revenue + returns for ${period}...`);
    const [rev, ret] = await Promise.all([fetchMonthRevenue(y, m), fetchMonthReturns(y, m)]);
    months.push({ period, revenue: rev.revenue, units: rev.units, orders: rev.orders, returns: ret });

    const liveItems = buildLiveSalesItems(products, period, priceMap);
    // Scale per-product estimated revenue to match actual order totals
    const estimatedTotal = liveItems.reduce((s, it) => s + it.subtotal, 0);
    if (estimatedTotal > 0 && rev.revenue > 0) {
      const scale = rev.revenue / estimatedTotal;
      liveItems.forEach(it => {
        it.subtotal = Math.round(it.subtotal * scale * 100) / 100;
        it.price = Math.round(it.price * scale * 100) / 100;
      });
    }
    salesItems.push(...liveItems);
    console.log(`  ${period}: $${rev.revenue.toLocaleString('en-US', { minimumFractionDigits: 2 })} revenue, ${liveItems.length} products (scale: ${estimatedTotal > 0 ? (rev.revenue / estimatedTotal).toFixed(3) : 'n/a'})`);
  }

  months.sort((a, b) => a.period.localeCompare(b.period));
  return { months, salesItems };
}

export async function fetchAll() {
  if (!AUTH) {
    console.warn('No Finale API credentials — using static data');
    return fetchAllStatic();
  }

  console.log('Fetching live data from Finale API...');
  let products;
  try {
    products = await fetchLiveProducts();
  } catch (err) {
    console.warn('Live API unavailable, falling back to static data:', err.message);
    return fetchAllStatic();
  }
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
  const consume = buildConsumeCSV(90, active);
  const consume30 = buildConsumeCSV(30, active);

  const withStock = active.filter(p => num(p.sfsOnHand) > 0).length;
  const withSales = active.filter(p => num(p.salesLast30Days) > 0 || num(p.salesLastMonth) > 0).length;
  console.log(`Live: ${active.length} active products, ${withStock} with stock, ${withSales} with sales`);

  console.log('Fetching live monthly order data...');
  let monthlyTotals, productSalesData;
  try {
    const liveData = await fetchLiveMonthlyData(products);
    monthlyTotals = liveData.months;
    productSalesData = liveData.salesItems.map(r => ({
      ...r,
      date: r.date || (r.month + '-01'),
      status: 'Completed',
      category: '',
    }));
  } catch (err) {
    console.warn('Live monthly data failed, using static:', err.message);
    monthlyTotals = monthlyData.months || [];
    productSalesData = (orderItemData.data || []).map(r => ({
      ...r,
      date: r.date || (r.month + '-01'),
      status: 'Completed',
      category: '',
    }));
  }

  const costMap = {};
  products.forEach(p => {
    const cost = num(p.lastPurchaseLandedCostPerUnit);
    if (cost > 0) costMap[p.productId] = cost;
  });

  const priceMap = buildAvgPriceMap();
  const shopifyPriceMap = priceMapsData.shopify || {};
  const wholesalePriceMap = priceMapsData.wholesale || {};

  console.log('Fetching shipped sales by state...');
  let salesByState = {};
  try {
    const allPeriods = monthlyTotals.map(m => m.period).sort();
    const firstPeriod = allPeriods[0];
    const lastPeriod = allPeriods[allPeriods.length - 1];
    const [fy, fm] = firstPeriod.split('-').map(Number);
    const [ly, lm] = lastPeriod.split('-').map(Number);
    const lastDays = new Date(ly, lm, 0).getDate();
    salesByState = await fetchShipmentsByState(`${fm}/1/${fy}`, `${lm}/${lastDays}/${ly}`);
    const totalStateRev = Object.values(salesByState).reduce((s, d) => s + d.revenue, 0);
    console.log(`  ${Object.keys(salesByState).length} states, $${Math.round(totalStateRev).toLocaleString()} total shipped revenue`);
  } catch (err) {
    console.warn('State sales fetch failed:', err.message);
  }

  return { stock, salesHistory, consume, consume30, salesOrder, monthlyTotals, productSalesData, costMap, priceMap, shopifyPriceMap, wholesalePriceMap, salesByState };
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

  const costMap = {};
  stockData.forEach(p => { if (p.cost > 0) costMap[p.sku] = p.cost; });
  const priceMap = buildAvgPriceMap();
  const shopifyPriceMap = priceMapsData.shopify || {};
  const wholesalePriceMap = priceMapsData.wholesale || {};

  return { stock, salesHistory, consume, consume30, salesOrder, monthlyTotals: monthlyData.months || [], productSalesData, costMap, priceMap, shopifyPriceMap, wholesalePriceMap, salesByState: {} };
}
