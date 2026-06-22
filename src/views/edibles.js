import { state } from '../data/state.js';

function fmt(n) { return Math.round(n).toLocaleString(); }

const PACK_MULTIPLIER = { 'Single': 1, '2-Pack': 2, '3-Pack': 3, '5PK Display': 5, '8PK Display': 8, '10PK Display': 10 };

const FLAVOR_LINE = {
  'Blue Dream': 'Euphoria', 'Kiwi Burst': 'Euphoria', 'Mango Crush': 'Euphoria',
  'Midnight Berry': 'Euphoria', 'Pink Lemonade': 'Euphoria', 'Strawberry Shortcake': 'Euphoria',
  'Appleberry Nectar': 'Froot Jam', 'Strawberry Dream': 'Froot Jam', 'Tropical Passion': 'Froot Jam',
  'Big Brain Gummies': 'Microdose', 'Love Gummies': 'Microdose', 'Chillin Gummies': 'Microdose',
  'Cinnamon Brulee': 'Crunchies', 'Cocoa Fudge': 'Crunchies', 'Double Rainbow': 'Crunchies', 'Rainbow': 'Crunchies',
};
const LINE_COLOR = { 'Euphoria': '#e05252', 'Froot Jam': '#52c97a', 'Microdose': '#9b7fee', 'Crunchies': '#e8c547' };

const PACK_ORDER = ['Single', '2-Pack', '3-Pack', '5PK Display', '8PK Display', '10PK Display', 'RAW'];

function slug(s) { return s.replace(/[^a-zA-Z0-9]/g, '-'); }

function mosColor(v) {
  if (v < 1) return 'var(--red)';
  if (v < 2) return 'var(--orange)';
  if (v < 3) return 'var(--purple)';
  return 'var(--green)';
}

function mosBg(v) {
  if (v < 1) return 'rgba(224,82,82,0.12)';
  if (v < 2) return 'rgba(224,124,58,0.12)';
  if (v < 3) return 'rgba(155,127,238,0.10)';
  return 'rgba(82,201,122,0.08)';
}

