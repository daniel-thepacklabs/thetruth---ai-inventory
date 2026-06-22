import { state } from '../data/state.js';
import { ALL_CATEGORIES, SUBCAT_COLORS } from '../data/constants.js';

// imported lazily to avoid circular dep — set by main.js
let _render = () => {};
export function setRenderFn(fn) { _render = fn; }

// ── Range labels ──
export function updateRangeLabel() {
  const mv = parseFloat(document.getElementById('maxMonths').value);
  document.getElementById('maxMonthsVal').textContent = mv >= 12 ? 'All' : mv.toFixed(1) + 'mo';
  const md = parseInt(document.getElementById('minDemand').value);
  document.getElementById('minDemandVal').textContent = md === 0 ? 'Any' : Math.round(md).toLocaleString() + '/mo';
}

// ── Subcat chips ──
export function renderSubcatChips() {
  const container = document.getElementById('subcat-chips'); if (!container) return;
  const list = [...state.ALL_SUBCAT_LIST].filter(s => {
    for (const cat of state.activeCats) {
      if (state.ALL_SUBCATS[cat] && state.ALL_SUBCATS[cat].has(s)) return true;
    }
    return false;
  }).sort();
  container.innerHTML = list.map(s => {
    const cls = SUBCAT_COLORS[s] || 'badge-gray';
    return `<span class="chip ${cls} ${state.activeSubcats.has(s) ? 'active' : ''}" data-subcat="${s}" onclick="toggleSubcat(this,'${s.replace(/'/g, "\\'")}')" style="font-size:10px;padding:2px 8px;">${s}</span>`;
  }).join('');
}

export function toggleSubcat(el, val) {
  if (state.activeSubcats.has(val)) state.activeSubcats.delete(val); else state.activeSubcats.add(val);
  el.classList.toggle('active', state.activeSubcats.has(val));
  _render();
}
export function selectAllSubcats() { state.ALL_SUBCAT_LIST.forEach(s => state.activeSubcats.add(s)); document.querySelectorAll('[data-subcat]').forEach(c => c.classList.add('active')); _render(); }
export function clearAllSubcats()  { state.activeSubcats.clear(); document.querySelectorAll('[data-subcat]').forEach(c => c.classList.remove('active')); _render(); }

// ── Edible flavor / pack filters ──
export function renderEdibleFilters() {
  const container = document.getElementById('edible-filters'); if (!container) return;
  const showEdibles = state.activeCats.has('Edibles');
  if (!showEdibles || !state.ALL_EDIBLE_FLAVORS.size) { container.style.display = 'none'; return; }
  container.style.display = '';

  const flavors = [...state.ALL_EDIBLE_FLAVORS].sort();
  const packs = ['Single', '2-Pack', '3-Pack', '5PK Display', '8PK Display', '10PK Display', 'RAW'].filter(p => state.ALL_EDIBLE_PACKS.has(p));

  let html = '<div style="display:flex;flex-wrap:wrap;gap:4px;align-items:center;margin-bottom:6px">';
  html += '<span style="font-size:10px;color:var(--text3);font-weight:600;margin-right:4px">FLAVOR</span>';
  html += `<span class="chip badge-gray" style="font-size:9px;padding:1px 6px;cursor:pointer" onclick="window.__edibleFlavorAll()">All</span>`;
  html += `<span class="chip badge-gray" style="font-size:9px;padding:1px 6px;cursor:pointer" onclick="window.__edibleFlavorNone()">None</span>`;
  for (const f of flavors) {
    const active = state.activeEdibleFlavors.has(f);
    html += `<span class="chip badge-orange ${active ? 'active' : ''}" data-eflavor="${f}" onclick="window.__toggleEdibleFlavor(this,'${f.replace(/'/g, "\\'")}')" style="font-size:10px;padding:2px 8px;cursor:pointer">${f}</span>`;
  }
  html += '</div><div style="display:flex;flex-wrap:wrap;gap:4px;align-items:center">';
  html += '<span style="font-size:10px;color:var(--text3);font-weight:600;margin-right:4px">PACK</span>';
  html += `<span class="chip badge-gray" style="font-size:9px;padding:1px 6px;cursor:pointer" onclick="window.__ediblePackAll()">All</span>`;
  html += `<span class="chip badge-gray" style="font-size:9px;padding:1px 6px;cursor:pointer" onclick="window.__ediblePackNone()">None</span>`;
  for (const p of packs) {
    const active = state.activeEdiblePacks.has(p);
    html += `<span class="chip badge-blue ${active ? 'active' : ''}" data-epack="${p}" onclick="window.__toggleEdiblePack(this,'${p.replace(/'/g, "\\'")}')" style="font-size:10px;padding:2px 8px;cursor:pointer">${p}</span>`;
  }
  html += '</div>';
  container.innerHTML = html;
}

