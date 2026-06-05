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
  if (key === 'combined') {
    el.style.background  = state.toggles[key] ? 'rgba(232,197,71,0.1)' : '';
    el.style.borderColor = state.toggles[key] ? 'rgba(232,197,71,0.3)' : '';
    el.style.color       = state.toggles[key] ? 'var(--accent)' : '';
  }
  if (key === 'individual') {
    el.style.background  = state.toggles[key] ? 'rgba(91,163,224,0.1)' : '';
    el.style.borderColor = state.toggles[key] ? 'rgba(91,163,224,0.3)' : '';
    el.style.color       = state.toggles[key] ? 'var(--blue)' : '';
  }
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
  state.toggles = { reorder:false, nodem:false, adjusted:false, onorder:false, combined:true, individual:true };

  document.querySelectorAll('.chip[data-status],.chip[data-cat]').forEach(c => c.classList.add('active'));
  ['reorder','nodem','adjusted','onorder'].forEach(k => { const el = document.getElementById('tog-' + k); if (el) el.classList.remove('active'); });

  const togCombined = document.getElementById('tog-combined');
  if (togCombined) { togCombined.classList.add('active'); togCombined.style.background='rgba(232,197,71,0.1)'; togCombined.style.borderColor='rgba(232,197,71,0.3)'; togCombined.style.color='var(--accent)'; }
  const togIndividual = document.getElementById('tog-individual');
  if (togIndividual) { togIndividual.classList.add('active'); togIndividual.style.background='rgba(91,163,224,0.1)'; togIndividual.style.borderColor='rgba(91,163,224,0.3)'; togIndividual.style.color='var(--blue)'; }

  document.getElementById('maxMonths').value = 12;
  document.getElementById('minDemand').value = 0;
  document.getElementById('search').value = '';
  document.getElementById('sortSel').value = 'urgency';
  updateRangeLabel();
  renderSubcatChips();
  _render();
}
