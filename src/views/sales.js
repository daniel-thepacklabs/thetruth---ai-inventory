import { state } from '../data/state.js';
import { fmt, getSalesProductType, getPackSize } from '../data/parsers.js';
import { computeForecast, computeForecastByType } from '../forecast/engine.js';
import { buildCogsLookup } from './cogs.js';

const MONTH_NAMES = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const $f = v => '$' + (v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const $u = v => v > 0 ? v.toLocaleString() : '-';
const marginColor = pct => pct >= 70 ? 'var(--green)' : pct >= 50 ? 'var(--blue)' : pct >= 30 ? 'var(--orange)' : 'var(--red)';

function getItemCogs(cogsLookup, pid, desc, qty) {
  const [, subtype] = getSalesProductType(pid, desc);
  const entry = cogsLookup[subtype];
  if (!entry) return 0;
  const packSize = getPackSize(pid);
  const unitCost = packSize > 1 ? entry.packCost : entry.singleCost;
  return unitCost * qty;
}

function getCurrentMonthInfo() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const period = `${year}-${String(month + 1).padStart(2, '0')}`;
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const pctElapsed = dayOfMonth / daysInMonth;
  return { period, dayOfMonth, daysInMonth, pctElapsed };
}

function populateFilterDropdowns(months, yearEl, monthEl, onChange) {
  const years = [...new Set(months.map(m => m.slice(0, 4)))].sort();
  yearEl.innerHTML = '<option value="">All Years</option>' + years.map(y => `<option value="${y}">${y}</option>`).join('');
  monthEl.innerHTML = '<option value="">All Months</option>' +
    Array.from({ length: 12 }, (_, i) => `<option value="${String(i + 1).padStart(2, '0')}">${MONTH_NAMES[i + 1]}</option>`).join('');
  yearEl.onchange = onChange;
  monthEl.onchange = onChange;
}

function filterMonths(months, yearEl, monthEl) {
  const y = yearEl.value;
  const m = monthEl.value;
  return months.filter(p => {
    if (y && !p.startsWith(y)) return false;
    if (m && p.slice(5, 7) !== m) return false;
    return true;
  });
}

function renderCurrentMonthSummary(byMonth) {
  const cm = getCurrentMonthInfo();
  const cur = byMonth[cm.period];
  const prevMonths = Object.keys(byMonth).filter(m => m < cm.period).sort();
  const lastMoPeriod = prevMonths.length ? prevMonths[prevMonths.length - 1] : null;
  const lastMo = lastMoPeriod ? byMonth[lastMoPeriod] : null;

  let container = document.getElementById('current-month-summary');
  if (!container) {
    container = document.createElement('div');
    container.id = 'current-month-summary';
    const salesView = document.getElementById('sales-view');
    const kpis = document.getElementById('sales-kpis');
    salesView.insertBefore(container, kpis);
  }

  if (!cur) { container.innerHTML = ''; return; }

  const projRev = cm.pctElapsed > 0 ? cur.rev / cm.pctElapsed : 0;
  const projUnits = cm.pctElapsed > 0 ? cur.units / cm.pctElapsed : 0;
  const vsRev = lastMo && lastMo.rev > 0 ? ((projRev - lastMo.rev) / lastMo.rev * 100) : 0;
  const vsCol = vsRev >= 0 ? 'var(--green)' : 'var(--red)';
  const monthName = MONTH_NAMES[parseInt(cm.period.slice(5))];

  container.innerHTML = `
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--r2);padding:.75rem 1rem;margin-bottom:1rem">
      <div style="font-size:12px;font-weight:500;color:var(--text);margin-bottom:.5rem">
        ${monthName} ${cm.period.slice(0,4)} — Current Month
        <span style="font-size:10px;color:var(--text3);margin-left:6px">${cm.dayOfMonth}/${cm.daysInMonth} days (${(cm.pctElapsed*100).toFixed(0)}%)</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px">
        <div class="stat-card" style="border-left:3px solid var(--green)">
          <div class="stat-label">MTD Revenue</div>
          <div class="stat-val c-green">${$f(cur.rev)}</div>
        </div>
        <div class="stat-card" style="border-left:3px solid var(--blue)">
          <div class="stat-label">MTD Units</div>
          <div class="stat-val c-blue">${cur.units.toLocaleString()}</div>
        </div>
        <div class="stat-card" style="border-left:3px solid var(--blue)">
          <div class="stat-label">Projected Revenue</div>
          <div class="stat-val c-blue">${$f(projRev)}</div>
        </div>
        <div class="stat-card" style="border-left:3px solid var(--blue)">
          <div class="stat-label">Projected Units</div>
          <div class="stat-val c-blue">${Math.round(projUnits).toLocaleString()}</div>
        </div>
        <div class="stat-card" style="border-left:3px solid ${vsCol}">
          <div class="stat-label">vs ${lastMoPeriod || 'Last Mo'}</div>
          <div class="stat-val" style="color:${vsCol}">${lastMo ? `${vsRev >= 0 ? '+' : ''}${vsRev.toFixed(1)}%` : '—'}</div>
          ${lastMo ? `<div style="font-size:10px;color:var(--text3)">${$f(lastMo.rev)}</div>` : ''}
        </div>
      </div>
    </div>`;
}

export function renderSalesView() {
  const hasMonthly = state.MONTHLY_TOTALS && state.MONTHLY_TOTALS.length > 0;
  if (!hasMonthly && !state.SALES_DATA.length) return;

  const allMonthlyData = hasMonthly ? state.MONTHLY_TOTALS : [];
  const allMonths = allMonthlyData.map(m => m.period);

  const curYear = String(new Date().getFullYear());
  const yearMonths = allMonths.filter(m => m.startsWith(curYear));
  const rangeMonths = yearMonths.length ? yearMonths : allMonths;
  const rangeLabel = rangeMonths.length
    ? `${MONTH_NAMES[parseInt(rangeMonths[0].slice(5))]} – ${MONTH_NAMES[parseInt(rangeMonths[rangeMonths.length-1].slice(5))]} ${curYear} · ${rangeMonths.length} months`
    : '';
  document.getElementById('sales-date-range').textContent = rangeLabel;

  const byMonth = {};
  allMonthlyData.forEach(m => {
    byMonth[m.period] = { rev: m.revenue, units: m.units, orders: m.orders, returns: m.returns || 0 };
  });

  renderCurrentMonthSummary(byMonth);

  const yearEl = document.getElementById('filter-monthly-year');
  const monthEl = document.getElementById('filter-monthly-month');
  populateFilterDropdowns(allMonths, yearEl, monthEl, () => renderMonthlyTable(allMonths, byMonth));
  yearEl.value = String(new Date().getFullYear());
  renderMonthlyTable(allMonths, byMonth);

  const yearEl2 = document.getElementById('filter-bytype-year');
  const monthEl2 = document.getElementById('filter-bytype-month');
  const allSalesMonths = [...new Set(state.SALES_DATA.map(r => r.month))].sort();
  populateFilterDropdowns(allSalesMonths, yearEl2, monthEl2, () => renderByProductType());
  renderByProductType();

  renderForecast(allMonths, byMonth);
  renderSalesByState();
}