export function initEdibleFilterGlobals() {
  window.__toggleEdibleFlavor = (el, val) => {
    if (state.activeEdibleFlavors.has(val)) state.activeEdibleFlavors.delete(val); else state.activeEdibleFlavors.add(val);
    el.classList.toggle('active', state.activeEdibleFlavors.has(val));
    _render();
  };
  window.__toggleEdiblePack = (el, val) => {
    if (state.activeEdiblePacks.has(val)) state.activeEdiblePacks.delete(val); else state.activeEdiblePacks.add(val);
    el.classList.toggle('active', state.activeEdiblePacks.has(val));
    _render();
  };
  window.__edibleFlavorAll = () => { state.ALL_EDIBLE_FLAVORS.forEach(f => state.activeEdibleFlavors.add(f)); renderEdibleFilters(); _render(); };
  window.__edibleFlavorNone = () => { state.activeEdibleFlavors.clear(); renderEdibleFilters(); _render(); };
  window.__ediblePackAll = () => { state.ALL_EDIBLE_PACKS.forEach(p => state.activeEdiblePacks.add(p)); renderEdibleFilters(); _render(); };
  window.__ediblePackNone = () => { state.activeEdiblePacks.clear(); renderEdibleFilters(); _render(); };
}

// ── Status / category chips ──
export function toggleChip(el, group) {
  const val = el.dataset.status || el.dataset.cat;
  const set = group === 'status' ? state.activeStatuses : state.activeCats;
  if (set.has(val)) set.delete(val); else set.add(val);
  el.classList.toggle('active', set.has(val));
  if (group === 'cat') renderSubcatChips();
  _render();
}

export function selectAllChips(group) {
  if (group === 'cat') {
    document.querySelectorAll('.chip[data-cat]').forEach(c => { state.activeCats.add(c.dataset.cat); c.classList.add('active'); });
    renderSubcatChips();
  } else {
    document.querySelectorAll('.chip[data-status]').forEach(c => { state.activeStatuses.add(c.dataset.status); c.classList.add('active'); });
  }
  _render();
}

export function clearAllChips(group) {
  if (group === 'cat') { state.activeCats.clear(); document.querySelectorAll('.chip[data-cat]').forEach(c => c.classList.remove('active')); renderSubcatChips(); }
  _render();
}

// ── Toggle pills ──
export function togglePill(key) {
  state.toggles[key] = !state.toggles[key];
  const el = document.getElementById('tog-' + key); if (!el) return;
  el.classList.toggle('active', state.toggles[key]);
  _render();
}

// ── Quick filters ──
export function quickFilter(cat) {
  state.activeCats = new Set([cat]);
  document.querySelectorAll('.chip[data-cat]').forEach(c => c.classList.toggle('active', c.dataset.cat === cat));
  renderSubcatChips();
  _render();
}

export function quickStatusFilter(status) {
  state.activeStatuses = new Set([status]);
  document.querySelectorAll('.chip[data-status]').forEach(c => c.classList.toggle('active', c.dataset.status === status));
  _render();
}

export function setFilter(f) {
  if (!['critical','alert','warning','ok'].includes(f)) return;
  state.activeStatuses = new Set([f]);
  document.querySelectorAll('.chip[data-status]').forEach(c => c.classList.toggle('active', c.dataset.status === f));
  _render();
}

export function activateReorderOnly() {
  state.toggles.reorder = true;
  document.getElementById('tog-reorder').classList.add('active');
  _render();
}

// ── Reset ──
export function resetFilters() {
  state.activeStatuses = new Set(['critical','alert','warning','ok']);
  state.activeCats     = new Set(ALL_CATEGORIES);
  state.activeSubcats  = new Set(state.ALL_SUBCAT_LIST);
  state.activeEdibleFlavors = new Set(state.ALL_EDIBLE_FLAVORS);
  state.activeEdiblePacks = new Set(state.ALL_EDIBLE_PACKS);
  state.toggles = { reorder:false, nodem:false, adjusted:false, onorder:false };

  document.querySelectorAll('.chip[data-status],.chip[data-cat]').forEach(c => c.classList.add('active'));
  ['reorder','nodem','adjusted','onorder'].forEach(k => { const el = document.getElementById('tog-' + k); if (el) el.classList.remove('active'); });


  document.getElementById('maxMonths').value = 12;
  document.getElementById('minDemand').value = 0;
  document.getElementById('search').value = '';
  document.getElementById('sortSel').value = 'urgency';
  updateRangeLabel();
  renderSubcatChips();
  _render();
}
