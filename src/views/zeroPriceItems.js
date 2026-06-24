import { state } from '../data/state.js';
import { buildCogsLookup } from './cogs.js';
import { getSalesProductType, getPackSize } from '../data/parsers.js';
import data2026 from '../data/zero-price-2026.json';
import dataPre2026 from '../data/zero-price-pre2026.json';
import marketingPids from '../data/marketing-pids.json';
import priceMaps from '../data/price-maps.json';

const $f = v => '$' + (v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const MONTH_NAMES = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const WHOLESALE_SOURCES = new Set([
  'Dropshipping', 'Hemper Drop Ship', 'HS Wholesale Dropshipping',
  'LAVapor Dropshipping', 'Wholesale Zoey', 'Vape Ranger Drop Shipping'
]);

const MKT_SET = new Set(marketingPids);
const _filterState = { year: '', month: '', channel: '', mkt: 'all' };

function isMarketing(pid) {
  if (MKT_SET.has(pid)) return true;
  if (pid.startsWith('MM-') || pid.startsWith('IM-') || pid.startsWith('TPLM-')) return true;
  return false;
}

function classifySource(source) {
  return WHOLESALE_SOURCES.has(source) ? 'Wholesale' : 'Ecomm';
}

function fmtMonth(period) {
  const [y, m] = period.split('-');
  return MONTH_NAMES[parseInt(m)] + ' ' + y;
}

function matchSkuPattern(pid, pattern) {
  const re = new RegExp('^' + pattern.replace(/[.*+?^${}()|[\]\\]/g, m => m === '*' ? '.*' : '\\' + m) + '$');
  return re.test(pid);
}

function pickCost(costs, pid) {
  const packSize = getPackSize(pid);
  return packSize > 1 ? costs.packCost : costs.singleCost;
}

function isEuphoria20ct(pid, desc) {
  const mgMatch = pid.match(/^EG[A-Z]+-(\d+)-/);
  if (mgMatch) {
    const mg = parseInt(mgMatch[1]);
    if (mg >= 400) return true;
  }
  if (desc) {
    const d = desc.toLowerCase();
    if (d.includes('20ct') || d.includes('20pc')) return true;
  }
  return false;
}

function getSkuCost(cogsLookup, pid, desc) {
  const [type, subtype] = getSalesProductType(pid, desc || '');
  if (pid.startsWith('EG') && subtype && subtype.includes('Euphoria')) {
    const is20 = isEuphoria20ct(pid, desc);
    const variantKey = is20 ? subtype + '|20ct' : subtype;
    if (cogsLookup[variantKey]) return pickCost(cogsLookup[variantKey], pid);
    if (cogsLookup[subtype]) return pickCost(cogsLookup[subtype], pid);
  }
  const skuMap = cogsLookup._skuMap || {};
  for (const [pattern, costs] of Object.entries(skuMap)) {
    if (matchSkuPattern(pid, pattern)) return pickCost(costs, pid);
  }
  if (type === 'Edibles') {
    if (cogsLookup[subtype]) return pickCost(cogsLookup[subtype], pid);
  }
  const entry = cogsLookup[subtype];
  if (entry) return pickCost(entry, pid);
  const costMap = state.COST_MAP || {};
  return parseFloat(costMap[pid]) || 0;
}

function derivePackPrice(pid, maps) {
  const packSuffixes = [
    ['-10PK', 10], ['-5PK', 5], ['-8PK', 8], ['-6PK', 6], ['-2PK', 2],
  ];
  const base = pid.replace(/-01$/, '');
  for (const [suffix, size] of packSuffixes) {
    const packPid = base + suffix;
    for (const map of maps) {
      if (map[packPid]) return map[packPid] / size;
    }
  }
  return 0;
}

function getSkuPrice(pid) {
  if (isMarketing(pid)) return 0;
  const shopify = priceMaps.shopify || {};
  const wholesale = priceMaps.wholesale || {};
  const sShopify = state.SHOPIFY_PRICE_MAP || {};
  const sWholesale = state.WHOLESALE_PRICE_MAP || {};
  if (shopify[pid]) return shopify[pid];
  if (wholesale[pid]) return wholesale[pid];
  if (sShopify[pid]) return sShopify[pid];
  if (sWholesale[pid]) return sWholesale[pid];
  const packSize = getPackSize(pid);
  if (packSize > 1) {
    const singlePid = pid.replace(/-\d+PK$/, '-01');
    if (shopify[singlePid]) return shopify[singlePid] * packSize;
    if (wholesale[singlePid]) return wholesale[singlePid] * packSize;
    if (sShopify[singlePid]) return sShopify[singlePid] * packSize;
    if (sWholesale[singlePid]) return sWholesale[singlePid] * packSize;
  }
  if (pid.endsWith('-01')) {
    const derived = derivePackPrice(pid, [shopify, wholesale, sShopify, sWholesale]);
    if (derived) return derived;
  }
  return 0;
}

let _allData = null;
let _skuIndex = null;

function getAllData() {
  if (_allData) return _allData;
  _allData = [...dataPre2026, ...data2026];
  _skuIndex = {};
  _allData.forEach(entry => {
    const key = `${entry.source}|${entry.month}`;
    _skuIndex[key] = entry.skus || [];
  });
  return _allData;
}

function computeFiltered(allData, cogsLookup, filters) {
  const { year, month, channel, mkt } = filters;
  const byChannelSourceMonth = {};
  let totalQty = 0, totalCost = 0, totalPotentialRev = 0;

  allData.forEach(entry => {
    if (!entry.month) return;
    if (year && !entry.month.startsWith(year)) return;
    if (month && entry.month.slice(5,7) !== month) return;
    const ch = classifySource(entry.source);
    if (channel && ch !== channel) return;

    const key = `${ch}|${entry.source}|${entry.month}`;
    if (!byChannelSourceMonth[key]) byChannelSourceMonth[key] = { qty: 0, cost: 0, potentialRev: 0 };
    const bucket = byChannelSourceMonth[key];

    (entry.skus || []).forEach(sku => {
      const isMkt = sku.mkt || isMarketing(sku.pid);
      if (mkt === 'products' && isMkt) return;
      if (mkt === 'marketing' && !isMkt) return;
      bucket.qty += sku.qty;
      bucket.cost += getSkuCost(cogsLookup, sku.pid, sku.desc) * sku.qty;
      bucket.potentialRev += getSkuPrice(sku.pid) * sku.qty;
    });
  });

  const channels = {};
  Object.entries(byChannelSourceMonth).forEach(([key, val]) => {
    if (val.qty === 0) return;
    const [ch, source, mo] = key.split('|');
    if (!channels[ch]) channels[ch] = {};
    if (!channels[ch][source]) channels[ch][source] = {};
    channels[ch][source][mo] = val;
    totalQty += val.qty;
    totalCost += val.cost;
    totalPotentialRev += val.potentialRev;
  });

  return { channels, totalQty, totalCost, totalPotentialRev };
}

export function renderZeroPriceView() {
  const container = document.getElementById('zeroprice-view');
  if (!container) return;

  const allData = getAllData();
  const cogsLookup = buildCogsLookup();

  const allMonths = [...new Set(allData.map(d => d.month).filter(Boolean))].sort();
  const years = [...new Set(allMonths.map(m => m.slice(0, 4)))].sort();

  const computed = computeFiltered(allData, cogsLookup, _filterState);

  const selStyle = 'padding:4px 8px;background:var(--bg3);border:1px solid var(--border2);border-radius:var(--r);color:var(--text);font-size:12px';

  let html = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;flex-wrap:wrap;gap:.5rem">
      <div>
        <div style="font-size:15px;font-weight:500;color:var(--text)">Zero Unit Price Items</div>
        <div style="font-size:12px;color:var(--text3)">Orders where unit price = $0 — broken down by channel and source. Click a month row to see SKU breakdown.</div>
      </div>
    </div>

    <div id="zp-kpis" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:.75rem;margin-bottom:1.5rem">
      <div style="background:var(--bg3);padding:.75rem 1rem;border-radius:var(--r);border:1px solid var(--border)">
        <div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px">Total Units Given Away</div>
        <div style="font-size:20px;font-weight:600;color:var(--red);margin-top:4px" id="zp-kpi-units">${computed.totalQty.toLocaleString()}</div>
      </div>
      <div style="background:var(--bg3);padding:.75rem 1rem;border-radius:var(--r);border:1px solid var(--border)">
        <div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px">Our Cost (COGS)</div>
        <div style="font-size:20px;font-weight:600;color:var(--orange);margin-top:4px" id="zp-kpi-cost">${$f(computed.totalCost)}</div>
      </div>
      <div style="background:var(--bg3);padding:.75rem 1rem;border-radius:var(--r);border:1px solid var(--border)">
        <div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px">Potential Revenue Lost</div>
        <div style="font-size:20px;font-weight:600;color:var(--red);margin-top:4px" id="zp-kpi-rev">${$f(computed.totalPotentialRev)}</div>
      </div>
    </div>

    <div style="display:flex;gap:.5rem;margin-bottom:1rem;align-items:center;flex-wrap:wrap">
      <select id="zp-filter-year" style="${selStyle}">
        <option value="">All Years</option>
        ${years.map(y => `<option value="${y}"${_filterState.year === y ? ' selected' : ''}>${y}</option>`).join('')}
      </select>
      <select id="zp-filter-month" style="${selStyle}">
        <option value="">All Months</option>
        ${Array.from({length:12},(_,i) => { const v = String(i+1).padStart(2,'0'); return `<option value="${v}"${_filterState.month === v ? ' selected' : ''}>${MONTH_NAMES[i+1]}</option>`; }).join('')}
      </select>
      <select id="zp-filter-channel" style="${selStyle}">
        <option value="">All Channels</option>
        <option value="Ecomm"${_filterState.channel === 'Ecomm' ? ' selected' : ''}>Ecomm</option>
        <option value="Wholesale"${_filterState.channel === 'Wholesale' ? ' selected' : ''}>Wholesale</option>
      </select>
      <select id="zp-filter-mkt" style="${selStyle}">
        <option value="all"${_filterState.mkt === 'all' ? ' selected' : ''}>All Items</option>
        <option value="products"${_filterState.mkt === 'products' ? ' selected' : ''}>Products Only</option>
        <option value="marketing"${_filterState.mkt === 'marketing' ? ' selected' : ''}>Marketing Only</option>
      </select>
      <button id="zp-reset-btn" style="padding:4px 10px;background:var(--bg3);border:1px solid var(--border2);border-radius:var(--r);color:var(--text3);font-size:11px;cursor:pointer;display:${(_filterState.year || _filterState.month || _filterState.channel || _filterState.mkt !== 'all') ? 'inline-block' : 'none'}">Reset Filters</button>
    </div>

    <div id="zp-tables"></div>
  `;

  container.innerHTML = html;

  const refresh = () => {
    _filterState.year = document.getElementById('zp-filter-year').value;
    _filterState.month = document.getElementById('zp-filter-month').value;
    _filterState.channel = document.getElementById('zp-filter-channel').value;
    _filterState.mkt = document.getElementById('zp-filter-mkt').value;
    const c = computeFiltered(allData, cogsLookup, _filterState);
    document.getElementById('zp-kpi-units').textContent = c.totalQty.toLocaleString();
    document.getElementById('zp-kpi-cost').textContent = $f(c.totalCost);
    document.getElementById('zp-kpi-rev').textContent = $f(c.totalPotentialRev);
    const resetBtn = document.getElementById('zp-reset-btn');
    resetBtn.style.display = (_filterState.year || _filterState.month || _filterState.channel || _filterState.mkt !== 'all') ? 'inline-block' : 'none';
    renderTables(c.channels, cogsLookup, _filterState.mkt);
  };

  document.getElementById('zp-filter-year').onchange = refresh;
  document.getElementById('zp-filter-month').onchange = refresh;
  document.getElementById('zp-filter-channel').onchange = refresh;
  document.getElementById('zp-filter-mkt').onchange = refresh;
  document.getElementById('zp-reset-btn').onclick = () => {
    _filterState.year = ''; _filterState.month = ''; _filterState.channel = ''; _filterState.mkt = 'all';
    document.getElementById('zp-filter-year').value = '';
    document.getElementById('zp-filter-month').value = '';
    document.getElementById('zp-filter-channel').value = '';
    document.getElementById('zp-filter-mkt').value = 'all';
    refresh();
  };

  renderTables(computed.channels, cogsLookup, _filterState.mkt);
}

function renderTables(channels, cogsLookup, mktFilter) {
  const target = document.getElementById('zp-tables');
  let html = '';
  const channelOrder = _filterState.channel ? [_filterState.channel] : ['Ecomm', 'Wholesale'];

  channelOrder.forEach(channel => {
    if (!channels[channel]) return;
    const sources = channels[channel];

    const sourceAgg = {};
    let channelTotalQty = 0, channelTotalCost = 0, channelTotalRev = 0;

    Object.entries(sources).forEach(([source, monthData]) => {
      if (!sourceAgg[source]) sourceAgg[source] = { byMonth: {}, totalQty: 0, totalCost: 0, totalRev: 0 };
      Object.entries(monthData).forEach(([m, d]) => {
        sourceAgg[source].byMonth[m] = d;
        sourceAgg[source].totalQty += d.qty;
        sourceAgg[source].totalCost += d.cost;
        sourceAgg[source].totalRev += d.potentialRev;
      });
      channelTotalQty += sourceAgg[source].totalQty;
      channelTotalCost += sourceAgg[source].totalCost;
      channelTotalRev += sourceAgg[source].totalRev;
    });

    if (channelTotalQty === 0) return;

    const chColor = channel === 'Wholesale' ? 'var(--purple)' : 'var(--blue)';

    html += `
      <div style="margin-bottom:2rem">
        <div style="font-size:14px;font-weight:600;color:${chColor};margin-bottom:.5rem;display:flex;align-items:center;gap:8px">
          <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${chColor}"></span>
          ${channel}
          <span style="font-size:11px;color:var(--text3);font-weight:400">${channelTotalQty.toLocaleString()} units · ${$f(channelTotalCost)} cost · ${$f(channelTotalRev)} potential rev</span>
        </div>
        <div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;font-size:12px">
            <thead>
              <tr style="background:var(--bg3);border-bottom:2px solid var(--border2)">
                <th style="padding:.5rem .75rem;text-align:left;color:var(--text3);font-weight:500">Source</th>
                <th style="padding:.5rem .75rem;text-align:left;color:var(--text3);font-weight:500">Month</th>
                <th style="padding:.5rem .75rem;text-align:right;color:var(--text3);font-weight:500">Units</th>
                <th style="padding:.5rem .75rem;text-align:right;color:var(--text3);font-weight:500">Our Cost</th>
                <th style="padding:.5rem .75rem;text-align:right;color:var(--text3);font-weight:500">Potential Revenue</th>
              </tr>
            </thead>
            <tbody>`;

    const sortedSources = Object.entries(sourceAgg)
      .filter(([,v]) => v.totalQty > 0)
      .sort((a,b) => b[1].totalQty - a[1].totalQty);

    sortedSources.forEach(([source, data]) => {
      const sortedMonths = Object.entries(data.byMonth).sort((a,b) => b[0].localeCompare(a[0]));

      html += `<tr style="background:var(--bg2);border-top:1px solid var(--border2)">
        <td colspan="2" style="padding:.5rem .75rem;font-weight:600;color:var(--text)">${source}</td>
        <td style="padding:.5rem .75rem;text-align:right;font-weight:600;font-family:var(--font-mono);color:var(--text)">${data.totalQty.toLocaleString()}</td>
        <td style="padding:.5rem .75rem;text-align:right;font-weight:600;font-family:var(--font-mono);color:var(--orange)">${$f(data.totalCost)}</td>
        <td style="padding:.5rem .75rem;text-align:right;font-weight:600;font-family:var(--font-mono);color:var(--green)">${$f(data.totalRev)}</td>
      </tr>`;

      sortedMonths.forEach(([m, mv]) => {
        const rowId = `zp-${source.replace(/\s+/g, '_')}-${m}`;
        html += `<tr style="border-bottom:1px solid var(--border);cursor:pointer" onclick="window._zpToggle('${rowId}','${source}','${m}')" title="Click to expand SKU breakdown">
          <td style="padding:.4rem .75rem"><span id="zp-arrow-${rowId}" style="font-size:10px;color:var(--text3)">&#9654;</span></td>
          <td style="padding:.4rem .75rem;color:var(--text2)">${fmtMonth(m)}</td>
          <td style="padding:.4rem .75rem;text-align:right;font-family:var(--font-mono)">${mv.qty.toLocaleString()}</td>
          <td style="padding:.4rem .75rem;text-align:right;font-family:var(--font-mono);color:var(--orange)">${$f(mv.cost)}</td>
          <td style="padding:.4rem .75rem;text-align:right;font-family:var(--font-mono);color:var(--green)">${$f(mv.potentialRev)}</td>
        </tr>`;
        html += `<tr id="zp-detail-${rowId}" style="display:none"><td colspan="5" style="padding:0"></td></tr>`;
      });
    });

    html += `<tr style="background:var(--bg3);border-top:2px solid var(--border2)">
      <td colspan="2" style="padding:.5rem .75rem;font-weight:700;color:var(--accent)">${channel} TOTAL</td>
      <td style="padding:.5rem .75rem;text-align:right;font-weight:700;font-family:var(--font-mono);color:var(--text)">${channelTotalQty.toLocaleString()}</td>
      <td style="padding:.5rem .75rem;text-align:right;font-weight:700;font-family:var(--font-mono);color:var(--orange)">${$f(channelTotalCost)}</td>
      <td style="padding:.5rem .75rem;text-align:right;font-weight:700;font-family:var(--font-mono);color:var(--green)">${$f(channelTotalRev)}</td>
    </tr>`;

    html += `</tbody></table></div></div>`;
  });

  target.innerHTML = html;

  window._zpToggle = (rowId, source, month) => {
    const detailRow = document.getElementById('zp-detail-' + rowId);
    const arrow = document.getElementById('zp-arrow-' + rowId);
    if (!detailRow) return;

    if (detailRow.style.display !== 'none') {
      detailRow.style.display = 'none';
      if (arrow) arrow.innerHTML = '&#9654;';
      return;
    }

    const skus = _skuIndex[`${source}|${month}`] || [];
    const skuRows = skus
      .filter(sku => {
        const isMkt = sku.mkt || isMarketing(sku.pid);
        if (mktFilter === 'products' && isMkt) return false;
        if (mktFilter === 'marketing' && !isMkt) return false;
        return true;
      })
      .map(sku => {
        const mkt = sku.mkt || isMarketing(sku.pid);
        const unitCost = getSkuCost(cogsLookup, sku.pid, sku.desc);
        const unitPrice = mkt ? 0 : getSkuPrice(sku.pid);
        const totalCost = unitCost * sku.qty;
        const totalRev = unitPrice * sku.qty;
        return { ...sku, mkt, unitCost, unitPrice, totalCost, totalRev };
      }).sort((a, b) => b.qty - a.qty);

    let skuHtml = `<div style="padding:.25rem .75rem .5rem 2rem;background:var(--bg2)">
      <table style="width:100%;border-collapse:collapse;font-size:11px">
        <thead>
          <tr style="border-bottom:1px solid var(--border)">
            <th style="padding:.3rem .5rem;text-align:left;color:var(--text3);font-weight:500">SKU</th>
            <th style="padding:.3rem .5rem;text-align:left;color:var(--text3);font-weight:500">Description</th>
            <th style="padding:.3rem .5rem;text-align:center;color:var(--text3);font-weight:500">Type</th>
            <th style="padding:.3rem .5rem;text-align:right;color:var(--text3);font-weight:500">Qty</th>
            <th style="padding:.3rem .5rem;text-align:right;color:var(--text3);font-weight:500">Unit Cost</th>
            <th style="padding:.3rem .5rem;text-align:right;color:var(--text3);font-weight:500">Total Cost</th>
            <th style="padding:.3rem .5rem;text-align:right;color:var(--text3);font-weight:500">Unit Price</th>
            <th style="padding:.3rem .5rem;text-align:right;color:var(--text3);font-weight:500">Potential Rev</th>
          </tr>
        </thead>
        <tbody>`;

    skuRows.forEach(s => {
      const typeLabel = s.mkt
        ? '<span style="background:var(--purple);color:#fff;padding:1px 6px;border-radius:3px;font-size:9px">MKT</span>'
        : '<span style="font-size:9px;color:var(--text3)">Product</span>';
      skuHtml += `<tr style="border-bottom:1px solid var(--border)">
        <td style="padding:.25rem .5rem;font-family:var(--font-mono);color:var(--accent)">${s.pid}</td>
        <td style="padding:.25rem .5rem;color:var(--text2);max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${s.desc || ''}</td>
        <td style="padding:.25rem .5rem;text-align:center">${typeLabel}</td>
        <td style="padding:.25rem .5rem;text-align:right;font-family:var(--font-mono)">${s.qty.toLocaleString()}</td>
        <td style="padding:.25rem .5rem;text-align:right;font-family:var(--font-mono);color:${s.unitCost > 0 ? 'var(--orange)' : 'var(--text3)'}">${s.unitCost > 0 ? $f(s.unitCost) : '—'}</td>
        <td style="padding:.25rem .5rem;text-align:right;font-family:var(--font-mono);color:var(--orange)">${s.totalCost > 0 ? $f(s.totalCost) : '—'}</td>
        <td style="padding:.25rem .5rem;text-align:right;font-family:var(--font-mono);color:${s.unitPrice > 0 ? 'var(--green)' : 'var(--text3)'}">${s.unitPrice > 0 ? $f(s.unitPrice) : '—'}</td>
        <td style="padding:.25rem .5rem;text-align:right;font-family:var(--font-mono);color:var(--green)">${s.totalRev > 0 ? $f(s.totalRev) : '—'}</td>
      </tr>`;
    });

    const totCost = skuRows.reduce((s, r) => s + r.totalCost, 0);
    const totRev = skuRows.reduce((s, r) => s + r.totalRev, 0);
    const totQty = skuRows.reduce((s, r) => s + r.qty, 0);
    const mktQty = skuRows.filter(r => r.mkt).reduce((s, r) => s + r.qty, 0);
    skuHtml += `<tr style="border-top:1px solid var(--border2);font-weight:600">
      <td colspan="2" style="padding:.3rem .5rem;color:var(--text3)">${skuRows.length} SKUs${mktQty > 0 ? ` (${mktQty.toLocaleString()} mkt units)` : ''}</td>
      <td style="padding:.3rem .5rem"></td>
      <td style="padding:.3rem .5rem;text-align:right;font-family:var(--font-mono)">${totQty.toLocaleString()}</td>
      <td style="padding:.3rem .5rem"></td>
      <td style="padding:.3rem .5rem;text-align:right;font-family:var(--font-mono);color:var(--orange)">${$f(totCost)}</td>
      <td style="padding:.3rem .5rem"></td>
      <td style="padding:.3rem .5rem;text-align:right;font-family:var(--font-mono);color:var(--green)">${$f(totRev)}</td>
    </tr>`;

    skuHtml += `</tbody></table></div>`;

    detailRow.querySelector('td').innerHTML = skuHtml;
    detailRow.style.display = '';
    if (arrow) arrow.innerHTML = '&#9660;';
  };
}