function renderMonthlyTable(allMonths, byMonth) {
  const yearEl = document.getElementById('filter-monthly-year');
  const monthEl = document.getElementById('filter-monthly-month');
  const months = filterMonths(allMonths, yearEl, monthEl);

  const cogsLookup = buildCogsLookup();
  const cogsByMonth = {};
  state.SALES_DATA.forEach(r => {
    if (!months.includes(r.month)) return;
    if (!cogsByMonth[r.month]) cogsByMonth[r.month] = 0;
    cogsByMonth[r.month] += getItemCogs(cogsLookup, r.pid, r.desc, r.qty);
  });

  const filteredData = months.map(m => ({ period: m, ...byMonth[m], cogs: cogsByMonth[m] || 0 }));
  const totalRev = filteredData.reduce((s, m) => s + m.rev, 0);
  const totalUnits = filteredData.reduce((s, m) => s + m.units, 0);
  const totalOrders = filteredData.reduce((s, m) => s + m.orders, 0);
  const totalCogs = filteredData.reduce((s, m) => s + m.cogs, 0);
  const totalReturns = filteredData.reduce((s, m) => s + (m.returns || 0), 0);
  const cm = getCurrentMonthInfo();
  const fullMonths = filteredData.filter(m => m.period !== cm.period);
  const avgRev = fullMonths.length ? fullMonths.reduce((s, m) => s + m.rev, 0) / fullMonths.length : 0;
  const avgUnits = fullMonths.length ? fullMonths.reduce((s, m) => s + m.units, 0) / fullMonths.length : 0;

  document.getElementById('kpi-revenue').textContent = $f(totalRev);
  document.getElementById('kpi-units').textContent = totalUnits.toLocaleString();
  document.getElementById('kpi-avg-rev').textContent = $f(avgRev);
  document.getElementById('kpi-avg-units').textContent = Math.round(avgUnits).toLocaleString();

  const tbody = document.getElementById('sales-monthly-body');
  const monthList = months.map((m, i) => ({ m, ...byMonth[m], cogs: cogsByMonth[m] || 0, prev: i > 0 ? byMonth[months[i - 1]] : null }));
  tbody.innerHTML = monthList.map(({ m, rev, units, orders, cogs, returns, prev }) => {
    const aov = units > 0 ? rev / units : 0;
    const margin = rev > 0 ? ((rev - cogs) / rev) * 100 : 0;
    const mCol = cogs > 0 ? marginColor(margin) : 'var(--text3)';
    const isPartial = m === cm.period;
    const projected = isPartial && cm.pctElapsed > 0 ? rev / cm.pctElapsed : null;
    const vsLabel = !prev ? '—' : (() => {
      const diff = rev - prev.rev;
      const pct = prev.rev > 0 ? (diff / prev.rev * 100).toFixed(1) : '0';
      const col = diff >= 0 ? 'var(--green)' : 'var(--red)';
      return `<span style="color:${col}">${diff >= 0 ? '+' : ''}${$f(Math.abs(diff))} (${pct}%)</span>`;
    })();
    const maxRev = Math.max(...months.map(mo => byMonth[mo].rev));
    const pct = (rev / maxRev * 100).toFixed(1);
    const projectedBar = projected ? (projected / maxRev * 100).toFixed(1) : null;
    return `<tr style="border-bottom:1px solid var(--border)${isPartial ? ';background:rgba(99,179,237,0.04)' : ''}">
      <td style="padding:.6rem 1rem;color:var(--text);font-weight:500">${m}${isPartial ? ` <span style="font-size:10px;color:var(--text3)">(${cm.dayOfMonth}/${cm.daysInMonth} days)</span>` : ''}</td>
      <td style="padding:.6rem 1rem;text-align:right;font-family:var(--font-mono);color:var(--green)">${$f(rev)}${isPartial && projected ? `<br><span style="font-size:10px;color:var(--blue)">proj: ${$f(projected)}</span>` : ''}</td>
      <td style="padding:.6rem 1rem;text-align:right;font-family:var(--font-mono)">${units.toLocaleString()}${isPartial && projected ? `<br><span style="font-size:10px;color:var(--blue)">proj: ${Math.round(units / cm.pctElapsed).toLocaleString()}</span>` : ''}</td>
      <td style="padding:.6rem 1rem;text-align:right;font-family:var(--font-mono)">${orders.toLocaleString()}${isPartial && projected ? `<br><span style="font-size:10px;color:var(--blue)">proj: ${Math.round(orders / cm.pctElapsed).toLocaleString()}</span>` : ''}</td>
      <td style="padding:.6rem 1rem;text-align:right;font-family:var(--font-mono)">${$f(aov)}</td>
      <td style="padding:.6rem 1rem;text-align:right;font-family:var(--font-mono);color:var(--red)">${(returns || 0) > 0 ? $f(returns) : '—'}</td>
      <td style="padding:.6rem 1rem;text-align:right;font-family:var(--font-mono);color:var(--orange)">${cogs > 0 ? $f(cogs) : '—'}</td>
      <td style="padding:.6rem 1rem;text-align:right;font-family:var(--font-mono);font-weight:600;color:${mCol}">${cogs > 0 ? margin.toFixed(1) + '%' : '—'}</td>
      <td style="padding:.6rem 1rem">
        <div style="display:flex;align-items:center;gap:8px">
          ${vsLabel}
          <div style="flex:1;height:4px;background:var(--bg4);border-radius:2px;min-width:60px;position:relative">
            <div style="height:100%;width:${pct}%;background:var(--blue);border-radius:2px"></div>
            ${isPartial && projectedBar ? `<div style="position:absolute;top:-1px;left:${projectedBar}%;width:2px;height:6px;background:var(--blue);border-radius:1px;opacity:.5" title="Projected"></div>` : ''}
          </div>
        </div>
      </td>
    </tr>`;
  }).join('');

  const label = months.length === 1 ? months[0] : `TOTAL (${months.length} mo)`;
  const avgAov = totalUnits > 0 ? totalRev / totalUnits : 0;
  const totalMargin = totalRev > 0 ? ((totalRev - totalCogs) / totalRev) * 100 : 0;
  const tmCol = totalCogs > 0 ? marginColor(totalMargin) : 'var(--text3)';
  tbody.innerHTML += `<tr style="background:var(--bg3);border-top:2px solid var(--border2)">
    <td style="padding:.6rem 1rem;font-weight:700;color:var(--accent)">${label}</td>
    <td style="padding:.6rem 1rem;text-align:right;font-family:var(--font-mono);font-weight:700;color:var(--green)">${$f(totalRev)}</td>
    <td style="padding:.6rem 1rem;text-align:right;font-family:var(--font-mono);font-weight:700">${totalUnits.toLocaleString()}</td>
    <td style="padding:.6rem 1rem;text-align:right;font-family:var(--font-mono);font-weight:700">${totalOrders.toLocaleString()}</td>
    <td style="padding:.6rem 1rem;text-align:right;font-family:var(--font-mono);font-weight:700">${$f(avgAov)}</td>
    <td style="padding:.6rem 1rem;text-align:right;font-family:var(--font-mono);font-weight:700;color:var(--red)">${totalReturns > 0 ? $f(totalReturns) : '—'}</td>
    <td style="padding:.6rem 1rem;text-align:right;font-family:var(--font-mono);font-weight:700;color:var(--orange)">${totalCogs > 0 ? $f(totalCogs) : '—'}</td>
    <td style="padding:.6rem 1rem;text-align:right;font-family:var(--font-mono);font-weight:700;color:${tmCol}">${totalCogs > 0 ? totalMargin.toFixed(1) + '%' : '—'}</td>
    <td></td>
  </tr>`;
}

