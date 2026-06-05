import { state } from '../data/state.js';
import { CATEGORY_THRESHOLDS } from '../data/constants.js';
import { fmtDec, fmt } from '../data/parsers.js';

// injected by main.js
let _render = () => {};
export function setRenderFn(fn) { _render = fn; }

function getSafetyStockForModal(item) {
  const ov = state.overrides[item.id] || {};
  if (ov.ss != null) return ov.ss;
  // import inline to avoid circular dep with business logic
  const SUBCAT_SS = { Flower:0.5, FMX:0.5, Glue:0.5, ISO:0.5, Oil:0.5, TRP:0.5, Gummy:1.0, ECC:1.0, EGBD:1.0, EGFJ:1.0, EGKB:1.0, EGBB:1.0, EGMB:1.0, EGMCR:1.0, EGPL:1.0, EGSS:1.0 };
  if (SUBCAT_SS[item.subcat] != null) return SUBCAT_SS[item.subcat];
  return 2.0;
}

export function openModal(id) {
  const item = state.RAW_DATA.find(r => r.id === id); if (!item) return;
  state.activeModalId = id;
  const ov  = state.overrides[id] || {};
  const rp  = ov.rp != null ? ov.rp : CATEGORY_THRESHOLDS[item.cat];
  const ss  = getSafetyStockForModal(item);
  const dem = ov.dem != null ? ov.dem : item.dem;

  document.getElementById('m-id').textContent   = item.id;
  document.getElementById('m-desc').textContent = item.desc.slice(0, 70) + (item.desc.length > 70 ? '…' : '');
  document.getElementById('m-onhand').textContent = item.onHand.toLocaleString();
  document.getElementById('m-months').textContent = fmtDec(item.months);

  const ssEl = document.getElementById('m-ss'); ssEl.value = ss; ssEl.min = 0.25; ssEl.max = 6; ssEl.step = 0.25;
  const rpEl = document.getElementById('m-rp'); rpEl.value = rp; rpEl.min = 0.25; rpEl.max = 6; rpEl.step = 0.25;
  const maxD = Math.max(Math.round((item.dem || 1) * 5), 100);
  const dEl  = document.getElementById('m-dem'); dEl.value = dem; dEl.min = Math.max(1, Math.round((item.dem || 1) * 0.1)); dEl.max = maxD; dEl.step = Math.max(1, Math.round((item.dem || 1) * 0.05));
  document.getElementById('m-sys-dem').textContent = 'System: ' + fmt(item.dem) + ' / mo';
  document.getElementById('m-notes').value = ov.notes || '';
  document.getElementById('m-reset-btn').style.display = state.overrides[id] ? 'block' : 'none';

  updateModalPreview();
  document.getElementById('modal-wrap').classList.add('open');
}

export function updateModalPreview() {
  const id = state.activeModalId;
  const item = state.RAW_DATA.find(r => r.id === id); if (!item) return;
  const ss  = parseFloat(document.getElementById('m-ss').value);
  const rp  = parseFloat(document.getElementById('m-rp').value);
  const dem = parseFloat(document.getElementById('m-dem').value);
  document.getElementById('m-ss-val').textContent  = fmtDec(ss);
  document.getElementById('m-rp-val').textContent  = fmtDec(rp);
  document.getElementById('m-dem-val').textContent = fmt(dem);
  const totalMo  = item.dem > 0 ? (item.remaining + item.onOrder) / item.dem : 0;
  const shortfall = rp - totalMo;
  const rq = shortfall > 0 ? Math.ceil(shortfall * dem) : 0;
  const el = document.getElementById('m-rqty');
  el.textContent = (rq > 0 ? '+' : '') + fmt(rq);
  el.style.color = rq > 0 ? 'var(--red)' : 'var(--green)';
}

export function saveModal() {
  if (!state.activeModalId) return;
  state.overrides[state.activeModalId] = {
    ss:    parseFloat(document.getElementById('m-ss').value),
    rp:    parseFloat(document.getElementById('m-rp').value),
    dem:   parseFloat(document.getElementById('m-dem').value),
    notes: document.getElementById('m-notes').value.trim(),
  };
  closeModal();
  _render();
}

export function resetOverride() {
  if (!state.activeModalId) return;
  delete state.overrides[state.activeModalId];
  closeModal();
  _render();
}

export function closeModal(event) {
  if (event && event.target !== document.getElementById('modal-wrap')) return;
  document.getElementById('modal-wrap').classList.remove('open');
  state.activeModalId = null;
}
