import { state } from '../data/state.js';
import { SUBCAT_COLORS } from '../data/constants.js';

export function renderAlertSubcatChips() {
  const container = document.getElementById('alert-subcat-chips'); if (!container) return;
  const relevant  = new Set();
  state.RAW_DATA.forEach(r => { if (state.alertActiveCats.has(r.cat)) relevant.add(r.subcat); });
  const list = [...relevant].sort();
  list.forEach(s => state.alertActiveSubcats.add(s));
  container.innerHTML = list.map(s => {
    const cls = SUBCAT_COLORS[s] || 'badge-gray';
    return `<span class="chip ${cls} ${state.alertActiveSubcats.has(s) ? 'active' : ''}" data-asub="${s}" onclick="toggleAlertChip(this,'sub')" style="font-size:10px;padding:2px 7px">${s}</span>`;
  }).join('');
}

export function toggleAlertChip(el, type) {
  if (type === 'cat') {
    const val = el.dataset.acat;
    if (state.alertActiveCats.has(val)) state.alertActiveCats.delete(val); else state.alertActiveCats.add(val);
    el.classList.toggle('active', state.alertActiveCats.has(val));
    renderAlertSubcatChips();
  } else {
    const val = el.dataset.asub;
    if (state.alertActiveSubcats.has(val)) state.alertActiveSubcats.delete(val); else state.alertActiveSubcats.add(val);
    el.classList.toggle('active', state.alertActiveSubcats.has(val));
  }
  renderAlerts();
}

export function updateAlertThresholds() {
  const s = parseInt(document.getElementById('spike-threshold').value);
  const d = parseInt(document.getElementById('drop-threshold').value);
  document.getElementById('spike-val').textContent = '+' + s + '%';
  document.getElementById('drop-val').textContent  = '-' + d + '%';
  renderAlerts();
}

export function renderAlerts() {
  const spikePct = parseInt(document.getElementById('spike-threshold')?.value || 15);
  const dropPct  = parseInt(document.getElementById('drop-threshold')?.value  || 20);
  const search   = (document.getElementById('alert-search')?.value || '').toLowerCase();

  let items = state.RAW_DATA.filter(r => r.hasConsumption && r.has30Consumption && r.runRate30 > 0);

  if (!items.length) {
    ['spikes-body','drops-body'].forEach(id => {
      document.getElementById(id).innerHTML = `<tr><td colspan="5" style="padding:2rem;text-align:center;color:var(--text3)">No consumption data yet — connect Finale API to see alerts</td></tr>`;
    });
    document.getElementById('spike-count').textContent = '—';
    document.getElementById('drop-count').textContent  = '—';
    return;
  }

  if (state.alertActiveCats.size)    items = items.filter(r => state.alertActiveCats.has(r.cat));
  if (state.alertActiveSubcats.size) items = items.filter(r => state.alertActiveSubcats.has(r.subcat));
  if (search) items = items.filter(r => r.id.toLowerCase().includes(search) || r.desc.toLowerCase().includes(search));

  const spikes = [], drops = [];
  items.forEach(item => {
    const pct = ((item.actual30 - item.runRate30) / item.runRate30) * 100;
    if (pct >=  spikePct) spikes.push({ ...item, pct });
    if (pct <= -dropPct)  drops.push({ ...item, pct });
  });

  spikes.sort((a, b) => b.pct - a.pct);
  drops.sort((a, b)  => a.pct - b.pct);

  const mkRow = (item, isSpike) => {
    const col     = isSpike ? 'var(--red)' : 'var(--green)';
    const pctStr  = (item.pct > 0 ? '+' : '') + item.pct.toFixed(1) + '%';
    const barW    = Math.min(Math.abs(item.pct), 200) / 2;
    const subBadge = SUBCAT_COLORS[item.subcat] || 'badge-gray';
    return `<tr style="border-bottom:0.5px solid var(--border)">
      <td style="padding:.45rem .75rem;max-width:200px">
        <div style="font-family:var(--font-mono);font-size:11px;color:var(--accent);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${item.id}</div>
        <div style="font-size:10px;color:var(--text3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${item.desc}">${item.desc}</div>
      </td>
      <td style="padding:.45rem .75rem"><span class="badge ${subBadge}" style="font-size:9px">${item.subcat}</span></td>
      <td style="padding:.45rem .75rem;text-align:right;font-family:var(--font-mono);font-size:11px;color:var(--text2)">${Math.round(item.runRate30).toLocaleString()}</td>
      <td style="padding:.45rem .75rem;text-align:right;font-family:var(--font-mono);font-size:11px;color:var(--text2)">${Math.round(item.actual30).toLocaleString()}</td>
      <td style="padding:.45rem .75rem;text-align:right">
        <div style="display:flex;align-items:center;gap:5px;justify-content:flex-end">
          <div style="height:4px;border-radius:2px;background:${col};width:${barW}px;opacity:.7;flex-shrink:0"></div>
          <span style="font-family:var(--font-mono);font-size:12px;font-weight:600;color:${col};white-space:nowrap">${pctStr}</span>
        </div>
      </td>
    </tr>`;
  };

  document.getElementById('spikes-body').innerHTML = spikes.length
    ? spikes.map(i => mkRow(i, true)).join('')
    : `<tr><td colspan="5" style="padding:2rem;text-align:center;color:var(--text3)">No spikes above +${spikePct}% with current filters</td></tr>`;

  document.getElementById('drops-body').innerHTML = drops.length
    ? drops.map(i => mkRow(i, false)).join('')
    : `<tr><td colspan="5" style="padding:2rem;text-align:center;color:var(--text3)">No drops below -${dropPct}% with current filters</td></tr>`;

  document.getElementById('spike-count').textContent = spikes.length + ' item' + (spikes.length !== 1 ? 's' : '');
  document.getElementById('drop-count').textContent  = drops.length  + ' item' + (drops.length  !== 1 ? 's' : '');
}
