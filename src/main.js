import { processData, processSalesReport, buildSubcatIndex } from './data/parsers.js';
import { state } from './data/state.js';
import { fetchAll } from './data/finaleApi.js';
import { updateRangeLabel, renderSubcatChips, renderEdibleFilters, initEdibleFilterGlobals, setRenderFn as setFilterRender, toggleChip, togglePill, resetFilters, selectAllChips, clearAllChips, toggleSubcat, selectAllSubcats, clearAllSubcats, quickFilter, quickStatusFilter, setFilter, activateReorderOnly } from './ui/filters.js';
import { openModal, closeModal, saveModal, resetOverride, updateModalPreview, setRenderFn as setModalRender } from './ui/modal.js';
import { render, toggleRow, toggleSelect, selectAllVisible, clearSelection, updateBulkBar, removeSelected, exportSelected, removeFromView, discontinueProduct, restoreProduct } from './views/inventory.js';
import { renderSalesView } from './views/sales.js';
import { exportForecastCSV, exportForecastPDF, exportMonthlyCSV, exportMonthlyPDF, exportByTypeCSV, exportByTypePDF, exportAllCSV } from './export.js';
import { renderCogsView, exportCogsIngCSV, exportCogsIngPDF, exportCogsProductCSV, exportCogsProductPDF } from './views/cogs.js';
import { renderZeroPriceView } from './views/zeroPriceItems.js';
import { renderAlerts, renderAlertSubcatChips, toggleAlertChip, updateAlertThresholds } from './views/alerts.js';
import { renderEdiblesView } from './views/edibles.js';
import { renderCalculatorView } from './views/calculator.js';

// ── Inject render() into modules that need it ──
setFilterRender(render);
setModalRender(render);

// ── Expose all functions that HTML onclick= attributes call ──
Object.assign(window, {
  // Inventory
  render, toggleRow, toggleSelect, selectAllVisible, clearSelection,
  removeSelected, exportSelected, removeFromView, updateBulkBar,
  discontinueProduct, restoreProduct,
  // Modal
  openModal, closeModal, saveModal, resetOverride, updateModalPreview,
  // Filters
  toggleChip, togglePill, resetFilters, selectAllChips, clearAllChips,
  toggleSubcat, selectAllSubcats, clearAllSubcats, quickFilter,
  quickStatusFilter, setFilter, activateReorderOnly, updateRangeLabel,
  // Sales
  renderSalesView,
  // Exports
  exportForecastCSV, exportForecastPDF, exportMonthlyCSV, exportMonthlyPDF,
  exportByTypeCSV, exportByTypePDF, exportAllCSV,
  // COGS
  renderCogsView, exportCogsIngCSV, exportCogsIngPDF, exportCogsProductCSV, exportCogsProductPDF,
  // Zero Price
  renderZeroPriceView,
  // Alerts
  renderAlerts, renderAlertSubcatChips, toggleAlertChip, updateAlertThresholds,
  // View switching
  showView,
});

// ── View switcher ──
const _viewRendered = {};
function showView(view) {
  const isInv    = view === 'inventory';
  const isSales  = view === 'sales';
  const isAlerts = view === 'alerts';
  const isCalc   = view === 'calculator';
  const isEdibles = view === 'edibles';
  const isCogs = view === 'cogs';
  const isZeroPrice = view === 'zeroprice';

  document.getElementById('sales-view').style.display  = isSales   ? 'block' : 'none';
  document.getElementById('alerts-view').style.display = isAlerts  ? 'block' : 'none';
  document.getElementById('calculator-view').style.display = isCalc ? 'block' : 'none';
  document.getElementById('edibles-view').style.display = isEdibles ? 'block' : 'none';
  document.getElementById('cogs-view').style.display = isCogs ? 'block' : 'none';
  document.getElementById('zeroprice-view').style.display = isZeroPrice ? 'block' : 'none';
  document.getElementById('items-list').style.display  = isInv     ? '' : 'none';
  document.getElementById('empty-state').style.display = 'none';

  const inventoryOnly = [
    document.querySelector('.stat-row'),
    document.querySelector('.legend'),
    document.getElementById('bulk-bar'),
  ];
  inventoryOnly.forEach(el => { if (el) el.style.display = isInv ? '' : 'none'; });

  const content = document.getElementById('main-content');
  if (content) content.style.padding = isInv ? '' : '0';

  const sw = document.getElementById('search')?.closest('.search-wrap');
  if (sw) sw.style.display = isInv ? '' : 'none';
  const sortSel = document.getElementById('sortSel');
  if (sortSel) sortSel.style.display = isInv ? '' : 'none';
  const fbar = document.querySelector('.filter-bar');
  if (fbar) fbar.style.display = (isInv || isEdibles) ? '' : 'none';

  ['inventory','sales','alerts','calculator','edibles','cogs','zeroprice'].forEach(v => {
    const el = document.getElementById('nav-' + v);
    if (el) el.style.color = v === view ? 'var(--accent)' : '';
  });

  if (isInv)     render();
  if (isEdibles) { renderEdiblesView(); }
  if (isAlerts)  { renderAlertSubcatChips(); renderAlerts(); }
  if (isCalc) renderCalculatorView();
  if (isCogs)    renderCogsView();
  if (isZeroPrice && !_viewRendered.zeroprice) { _viewRendered.zeroprice = true; renderZeroPriceView(); }
}

