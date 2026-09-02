import { state } from '../data/state.js';

const $f = v => '$' + (v || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const MONTH_NAMES = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export function renderDataHealthView() {
  const el = document.getElementById('datahealth-view');
  if (!el) return;

  const validation = window.__syncValidation;
  const syncRunning = window.__syncRunning;
  const monthlyTotals = state.MONTHLY_TOTALS || [];
  const salesData = state.SALES_DATA || [];
  const rawData = state.RAW_DATA || [];

  let html = `
    <div style="margin-bottom:1.5rem">
      <h2 style="margin:0;font-size:1.4rem;color:var(--text1)">📊 Data Health</h2>
      <p style="margin:4px 0 0;font-size:0.85rem;color:var(--text3)">Validates dashboard data against Finale API. Re-sync to refresh.</p>
    </div>`;

  // ── Sync Status ──
  const syncTs = localStorage.getItem('__syncTimestamp');
  const syncAge = syncTs ? Math.round((Date.now() - parseInt(syncTs)) / 60000) : null;
  const syncColor = syncRunning ? 'var(--orange)' : syncAge !== null && syncAge < 10 ? 'var(--green)' : 'var(--red)';
  const syncLabel = syncRunning ? '⟳ Sync in progress…' : syncAge !== null ? `Last sync: ${syncAge} min ago` : 'Never synced';

  html += `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:1.5rem">
      <div style="background:var(--card-bg,rgba(255,255,255,0.04));border:1px solid var(--border);border-radius:8px;padding:14px">
        <div style="font-size:0.75rem;color:var(--text3);margin-bottom:4px">SYNC STATUS</div>
        <div style="font-size:1.1rem;font-weight:600;color:${syncColor}">${syncLabel}</div>
      </div>
      <div style="background:var(--card-bg,rgba(255,255,255,0.04));border:1px solid var(--border);border-radius:8px;padding:14px">
        <div style="font-size:0.75rem;color:var(--text3);margin-bottom:4px">MONTHLY DATA</div>
        <div style="font-size:1.1rem;font-weight:600;color:var(--text1)">${monthlyTotals.length} months loaded</div>
      </div>
      <div style="background:var(--card-bg,rgba(255,255,255,0.04));border:1px solid var(--border);border-radius:8px;padding:14px">
        <div style="font-size:0.75rem;color:var(--text3);margin-bottom:4px">PRODUCT SALES DATA</div>
        <div style="font-size:1.1rem;font-weight:600;color:var(--text1)">${salesData.length.toLocaleString()} items</div>
      </div>
      <div style="background:var(--card-bg,rgba(255,255,255,0.04));border:1px solid var(--border);border-radius:8px;padding:14px">
        <div style="font-size:0.75rem;color:var(--text3);margin-bottom:4px">INVENTORY ITEMS</div>
        <div style="font-size:1.1rem;font-weight:600;color:var(--text1)">${rawData.length.toLocaleString()} products</div>
      </div>
    </div>`;

  // ── Monthly Revenue Validation ──
  html += `
    <h3 style="margin:0 0 10px;font-size:1rem;color:var(--text1)">Monthly Revenue — API vs Dashboard</h3>
    <div style="overflow-x:auto;margin-bottom:1.5rem">
    <table style="width:100%;border-collapse:collapse;font-size:0.82rem">
      <thead>
        <tr style="border-bottom:2px solid var(--border)">
          <th style="padding:8px 10px;text-align:left;color:var(--text3)">Month</th>
          <th style="padding:8px 10px;text-align:right;color:var(--text3)">Dashboard Revenue</th>
          <th style="padding:8px 10px;text-align:right;color:var(--text3)">API Revenue</th>
          <th style="padding:8px 10px;text-align:right;color:var(--text3)">Difference</th>
          <th style="padding:8px 10px;text-align:center;color:var(--text3)">Source</th>
          <th style="padding:8px 10px;text-align:center;color:var(--text3)">Status</th>
        </tr>
      </thead>
      <tbody>`;

  const sortedMonths = [...monthlyTotals].sort((a, b) => a.period.localeCompare(b.period));
  for (const mt of sortedMonths) {
    const v = (validation?.months || []).find(vm => vm.period === mt.period);
    const apiRev = v?.revenue;
    const diff = apiRev != null ? Math.abs(mt.revenue - apiRev) : null;
    const [, mm] = mt.period.split('-').map(Number);
    const label = `${MONTH_NAMES[mm]} ${mt.period.slice(0, 4)}`;

    let statusIcon, statusColor, source;
    if (!v) {
      statusIcon = '⚠️'; statusColor = 'var(--orange)'; source = 'static';
    } else if (!v.ok) {
      statusIcon = '❌'; statusColor = 'var(--red)'; source = 'fallback';
    } else if (diff !== null && diff < 1) {
      statusIcon = '✅'; statusColor = 'var(--green)'; source = 'api';
    } else if (diff !== null && diff < 100) {
      statusIcon = '✅'; statusColor = 'var(--green)'; source = 'api';
    } else {
      statusIcon = '⚠️'; statusColor = 'var(--orange)'; source = v.source || 'unknown';
    }

    const diffStr = diff != null ? (diff < 1 ? '-' : `$${diff.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`) : '-';
    const diffColor = diff != null && diff > 100 ? 'var(--red)' : 'var(--text3)';
    const sourceColors = { api: 'var(--green)', static: 'var(--orange)', fallback: 'var(--red)', unknown: 'var(--text3)' };

    html += `
        <tr style="border-bottom:1px solid var(--border)">
          <td style="padding:6px 10px;color:var(--text1)">${label}</td>
          <td style="padding:6px 10px;text-align:right;color:var(--text2)">${$f(mt.revenue)}</td>
          <td style="padding:6px 10px;text-align:right;color:var(--text2)">${apiRev != null ? $f(apiRev) : '<span style="color:var(--text3)">—</span>'}</td>
          <td style="padding:6px 10px;text-align:right;color:${diffColor}">${diffStr}</td>
          <td style="padding:6px 10px;text-align:center"><span style="font-size:0.72rem;padding:2px 6px;border-radius:4px;background:rgba(255,255,255,0.05);color:${sourceColors[source] || 'var(--text3)'}">${source}</span></td>
          <td style="padding:6px 10px;text-align:center">${statusIcon}</td>
        </tr>`;
  }

  html += `
      </tbody>
    </table>
    </div>`;

  // ── Data Completeness Checks ──
  html += `<h3 style="margin:0 0 10px;font-size:1rem;color:var(--text1)">Data Completeness</h3>
    <div style="overflow-x:auto;margin-bottom:1.5rem">
    <table style="width:100%;border-collapse:collapse;font-size:0.82rem">
      <thead>
        <tr style="border-bottom:2px solid var(--border)">
          <th style="padding:8px 10px;text-align:left;color:var(--text3)">Check</th>
          <th style="padding:8px 10px;text-align:right;color:var(--text3)">Value</th>
          <th style="padding:8px 10px;text-align:center;color:var(--text3)">Status</th>
        </tr>
      </thead>
      <tbody>`;

  // Check 1: All months from Jan to current have data
  const now = new Date();
  const curMonth = now.getMonth() + 1;
  const monthPeriods = monthlyTotals.map(m => m.period);
  let missingMonths = [];
  for (let m = 1; m <= curMonth; m++) {
    const p = `2026-${String(m).padStart(2, '0')}`;
    if (!monthPeriods.includes(p)) missingMonths.push(MONTH_NAMES[m]);
  }
  const monthCheck = missingMonths.length === 0;
  html += checkRow('All 2026 months present', monthCheck ? `${curMonth} of ${curMonth} months` : `Missing: ${missingMonths.join(', ')}`, monthCheck);

  // Check 2: No month has $0 revenue (except current month if early)
  const zeroRevMonths = sortedMonths.filter(m => m.revenue === 0 && m.period !== `2026-${String(curMonth).padStart(2, '0')}`);
  html += checkRow('No months with $0 revenue', zeroRevMonths.length === 0 ? 'All months have revenue' : `${zeroRevMonths.map(m => m.period).join(', ')} = $0`, zeroRevMonths.length === 0);

  // Check 3: Product sales data covers recent months
  const salesMonths = [...new Set(salesData.map(s => s.month))].sort();
  const recentSalesMonths = salesMonths.filter(m => m >= '2026-01');
  html += checkRow('Product-level sales data', `${recentSalesMonths.length} months with product data`, recentSalesMonths.length >= curMonth - 1);

  // Check 4: Inventory data loaded
  const invWithStock = rawData.filter(r => r['On hand'] > 0).length;
  html += checkRow('Inventory items with stock', `${invWithStock.toLocaleString()} items`, invWithStock > 100);

  // Check 5: Price data available
  const priceCount = Object.keys(state.PRICE_MAP || {}).length;
  const costCount = Object.keys(state.COST_MAP || {}).length;
  html += checkRow('Price data', `${priceCount} prices, ${costCount} costs`, priceCount > 50);

  // Check 6: API validation summary
  const apiOk = validation?.totalApiSuccess || 0;
  const apiFail = validation?.totalApiFailed || 0;
  html += checkRow('API month verification', validation ? `${apiOk} verified, ${apiFail} failed` : 'Not yet synced', validation ? apiFail === 0 : false);

  // Check 7: Consumption data
  html += checkRow('Consumption data', rawData.some(r => r.c90 > 0) ? 'Loaded' : 'Missing', rawData.some(r => r.c90 > 0));

  // Check 8: Sales by state
  const stateCount = Object.keys(state.SALES_BY_STATE || {}).length;
  html += checkRow('Sales by state', stateCount > 0 ? `${stateCount} states` : 'Not loaded', stateCount > 0);

  html += `
      </tbody>
    </table>
    </div>`;

  // ── Sync Log ──
  if (validation) {
    const failedMonths = validation.months.filter(v => !v.ok);
    if (failedMonths.length > 0) {
      html += `<h3 style="margin:0 0 10px;font-size:1rem;color:var(--red)">⚠️ Sync Errors</h3>
        <div style="background:rgba(255,60,60,0.08);border:1px solid rgba(255,60,60,0.2);border-radius:8px;padding:12px;margin-bottom:1.5rem;font-size:0.82rem">`;
      for (const fm of failedMonths) {
        html += `<div style="color:var(--red);margin-bottom:4px">❌ ${fm.period}: ${fm.error}</div>`;
      }
      html += `</div>`;
    }
  }

  // ── Tips ──
  html += `
    <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:8px;padding:14px;font-size:0.8rem;color:var(--text3)">
      <strong style="color:var(--text2)">Tips:</strong>
      <ul style="margin:6px 0 0;padding-left:20px;line-height:1.8">
        <li>Click <strong>Sync Finale</strong> to refresh all data from the API</li>
        <li>All months now fetch live revenue from the API (no stale static data)</li>
        <li>If a month shows ❌, the API call failed — try syncing again</li>
        <li>Inventory valuation is updated from Finale exports at end of each month</li>
      </ul>
    </div>`;

  el.innerHTML = html;
}

function checkRow(label, value, ok) {
  const icon = ok ? '✅' : '❌';
  const color = ok ? 'var(--text2)' : 'var(--red)';
  return `
        <tr style="border-bottom:1px solid var(--border)">
          <td style="padding:6px 10px;color:var(--text1)">${label}</td>
          <td style="padding:6px 10px;text-align:right;color:${color}">${value}</td>
          <td style="padding:6px 10px;text-align:center">${icon}</td>
        </tr>`;
}