function renderForecast(allMonths, byMonth) {
  const cm = getCurrentMonthInfo();
  const current = byMonth[cm.period];
  if (!current || cm.pctElapsed <= 0) {
    document.getElementById('forecast-section').style.display = 'none';
    return;
  }
  document.getElementById('forecast-section').style.display = '';

  const fc = computeForecast(state.SALES_DATA, allMonths, cm.period, cm.dayOfMonth, cm.daysInMonth, current.orders);

  const priorMonths = allMonths.filter(m => m < cm.period);
  const lastMoPeriod = priorMonths.length ? priorMonths[priorMonths.length - 1] : null;
  const lastMo = lastMoPeriod ? byMonth[lastMoPeriod] : null;
  const lastMoRev = lastMo ? lastMo.rev : 0;
  const vsLastMoPct = lastMoRev > 0 ? ((fc.projRev - lastMoRev) / lastMoRev * 100) : 0;
  const vsLastMoCol = vsLastMoPct >= 0 ? 'var(--green)' : 'var(--red)';

  const factorNames = fc.factors.map(f => f.name).join(' · ');
  document.getElementById('forecast-basis').textContent =
    `${fc.factorCount} factors (${factorNames}) · ${cm.dayOfMonth}/${cm.daysInMonth} days (${(cm.pctElapsed * 100).toFixed(0)}% through ${MONTH_NAMES[parseInt(cm.period.slice(5))]})`;
  document.getElementById('fc-rev').textContent = $f(fc.projRev);
  document.getElementById('fc-units').textContent = Math.round(fc.projUnits).toLocaleString();
  document.getElementById('fc-orders').textContent = Math.round(fc.projOrders).toLocaleString();
  document.getElementById('fc-lastmo').textContent = lastMo ? $f(lastMoRev) : '—';
  const fcVsEl = document.getElementById('fc-vs-lastmo');
  fcVsEl.style.color = vsLastMoCol;
  fcVsEl.textContent = lastMo ? `${vsLastMoPct >= 0 ? '+' : ''}${vsLastMoPct.toFixed(1)}%` : '—';

  const pillsEl = document.getElementById('forecast-factor-pills');
  const factorsEl = document.getElementById('forecast-factors');
  if (pillsEl && fc.factors.length > 1) {
    factorsEl.style.display = '';
    const colors = { 'Run Rate': 'var(--blue)', 'Day-of-Week': 'var(--orange)', 'Reorder Cadence': 'var(--purple)', 'Trend': 'var(--green)', 'Velocity': '#e6a817', 'Seasonality': 'var(--text3)' };
    pillsEl.innerHTML = fc.factors.map(f => {
      const col = colors[f.name] || 'var(--text3)';
      const pct = (f.confidence * 100).toFixed(0);
      const projLabel = f.projRev > 0 ? $f(f.projRev) : '—';
      return `<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;background:var(--bg3);border:1px solid var(--border);border-radius:4px;font-size:10px;color:var(--text2)" title="${f.name}: projects ${projLabel}, confidence ${pct}%">
        <span style="width:6px;height:6px;border-radius:50%;background:${col}"></span>
        <span style="font-weight:500;color:${col}">${f.name}</span>
        <span>${projLabel}</span>
        <span style="color:var(--text3)">(${pct}%)</span>
      </span>`;
    }).join('');
  } else if (factorsEl) {
    factorsEl.style.display = 'none';
  }

  renderForecastByType(cm, lastMoPeriod, allMonths);
}

