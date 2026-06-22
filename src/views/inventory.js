import { state } from '../data/state.js';
import { CATEGORY_THRESHOLDS, SUBCAT_SAFETY_STOCK, CAT_BADGE, SUBCAT_COLORS } from '../data/constants.js';
import { fmt, fmtDec } from '../data/parsers.js';
import { renderEdibleFilters } from '../ui/filters.js';

// ── Business logic ──
export function getSafetyStock(item) {
  const ov = state.overrides[item.id] || {};
  if (ov.ss != null) return ov.ss;
  if (SUBCAT_SAFETY_STOCK[item.subcat] != null) return SUBCAT_SAFETY_STOCK[item.subcat];
  return 2.0;
}

export function getEffectiveDemand(item) {
  return (state.overrides[item.id] && state.overrides[item.id].dem) || item.dem;
}

export function getStatus(item) {
  const ss = getSafetyStock(item);
  const ov = state.overrides[item.id] || {};
  const rp = ov.rp != null ? ov.rp : CATEGORY_THRESHOLDS[item.cat];
  const totalMonths = item.dem > 0 ? (item.remaining + item.onOrder) / item.dem : 0;
  if (totalMonths < 1)  return 'critical';
  if (totalMonths < ss) return 'alert';
  if (totalMonths < rp) return 'warning';
  return 'ok';
}

export function getReorderQty(item) {
  const ov  = state.overrides[item.id] || {};
  const rp  = ov.rp != null ? ov.rp : CATEGORY_THRESHOLDS[item.cat];
  const dem = getEffectiveDemand(item);
  const totalMonths = dem > 0 ? (item.remaining + item.onOrder) / dem : 0;
  const shortfall   = rp - totalMonths;
  return shortfall > 0 ? Math.ceil(shortfall * dem) : 0;
}

function statusConfig(s) {
  return {
    critical: { label:'Critical', badge:'badge-red',    barColor:'#e05252' },
    alert:    { label:'Alert',    badge:'badge-orange',  barColor:'#e07c3a' },
    warning:  { label:'Low',      badge:'badge-purple',  barColor:'#9b7fee' },
    ok:       { label:'OK',       badge:'badge-green',   barColor:'#52c97a' },
  }[s];
}

// ── Selection ──
export function toggleSelect(id, e) {
  e.stopPropagation();
  if (state.selectedIds.has(id)) state.selectedIds.delete(id); else state.selectedIds.add(id);
  const cb  = document.getElementById('cb-' + CSS.escape(id)); if (cb) cb.checked = state.selectedIds.has(id);
  const row = document.getElementById('row-' + CSS.escape(id)); if (row) row.style.outline = state.selectedIds.has(id) ? '1.5px solid rgba(232,197,71,0.5)' : '';
  updateBulkBar();
}

export function selectAllVisible() {
  document.querySelectorAll('.item-row').forEach(r => {
    const id = r.id.replace('row-', '');
    state.selectedIds.add(decodeURIComponent(id));
    r.style.outline = '1.5px solid rgba(232,197,71,0.5)';
    const cb = r.querySelector('input[type=checkbox]'); if (cb) cb.checked = true;
  });
  updateBulkBar();
}

export function clearSelection() {
  state.selectedIds.clear();
  document.querySelectorAll('.item-row').forEach(r => r.style.outline = '');
  document.querySelectorAll('.item-row input[type=checkbox]').forEach(cb => cb.checked = false);
  updateBulkBar();
}

export function updateBulkBar() {
  const bar   = document.getElementById('bulk-bar');
  const count = state.selectedIds.size;
  bar.classList.toggle('visible', count > 0);
  document.getElementById('bulk-info').textContent = count + ' item' + (count !== 1 ? 's' : '') + ' selected';
}

export function removeSelected() {
  if (!state.selectedIds.size) return;
  const nn = state.selectedIds.size;
  state.selectedIds.forEach(id => state.removedIds.add(id));
  state.selectedIds.clear();
  updateBulkBar();
  render();
  const t = document.createElement('div');
  t.textContent = nn + ' item' + (nn !== 1 ? 's' : '') + ' removed';
  t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1a1e24;border:1px solid rgba(232,197,71,0.3);color:#e8c547;padding:8px 18px;border-radius:8px;font-size:12px;z-index:200;transition:opacity 0.4s;';
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 400); }, 2500);
}

