import { state } from '../data/state.js';
import { getPiecesPerBag, getPackMultiplier, getPiecesPerUnit } from '../data/parsers.js';

function fmt(n) { return Math.round(n).toLocaleString(); }

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

function buildEuphoriaTable(edibles) {
  const cs = 'padding:8px 12px;text-align:right;font-size:12px;white-space:nowrap;';
  const hs = 'padding:8px 12px;text-align:right;font-size:10px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;white-space:nowrap;border-bottom:2px solid var(--border);';
  const fs = 'padding:8px 12px;text-align:left;font-size:12px;font-weight:500;color:var(--text);white-space:nowrap;';

  const euphoriaItems = edibles.filter(r => FLAVOR_LINE[r.flavor] === 'Euphoria' && r.packType !== 'RAW');

  // Group by flavor → ct size, converting packs into single-unit equivalents
  const byFlavor = {};
  euphoriaItems.forEach(r => {
    if (!byFlavor[r.flavor]) byFlavor[r.flavor] = {};
    const ct = getPiecesPerBag(r.id, r.desc);
    const ctKey = ct + 'ct';
    if (!byFlavor[r.flavor][ctKey]) byFlavor[r.flavor][ctKey] = { ct, onHand: 0, onOrder: 0, sales: 0, skus: [] };
    const g = byFlavor[r.flavor][ctKey];
    const packMult = getPackMultiplier(r.id);
    // Convert to single-unit equivalents: 1 unit of 5PK = 5 singles
    const avail = r.onHand - (r.reserved || 0);
    const singlesOnHand = avail * packMult;
    const singlesOnOrder = r.onOrder * packMult;
    const monthlySales = (r.s90 || 0) / 3;
    const singlesSales = monthlySales * packMult;
    g.onHand += singlesOnHand;
    g.onOrder += singlesOnOrder;
    g.sales += singlesSales;
    g.skus.push({ id: r.id, packType: r.packType, packMult, onHand: avail, singlesOnHand, onOrder: r.onOrder, singlesOnOrder, sales: monthlySales, singlesSales });
  });

  // Also collect RAW per flavor
  const rawByFlavor = {};
  edibles.filter(r => FLAVOR_LINE[r.flavor] === 'Euphoria' && r.packType === 'RAW').forEach(r => {
    if (!rawByFlavor[r.flavor]) rawByFlavor[r.flavor] = { onHand: 0, onOrder: 0 };
    rawByFlavor[r.flavor].onHand += r.onHand;
    rawByFlavor[r.flavor].onOrder += r.onOrder;
  });

  // Determine which ct sizes exist across all Euphoria flavors
  const ctSizes = [...new Set(euphoriaItems.map(r => getPiecesPerBag(r.id, r.desc)))].sort((a, b) => a - b);

  const flavors = Object.keys(byFlavor).sort();

  let html = `<div style="margin-bottom:24px">`;
  html += `<div style="font-size:14px;font-weight:600;color:#e05252;margin-bottom:8px">Euphoria</div>`;
  html += `<div style="font-size:11px;color:var(--text3);margin-bottom:12px">All quantities shown as single-unit equivalents (packs broken down into singles)</div>`;
  html += `<div style="overflow-x:auto;border:1px solid var(--border);border-radius:8px;background:var(--bg2)">`;
  html += `<table style="width:100%;border-collapse:collapse;font-family:Arial,sans-serif">`;

  // Header
  html += '<thead><tr style="background:rgba(255,255,255,0.03)">';
  html += `<th style="${hs}text-align:left;min-width:140px" rowspan="2">Flavor</th>`;
  ctSizes.forEach(ct => {
    html += `<th style="${hs}text-align:center;border-left:2px solid var(--border)" colspan="4">${ct}ct</th>`;
  });
  html += `<th style="${hs}text-align:center;border-left:2px solid var(--border)" colspan="2">RAW</th>`;
  html += '</tr><tr style="background:rgba(255,255,255,0.03)">';
  ctSizes.forEach(() => {
    html += `<th style="${hs}border-left:2px solid var(--border)"><span style="color:var(--green)">Available</span></th>`;
    html += `<th style="${hs}">Total Supply</th>`;
    html += `<th style="${hs}"><span style="color:var(--yellow)">Monthly Sales</span></th>`;
    html += `<th style="${hs}"><span style="color:var(--orange)">MOS</span></th>`;
  });
  html += `<th style="${hs}border-left:2px solid var(--border)"><span style="color:var(--green)">Available</span></th>`;
  html += `<th style="${hs}"><span style="color:var(--blue)">On Order</span></th>`;
  html += '</tr></thead>';

  // Body
  html += '<tbody>';
  const totals = {};
  ctSizes.forEach(ct => { totals[ct] = { onHand: 0, onOrder: 0, sales: 0 }; });
  let totalRawOnHand = 0, totalRawOnOrder = 0;

  flavors.forEach((flavor, i) => {
    const stripe = i % 2 === 0 ? '' : 'background:rgba(255,255,255,0.02);';
    const fid = slug(flavor);
    html += `<tr style="${stripe}border-bottom:1px solid var(--border);cursor:pointer" onclick="window.__toggleEdibleDetail('euphoria-${fid}')" id="erow-euphoria-${fid}">`;
    html += `<td style="${fs}"><span id="echev-euphoria-${fid}" style="display:inline-block;transition:transform .15s;transform:rotate(0deg);margin-right:6px;font-size:10px;color:var(--text3)">▶</span>${flavor}</td>`;

    ctSizes.forEach(ct => {
      const ctKey = ct + 'ct';
      const g = byFlavor[flavor][ctKey];
      if (g) {
        const totalSupply = g.onHand + g.onOrder;
        const mos = g.sales > 0 ? totalSupply / g.sales : 0;
        totals[ct].onHand += g.onHand;
        totals[ct].onOrder += g.onOrder;
        totals[ct].sales += g.sales;
        html += `<td style="${cs}border-left:2px solid var(--border);color:var(--green)">${fmt(g.onHand)}</td>`;
        html += `<td style="${cs}color:var(--text2)">${fmt(totalSupply)}</td>`;
        html += `<td style="${cs}color:var(--yellow)">${fmt(g.sales)}</td>`;
        html += `<td style="${cs}font-weight:600;color:${mosColor(mos)};background:${mosBg(mos)}">${mos.toFixed(1)}</td>`;
      } else {
        html += `<td style="${cs}border-left:2px solid var(--border);color:var(--text3)">—</td>`;
        html += `<td style="${cs}color:var(--text3)">—</td>`;
        html += `<td style="${cs}color:var(--text3)">—</td>`;
        html += `<td style="${cs}color:var(--text3)">—</td>`;
      }
    });

    const raw = rawByFlavor[flavor];
    if (raw) {
      totalRawOnHand += raw.onHand;
      totalRawOnOrder += raw.onOrder;
      html += `<td style="${cs}border-left:2px solid var(--border);color:var(--green)">${fmt(raw.onHand)}</td>`;
      html += `<td style="${cs}color:var(--blue)">${fmt(raw.onOrder)}</td>`;
    } else {
      html += `<td style="${cs}border-left:2px solid var(--border);color:var(--text3)">—</td>`;
      html += `<td style="${cs}color:var(--text3)">—</td>`;
    }
    html += '</tr>';

    // Detail rows — SKU breakdown
    ctSizes.forEach(ct => {
      const ctKey = ct + 'ct';
      const g = byFlavor[flavor][ctKey];
      if (!g) return;
      g.skus.sort((a, b) => {
        const ai = PACK_ORDER.indexOf(a.packType), bi = PACK_ORDER.indexOf(b.packType);
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      });
      g.skus.forEach(sku => {
        const skuTotalSupply = sku.singlesOnHand + sku.singlesOnOrder;
        const skuMos = sku.singlesSales > 0 ? skuTotalSupply / sku.singlesSales : 0;
        html += `<tr class="edetail-euphoria-${fid}" style="display:none;background:rgba(255,255,255,0.015);border-bottom:1px solid rgba(255,255,255,0.04)">`;
        html += `<td style="${fs}padding-left:36px;font-weight:400;font-size:11px;color:var(--text2)">${sku.packType}${sku.packMult > 1 ? ` <span style="color:var(--text3);font-size:9px">(${sku.onHand} packs → ${fmt(sku.singlesOnHand)} singles)</span>` : ''}</td>`;
        // Fill cells — put values under the matching ct columns
        ctSizes.forEach(colCt => {
          if (colCt === ct) {
            html += `<td style="${cs}border-left:2px solid var(--border);font-size:11px;color:var(--green)">${fmt(sku.singlesOnHand)}</td>`;
            html += `<td style="${cs}font-size:11px;color:var(--text2)">${fmt(skuTotalSupply)}</td>`;
            html += `<td style="${cs}font-size:11px;color:var(--yellow)">${fmt(sku.singlesSales)}</td>`;
            html += `<td style="${cs}font-size:11px;font-weight:600;color:${mosColor(skuMos)};background:${mosBg(skuMos)}">${skuMos.toFixed(1)}</td>`;
          } else {
            html += `<td style="${cs}border-left:2px solid var(--border)"></td><td style="${cs}"></td><td style="${cs}"></td><td style="${cs}"></td>`;
          }
        });
        html += `<td style="${cs}border-left:2px solid var(--border)"></td><td style="${cs}"></td>`;
        html += '</tr>';
      });
    });
  });
  html += '</tbody>';

  // Footer totals
  html += '<tfoot><tr style="border-top:2px solid var(--border);background:rgba(255,255,255,0.04)">';
  html += `<td style="${fs}font-weight:700">TOTAL</td>`;
  ctSizes.forEach(ct => {
    const t = totals[ct];
    const totalSupply = t.onHand + t.onOrder;
    const mos = t.sales > 0 ? totalSupply / t.sales : 0;
    html += `<td style="${cs}border-left:2px solid var(--border);font-weight:700;color:var(--green)">${fmt(t.onHand)}</td>`;
    html += `<td style="${cs}font-weight:700;color:var(--text2)">${fmt(totalSupply)}</td>`;
    html += `<td style="${cs}font-weight:700;color:var(--yellow)">${fmt(t.sales)}</td>`;
    html += `<td style="${cs}font-weight:700;color:${mosColor(mos)};background:${mosBg(mos)}">${mos.toFixed(1)}</td>`;
  });
  html += `<td style="${cs}border-left:2px solid var(--border);font-weight:700;color:var(--green)">${fmt(totalRawOnHand)}</td>`;
  html += `<td style="${cs}font-weight:700;color:var(--blue)">${fmt(totalRawOnOrder)}</td>`;
  html += '</tr></tfoot>';

  html += '</table></div></div>';
  return html;
}

