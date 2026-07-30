import history from '../data/valuation-history.json';

const $f = v => '$' + (v || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const nf = v => (v || 0).toLocaleString('en-US');
const CAT_ORDER = ['RAW MATERIALS', 'FINISHED GOODS', 'WIP', 'MARKETING', 'NON-INVENTORY'];

export function renderValuationView() {
  const el = document.getElementById('valuation-view');
  if (!el) return;

  const months = Object.keys(history).sort();

  const allSubs = {};
  const allProds = {};
  for (const cat of CAT_ORDER) {
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

  const thStyle = 'padding:6px 6px;text-align:right;color:var(--text3);font-weight:600;min-width:100px;font-size:0.75rem';
  const stickyTd = 'position:sticky;left:0;background:var(--bg, #1a1a2e);z-index:1';

  let html = `
    <div style="margin-bottom:1rem">
      <h2 style="margin:0;font-size:1.4rem;color:var(--text1)">Inventory Valuation</h2>
      <p style="margin:4px 0 0;font-size:0.85rem;color:var(--text3)">End-of-month inventory valued at average cost (Finale)</p>
    </div>
    <div style="overflow-x:auto">
    <table style="width:100%;border-collapse:collapse;font-size:0.8rem;min-width:${months.length * 120 + 200}px">
      <thead>
        <tr style="border-bottom:2px solid var(--border)">
          <th style="padding:6px 10px;text-align:left;color:var(--text3);font-weight:600;${stickyTd};z-index:3;min-width:180px"></th>
          ${months.map(m => `<th colspan="2" style="padding:6px 6px;text-align:center;color:var(--text3);font-weight:600;border-bottom:1px solid var(--border);font-size:0.78rem">${history[m].l}</th>`).join('')}
        </tr>
        <tr style="border-bottom:1px solid var(--border)">
          <th style="padding:4px 10px;text-align:left;color:var(--text3);font-weight:500;font-size:0.7rem;${stickyTd};z-index:3"></th>
          ${months.map(() => `<th style="padding:4px 6px;text-align:right;color:var(--text3);font-weight:500;font-size:0.7rem">Qty</th><th style="padding:4px 6px;text-align:right;color:var(--text3);font-weight:500;font-size:0.7rem">Value</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        <tr style="border-bottom:1px solid var(--border);background:rgba(255,255,255,0.03)">
          <td style="padding:8px 10px;font-weight:700;color:var(--text1);${stickyTd}">Grand Total</td>
          ${months.map(m => `<td style="padding:8px 6px;text-align:right;font-weight:700;color:var(--text2)">${nf(Object.values(history[m].c).reduce((s, subs) => s + Object.values(subs).reduce((ss, sd) => ss + sd[0], 0), 0))}</td><td style="padding:8px 6px;text-align:right;font-weight:700;color:var(--green)">${$f(history[m].g)}</td>`).join('')}
        </tr>`;

  for (const cat of CAT_ORDER) {
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

  el.innerHTML = html;
}

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