function renderForecastByType(cm, lastMoPeriod, allMonths) {
  const allSalesMonths = [...new Set(state.SALES_DATA.map(r => r.month))].sort();

  const rows = computeForecastByType(state.SALES_DATA, allSalesMonths, cm.period, cm.dayOfMonth, cm.daysInMonth, lastMoPeriod);

  const typeOrder = ['Prerolls', 'Vapes', 'Edibles', 'Flower', 'Other'];
  const typeColors = { Prerolls: 'var(--green)', Vapes: 'var(--blue)', Edibles: 'var(--orange)', Flower: '#52c97a', Other: 'var(--text3)' };
  const lastMoLabel = lastMoPeriod || 'Last Mo';
  const grouped = {};
  rows.forEach(r => {
    if (!grouped[r.type]) grouped[r.type] = { subs: [], projRev: 0, projUnits: 0, lastMoRev: 0, lastMoUnits: 0, curRev: 0 };
    grouped[r.type].subs.push(r);
    grouped[r.type].projRev += r.projRev;
    grouped[r.type].projUnits += r.projUnits;
    grouped[r.type].lastMoRev += r.lastMoRev;
    grouped[r.type].lastMoUnits += r.lastMoUnits;
    grouped[r.type].curRev += r.curRev;
  });

  const thead = document.getElementById('forecast-type-head');
  thead.innerHTML = `<tr style="background:var(--bg3);position:sticky;top:0;z-index:4">
    <th style="padding:.5rem 1rem;text-align:left;color:var(--text3);font-weight:500;min-width:200px;position:sticky;left:0;background:var(--bg3);z-index:5">Category</th>
    <th style="padding:.5rem .75rem;text-align:right;color:var(--text3);font-weight:500;white-space:nowrap;background:var(--bg3)">MTD Revenue</th>
    <th style="padding:.5rem .75rem;text-align:right;color:var(--blue);font-weight:500;white-space:nowrap;background:var(--bg3)">Projected Rev</th>
    <th style="padding:.5rem .75rem;text-align:right;color:var(--blue);font-weight:500;white-space:nowrap;background:var(--bg3)">Projected Units</th>
    <th style="padding:.5rem .75rem;text-align:right;color:var(--text3);font-weight:500;white-space:nowrap;background:var(--bg3)">${lastMoLabel} Rev</th>
    <th style="padding:.5rem .75rem;text-align:right;color:var(--text3);font-weight:500;white-space:nowrap;background:var(--bg3)">${lastMoLabel} Units</th>
    <th style="padding:.5rem .75rem;text-align:right;color:var(--text3);font-weight:500;white-space:nowrap;background:var(--bg3)">vs ${lastMoLabel}</th>
  </tr>`;

  const tbody = document.getElementById('forecast-type-body');
  let html = '';
  let gProjRev = 0, gProjUnits = 0, gLastMoRev = 0, gLastMoUnits = 0, gCurRev = 0;

  typeOrder.filter(t => grouped[t]).forEach(type => {
    const g = grouped[type];
    const col = typeColors[type] || 'var(--text)';
    const pace = g.lastMoRev > 0 ? ((g.projRev - g.lastMoRev) / g.lastMoRev * 100) : 0;
    const pCol = pace >= 0 ? 'var(--green)' : 'var(--red)';
    gProjRev += g.projRev; gProjUnits += g.projUnits; gLastMoRev += g.lastMoRev; gLastMoUnits += g.lastMoUnits; gCurRev += g.curRev;

    html += `<tr style="background:var(--bg3);border-top:1px solid var(--border2)">
      <td style="padding:.5rem 1rem;font-weight:600;color:${col};position:sticky;left:0;background:var(--bg3);z-index:2">${type}</td>
      <td style="padding:.5rem .75rem;text-align:right;font-family:var(--font-mono);font-weight:600;color:var(--text)">${$f(g.curRev)}</td>
      <td style="padding:.5rem .75rem;text-align:right;font-family:var(--font-mono);font-weight:600;color:var(--blue)">${$f(g.projRev)}</td>
      <td style="padding:.5rem .75rem;text-align:right;font-family:var(--font-mono);font-weight:600;color:var(--blue)">${g.projUnits.toLocaleString()}</td>
      <td style="padding:.5rem .75rem;text-align:right;font-family:var(--font-mono);color:var(--text2)">${$f(g.lastMoRev)}</td>
      <td style="padding:.5rem .75rem;text-align:right;font-family:var(--font-mono);color:var(--text2)">${g.lastMoUnits.toLocaleString()}</td>
      <td style="padding:.5rem .75rem;text-align:right;font-family:var(--font-mono);font-weight:600;color:${pCol}">${g.lastMoRev > 0 ? `${pace >= 0 ? '+' : ''}${pace.toFixed(1)}%` : '—'}</td>
    </tr>`;

    g.subs.sort((a, b) => {
      if (type === 'Prerolls') {
        const aThca = a.subtype.includes('THCA') ? 0 : 1;
        const bThca = b.subtype.includes('THCA') ? 0 : 1;
        if (aThca !== bThca) return aThca - bThca;
      }
      return b.projRev - a.projRev;
    }).forEach(sub => {
      const sp = sub.lastMoRev > 0 ? ((sub.projRev - sub.lastMoRev) / sub.lastMoRev * 100) : 0;
      const sCol = sp >= 0 ? 'var(--green)' : 'var(--red)';
      html += `<tr style="border-bottom:0.5px solid var(--border)">
        <td style="padding:.35rem 1rem .35rem 1.75rem;color:var(--text2);font-size:11px;position:sticky;left:0;background:var(--bg2);z-index:2">&lfloor; ${sub.subtype}</td>
        <td style="padding:.35rem .75rem;text-align:right;font-family:var(--font-mono);font-size:11px;color:var(--text2)">${sub.curRev > 0 ? $f(sub.curRev) : '-'}</td>
        <td style="padding:.35rem .75rem;text-align:right;font-family:var(--font-mono);font-size:11px;color:var(--blue)">${sub.projRev > 0 ? $f(sub.projRev) : '-'}</td>
        <td style="padding:.35rem .75rem;text-align:right;font-family:var(--font-mono);font-size:11px;color:var(--blue)">${$u(sub.projUnits)}</td>
        <td style="padding:.35rem .75rem;text-align:right;font-family:var(--font-mono);font-size:11px;color:var(--text3)">${sub.lastMoRev > 0 ? $f(sub.lastMoRev) : '-'}</td>
        <td style="padding:.35rem .75rem;text-align:right;font-family:var(--font-mono);font-size:11px;color:var(--text3)">${$u(sub.lastMoUnits)}</td>
        <td style="padding:.35rem .75rem;text-align:right;font-family:var(--font-mono);font-size:11px;font-weight:500;color:${sCol}">${sub.lastMoRev > 0 ? `${sp >= 0 ? '+' : ''}${sp.toFixed(1)}%` : '—'}</td>
      </tr>`;
    });
  });

  const gPace = gLastMoRev > 0 ? ((gProjRev - gLastMoRev) / gLastMoRev * 100) : 0;
  const gpCol = gPace >= 0 ? 'var(--green)' : 'var(--red)';
  html += `<tr style="background:var(--bg3);border-top:2px solid var(--border2)">
    <td style="padding:.6rem 1rem;font-weight:700;color:var(--accent);position:sticky;left:0;background:var(--bg3);z-index:2">Grand Total</td>
    <td style="padding:.6rem .75rem;text-align:right;font-family:var(--font-mono);font-weight:700;color:var(--text)">${$f(gCurRev)}</td>
    <td style="padding:.6rem .75rem;text-align:right;font-family:var(--font-mono);font-weight:700;color:var(--blue)">${$f(gProjRev)}</td>
    <td style="padding:.6rem .75rem;text-align:right;font-family:var(--font-mono);font-weight:700;color:var(--blue)">${gProjUnits.toLocaleString()}</td>
    <td style="padding:.6rem .75rem;text-align:right;font-family:var(--font-mono);font-weight:700;color:var(--text2)">${$f(gLastMoRev)}</td>
    <td style="padding:.6rem .75rem;text-align:right;font-family:var(--font-mono);font-weight:700;color:var(--text2)">${gLastMoUnits.toLocaleString()}</td>
    <td style="padding:.6rem .75rem;text-align:right;font-family:var(--font-mono);font-weight:700;color:${gpCol}">${gLastMoRev > 0 ? `${gPace >= 0 ? '+' : ''}${gPace.toFixed(1)}%` : '—'}</td>
  </tr>`;

  tbody.innerHTML = html;
}