function buildOtherLinesTable(edibles) {
  const cs = 'padding:8px 12px;text-align:right;font-size:12px;white-space:nowrap;';
  const hs = 'padding:8px 12px;text-align:right;font-size:10px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;white-space:nowrap;border-bottom:2px solid var(--border);';
  const fs = 'padding:8px 12px;text-align:left;font-size:12px;font-weight:500;color:var(--text);white-space:nowrap;';

  const items = edibles.filter(r => FLAVOR_LINE[r.flavor] !== 'Euphoria');

  const byFlavor = {};
  items.forEach(r => {
    if (!byFlavor[r.flavor]) byFlavor[r.flavor] = { onHand: 0, onOrder: 0, sales: 0, totalInv: 0, rawOnHand: 0, rawOnOrder: 0, skus: [] };
    const f = byFlavor[r.flavor];
    const monthlySales = (r.s90 || 0) / 3;
    if (r.packType === 'RAW') {
      f.rawOnHand += r.onHand;
      f.rawOnOrder += r.onOrder;
      f.skus.push({ id: r.id, packType: 'RAW', onHand: r.onHand, onOrder: r.onOrder, sales: monthlySales, unitOnHand: r.onHand, unitOnOrder: r.onOrder, unitSales: monthlySales });
      return;
    }
    const mult = getPiecesPerUnit(r.id, r.desc);
    const avail = r.onHand - (r.reserved || 0);
    f.onHand += avail * mult;
    f.onOrder += r.onOrder * mult;
    f.sales += monthlySales * mult;
    f.totalInv += (avail + r.onOrder) * mult;
    f.skus.push({ id: r.id, packType: r.packType || '—', onHand: avail, onOrder: r.onOrder, sales: monthlySales, unitOnHand: avail * mult, unitOnOrder: r.onOrder * mult, unitSales: monthlySales * mult });
  });

  const lineOrder = ['Froot Jam', 'Microdose', 'Crunchies', ''];
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

  let html = `<div style="overflow-x:auto;border:1px solid var(--border);border-radius:8px;background:var(--bg2)">`;
  html += `<table style="width:100%;border-collapse:collapse;font-family:Arial,sans-serif">`;
  html += '<thead><tr style="background:rgba(255,255,255,0.03)">';
  html += `<th style="${hs}text-align:left;min-width:160px">Flavor</th>`;
  html += `<th style="${hs}text-align:left">Line</th>`;
  html += `<th style="${hs}"><span style="color:var(--green)">Available</span></th>`;
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

    r.skus.forEach(sku => {
      const skuMos = sku.unitSales > 0 ? (sku.unitOnHand + sku.unitOnOrder) / sku.unitSales : 0;
      const isRaw = sku.packType === 'RAW';
      html += `<tr class="edetail-${fid}" style="display:none;background:rgba(255,255,255,0.015);border-bottom:1px solid rgba(255,255,255,0.04)">`;
      html += `<td style="${fs}padding-left:36px;font-weight:400;font-size:11px;color:var(--text2)">${sku.id}</td>`;
      html += `<td style="${cs}font-size:11px;color:var(--text3)">${sku.packType}</td>`;
      html += `<td style="${cs}font-size:11px;color:var(--green)">${fmt(sku.onHand)}${!isRaw && sku.onHand !== sku.unitOnHand ? ` <span style="color:var(--text3);font-size:9px">(${fmt(sku.unitOnHand)} pcs)</span>` : ''}</td>`;
      html += `<td style="${cs}font-size:11px;color:var(--blue)">${fmt(sku.onOrder)}${!isRaw && sku.onOrder !== sku.unitOnOrder ? ` <span style="color:var(--text3);font-size:9px">(${fmt(sku.unitOnOrder)} pcs)</span>` : ''}</td>`;
      html += `<td style="${cs}font-size:11px;color:var(--text2)">${fmt(sku.unitOnHand + sku.unitOnOrder)}</td>`;
      html += `<td style="${cs}font-size:11px;color:var(--yellow)">${fmt(sku.sales)}${!isRaw && sku.sales !== sku.unitSales ? ` <span style="color:var(--text3);font-size:9px">(${fmt(sku.unitSales)} pcs)</span>` : ''}</td>`;
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
  return html;
}

export function renderEdiblesView() {
  const container = document.getElementById('edibles-table');
  if (!container) return;

  const edibles = state.RAW_DATA.filter(r => r.cat === 'Edibles' && r.flavor && !state.removedIds.has(r.id));

  let html = buildEuphoriaTable(edibles);
  html += `<div style="margin-top:24px">`;
  html += `<div style="font-size:14px;font-weight:600;color:var(--text);margin-bottom:8px">Froot Jam · Microdose · Crunchies</div>`;
  html += buildOtherLinesTable(edibles);
  html += `</div>`;

  container.innerHTML = html;
}

window.__toggleEdibleDetail = (key) => {
  const rows = document.querySelectorAll(`.edetail-${slug(key)}`);
  const chev = document.getElementById(`echev-${slug(key)}`);
  const isOpen = rows[0]?.style.display !== 'none';
  rows.forEach(r => r.style.display = isOpen ? 'none' : 'table-row');
  if (chev) chev.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(90deg)';
};
