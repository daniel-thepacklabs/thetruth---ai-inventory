import history from '../data/valuation-history.json';
import { state } from '../data/state.js';
import { catSubcat } from '../data/parsers.js';

const $f = v => '$' + (v || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const nf = v => (v || 0).toLocaleString('en-US');
const LIVE_CAT_ORDER = ['Raw Material', 'Packaging', 'Components', 'WIP', 'Edibles', 'Marketing', 'Misc'];
const HIST_CAT_ORDER = ['Raw Material', 'Packaging', 'Components', 'WIP', 'Edibles', 'Marketing', 'Misc'];

function buildLiveValuation() {
  const raw = state.RAW_DATA || [];
  const valMap = state.VALUATION_MAP || {};
  const costMap = state.COST_MAP || {};

  const byCat = {};
  let grandTotal = 0;
  let grandQty = 0;
  let itemsWithVal = 0;
  let itemsNoVal = 0;

  for (const item of raw) {
    if (item.onHand <= 0) continue;
    const cat = item.cat || 'Misc';
    if (!byCat[cat]) byCat[cat] = { qty: 0, val: 0, subs: {} };

    const val = valMap[item.id] || (costMap[item.id] ? item.onHand * costMap[item.id] : 0);
    byCat[cat].qty += item.onHand;
    byCat[cat].val += val;
    grandTotal += val;
    grandQty += item.onHand;
    if (val > 0) itemsWithVal++; else itemsNoVal++;

    const sub = item.subcat || 'Other';
    if (!byCat[cat].subs[sub]) byCat[cat].subs[sub] = { qty: 0, val: 0, items: [] };
    byCat[cat].subs[sub].qty += item.onHand;
    byCat[cat].subs[sub].val += val;
    byCat[cat].subs[sub].items.push({ id: item.id, desc: item.desc, qty: item.onHand, val });
  }

  for (const cat of Object.values(byCat)) {
    for (const sub of Object.values(cat.subs)) {
      sub.items.sort((a, b) => b.val - a.val);
    }
  }

  return { byCat, grandTotal, grandQty, itemsWithVal, itemsNoVal };
}

export function renderValuationView() {
  const el = document.getElementById('valuation-view');
  if (!el) return;

  const live = buildLiveValuation();
  const hasLive = state.RAW_DATA && state.RAW_DATA.length > 0;
  const stickyTd = 'position:sticky;left:0;background:var(--bg, #1a1a2e);z-index:1';

  let html = `
    <div style="margin-bottom:1.5rem">
      <h2 style="margin:0;font-size:1.4rem;color:var(--text1)">Inventory Valuation</h2>
      <p style="margin:4px 0 0;font-size:0.85rem;color:var(--text3)">Live valuation from Finale (QOH × average cost)</p>
    </div>`;

  // ── Live Valuation Summary Cards ──
  if (hasLive) {
    const cats = LIVE_CAT_ORDER.filter(c => live.byCat[c]);

    html += `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:1.5rem">
      <div style="background:var(--card-bg,rgba(255,255,255,0.04));border:1px solid var(--border);border-radius:8px;padding:14px">
        <div style="font-size:0.75rem;color:var(--text3);margin-bottom:4px">TOTAL INVENTORY VALUE</div>
        <div style="font-size:1.4rem;font-weight:700;color:var(--green)">${$f(live.grandTotal)}</div>
        <div style="font-size:0.72rem;color:var(--text3);margin-top:2px">${nf(live.grandQty)} units across ${live.itemsWithVal + live.itemsNoVal} items</div>
      </div>
      ${cats.map(cat => {
        const d = live.byCat[cat];
        const pct = live.grandTotal > 0 ? ((d.val / live.grandTotal) * 100).toFixed(1) : '0';
        return `<div style="background:var(--card-bg,rgba(255,255,255,0.04));border:1px solid var(--border);border-radius:8px;padding:14px">
          <div style="font-size:0.75rem;color:var(--text3);margin-bottom:4px">${cat.toUpperCase()}</div>
          <div style="font-size:1.1rem;font-weight:600;color:var(--text1)">${$f(d.val)}</div>
          <div style="font-size:0.72rem;color:var(--text3);margin-top:2px">${pct}% · ${nf(d.qty)} units</div>
        </div>`;
      }).join('')}
    </div>`;

    // ── Live Valuation Detail Table ──
    html += `
    <h3 style="margin:0 0 10px;font-size:1rem;color:var(--text1)">Current Valuation by Category</h3>
    <div style="overflow-x:auto;margin-bottom:2rem">
    <table style="width:100%;border-collapse:collapse;font-size:0.82rem">
      <thead>
        <tr style="border-bottom:2px solid var(--border)">
          <th style="padding:8px 10px;text-align:left;color:var(--text3)">Category / Subcategory</th>
          <th style="padding:8px 10px;text-align:right;color:var(--text3)">Qty on Hand</th>
          <th style="padding:8px 10px;text-align:right;color:var(--text3)">Value</th>
          <th style="padding:8px 10px;text-align:right;color:var(--text3)">% of Total</th>
        </tr>
      </thead>
      <tbody>
        <tr style="border-bottom:2px solid var(--border);background:rgba(255,255,255,0.03)">
          <td style="padding:8px 10px;font-weight:700;color:var(--text1)">Grand Total</td>
          <td style="padding:8px 10px;text-align:right;font-weight:700;color:var(--text2)">${nf(live.grandQty)}</td>
          <td style="padding:8px 10px;text-align:right;font-weight:700;color:var(--green)">${$f(live.grandTotal)}</td>
          <td style="padding:8px 10px;text-align:right;font-weight:700;color:var(--text2)">100%</td>
        </tr>`;

    for (const cat of cats) {
      const d = live.byCat[cat];
      const pct = live.grandTotal > 0 ? ((d.val / live.grandTotal) * 100).toFixed(1) : '0';
      const catId = 'lv_' + cat.replace(/\s+/g, '_');
      const subs = Object.entries(d.subs).sort((a, b) => b[1].val - a[1].val);

      html += `
        <tr style="border-bottom:1px solid var(--border);cursor:pointer" onclick="toggleLiveCat('${catId}')">
          <td style="padding:8px 10px;font-weight:600;color:var(--text1)">
            <span style="display:inline-flex;align-items:center;gap:6px">
              <span id="lv-arrow-${catId}" style="color:var(--text3);font-size:0.65rem;width:10px">▶</span>
              ${cat}
            </span>
          </td>
          <td style="padding:8px 10px;text-align:right;color:var(--text2)">${nf(d.qty)}</td>
          <td style="padding:8px 10px;text-align:right;font-weight:500;color:var(--text1)">${$f(d.val)}</td>
          <td style="padding:8px 10px;text-align:right;color:var(--text2)">${pct}%</td>
        </tr>`;

      for (const [sub, sd] of subs) {
        const subId = catId + '__' + sub.replace(/[^a-zA-Z0-9]/g, '_');
        const subPct = live.grandTotal > 0 ? ((sd.val / live.grandTotal) * 100).toFixed(1) : '0';

        html += `
        <tr class="lv-sub-${catId}" style="display:none;border-bottom:1px solid var(--border);background:rgba(255,255,255,0.02);cursor:pointer" onclick="event.stopPropagation();toggleLiveSub('${subId}')">
          <td style="padding:6px 10px 6px 32px;color:var(--text2);font-size:0.78rem">
            <span style="display:inline-flex;align-items:center;gap:6px">
              <span id="lv-arrow-${subId}" style="color:var(--text3);font-size:0.6rem;width:8px">▶</span>
              ${sub}
            </span>
          </td>
          <td style="padding:6px 10px;text-align:right;color:var(--text3);font-size:0.78rem">${nf(sd.qty)}</td>
          <td style="padding:6px 10px;text-align:right;color:var(--text2);font-size:0.78rem">${$f(sd.val)}</td>
          <td style="padding:6px 10px;text-align:right;color:var(--text3);font-size:0.78rem">${subPct}%</td>
        </tr>`;

        for (const item of sd.items) {
          html += `
        <tr class="lv-prod-${subId}" style="display:none;border-bottom:1px solid rgba(255,255,255,0.02);background:rgba(255,255,255,0.01)">
          <td style="padding:4px 10px 4px 52px;color:var(--text3);font-size:0.72rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:280px" title="${item.desc}">${item.id} <span style="color:var(--text3);opacity:0.6">— ${item.desc}</span></td>
          <td style="padding:4px 10px;text-align:right;color:var(--text3);font-size:0.72rem">${nf(item.qty)}</td>
          <td style="padding:4px 10px;text-align:right;color:var(--text3);font-size:0.72rem">${item.val > 0 ? $f(item.val) : '<span style="color:var(--red)">no cost</span>'}</td>
          <td style="padding:4px 10px;text-align:right;color:var(--text3);font-size:0.72rem"></td>
        </tr>`;
        }
      }
    }

    html += `
      </tbody>
    </table>
    </div>`;

    if (live.itemsNoVal > 0) {
      html += `<div style="background:rgba(255,165,0,0.08);border:1px solid rgba(255,165,0,0.2);border-radius:8px;padding:10px 14px;margin-bottom:1.5rem;font-size:0.8rem;color:var(--orange)">${live.itemsNoVal} items have stock but no cost data — total may be understated.</div>`;
    }
  } else {
    html += `<div style="background:var(--card-bg,rgba(255,255,255,0.04));border:1px solid var(--border);border-radius:8px;padding:20px;text-align:center;color:var(--text3);margin-bottom:1.5rem">Sync Finale to see live valuation</div>`;
  }

  // ── Historical Valuation Table ──
  const months = Object.keys(history).sort();
  if (months.length > 0) {
    const allSubs = {};
    const allProds = {};
    for (const cat of HIST_CAT_ORDER) {
      const subs = new Set();
      for (const m of months) {
        const cd = history[m].c[cat];
        if (cd) Object.keys(cd).forEach(s => subs.add(s));
      }
      const last = months[months.length - 1];
      allSubs[cat] = [...subs].sort((a, b) => {
        const aVal = history[last].c[cat]?.[a]?.[1] || 0;
        const bVal = history[last].c[cat]?.[b]?.[1] || 0;
        return bVal - aVal;
      });
      allProds[cat] = {};
      for (const sub of allSubs[cat]) {
        const prods = new Set();
        for (const m of months) {
          const sd = history[m].c[cat]?.[sub];
          if (sd && sd[2]) Object.keys(sd[2]).forEach(p => prods.add(p));
        }
        allProds[cat][sub] = [...prods].sort((a, b) => {
          const aVal = history[last].c[cat]?.[sub]?.[2]?.[a]?.[1] || 0;
          const bVal = history[last].c[cat]?.[sub]?.[2]?.[b]?.[1] || 0;
          return bVal - aVal;
        });
      }
    }

    html += `
    <h3 style="margin:0 0 10px;font-size:1rem;color:var(--text1)">Historical Trend (End-of-Month)</h3>
    <div style="overflow-x:auto">
    <table style="width:100%;border-collapse:collapse;font-size:0.8rem;min-width:${months.length * 120 + 200}px">
      <thead>
        <tr style="border-bottom:2px solid var(--border)">
          <th style="padding:6px 10px;text-align:left;color:var(--text3);font-weight:600;${stickyTd};z-index:3;min-width:180px"></th>
          ${months.map(m => `<th colspan="2" style="padding:6px 6px;text-align:center;color:var(--text3);font-weight:600;border-bottom:1px solid var(--border);font-size:0.78rem">${history[m].l}</th>`).join('')}
        </tr>
        <tr style="border-bottom:1px solid var(--border)">
          <th style="padding:4px 10px;${stickyTd};z-index:3"></th>
          ${months.map(() => `<th style="padding:4px 6px;text-align:right;color:var(--text3);font-weight:500;font-size:0.7rem">Qty</th><th style="padding:4px 6px;text-align:right;color:var(--text3);font-weight:500;font-size:0.7rem">Value</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        <tr style="border-bottom:1px solid var(--border);background:rgba(255,255,255,0.03)">
          <td style="padding:8px 10px;font-weight:700;color:var(--text1);${stickyTd}">Grand Total</td>
          ${months.map(m => `<td style="padding:8px 6px;text-align:right;font-weight:700;color:var(--text2)">${nf(Object.values(history[m].c).reduce((s, subs) => s + Object.values(subs).reduce((ss, sd) => ss + sd[0], 0), 0))}</td><td style="padding:8px 6px;text-align:right;font-weight:700;color:var(--green)">${$f(history[m].g)}</td>`).join('')}
        </tr>`;

    for (const cat of HIST_CAT_ORDER) {
      const catId = cat.replace(/\s+/g, '_');
      const hasSubs = allSubs[cat].length > 0;

      html += `
        <tr style="border-bottom:1px solid var(--border);${hasSubs ? 'cursor:pointer' : ''}" ${hasSubs ? `onclick="toggleValCat('${catId}')"` : ''}>
          <td style="padding:8px 10px;font-weight:600;color:var(--text1);${stickyTd}">
            <span style="display:inline-flex;align-items:center;gap:6px">
              ${hasSubs ? `<span id="val-arrow-${catId}" style="color:var(--text3);font-size:0.65rem;width:10px">▶</span>` : '<span style="width:10px"></span>'}
              ${cat}
            </span>
          </td>
          ${months.map(m => {
            const cd = history[m].c[cat];
            const qty = cd ? Object.values(cd).reduce((s, sd) => s + sd[0], 0) : 0;
            const val = cd ? Object.values(cd).reduce((s, sd) => s + sd[1], 0) : 0;
            return `<td style="padding:8px 6px;text-align:right;color:var(--text2)">${nf(qty)}</td><td style="padding:8px 6px;text-align:right;font-weight:500;color:var(--text1)">${$f(val)}</td>`;
          }).join('')}
        </tr>`;

      if (hasSubs) {
        for (const sub of allSubs[cat]) {
          const subId = `${catId}__${sub.replace(/[^a-zA-Z0-9]/g, '_')}`;
          const hasProds = allProds[cat][sub].length > 0;

          html += `
        <tr class="val-sub-${catId}" style="display:none;border-bottom:1px solid var(--border);background:rgba(255,255,255,0.02);${hasProds ? 'cursor:pointer' : ''}" ${hasProds ? `onclick="event.stopPropagation();toggleValProd('${subId}')"` : ''}>
          <td style="padding:6px 10px 6px 32px;color:var(--text2);font-size:0.78rem;${stickyTd}">
            <span style="display:inline-flex;align-items:center;gap:6px">
              ${hasProds ? `<span id="val-arrow-${subId}" style="color:var(--text3);font-size:0.6rem;width:8px">▶</span>` : '<span style="width:8px"></span>'}
              ${sub}
            </span>
          </td>
          ${months.map(m => {
            const sd = history[m].c[cat]?.[sub];
            const sq = sd ? sd[0] : 0;
            const sv = sd ? sd[1] : 0;
            return `<td style="padding:6px 6px;text-align:right;color:var(--text3);font-size:0.78rem">${sq ? nf(sq) : '-'}</td><td style="padding:6px 6px;text-align:right;color:var(--text2);font-size:0.78rem">${sv ? $f(sv) : '-'}</td>`;
          }).join('')}
        </tr>`;

          if (hasProds) {
            for (const prod of allProds[cat][sub]) {
              html += `
        <tr class="val-prod-${subId}" style="display:none;border-bottom:1px solid rgba(255,255,255,0.02);background:rgba(255,255,255,0.01)">
          <td style="padding:4px 10px 4px 52px;color:var(--text3);font-size:0.72rem;${stickyTd};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px" title="${prod}">${prod}</td>
          ${months.map(m => {
            const pd = history[m].c[cat]?.[sub]?.[2]?.[prod];
            const pq = pd ? pd[0] : 0;
            const pv = pd ? pd[1] : 0;
            return `<td style="padding:4px 6px;text-align:right;color:var(--text3);font-size:0.72rem">${pq ? nf(pq) : '-'}</td><td style="padding:4px 6px;text-align:right;color:var(--text3);font-size:0.72rem">${pv ? $f(pv) : '-'}</td>`;
          }).join('')}
        </tr>`;
            }
          }
        }
      }
    }

    html += `
      </tbody>
    </table>
    </div>`;
  }

  el.innerHTML = html;
}

window.toggleLiveCat = function(catId) {
  const rows = document.querySelectorAll(`.lv-sub-${catId}`);
  const arrow = document.getElementById(`lv-arrow-${catId}`);
  const showing = rows[0]?.style.display !== 'none';
  rows.forEach(r => r.style.display = showing ? 'none' : '');
  if (arrow) arrow.textContent = showing ? '▶' : '▼';
  if (showing) {
    document.querySelectorAll(`[class^="lv-prod-${catId}__"]`).forEach(r => r.style.display = 'none');
    document.querySelectorAll(`[id^="lv-arrow-${catId}__"]`).forEach(a => a.textContent = '▶');
  }
};

window.toggleLiveSub = function(subId) {
  const rows = document.querySelectorAll(`.lv-prod-${subId}`);
  const arrow = document.getElementById(`lv-arrow-${subId}`);
  const showing = rows[0]?.style.display !== 'none';
  rows.forEach(r => r.style.display = showing ? 'none' : '');
  if (arrow) arrow.textContent = showing ? '▶' : '▼';
};

window.toggleValCat = function(catId) {
  const rows = document.querySelectorAll(`.val-sub-${catId}`);
  const arrow = document.getElementById(`val-arrow-${catId}`);
  const showing = rows[0]?.style.display !== 'none';
  rows.forEach(r => r.style.display = showing ? 'none' : '');
  if (arrow) arrow.textContent = showing ? '▶' : '▼';
  if (showing) {
    document.querySelectorAll(`[class^="val-prod-${catId}__"]`).forEach(r => r.style.display = 'none');
    document.querySelectorAll(`[id^="val-arrow-${catId}__"]`).forEach(a => a.textContent = '▶');
  }
};

window.toggleValProd = function(subId) {
  const rows = document.querySelectorAll(`.val-prod-${subId}`);
  const arrow = document.getElementById(`val-arrow-${subId}`);
  const showing = rows[0]?.style.display !== 'none';
  rows.forEach(r => r.style.display = showing ? 'none' : '');
  if (arrow) arrow.textContent = showing ? '▶' : '▼';
};