function renderByProductType() {
  const yearEl = document.getElementById('filter-bytype-year');
  const monthEl = document.getElementById('filter-bytype-month');
  const allSalesMonths = [...new Set(state.SALES_DATA.map(r => r.month))].sort();
  const months = filterMonths(allSalesMonths, yearEl, monthEl);

  const filtered = state.SALES_DATA.filter(r => months.includes(r.month));
  const cogsLookup = buildCogsLookup();
  const tree = {}, typeTotals = {};

  filtered.forEach(r => {
    const [type, subtype] = getSalesProductType(r.pid, r.desc);
    const isPack = getPackSize(r.pid) > 1;
    const itemCogs = getItemCogs(cogsLookup, r.pid, r.desc, r.qty);
    if (!tree[type]) tree[type] = {};
    if (!tree[type][subtype]) tree[type][subtype] = {};
    if (!tree[type][subtype][r.month]) tree[type][subtype][r.month] = { rev: 0, packs: 0, singles: 0, cogs: 0 };
    tree[type][subtype][r.month].rev += r.subtotal;
    tree[type][subtype][r.month].cogs += itemCogs;
    if (isPack) tree[type][subtype][r.month].packs += r.qty;
    else tree[type][subtype][r.month].singles += r.qty;
    if (!typeTotals[type]) typeTotals[type] = { rev: 0, packs: 0, singles: 0, cogs: 0 };
    typeTotals[type].rev += r.subtotal;
    typeTotals[type].cogs += itemCogs;
    if (isPack) typeTotals[type].packs += r.qty;
    else typeTotals[type].singles += r.qty;
  });

  const $r = $f;
  const typeOrder = ['Prerolls', 'Vapes', 'Edibles', 'Flower', 'Other'];
  const typeColors = { Prerolls: 'var(--green)', Vapes: 'var(--blue)', Edibles: 'var(--orange)', Flower: '#52c97a', Other: 'var(--text3)' };

  const thead = document.getElementById('by-type-head');
  thead.innerHTML = `<tr style="background:var(--bg3)">
    <th rowspan="2" style="padding:.5rem 1rem;text-align:left;color:var(--text3);font-weight:500;white-space:nowrap;position:sticky;left:0;background:var(--bg3);z-index:3;vertical-align:bottom;min-width:220px">Product Type / Sub</th>
    ${months.map(m => `<th colspan="5" style="padding:.4rem .65rem;text-align:center;color:var(--text3);font-weight:500;white-space:nowrap;border-left:1px solid var(--border2)">${m}</th>`).join('')}
    <th colspan="5" style="padding:.4rem .65rem;text-align:center;color:var(--text3);font-weight:600;border-left:2px solid var(--border2)">Total</th>
  </tr>
  <tr style="background:var(--bg3)">
    ${months.map(() => `
      <th style="padding:.3rem .5rem;text-align:right;color:var(--green);font-weight:400;font-size:10px;border-left:1px solid var(--border2);white-space:nowrap">Revenue</th>
      <th style="padding:.3rem .5rem;text-align:right;color:var(--blue);font-weight:400;font-size:10px;white-space:nowrap">Packs</th>
      <th style="padding:.3rem .5rem;text-align:right;color:var(--text3);font-weight:400;font-size:10px;white-space:nowrap">Singles</th>
      <th style="padding:.3rem .5rem;text-align:right;color:var(--orange);font-weight:400;font-size:10px;white-space:nowrap">COGS</th>
      <th style="padding:.3rem .5rem;text-align:right;color:var(--text3);font-weight:400;font-size:10px;white-space:nowrap">Margin</th>
    `).join('')}
    <th style="padding:.3rem .5rem;text-align:right;color:var(--green);font-weight:600;font-size:10px;border-left:2px solid var(--border2);white-space:nowrap">Revenue</th>
    <th style="padding:.3rem .5rem;text-align:right;color:var(--blue);font-weight:600;font-size:10px;white-space:nowrap">Packs</th>
    <th style="padding:.3rem .5rem;text-align:right;color:var(--text3);font-weight:600;font-size:10px;white-space:nowrap">Singles</th>
    <th style="padding:.3rem .5rem;text-align:right;color:var(--orange);font-weight:600;font-size:10px;white-space:nowrap">COGS</th>
    <th style="padding:.3rem .5rem;text-align:right;color:var(--text3);font-weight:600;font-size:10px;white-space:nowrap">Margin</th>
  </tr>`;

  const tbody = document.getElementById('by-type-body');
  let html = '', grandRev = 0, grandPacks = 0, grandSingles = 0, grandCogs = 0;
  const grandByMonth = {};

  typeOrder.filter(t => tree[t]).forEach(type => {
    const col = typeColors[type];
    const { rev: typeRev, packs: typePacks, singles: typeSingles, cogs: typeCogs } = typeTotals[type] || { rev: 0, packs: 0, singles: 0, cogs: 0 };
    grandRev += typeRev; grandPacks += typePacks; grandSingles += typeSingles; grandCogs += typeCogs;
    const typeByMonth = {};
    months.forEach(m => {
      const rev = Object.values(tree[type]).reduce((s, sub) => s + ((sub[m] || {}).rev || 0), 0);
      const packs = Object.values(tree[type]).reduce((s, sub) => s + ((sub[m] || {}).packs || 0), 0);
      const singles = Object.values(tree[type]).reduce((s, sub) => s + ((sub[m] || {}).singles || 0), 0);
      const cogs = Object.values(tree[type]).reduce((s, sub) => s + ((sub[m] || {}).cogs || 0), 0);
      typeByMonth[m] = { rev, packs, singles, cogs };
      if (!grandByMonth[m]) grandByMonth[m] = { rev: 0, packs: 0, singles: 0, cogs: 0 };
      grandByMonth[m].rev += rev; grandByMonth[m].packs += packs; grandByMonth[m].singles += singles; grandByMonth[m].cogs += cogs;
    });
    const typeMargin = typeRev > 0 ? ((typeRev - typeCogs) / typeRev) * 100 : 0;
    const tmCol = typeCogs > 0 ? marginColor(typeMargin) : 'var(--text3)';
    html += `<tr style="background:var(--bg3);border-top:1px solid var(--border2)">
      <td style="padding:.55rem 1rem;font-weight:600;color:${col};position:sticky;left:0;background:var(--bg3);z-index:2">${type}</td>
      ${months.map(m => {
        const mm = typeByMonth[m].rev > 0 ? ((typeByMonth[m].rev - typeByMonth[m].cogs) / typeByMonth[m].rev * 100) : 0;
        const mc = typeByMonth[m].cogs > 0 ? marginColor(mm) : 'var(--text3)';
        return `
        <td style="padding:.5rem .5rem;text-align:right;font-family:var(--font-mono);font-weight:600;color:${col};border-left:1px solid var(--border2)">${$r(typeByMonth[m].rev)}</td>
        <td style="padding:.5rem .5rem;text-align:right;font-family:var(--font-mono);font-weight:600;color:var(--blue)">${$u(typeByMonth[m].packs)}</td>
        <td style="padding:.5rem .5rem;text-align:right;font-family:var(--font-mono);font-weight:600;color:var(--text2)">${$u(typeByMonth[m].singles)}</td>
        <td style="padding:.5rem .5rem;text-align:right;font-family:var(--font-mono);font-weight:500;color:var(--orange)">${typeByMonth[m].cogs > 0 ? $r(typeByMonth[m].cogs) : '—'}</td>
        <td style="padding:.5rem .5rem;text-align:right;font-family:var(--font-mono);font-weight:600;color:${mc}">${typeByMonth[m].cogs > 0 ? mm.toFixed(1) + '%' : '—'}</td>`;
      }).join('')}
      <td style="padding:.5rem .5rem;text-align:right;font-family:var(--font-mono);font-weight:600;color:${col};border-left:2px solid var(--border2)">${$r(typeRev)}</td>
      <td style="padding:.5rem .5rem;text-align:right;font-family:var(--font-mono);font-weight:600;color:var(--blue)">${$u(typePacks)}</td>
      <td style="padding:.5rem .5rem;text-align:right;font-family:var(--font-mono);font-weight:600;color:var(--text2)">${$u(typeSingles)}</td>
      <td style="padding:.5rem .5rem;text-align:right;font-family:var(--font-mono);font-weight:600;color:var(--orange)">${typeCogs > 0 ? $r(typeCogs) : '—'}</td>
      <td style="padding:.5rem .5rem;text-align:right;font-family:var(--font-mono);font-weight:600;color:${tmCol}">${typeCogs > 0 ? typeMargin.toFixed(1) + '%' : '—'}</td>
    </tr>`;
    Object.keys(tree[type]).sort((a, b) => {
      if (type === 'Prerolls') {
        const aThca = a.includes('THCA') ? 0 : 1;
        const bThca = b.includes('THCA') ? 0 : 1;
        if (aThca !== bThca) return aThca - bThca;
      }
      return a.localeCompare(b);
    }).forEach(sub => {
      const sm = tree[type][sub];
      const sRev = Object.values(sm).reduce((s, v) => s + v.rev, 0);
      const sPacks = Object.values(sm).reduce((s, v) => s + v.packs, 0);
      const sSingles = Object.values(sm).reduce((s, v) => s + v.singles, 0);
      const sCogs = Object.values(sm).reduce((s, v) => s + (v.cogs || 0), 0);
      const sMargin = sRev > 0 ? ((sRev - sCogs) / sRev) * 100 : 0;
      const smCol = sCogs > 0 ? marginColor(sMargin) : 'var(--text3)';
      html += `<tr style="border-bottom:0.5px solid var(--border)">
        <td style="padding:.4rem 1rem .4rem 1.75rem;color:var(--text2);font-size:11px;position:sticky;left:0;background:var(--bg2);z-index:2">&lfloor; ${sub}</td>
        ${months.map(m => {
          const mr = sm[m]?.rev || 0;
          const mc = sm[m]?.cogs || 0;
          const mm = mr > 0 ? ((mr - mc) / mr * 100) : 0;
          const mmc = mc > 0 ? marginColor(mm) : 'var(--text3)';
          return `
          <td style="padding:.4rem .5rem;text-align:right;font-family:var(--font-mono);font-size:11px;color:var(--text2);border-left:1px solid var(--border)">${sm[m] && sm[m].rev > 0 ? $r(sm[m].rev) : '-'}</td>
          <td style="padding:.4rem .5rem;text-align:right;font-family:var(--font-mono);font-size:11px;color:var(--blue)">${sm[m] ? $u(sm[m].packs) : '-'}</td>
          <td style="padding:.4rem .5rem;text-align:right;font-family:var(--font-mono);font-size:11px;color:var(--text3)">${sm[m] ? $u(sm[m].singles) : '-'}</td>
          <td style="padding:.4rem .5rem;text-align:right;font-family:var(--font-mono);font-size:11px;color:var(--orange)">${mc > 0 ? $r(mc) : '-'}</td>
          <td style="padding:.4rem .5rem;text-align:right;font-family:var(--font-mono);font-size:11px;font-weight:500;color:${mmc}">${mc > 0 ? mm.toFixed(1) + '%' : '-'}</td>`;
        }).join('')}
        <td style="padding:.4rem .5rem;text-align:right;font-family:var(--font-mono);font-size:11px;color:var(--text2);border-left:2px solid var(--border)">${$r(sRev)}</td>
        <td style="padding:.4rem .5rem;text-align:right;font-family:var(--font-mono);font-size:11px;color:var(--blue)">${$u(sPacks)}</td>
        <td style="padding:.4rem .5rem;text-align:right;font-family:var(--font-mono);font-size:11px;color:var(--text3)">${$u(sSingles)}</td>
        <td style="padding:.4rem .5rem;text-align:right;font-family:var(--font-mono);font-size:11px;color:var(--orange)">${sCogs > 0 ? $r(sCogs) : '-'}</td>
        <td style="padding:.4rem .5rem;text-align:right;font-family:var(--font-mono);font-size:11px;font-weight:500;color:${smCol}">${sCogs > 0 ? sMargin.toFixed(1) + '%' : '-'}</td>
      </tr>`;
    });
  });

  const grandMargin = grandRev > 0 ? ((grandRev - grandCogs) / grandRev * 100) : 0;
  const gmCol = grandCogs > 0 ? marginColor(grandMargin) : 'var(--text3)';
  html += `<tr style="background:var(--bg3);border-top:2px solid var(--border2)">
    <td style="padding:.6rem 1rem;font-weight:700;color:var(--accent);position:sticky;left:0;background:var(--bg3);z-index:2">Grand Total</td>
    ${months.map(m => {
      const gr = grandByMonth[m]?.rev || 0;
      const gc = grandByMonth[m]?.cogs || 0;
      const gm = gr > 0 ? ((gr - gc) / gr * 100) : 0;
      const gmc = gc > 0 ? marginColor(gm) : 'var(--text3)';
      return `
      <td style="padding:.6rem .5rem;text-align:right;font-family:var(--font-mono);font-weight:700;color:var(--accent);border-left:1px solid var(--border2)">${$r(gr)}</td>
      <td style="padding:.6rem .5rem;text-align:right;font-family:var(--font-mono);font-weight:700;color:var(--blue)">${$u(grandByMonth[m]?.packs || 0)}</td>
      <td style="padding:.6rem .5rem;text-align:right;font-family:var(--font-mono);font-weight:700;color:var(--text2)">${$u(grandByMonth[m]?.singles || 0)}</td>
      <td style="padding:.6rem .5rem;text-align:right;font-family:var(--font-mono);font-weight:700;color:var(--orange)">${gc > 0 ? $r(gc) : '—'}</td>
      <td style="padding:.6rem .5rem;text-align:right;font-family:var(--font-mono);font-weight:700;color:${gmc}">${gc > 0 ? gm.toFixed(1) + '%' : '—'}</td>`;
    }).join('')}
    <td style="padding:.6rem .5rem;text-align:right;font-family:var(--font-mono);font-weight:700;color:var(--accent);border-left:2px solid var(--border2)">${$r(grandRev)}</td>
    <td style="padding:.6rem .5rem;text-align:right;font-family:var(--font-mono);font-weight:700;color:var(--blue)">${$u(grandPacks)}</td>
    <td style="padding:.6rem .5rem;text-align:right;font-family:var(--font-mono);font-weight:700;color:var(--text2)">${$u(grandSingles)}</td>
    <td style="padding:.6rem .5rem;text-align:right;font-family:var(--font-mono);font-weight:700;color:var(--orange)">${grandCogs > 0 ? $r(grandCogs) : '—'}</td>
    <td style="padding:.6rem .5rem;text-align:right;font-family:var(--font-mono);font-weight:700;color:${gmCol}">${grandCogs > 0 ? grandMargin.toFixed(1) + '%' : '—'}</td>
  </tr>`;

  tbody.innerHTML = html;
}