export function exportSelected() {
  if (!state.selectedIds.size) return;
  const items  = state.RAW_DATA.filter(r => state.selectedIds.has(r.id));
  const header = 'Product ID,Description,Category,Subcategory,On Hand,On Order,Monthly Demand,Months On Hand,Reorder Qty';
  const rows   = items.map(item => [
    item.id, '"' + item.desc.replace(/"/g, '""') + '"', item.cat, item.subcat,
    item.onHand, item.onOrder, Math.round(getEffectiveDemand(item)), fmtDec(item.months), getReorderQty(item),
  ].join(','));
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent([header, ...rows].join('\n'));
  a.download = 'pack_labs_' + new Date().toISOString().slice(0, 10) + '.csv';
  a.click();
}

// ── Row toggle ──
export function toggleRow(id) {
  const exp  = document.getElementById('exp-'  + CSS.escape(id));
  const chev = document.getElementById('chev-' + CSS.escape(id));
  if (!exp) return;
  const open = !exp.classList.contains('open');
  exp.classList.toggle('open', open);
  if (chev) chev.classList.toggle('open', open);
}

// ── Main render ──
export function render() {
  renderEdibleFilters();
  if (!state.RAW_DATA.length) return;

  const search  = document.getElementById('search').value.toLowerCase();
  const sort    = document.getElementById('sortSel').value;
  const maxMo   = parseFloat(document.getElementById('maxMonths').value);
  const minDem  = parseInt(document.getElementById('minDemand').value);

  let rows = state.RAW_DATA
    .filter(r => !state.removedIds.has(r.id))
    .map(item => ({ ...item, status: getStatus(item), eff_dem: getEffectiveDemand(item) }));

  // Counts for stat cards (category-filtered but status-unfiltered)
  const visibleRows = rows.filter(r => state.activeCats.has(r.cat) && (state.activeSubcats.size >= state.ALL_SUBCAT_LIST.size || state.activeSubcats.has(r.subcat)));
  const counts = { critical:0, alert:0, warning:0, ok:0 };
  visibleRows.forEach(r => counts[r.status]++);
  document.getElementById('cnt-all').textContent = visibleRows.length;
  ['critical','alert','warning','ok'].forEach(s => {
    document.getElementById('cnt-' + s).textContent = counts[s];
    document.getElementById('sv-' + s).textContent  = counts[s];
  });
  document.getElementById('sv-adjusted').textContent = Object.keys(state.overrides).length;

  // Apply all filters
  rows = rows.filter(r => state.activeStatuses.has(r.status) && state.activeCats.has(r.cat));
  if (state.activeSubcats.size < state.ALL_SUBCAT_LIST.size) rows = rows.filter(r => state.activeSubcats.has(r.subcat));
  if (search)   rows = rows.filter(r => r.id.toLowerCase().includes(search) || r.desc.toLowerCase().includes(search));
  if (maxMo < 12) rows = rows.filter(r => r.months <= maxMo);
  if (minDem > 0) rows = rows.filter(r => r.eff_dem >= minDem);
  if (state.toggles.reorder)   rows = rows.filter(r => getReorderQty(r) > 0);
  if (state.toggles.nodem)     rows = rows.filter(r => r.eff_dem > 0);
  if (state.toggles.adjusted)  rows = rows.filter(r => !!state.overrides[r.id]);
  if (state.toggles.onorder)   rows = rows.filter(r => r.onOrder > 0);
  if (state.activeEdibleFlavors.size < state.ALL_EDIBLE_FLAVORS.size) rows = rows.filter(r => r.cat !== 'Edibles' || (r.flavor && state.activeEdibleFlavors.has(r.flavor)));
  if (state.activeEdiblePacks.size < state.ALL_EDIBLE_PACKS.size) rows = rows.filter(r => r.cat !== 'Edibles' || (r.packType && state.activeEdiblePacks.has(r.packType)));

  if (sort === 'urgency')      rows.sort((a, b) => a.months - b.months);
  else if (sort === 'demand')  rows.sort((a, b) => b.eff_dem - a.eff_dem);
  else if (sort === 'onhand_desc') rows.sort((a, b) => b.onHand - a.onHand);
  else if (sort === 'onhand_asc')  rows.sort((a, b) => a.onHand - b.onHand);
  else rows.sort((a, b) => a.id.localeCompare(b.id));

  const total = state.RAW_DATA.length - state.removedIds.size;
  const cs    = rows.length + ' of ' + total + ' items';
  document.getElementById('showing-count').textContent = cs;
  const leg = document.getElementById('showing-count-legend'); if (leg) leg.textContent = cs;

  const list  = document.getElementById('items-list');
  const empty = document.getElementById('empty-state');
  if (!rows.length) { list.innerHTML = ''; if (empty) empty.style.display = 'block'; return; }
  if (empty) empty.style.display = 'none';

  list.innerHTML = rows.map((item, idx) => {
    const st       = statusConfig(item.status);
    const catBadge = CAT_BADGE[item.cat] || 'badge-gray';
    const subBadge = SUBCAT_COLORS[item.subcat] || 'badge-gray';
    const ov       = state.overrides[item.id];
    const rp       = (ov && ov.rp != null) ? ov.rp : CATEGORY_THRESHOLDS[item.cat];
    const ss       = getSafetyStock(item);
    const rqty     = getReorderQty(item);
    const isSel    = state.selectedIds.has(item.id);
    const max      = Math.max(rp * 2.5, item.months * 1.1, 6);
    const fp       = Math.min((item.months / max) * 100, 100).toFixed(1);
    const ssp      = Math.min((ss / max) * 100, 100).toFixed(1);
    const rpp      = Math.min((rp / max) * 100, 100).toFixed(1);
    const sid      = item.id.replace(/'/g, "\\'");

    const moOnHand  = item.dem > 0 ? item.remaining / item.dem : 0;
    const moOnOrder = item.dem > 0 ? item.onOrder / item.dem : 0;
    const moTotal   = item.dem > 0 ? (item.remaining + item.onOrder) / item.dem : 0;
    const vcOH  = moOnHand < ss ? 'color:var(--red)' : moOnHand < rp ? 'color:var(--orange)' : 'color:var(--text)';
    const vcTot = moTotal  < ss ? 'color:var(--red)' : moTotal  < rp ? 'color:var(--orange)' : 'color:var(--green)';

    const displayId   = item.isEdibleFlavor ? '🍬 ' + item.flavorName : item.id;
    const displayDesc = item.desc || '—';

    return `<div class="item-row" id="row-${CSS.escape(item.id)}" style="${isSel ? 'outline:1.5px solid rgba(232,197,71,0.5)' : ''}">
      <div class="item-header">
        <label style="display:flex;align-items:center;padding:.75rem 0 .75rem .875rem;cursor:pointer;flex-shrink:0" onclick="event.stopPropagation()">
          <input type="checkbox" id="cb-${CSS.escape(item.id)}" ${isSel ? 'checked' : ''} onchange="toggleSelect('${sid}',event)" style="width:13px;height:13px;cursor:pointer;accent-color:var(--accent)"/>
        </label>
        <div class="item-left" style="padding:.75rem .875rem .75rem .625rem;cursor:pointer;min-width:0" onclick="toggleRow('${sid}')">
          <div class="item-meta">
            <span class="item-id">${displayId}</span>
            <span class="badge ${catBadge}">${item.cat}</span>
            <span class="badge ${subBadge}" style="font-size:9px;opacity:.8">${item.subcat}</span>
            <span class="badge ${st.badge}">${st.label}</span>
            ${ov ? '<span class="badge badge-accent">adjusted</span>' : ''}
            ${item.onOrder > 0 ? '<span class="badge badge-gray">PO open</span>' : ''}
          </div>
          <div class="item-desc" title="${displayDesc}">${displayDesc}</div>
          <div style="display:flex;align-items:center;gap:1rem;margin-top:6px;flex-wrap:wrap">
            <div style="display:flex;flex-direction:column;gap:1px;min-width:72px">
              <span style="font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:.06em">${item.isEdibleFlavor ? 'On hand (pcs)' : 'On hand'}</span>
              <span style="font-size:15px;font-weight:500;font-family:var(--font-mono);${vcOH}">${item.isEdibleFlavor ? fmt(item.onHand) : fmtDec(moOnHand)}<span style="font-size:9px;color:var(--text3);margin-left:1px">${item.isEdibleFlavor ? 'pc' : 'mo'}</span></span>
            </div>
            <div style="width:1px;height:26px;background:var(--border);flex-shrink:0"></div>
            <div style="display:flex;flex-direction:column;gap:1px;min-width:72px">
              <span style="font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:.06em">${item.isEdibleFlavor ? 'On order (pcs)' : 'On order'}</span>
              <span style="font-size:15px;font-weight:500;font-family:var(--font-mono);color:var(--text2)">${item.isEdibleFlavor ? fmt(item.onOrder) : fmtDec(moOnOrder)}<span style="font-size:9px;color:var(--text3);margin-left:1px">${item.isEdibleFlavor ? 'pc' : 'mo'}</span></span>
            </div>
            <div style="width:1px;height:26px;background:var(--border);flex-shrink:0"></div>
            <div style="display:flex;flex-direction:column;gap:1px;min-width:80px">
              <span style="font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:.06em">${item.isEdibleFlavor ? 'Total supply (pcs)' : 'Total supply'}</span>
              <span style="font-size:15px;font-weight:500;font-family:var(--font-mono);${vcTot}">${item.isEdibleFlavor ? fmt(item.totalInv) : fmtDec(moTotal)}<span style="font-size:9px;color:var(--text3);margin-left:1px">${item.isEdibleFlavor ? 'pc' : 'mo'}</span></span>
            </div>
            <div style="flex:1;min-width:80px">
              <div style="position:relative;height:6px;background:var(--bg4);border-radius:3px;overflow:hidden;margin-top:6px">
                <div style="position:absolute;left:0;top:0;height:100%;width:${fp}%;background:${st.barColor};border-radius:3px;z-index:2"></div>
                ${moOnOrder > 0 ? `<div style="position:absolute;left:${fp}%;top:0;height:100%;width:${Math.min((moOnOrder / max) * 100, 100 - parseFloat(fp)).toFixed(1)}%;background:var(--blue);opacity:0.7;z-index:1"></div>` : ''}
                <div class="bar-tick t-safety"  style="left:${ssp}%;z-index:3"></div>
                <div class="bar-tick t-reorder" style="left:${rpp}%;z-index:3"></div>
              </div>
              <div style="display:flex;gap:10px;margin-top:4px;font-size:9px;color:var(--text3)">
                <span style="display:flex;align-items:center;gap:3px"><span style="width:8px;height:3px;border-radius:1px;background:${st.barColor};display:inline-block"></span>On hand</span>
                ${moOnOrder > 0 ? `<span style="display:flex;align-items:center;gap:3px"><span style="width:8px;height:3px;border-radius:1px;background:var(--blue);display:inline-block"></span>On order</span>` : ''}
                <span style="display:flex;align-items:center;gap:3px"><span style="width:2px;height:8px;border-radius:1px;background:#e07c3a;display:inline-block"></span>Safety stock (${ss}mo)</span>
                <span style="display:flex;align-items:center;gap:3px"><span style="width:2px;height:8px;border-radius:1px;background:#e05252;display:inline-block"></span>Reorder point (${rp}mo)</span>
              </div>
            </div>
          </div>
        </div>
        <div style="padding:.75rem .875rem .75rem 0;cursor:pointer;flex-shrink:0;display:flex;align-items:center;align-self:stretch" onclick="toggleRow('${sid}')">
          <div class="chevron" id="chev-${CSS.escape(item.id)}">▾</div>
        </div>
      </div>
      <div class="item-expand" id="exp-${CSS.escape(item.id)}">
        <div class="expand-grid">
          <div class="expand-stat"><div class="expand-label">On hand</div><div class="expand-val">${fmt(item.onHand)}</div></div>
          <div class="expand-stat"><div class="expand-label">Reserved</div><div class="expand-val">${fmt(item.reserved || 0)}</div></div>
          <div class="expand-stat"><div class="expand-label">On order</div><div class="expand-val">${fmt(item.onOrder)}</div></div>
          <div class="expand-stat" title="Total units consumed in the last 90 days"><div class="expand-label">90-day consumed</div><div class="expand-val">${fmt(item.consumed90)}</div></div>
          <div class="expand-stat" title="30-day run rate = consumed over 90 days ÷ 3"><div class="expand-label">30d run rate${item.hasConsumption ? ' 🔥' : ''}</div><div class="expand-val">${fmt(item.runRate30)}</div></div>
          <div class="expand-stat" title="${item.has30Consumption ? 'From your 30-day consumption file' : 'Falling back to sales last 30 days'}"><div class="expand-label">Last 30d consumption${item.has30Consumption ? ' 🔥' : ' *'}</div><div class="expand-val">${fmt(item.actual30)}</div></div>
          <div class="expand-stat" title="Last 30d consumption minus the 90-day run rate avg. Positive = consuming faster than average.">
            <div class="expand-label">30d vs run rate</div>
            ${(() => { const d = item.actual30 - item.runRate30; const cls = d > 0 ? 'pos' : d < 0 ? 'neg' : ''; return '<div class="expand-val ' + cls + '">' + (d > 0 ? '+' : '') + fmt(d) + '</div>'; })()}
          </div>
          <div class="expand-stat"><div class="expand-label">Reorder qty</div><div class="expand-val ${rqty > 0 ? 'pos' : 'neg'}">${rqty > 0 ? '+' : ''}${fmt(rqty)}</div></div>
        </div>
        ${ov && ov.notes ? `<div class="notes-box visible">📋 ${ov.notes}</div>` : ''}
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-accent" onclick="openModal('${sid}')">⚙ Adjust thresholds</button>
          <button class="btn btn-danger" onclick="removeFromView('${sid}')">✕ Remove from view</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

export function removeFromView(id) {
  state.removedIds.add(id);
  state.selectedIds.delete(id);
  updateBulkBar();
  render();
}
