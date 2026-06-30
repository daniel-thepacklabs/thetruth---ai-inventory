import { processData, processSalesReport, buildSubcatIndex } from './data/parsers.js';
import { state } from './data/state.js';
import { fetchAll } from './data/finaleApi.js';
import { updateRangeLabel, renderSubcatChips, renderEdibleFilters, initEdibleFilterGlobals, setRenderFn as setFilterRender, toggleChip, togglePill, resetFilters, selectAllChips, clearAllChips, toggleSubcat, selectAllSubcats, clearAllSubcats, quickFilter, quickStatusFilter, setFilter, activateReorderOnly } from './ui/filters.js';
import { openModal, closeModal, saveModal, resetOverride, updateModalPreview, setRenderFn as setModalRender } from './ui/modal.js';
import { render, toggleRow, toggleSelect, selectAllVisible, clearSelection, updateBulkBar, removeSelected, exportSelected, removeFromView } from './views/inventory.js';
import { renderSalesView } from './views/sales.js';
import { exportForecastCSV, exportForecastPDF, exportMonthlyCSV, exportMonthlyPDF, exportByTypeCSV, exportByTypePDF, exportAllCSV } from './export.js';
import { renderCogsView, exportCogsIngCSV, exportCogsIngPDF, exportCogsProductCSV, exportCogsProductPDF } from './views/cogs.js';
import { renderZeroPriceView } from './views/zeroPriceItems.js';
import { renderAlerts, renderAlertSubcatChips, toggleAlertChip, updateAlertThresholds } from './views/alerts.js';

// ── Inject render() into modules that need it ──
setFilterRender(render);
setModalRender(render);

// ── Expose all functions that HTML onclick= attributes call ──
Object.assign(window, {
  // Inventory
  render, toggleRow, toggleSelect, selectAllVisible, clearSelection,
  removeSelected, exportSelected, removeFromView, updateBulkBar,
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
  if (isEdibles) { import('./views/edibles.js').then(m => m.renderEdiblesView()); }
  if (isAlerts)  { renderAlertSubcatChips(); renderAlerts(); }
  if (isCalc) import('./views/calculator.js').then(m => m.renderCalculatorView());
  if (isCogs)    renderCogsView();
  if (isZeroPrice && !_viewRendered.zeroprice) { _viewRendered.zeroprice = true; renderZeroPriceView(); }
}

// ── Keyboard shortcut: Escape closes modal ──
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

// ── Finale API sync ──
async function syncFromFinale() {
  const btn = document.getElementById('sync-btn');
  const ts  = document.getElementById('data-timestamp');
  if (btn) { btn.textContent = '⟳ Syncing…'; btn.disabled = true; }

  try {
    const { stock, salesHistory, consume, consume30, salesOrder, monthlyTotals, productSalesData, costMap, priceMap, shopifyPriceMap, wholesalePriceMap } = await fetchAll();

    if (!stock || !salesHistory) {
      if (ts) { ts.textContent = 'Finale API not connected'; ts.style.color = 'var(--text3)'; }
      return;
    }

    processData(stock, salesHistory, consume, consume30);
    if (salesOrder) processSalesReport(salesOrder);
    if (monthlyTotals) state.MONTHLY_TOTALS = monthlyTotals;
    if (productSalesData && productSalesData.length) state.SALES_DATA = productSalesData;
    if (costMap) state.COST_MAP = costMap;
    if (priceMap) state.PRICE_MAP = priceMap;
    if (shopifyPriceMap) state.SHOPIFY_PRICE_MAP = shopifyPriceMap;
    if (wholesalePriceMap) state.WHOLESALE_PRICE_MAP = wholesalePriceMap;

    buildSubcatIndex();
    updateRangeLabel();
    renderSubcatChips();
    renderEdibleFilters();
    render();
    if (salesOrder || monthlyTotals || productSalesData) renderSalesView();
    _viewRendered.zeroprice = false;
    if (document.getElementById('zeroprice-view')?.style.display !== 'none') { _viewRendered.zeroprice = true; renderZeroPriceView(); }
    if (document.getElementById('calculator-view')?.style.display !== 'none') import('./views/calculator.js').then(m => m.renderCalculatorView());
    if (document.getElementById('cogs-view')?.style.display !== 'none') renderCogsView();
    if (document.getElementById('edibles-view')?.style.display !== 'none') import('./views/edibles.js').then(m => m.renderEdiblesView());

    if (ts) {
      ts.textContent = 'Synced ' + new Date().toLocaleString('en-US', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
      ts.style.color = 'var(--green)';
    }
  } catch (err) {
    console.error('Finale sync error:', err);
    if (ts) { ts.textContent = 'Sync failed — ' + err.message; ts.style.color = 'var(--red)'; }
  } finally {
    if (btn) { btn.textContent = '⟳ Sync Finale'; btn.disabled = false; }
  }
}

// ── Init ──
updateRangeLabel();
if (!window.__finaleSyncStarted) {
  window.__finaleSyncStarted = true;
  syncFromFinale();
}

// expose for the sync button
window.syncFromFinale = syncFromFinale;
initEdibleFilterGlobals();
