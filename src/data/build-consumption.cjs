// Fetches transfer order data from Finale API to build consumption data
// Run: node src/data/build-consumption.cjs
const fs = require('fs');
const path = require('path');

const envFile = fs.readFileSync(path.join(__dirname, '../../.env'), 'utf8');
const env = Object.fromEntries(envFile.split('\n').filter(l => l.includes('=')).map(l => l.split('=').map(s => s.trim())));
const KEY = env.VITE_FINALE_API_KEY;
const SECRET = env.VITE_FINALE_API_SECRET;
const ACCOUNT = env.VITE_FINALE_ACCOUNT || 'deltamunchies';
if (!KEY || !SECRET) { console.error('Set VITE_FINALE_API_KEY and VITE_FINALE_API_SECRET in .env'); process.exit(1); }
const BASE = `https://app.finaleinventory.com/${ACCOUNT}/api`;
const AUTH = 'Basic ' + Buffer.from(`${KEY}:${SECRET}`).toString('base64');

async function api(endpoint) {
  const r = await fetch(BASE + endpoint, {
    headers: { Authorization: AUTH, 'Content-Type': 'application/json' },
  });
  if (!r.ok) throw new Error(`${endpoint}: ${r.status}`);
  return r.json();
}

async function main() {
  console.log('Fetching order summary...');
  const summary = await api('/ordersummary');

  // Collect all completed transfer order IDs
  const xferIds = [];
  for (let i = 0; i < summary.orderId.length; i++) {
    if (summary.orderTypeId[i] === 'TRANSFER_ORDER' && summary.statusId[i] === 'ORDER_COMPLETED') {
      xferIds.push(parseInt(summary.orderId[i]));
    }
  }
  xferIds.sort((a, b) => a - b);
  console.log(`Found ${xferIds.length} completed transfer orders`);

  // We'll fetch in batches and filter by date
  const now = new Date();
  const cutoff90 = new Date(now); cutoff90.setDate(cutoff90.getDate() - 90);
  const cutoff30 = new Date(now); cutoff30.setDate(cutoff30.getDate() - 30);
  console.log(`90-day cutoff: ${cutoff90.toISOString().slice(0,10)}`);
  console.log(`30-day cutoff: ${cutoff30.toISOString().slice(0,10)}`);

  // Binary search for approximate 90-day start index
  // Sample from the end backwards
  let startIdx = Math.max(0, xferIds.length - 5000); // conservative start
  const sampleOrder = await api('/order/' + xferIds[startIdx]);
  const sampleDate = new Date(sampleOrder.orderDate);
  if (sampleDate > cutoff90) {
    // Need to go further back
    startIdx = Math.max(0, startIdx - 2000);
  }
  console.log(`Starting from index ${startIdx} (ID ${xferIds[startIdx]})`);

  const consume90 = {}; // pid -> total qty
  const consume30 = {}; // pid -> total qty last 30 days
  let fetched = 0;
  let skippedOld = 0;
  const BATCH = 20;

  for (let i = startIdx; i < xferIds.length; i += BATCH) {
    const batch = xferIds.slice(i, i + BATCH);
    const results = await Promise.all(
      batch.map(id => api('/order/' + id).catch(e => null))
    );

    for (const order of results) {
      if (!order) continue;
      const orderDate = new Date(order.orderDate);
      if (orderDate < cutoff90) { skippedOld++; continue; }

      for (const item of (order.orderItemList || [])) {
        if (!item.productId || !item.quantity) continue;
        consume90[item.productId] = (consume90[item.productId] || 0) + item.quantity;
        if (orderDate >= cutoff30) {
          consume30[item.productId] = (consume30[item.productId] || 0) + item.quantity;
        }
      }
    }

    fetched += batch.length;
    if (fetched % 200 === 0) {
      console.log(`  ${fetched} / ${xferIds.length - startIdx} orders fetched...`);
    }
  }

  console.log(`Fetched ${fetched} orders, skipped ${skippedOld} older than 90 days`);
  console.log(`90-day consumption: ${Object.keys(consume90).length} products`);
  console.log(`30-day consumption: ${Object.keys(consume30).length} products`);

  // Fetch open POs for "on order" quantities
  console.log('\nFetching open purchase orders...');
  const openPOIds = [];
  for (let i = 0; i < summary.orderId.length; i++) {
    if (summary.orderTypeId[i] === 'PURCHASE_ORDER' && summary.statusId[i] === 'ORDER_LOCKED') {
      openPOIds.push(summary.orderId[i]);
    }
  }
  console.log(`Found ${openPOIds.length} open POs`);
  const poOrders = await Promise.all(
    openPOIds.map(id => api('/order/' + id).catch(e => null))
  );
  const onOrder = {};
  poOrders.forEach(o => {
    if (!o) return;
    (o.orderItemList || []).forEach(item => {
      if (item.productId && item.quantity) {
        onOrder[item.productId] = (onOrder[item.productId] || 0) + item.quantity;
      }
    });
  });
  console.log(`On order: ${Object.keys(onOrder).length} products`);

  // Write output
  const output = { generated: now.toISOString(), consume90, consume30, onOrder };
  const outPath = path.join(__dirname, 'finale-consumption.json');
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`Written to ${outPath}`);

  // Show top 20 by 90-day consumption
  const top = Object.entries(consume90).sort((a, b) => b[1] - a[1]).slice(0, 20);
  console.log('\nTop 20 consumed products (90 days):');
  top.forEach(([pid, qty]) => console.log(`  ${pid}: ${qty}`));

  const topOO = Object.entries(onOrder).sort((a, b) => b[1] - a[1]).slice(0, 10);
  console.log('\nTop 10 on order:');
  topOO.forEach(([pid, qty]) => console.log(`  ${pid}: ${qty}`));
}

main().catch(e => { console.error(e); process.exit(1); });