export function renderEdiblesView() {
  const container = document.getElementById('edibles-table');
  if (!container) return;

  const edibles = state.RAW_DATA.filter(r => r.cat === 'Edibles' && r.flavor && !state.removedIds.has(r.id));

  // Build per-flavor aggregated data + per-pack detail
  const byFlavor = {};
  edibles.forEach(r => {
    if (!byFlavor[r.flavor]) byFlavor[r.flavor] = { onHand: 0, onOrder: 0, sales: 0, totalInv: 0, rawOnHand: 0, rawOnOrder: 0, skus: [] };
    const f = byFlavor[r.flavor];

    if (r.packType === 'RAW') {
      f.rawOnHand += r.onHand;
      f.rawOnOrder += r.onOrder;
      f.skus.push({ id: r.id, packType: 'RAW', onHand: r.onHand, onOrder: r.onOrder, sales: r.dem, unitOnHand: r.onHand, unitOnOrder: r.onOrder, unitSales: r.dem });
      return;
    }
    const mult = PACK_MULTIPLIER[r.packType] || 1;
    f.onHand += r.onHand * mult;
    f.onOrder += r.onOrder * mult;
    f.sales += r.dem * mult;
    f.totalInv += (r.onHand + r.onOrder) * mult;
    f.skus.push({ id: r.id, packType: r.packType || '—', onHand: r.onHand, onOrder: r.onOrder, sales: r.dem, unitOnHand: r.onHand * mult, unitOnOrder: r.onOrder * mult, unitSales: r.dem * mult });
  });

  const lineOrder = ['Euphoria', 'Froot Jam', 'Microdose', 'Crunchies', ''];
  const flavors = Object.keys(byFlavor).sort((a, b) => {
    const la = lineOrder.indexOf(FLAVOR_LINE[a] || ''), lb = lineOrder.indexOf(FLAVOR_LINE[b] || '');
    return la !== lb ? la - lb : a.localeCompare(b);
  });

  const rows = flavors.map(f => {
    const d = byFlavor[f];
    const mos = d.sales > 0 ? d.totalInv / d.sales : 0;
    d.skus.sort((a, b) => {
      const ai = PACK_ORDER.indexOf(a.packType), bi = PACK_ORDER.indexOf(b.packType);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
    return { flavor: f, ...d, mos };
  });

  const totals = rows.reduce((t, r) => {
    t.onHand += r.onHand; t.onOrder += r.onOrder; t.sales += r.sales; t.totalSupply += r.totalInv; t.rawOnHand += r.rawOnHand; t.rawOnOrder += r.rawOnOrder;
    return t;
  }, { onHand: 0, onOrder: 0, sales: 0, totalSupply: 0, rawOnHand: 0, rawOnOrder: 0 });
  const totalMos = totals.sales > 0 ? totals.totalSupply / totals.sales : 0;

  const cs = 'padding:8px 12px;text-align:right;font-size:12px;white-space:nowrap;';
  const hs = 'padding:8px 12px;text-align:right;font-size:10px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;white-space:nowrap;border-bottom:2px solid var(--border);';
  const fs = 'padding:8px 12px;text-align:left;font-size:12px;font-weight:500;color:var(--text);white-space:nowrap;';

  let html = `<div style="overflow-x:auto;border:1px solid var(--border);border-radius:8px;background:var(--bg2)">`;
  html += `<table style="width:100%;border-collapse:collapse;font-family:Arial,sans-serif">`;

  html += '<thead><tr style="background:rgba(255,255,255,0.03)">';
  html += `<th style="${hs}text-align:left;min-width:160px">Flavor</th>`;
  html += `<th style="${hs}text-align:left">Line</th>`;
  html += `<th style="${hs}"><span style="color:var(--green)">On Hand</span></th>`;
  html += `<th style="${hs}"><span style="color:var(--blue)">On Order</span></th>`;
  html += `<th style="${hs}">Total Supply</th>`;
  html += `<th style="${hs}"><span style="color:var(--yellow)">Monthly Sales</span></th>`;
  html += `<th style="${hs}"><span style="color:var(--orange)">Months of Supply</span></th>`;
  html += `<th style="${hs}"><span style="color:var(--green)">RAW On Hand</span></th>`;
  html += `<th style="${hs}"><span style="color:var(--blue)">RAW On Order</span></th>`;
  html += '</tr></thead>';

  html += '<tbody>';
  rows.forEach((r, i) => {
    const stripe = i % 2 === 0 ? '' : 'background:rgba(255,255,255,0.02);';
    const line = FLAVOR_LINE[r.flavor] || '—';
    const lc = LINE_COLOR[line] || 'var(--text3)';
    const fid = slug(r.flavor);

    // Summary row — clickable
    html += `<tr style="${stripe}border-bottom:1px solid var(--border);cursor:pointer" onclick="window.__toggleEdibleDetail('${r.flavor.replace(/'/g, "\\'")}')" id="erow-${fid}">`;
    html += `<td style="${fs}"><span id="echev-${fid}" style="display:inline-block;transition:transform .15s;transform:rotate(0deg);margin-right:6px;font-size:10px;color:var(--text3)">▶</span>${r.flavor}</td>`;
    html += `<td style="${fs}color:${lc};font-size:11px">${line}</td>`;
    html += `<td style="${cs}color:var(--green)">${fmt(r.onHand)}</td>`;
    html += `<td style="${cs}color:var(--blue)">${fmt(r.onOrder)}</td>`;
    html += `<td style="${cs}color:var(--text2)">${fmt(r.totalInv)}</td>`;
    html += `<td style="${cs}color:var(--yellow)">${fmt(r.sales)}</td>`;
    html += `<td style="${cs}font-weight:600;color:${mosColor(r.mos)};background:${mosBg(r.mos)}">${r.mos.toFixed(1)}</td>`;
    html += `<td style="${cs}color:var(--green)">${fmt(r.rawOnHand)}</td>`;
    html += `<td style="${cs}color:var(--blue)">${fmt(r.rawOnOrder)}</td>`;
    html += '</tr>';

    // Detail rows — hidden by default
    r.skus.forEach(sku => {
      const skuMos = sku.unitSales > 0 ? (sku.unitOnHand + sku.unitOnOrder) / sku.unitSales : 0;
      const isRaw = sku.packType === 'RAW';
      html += `<tr class="edetail-${fid}" style="display:none;background:rgba(255,255,255,0.015);border-bottom:1px solid rgba(255,255,255,0.04)">`;
      html += `<td style="${fs}padding-left:36px;font-weight:400;font-size:11px;color:var(--text2)">${sku.id}</td>`;
      html += `<td style="${cs}font-size:11px;color:var(--text3)">${sku.packType}</td>`;
      html += `<td style="${cs}font-size:11px;color:var(--green)">${fmt(sku.onHand)}${!isRaw && sku.onHand !== sku.unitOnHand ? ` <span style="color:var(--text3);font-size:9px">(${fmt(sku.unitOnHand)} units)</span>` : ''}</td>`;
      html += `<td style="${cs}font-size:11px;color:var(--blue)">${fmt(sku.onOrder)}${!isRaw && sku.onOrder !== sku.unitOnOrder ? ` <span style="color:var(--text3);font-size:9px">(${fmt(sku.unitOnOrder)} units)</span>` : ''}</td>`;
      html += `<td style="${cs}font-size:11px;color:var(--text2)">${fmt(sku.unitOnHand + sku.unitOnOrder)}</td>`;
      html += `<td style="${cs}font-size:11px;color:var(--yellow)">${fmt(sku.sales)}${!isRaw && sku.sales !== sku.unitSales ? ` <span style="color:var(--text3);font-size:9px">(${fmt(sku.unitSales)} units)</span>` : ''}</td>`;
      html += `<td style="${cs}font-size:11px;font-weight:600;color:${mosColor(skuMos)};background:${mosBg(skuMos)}">${skuMos.toFixed(1)}</td>`;
      html += `<td style="${cs}font-size:11px"></td>`;
      html += `<td style="${cs}font-size:11px"></td>`;
      html += '</tr>';
    });
  });
  html += '</tbody>';

  html += '<tfoot><tr style="border-top:2px solid var(--border);background:rgba(255,255,255,0.04)">';
  html += `<td style="${fs}font-weight:700">TOTAL</td>`;
  html += `<td style="${fs}"></td>`;
  html += `<td style="${cs}font-weight:700;color:var(--green)">${fmt(totals.onHand)}</td>`;
  html += `<td style="${cs}font-weight:700;color:var(--blue)">${fmt(totals.onOrder)}</td>`;
  html += `<td style="${cs}font-weight:700;color:var(--text2)">${fmt(totals.totalSupply)}</td>`;
  html += `<td style="${cs}font-weight:700;color:var(--yellow)">${fmt(totals.sales)}</td>`;
  html += `<td style="${cs}font-weight:700;color:${mosColor(totalMos)};background:${mosBg(totalMos)}">${totalMos.toFixed(1)}</td>`;
  html += `<td style="${cs}font-weight:700;color:var(--green)">${fmt(totals.rawOnHand)}</td>`;
  html += `<td style="${cs}font-weight:700;color:var(--blue)">${fmt(totals.rawOnOrder)}</td>`;
  html += '</tr></tfoot>';

  html += '</table></div>';

  container.innerHTML = html;
}

window.__toggleEdibleDetail = (flavor) => {
  const fid = slug(flavor);
  const rows = document.querySelectorAll(`.edetail-${fid}`);
  const chev = document.getElementById(`echev-${fid}`);
  const isOpen = rows[0]?.style.display !== 'none';
  rows.forEach(r => r.style.display = isOpen ? 'none' : 'table-row');
  if (chev) chev.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(90deg)';
};