const STATE_NAMES = {AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',CT:'Connecticut',DE:'Delaware',FL:'Florida',GA:'Georgia',HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming',DC:'Washington DC',GU:'Guam',PR:'Puerto Rico',VI:'US Virgin Islands',AS:'American Samoa',MP:'Northern Mariana Islands'};

function getQuarter(period) {
  const m = parseInt(period.split('-')[1]);
  if (m <= 3) return 'Q1';
  if (m <= 6) return 'Q2';
  if (m <= 9) return 'Q3';
  return 'Q4';
}

function getFilteredMonths(allMonths) {
  const yearSel = document.getElementById('state-year-filter');
  const qSel = document.getElementById('state-quarter-filter');
  const year = yearSel?.value || 'all';
  const quarter = qSel?.value || 'all';
  return allMonths.filter(m => {
    if (year !== 'all' && !m.startsWith(year)) return false;
    if (quarter !== 'all' && getQuarter(m) !== quarter) return false;
    return true;
  });
}

function renderSalesByState() {
  const data = state.SALES_BY_STATE;
  const thead = document.getElementById('sales-state-head');
  const tbody = document.getElementById('sales-state-body');
  if (!thead || !tbody || !data || !Object.keys(data).length) return;

  const allMonths = [...new Set(Object.values(data).map(d => d.period))].sort();

  const yearSel = document.getElementById('state-year-filter');
  if (yearSel && yearSel.options.length <= 1) {
    const years = [...new Set(allMonths.map(m => m.split('-')[0]))].sort();
    years.forEach(y => {
      const opt = document.createElement('option');
      opt.value = y; opt.textContent = y;
      yearSel.appendChild(opt);
    });
  }

  const months = getFilteredMonths(allMonths);
  if (!months.length) {
    thead.innerHTML = '';
    tbody.innerHTML = '<tr><td style="padding:2rem;text-align:center;color:var(--text3)">No data for selected period</td></tr>';
    return;
  }

  const stateMap = {};
  Object.values(data).forEach(d => {
    if (!months.includes(d.period)) return;
    if (!stateMap[d.state]) stateMap[d.state] = { total: 0, months: {} };
    stateMap[d.state].months[d.period] = d;
    stateMap[d.state].total += d.revenue;
  });
  const states = Object.keys(stateMap).sort((a, b) => stateMap[b].total - stateMap[a].total);

  const th = s => `<th style="padding:.5rem .6rem;text-align:right;color:var(--text3);font-weight:500;white-space:nowrap;font-size:11px">${s}</th>`;
  thead.innerHTML = `<tr style="background:var(--bg3)">
    <th style="padding:.5rem .6rem;text-align:left;color:var(--text3);font-weight:500;white-space:nowrap;font-size:11px;position:sticky;left:0;background:var(--bg3);z-index:1">State</th>
    ${months.map(m => th(m.slice(2))).join('')}
    ${th('Total')}
  </tr>`;

  const grandTotal = states.reduce((s, st) => s + stateMap[st].total, 0);
  const monthTotals = {};
  months.forEach(m => { monthTotals[m] = states.reduce((s, st) => s + (stateMap[st].months[m]?.revenue || 0), 0); });

  const maxStateRev = stateMap[states[0]]?.total || 1;

  tbody.innerHTML = states.map(st => {
    const sd = stateMap[st];
    const name = STATE_NAMES[st] || st;
    const pct = grandTotal > 0 ? (sd.total / grandTotal * 100).toFixed(1) : '0';
    return `<tr style="border-bottom:1px solid var(--border)">
      <td style="padding:.5rem .6rem;font-weight:500;color:var(--text);white-space:nowrap;position:sticky;left:0;background:var(--bg2);z-index:1" title="${name} — ${pct}% of total">
        ${st}
        <div style="height:2px;background:var(--bg4);border-radius:1px;margin-top:2px"><div style="height:100%;width:${(sd.total/maxStateRev*100).toFixed(1)}%;background:var(--blue);border-radius:1px"></div></div>
      </td>
      ${months.map(m => {
        const md = sd.months[m];
        if (!md) return '<td style="padding:.5rem .6rem;text-align:right;font-family:var(--font-mono);color:var(--text3);font-size:11px">—</td>';
        return `<td style="padding:.5rem .6rem;text-align:right;font-family:var(--font-mono);color:var(--green);font-size:11px;cursor:pointer" onclick="window.__stateDetail('${st}','${m}')" title="Click for ${name} ${m} breakdown">${$f(md.revenue)}</td>`;
      }).join('')}
      <td style="padding:.5rem .6rem;text-align:right;font-family:var(--font-mono);font-weight:600;color:var(--green);font-size:11px">${$f(sd.total)}</td>
    </tr>`;
  }).join('');

  tbody.innerHTML += `<tr style="background:var(--bg3);border-top:2px solid var(--border2)">
    <td style="padding:.5rem .6rem;font-weight:700;color:var(--accent);position:sticky;left:0;background:var(--bg3);z-index:1">TOTAL (${states.length})</td>
    ${months.map(m => `<td style="padding:.5rem .6rem;text-align:right;font-family:var(--font-mono);font-weight:700;color:var(--green);font-size:11px">${$f(monthTotals[m] || 0)}</td>`).join('')}
    <td style="padding:.5rem .6rem;text-align:right;font-family:var(--font-mono);font-weight:700;color:var(--green);font-size:11px">${$f(grandTotal)}</td>
  </tr>`;

  window.__stateDetail = (st, period) => {
    const drilldown = document.getElementById('state-drilldown');
    if (!drilldown) return;
    const key = `${st}|${period}`;
    const d = data[key];
    if (!d || !d.products || !Object.keys(d.products).length) {
      drilldown.style.display = 'block';
      drilldown.innerHTML = `<div style="font-size:12px;color:var(--text3)">No product-level detail for ${STATE_NAMES[st] || st} — ${period} (most shipments contain multiple products)</div>`;
      return;
    }
    const byCat = {};
    Object.entries(d.products).forEach(([pid, pd]) => {
      const [cat, sub] = getSalesProductType(pid, '');
      const catKey = cat + '|' + sub;
      if (!byCat[catKey]) byCat[catKey] = { cat, sub, revenue: 0, units: 0 };
      byCat[catKey].revenue += pd.revenue;
      byCat[catKey].units += pd.units;
    });
    const sorted = Object.values(byCat).sort((a, b) => b.revenue - a.revenue);
    const trackedRev = sorted.reduce((s, c) => s + c.revenue, 0);
    const untrackedRev = d.revenue - trackedRev;
    const name = STATE_NAMES[st] || st;
    let html = `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.5rem">
      <span style="font-size:12px;font-weight:600;color:var(--text)">${name} — ${period}</span>
      <span style="font-size:11px;color:var(--text3)">Total: ${$f(d.revenue)} · ${d.shipments} shipments</span>
    </div>`;
    html += '<table style="width:100%;border-collapse:collapse;font-size:11px">';
    html += '<tr style="background:var(--bg3)"><th style="padding:.4rem .6rem;text-align:left;color:var(--text3)">Category</th><th style="padding:.4rem .6rem;text-align:left;color:var(--text3)">Subcategory</th><th style="padding:.4rem .6rem;text-align:right;color:var(--text3)">Revenue</th><th style="padding:.4rem .6rem;text-align:right;color:var(--text3)">Units</th><th style="padding:.4rem .6rem;text-align:right;color:var(--text3)">% of State</th></tr>';
    sorted.forEach(c => {
      const pct = d.revenue > 0 ? (c.revenue / d.revenue * 100).toFixed(1) : '0';
      html += `<tr style="border-bottom:1px solid var(--border)">
        <td style="padding:.4rem .6rem;color:var(--text)">${c.cat}</td>
        <td style="padding:.4rem .6rem;color:var(--text2)">${c.sub}</td>
        <td style="padding:.4rem .6rem;text-align:right;font-family:var(--font-mono);color:var(--green)">${$f(c.revenue)}</td>
        <td style="padding:.4rem .6rem;text-align:right;font-family:var(--font-mono)">${c.units.toLocaleString()}</td>
        <td style="padding:.4rem .6rem;text-align:right;font-family:var(--font-mono)">${pct}%</td>
      </tr>`;
    });
    if (untrackedRev > 0) {
      const pct = (untrackedRev / d.revenue * 100).toFixed(1);
      html += `<tr style="border-bottom:1px solid var(--border)"><td style="padding:.4rem .6rem;color:var(--text3)" colspan="2">Multi-product orders (unattributed)</td><td style="padding:.4rem .6rem;text-align:right;font-family:var(--font-mono);color:var(--text3)">${$f(untrackedRev)}</td><td></td><td style="padding:.4rem .6rem;text-align:right;font-family:var(--font-mono);color:var(--text3)">${pct}%</td></tr>`;
    }
    html += '</table>';
    drilldown.style.display = 'block';
    drilldown.innerHTML = html;
  };

  window.__filterStateSales = () => {
    document.getElementById('state-drilldown').style.display = 'none';
    renderSalesByState();
  };

  window.__exportStateCSV = () => {
    import('../export.js').then(m => m.exportTableCSV('sales-state-table', 'sales-by-state.csv'));
  };

  window.__exportStatePDF = () => {
    import('../export.js').then(m => m.exportTablePDF('sales-state-table', 'Monthly Sales by State', 'sales-by-state.pdf'));
  };
}