// ── Keyboard shortcut: Escape closes modal ──
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

// ── Finale API sync ──
// Store module references on window so the sync function never holds stale closures.
// Every time this module executes (including HMR), these are refreshed.
window.__syncDeps = {
  fetchAll, processData, processSalesReport, buildSubcatIndex,
  state, updateRangeLabel, renderSubcatChips, renderEdibleFilters, render,
  renderSalesView, renderZeroPriceView, renderCalculatorView, renderCogsView,
  renderEdiblesView, _viewRendered,
};

// Define sync function on window — reads deps from window.__syncDeps at call time, never from closure.
window.syncFromFinale = async function syncFromFinale() {
  const btn = document.getElementById('sync-btn');
  const ts  = document.getElementById('data-timestamp');

  if (window.__syncRunning) {
    console.log('[sync] Already running, skipping');
    return;
  }
  window.__syncRunning = true;
  console.log('[sync] Starting...');
  if (btn) { btn.textContent = '⟳ Syncing…'; btn.disabled = true; }

  const d = window.__syncDeps;
  try {
    const { stock, salesHistory, consume, consume30, salesOrder, monthlyTotals, productSalesData, costMap, priceMap, shopifyPriceMap, wholesalePriceMap } = await d.fetchAll();

    if (!stock || !salesHistory) {
      console.warn('[sync] No stock/sales data returned');
      if (ts) { ts.textContent = 'Finale API not connected'; ts.style.color = 'var(--text3)'; }
      return;
    }

    d.processData(stock, salesHistory, consume, consume30);
    if (salesOrder) d.processSalesReport(salesOrder);
    if (monthlyTotals) d.state.MONTHLY_TOTALS = monthlyTotals;
    if (productSalesData && productSalesData.length) d.state.SALES_DATA = productSalesData;
    if (costMap) d.state.COST_MAP = costMap;
    if (priceMap) d.state.PRICE_MAP = priceMap;
    if (shopifyPriceMap) d.state.SHOPIFY_PRICE_MAP = shopifyPriceMap;
    if (wholesalePriceMap) d.state.WHOLESALE_PRICE_MAP = wholesalePriceMap;

    d.buildSubcatIndex();
    d.updateRangeLabel();
    d.renderSubcatChips();
    d.renderEdibleFilters();
    d.render();
    if (salesOrder || monthlyTotals || productSalesData) d.renderSalesView();
    d._viewRendered.zeroprice = false;
    if (document.getElementById('zeroprice-view')?.style.display !== 'none') { d._viewRendered.zeroprice = true; d.renderZeroPriceView(); }
    if (document.getElementById('calculator-view')?.style.display !== 'none') d.renderCalculatorView();
    if (document.getElementById('cogs-view')?.style.display !== 'none') d.renderCogsView();
    if (document.getElementById('edibles-view')?.style.display !== 'none') d.renderEdiblesView();

    console.log('[sync] Complete');
    if (ts) {
      ts.textContent = 'Synced ' + new Date().toLocaleString('en-US', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
      ts.style.color = 'var(--green)';
    }
  } catch (err) {
    console.error('[sync] Error:', err);
    if (ts) { ts.textContent = 'Sync failed — ' + err.message; ts.style.color = 'var(--red)'; }
  } finally {
    window.__syncRunning = false;
    if (btn) { btn.textContent = '⟳ Sync Finale'; btn.disabled = false; }
    console.log('[sync] Button reset, __syncRunning =', window.__syncRunning);
  }
};

// ── Init ──
updateRangeLabel();
if (!window.__finaleSyncStarted) {
  window.__finaleSyncStarted = true;
  window.syncFromFinale();
}
initEdibleFilterGlobals();
