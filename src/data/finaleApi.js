/**
 * Finale Inventory API connector
 *
 * Current API key has access to: /product, /facility
 * TODO: Get API key upgraded with access to: /order, /inventoryitem
 *       (need those for stock quantities and sales data)
 */

const BASE_URL = '/finale-api';
const AUTH     = 'Basic ' + btoa(`${import.meta.env.VITE_FINALE_API_KEY}:${import.meta.env.VITE_FINALE_API_SECRET}`);

async function finaleGet(path) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: AUTH, 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`Finale API ${path}: ${res.status} ${res.statusText}`);
  return res.json();
}

// ── Fetch product catalog (single request, returns all product IDs + names) ──
export async function fetchProducts() {
  const data = await finaleGet('/product');
  const ids    = data.productId || [];
  const names  = data.internalName || [];
  const statuses = data.statusId || [];

  const products = [];
  for (let i = 0; i < ids.length; i++) {
    if (statuses[i] !== 'PRODUCT_ACTIVE') continue;
    products.push({ productId: ids[i], internalName: names[i] || '' });
  }
  return products;
}

// ── Build CSV from product data for processData() ──
// Stock quantities not available with current API key —
// dashboard will show items with 0 inventory until /inventoryitem access is granted
function productsToStockCSV(products) {
  const rows = products.map(p => ({
    'Location': 'SFS-HQ',
    'Product ID': p.productId,
    'Description': p.internalName,
    'On hand': 0,
    'On order': 0,
    'Reserved': 0,
  }));
  return toCSV(rows);
}

function productsToSalesCSV(products) {
  const rows = products.map(p => ({
    'Product ID': p.productId,
    'Sales last 90 days': 0,
    'Sales last 30 days': 0,
    'Sales last month': 0,
  }));
  return toCSV(rows);
}

// ── Main fetch ──
export async function fetchAll() {
  if (!import.meta.env.VITE_FINALE_API_KEY) {
    console.warn('Finale API credentials not set — add VITE_FINALE_API_KEY, VITE_FINALE_API_SECRET to .env');
    return { stock: null, salesHistory: null, consume: null, consume30: null, salesOrder: null };
  }

  const products = await fetchProducts();
  console.log(`Loaded ${products.length} active products from Finale`);

  return {
    stock: productsToStockCSV(products),
    salesHistory: productsToSalesCSV(products),
    consume: null,
    consume30: null,
    salesOrder: null,
  };
}

// ── Utility: array of objects → CSV string ──
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
