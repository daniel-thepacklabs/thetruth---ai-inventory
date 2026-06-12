const BASE_URL = '/finale-api';
const AUTH     = 'Basic ' + btoa(`${import.meta.env.VITE_FINALE_API_KEY}:${import.meta.env.VITE_FINALE_API_SECRET}`);

async function finaleGet(path) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: AUTH, 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`Finale API ${path}: ${res.status} ${res.statusText}`);
  return res.json();
}

import stockData from './zoey-stock.json';
import salesData from './zoey-sales.json';
import consumptionData from './finale-consumption.json';
import inventoryData from './finale-inventory.json';
import monthlyTotals from './zoey-monthly-sales.json';
import productSales from './zoey-product-sales.json';

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

function buildStockCSV(products) {
  const zoeyBySku = {};
  for (const s of stockData) {
    zoeyBySku[s.sku] = s.qty;
  }

  const finaleInv = inventoryData.inventory || {};
  const finaleOnOrder = consumptionData.onOrder || {};

  const rows = products.map(p => {
    const fi = finaleInv[p.productId];
    const onHand = fi ? fi.onHand : (zoeyBySku[p.productId] ?? 0);
    const onOrder = fi ? fi.onOrder : (finaleOnOrder[p.productId] || 0);
    const reserved = fi ? fi.reserved : 0;
    return {
      'Location': 'SFS-HQ',
      'Product ID': p.productId,
      'Description': p.internalName,
      'On hand': onHand,
      'On order': onOrder,
      'Reserved': reserved,
    };
  });
  return toCSV(rows);
}

function buildSalesCSV(products) {
  const rows = products.map(p => {
    const c90 = consumptionData.consume90[p.productId] || 0;
    const c30 = consumptionData.consume30[p.productId] || 0;
    const s = salesData[p.productId];
    const s30 = c30 || (s ? s.s30 : 0);
    const s90 = c90 || (s ? s.s30 + s.s60 : 0);
    return {
      'Product ID': p.productId,
      'Sales last 90 days': s90,
      'Sales last 30 days': s30,
      'Sales last month': s30,
    };
  });
  return toCSV(rows);
}

function buildSalesOrderCSV() {
  const rows = [];
  const now = new Date();
  for (const [sku, s] of Object.entries(salesData)) {
    if (s.s30 > 0) {
      rows.push({
        'Order date': new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10),
        'Status': 'Completed',
        'Category': '',
        'Product ID': sku,
        'Description': s.name,
        'Quantity': s.s30,
        'Unit price': s.s30 > 0 ? (s.r30 / s.s30).toFixed(2) : '0',
        'Subtotal sum': s.r30.toFixed(2),
      });
    }
    if (s.s60 > 0) {
      const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      rows.push({
        'Order date': prevMonth.toISOString().slice(0, 10),
        'Status': 'Completed',
        'Category': '',
        'Product ID': sku,
        'Description': s.name,
        'Quantity': Math.round(s.s60 / 2),
        'Unit price': s.s60 > 0 ? (s.r60 / s.s60).toFixed(2) : '0',
        'Subtotal sum': (s.r60 / 2).toFixed(2),
      });
      const prevMonth2 = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      rows.push({
        'Order date': prevMonth2.toISOString().slice(0, 10),
        'Status': 'Completed',
        'Category': '',
        'Product ID': sku,
        'Description': s.name,
        'Quantity': Math.round(s.s60 / 2),
        'Unit price': s.s60 > 0 ? (s.r60 / s.s60).toFixed(2) : '0',
        'Subtotal sum': (s.r60 / 2).toFixed(2),
      });
    }
  }
  return toCSV(rows);
}

function buildConsumeCSV(products, days) {
  const src = days === 30 ? consumptionData.consume30 : consumptionData.consume90;
  const rows = [];
  for (const p of products) {
    const finaleQty = src[p.productId] || 0;
    const zoeyS = salesData[p.productId];
    const zoeyQty = days === 30 ? (zoeyS ? zoeyS.s30 : 0) : (zoeyS ? zoeyS.s30 + zoeyS.s60 : 0);
    const qty = finaleQty || zoeyQty;
    if (qty > 0) {
      rows.push({ 'Product ID': p.productId, 'Quantity sum': qty });
    }
  }
  return rows.length ? toCSV(rows) : null;
}

export async function fetchAll() {
  if (!import.meta.env.VITE_FINALE_API_KEY) {
    console.warn('Finale API credentials not set — add VITE_FINALE_API_KEY, VITE_FINALE_API_SECRET to .env');
    return { stock: null, salesHistory: null, consume: null, consume30: null, salesOrder: null };
  }

  const products = await fetchProducts();
  console.log(`Loaded ${products.length} active products from Finale`);

  const stock = buildStockCSV(products);
  const salesHistory = buildSalesCSV(products);
  const salesOrder = buildSalesOrderCSV();
  const consume = buildConsumeCSV(products, 90);
  const consume30 = buildConsumeCSV(products, 30);

  const matchedZoey = products.filter(p => salesData[p.productId]).length;
  const matchedFinale = products.filter(p => consumptionData.consume90[p.productId]).length;
  console.log(`Matched ${matchedZoey} products with Zoey sales, ${matchedFinale} with Finale consumption`);

  return {
    stock,
    salesHistory,
    consume,
    consume30,
    salesOrder,
    monthlyTotals: monthlyTotals.months || [],
    productSalesData: productSales.data || [],
  };
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
