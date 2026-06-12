// Fetches on-hand inventory from Finale API inventoryitem endpoint
// Run: node src/data/build-inventory.cjs
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

async function main() {
  console.log('Fetching inventory items from Finale...');
  const r = await fetch(`${BASE}/inventoryitem/`, {
    headers: { Authorization: AUTH, 'Content-Type': 'application/json' },
  });
  if (!r.ok) throw new Error(`inventoryitem: ${r.status}`);
  const d = await r.json();
  console.log(`Got ${d.productId.length} inventory item records`);

  const totals = {};
  d.productId.forEach((pid, i) => {
    if (!totals[pid]) totals[pid] = { onHand: 0, onOrder: 0, reserved: 0 };
    totals[pid].onHand += (d.quantityOnHand[i] || 0);
    totals[pid].onOrder += (d.quantityOnOrder[i] || 0);
    totals[pid].reserved += (d.quantityReserved[i] || 0);
  });

  const withStock = Object.values(totals).filter(v => v.onHand > 0).length;
  const withOrder = Object.values(totals).filter(v => v.onOrder > 0).length;
  console.log(`${Object.keys(totals).length} unique products, ${withStock} with on-hand stock, ${withOrder} with on-order`);

  const output = { generated: new Date().toISOString(), inventory: totals };
  const outPath = path.join(__dirname, 'finale-inventory.json');
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`Written to ${outPath}`);

  const top = Object.entries(totals).sort((a, b) => b[1].onHand - a[1].onHand).slice(0, 15);
  console.log('\nTop 15 by on-hand:');
  top.forEach(([pid, v]) => console.log(`  ${pid}: ${v.onHand} (order: ${v.onOrder}, reserved: ${v.reserved})`));
}

main().catch(e => { console.error(e); process.exit(1); });
