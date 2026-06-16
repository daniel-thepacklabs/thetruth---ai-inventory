import { state } from '../data/state.js';
import { fmt, getSalesProductType, getPackSize } from '../data/parsers.js';
import { computeForecast, computeForecastByType } from '../forecast/engine.js';

const MONTH_NAMES = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const $f = v => '$' + (v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const $u = v => v > 0 ? v.toLocaleString() : '-';

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

export function renderSalesView() {
  const hasMonthly = state.MONTHLY_TOTALS && state.MONTHLY_TOTALS.length > 0;
  if (!hasMonthly && !state.SALES_DATA.length) return;

  const allMonthlyData = hasMonthly ? state.MONTHLY_TOTALS : [];
  const allMonths = allMonthlyData.map(m => m.period);

  document.getElementById('sales-date-range').textContent =
    `${allMonths[0]} to ${allMonths[allMonths.length - 1]} · ${allMonths.length} months`;

  const byMonth = {};
  allMonthlyData.forEach(m => {
    byMonth[m.period] = { rev: m.revenue, units: m.units, orders: m.orders };
  });

  const yearEl = document.getElementById('filter-monthly-year');
  const monthEl = document.getElementById('filter-monthly-month');
  populateFilterDropdowns(allMonths, yearEl, monthEl, () => renderMonthlyTable(allMonths, byMonth));
  renderMonthlyTable(allMonths, byMonth);

  const yearEl2 = document.getElementById('filter-bytype-year');
  const monthEl2 = document.getElementById('filter-bytype-month');
  const allSalesMonths = [...new Set(state.SALES_DATA.map(r => r.month))].sort();
  populateFilterDropdowns(allSalesMonths, yearEl2, monthEl2, () => renderByProductType());
  renderByProductType();

  renderForecast(allMonths, byMonth);
}

function renderMonthlyTable(allMonths, byMonth) {
  const yearEl = document.getElementById('filter-monthly-year');
  const monthEl = document.getElementById('filter-monthly-month');
  const months = filterMonths(allMonths, yearEl, monthEl);

  const filteredData = months.map(m => ({ period: m, ...byMonth[m] }));
  const totalRev = filteredData.reduce((s, m) => s + m.rev, 0);
  const totalUnits = filteredData.reduce((s, m) => s + m.units, 0);
  const totalOrders = filteredData.reduce((s, m) => s + m.orders, 0);
  const cm = getCurrentMonthInfo();
  const fullMonths = filteredData.filter(m => m.period !== cm.period);
  const avgRev = fullMonths.length ? fullMonths.reduce((s, m) => s + m.rev, 0) / fullMonths.length : 0;
  const avgUnits = fullMonths.length ? fullMonths.reduce((s, m) => s + m.units, 0) / fullMonths.length : 0;

  document.getElementById('kpi-revenue').textContent = $f(totalRev);
  document.getElementById('kpi-units').textContent = totalUnits.toLocaleString();
  document.getElementById('kpi-avg-rev').textContent = $f(avgRev);
  document.getElementById('kpi-avg-units').textContent = Math.round(avgUnits).toLocaleString();

  const tbody = document.getElementById('sales-monthly-body');
  const monthList = months.map((m, i) => ({ m, ...byMonth[m], prev: i > 0 ? byMonth[months[i - 1]] : null }));
  tbody.innerHTML = monthList.map(({ m, rev, units, orders, prev }) => {
    const aov = units > 0 ? rev / units : 0;
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
  tbody.innerHTML += `<tr style="background:var(--bg3);border-top:2px solid var(--border2)">
    <td style="padding:.6rem 1rem;font-weight:700;color:var(--accent)">${label}</td>
    <td style="padding:.6rem 1rem;text-align:right;font-family:var(--font-mono);font-weight:700;color:var(--green)">${$f(totalRev)}</td>
    <td style="padding:.6rem 1rem;text-align:right;font-family:var(--font-mono);font-weight:700">${totalUnits.toLocaleString()}</td>
    <td style="padding:.6rem 1rem;text-align:right;font-family:var(--font-mono);font-weight:700">${totalOrders.toLocaleString()}</td>
    <td style="padding:.6rem 1rem;text-align:right;font-family:var(--font-mono);font-weight:700">${$f(avgAov)}</td>
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

  const typeOrder = ['Prerolls', 'Vapes', 'Edibles', 'Flower'];
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

    g.subs.sort((a, b) => b.projRev - a.projRev).forEach(sub => {
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
  const tree = {}, typeTotals = {};

  filtered.forEach(r => {
    const [type, subtype] = getSalesProductType(r.pid, r.desc);
    const isPack = getPackSize(r.pid) > 1;
    if (!tree[type]) tree[type] = {};
    if (!tree[type][subtype]) tree[type][subtype] = {};
    if (!tree[type][subtype][r.month]) tree[type][subtype][r.month] = { rev: 0, packs: 0, singles: 0 };
    tree[type][subtype][r.month].rev += r.subtotal;
    if (isPack) tree[type][subtype][r.month].packs += r.qty;
    else tree[type][subtype][r.month].singles += r.qty;
    if (!typeTotals[type]) typeTotals[type] = { rev: 0, packs: 0, singles: 0 };
    typeTotals[type].rev += r.subtotal;
    if (isPack) typeTotals[type].packs += r.qty;
    else typeTotals[type].singles += r.qty;
  });

  const $r = $f;
  const typeOrder = ['Prerolls', 'Vapes', 'Edibles', 'Flower'];
  const typeColors = { Prerolls: 'var(--green)', Vapes: 'var(--blue)', Edibles: 'var(--orange)', Flower: '#52c97a', Other: 'var(--text3)' };

  const thead = document.getElementById('by-type-head');
  thead.innerHTML = `<tr style="background:var(--bg3)">
    <th rowspan="2" style="padding:.5rem 1rem;text-align:left;color:var(--text3);font-weight:500;white-space:nowrap;position:sticky;left:0;background:var(--bg3);z-index:3;vertical-align:bottom;min-width:220px">Product Type / Sub</th>
    ${months.map(m => `<th colspan="3" style="padding:.4rem .65rem;text-align:center;color:var(--text3);font-weight:500;white-space:nowrap;border-left:1px solid var(--border2)">${m}</th>`).join('')}
    <th colspan="3" style="padding:.4rem .65rem;text-align:center;color:var(--text3);font-weight:600;border-left:2px solid var(--border2)">Total</th>
  </tr>
  <tr style="background:var(--bg3)">
    ${months.map(() => `
      <th style="padding:.3rem .5rem;text-align:right;color:var(--green);font-weight:400;font-size:10px;border-left:1px solid var(--border2);white-space:nowrap">Revenue</th>
      <th style="padding:.3rem .5rem;text-align:right;color:var(--blue);font-weight:400;font-size:10px;white-space:nowrap">Packs</th>
      <th style="padding:.3rem .5rem;text-align:right;color:var(--text3);font-weight:400;font-size:10px;white-space:nowrap">Singles</th>
    `).join('')}
    <th style="padding:.3rem .5rem;text-align:right;color:var(--green);font-weight:600;font-size:10px;border-left:2px solid var(--border2);white-space:nowrap">Revenue</th>
    <th style="padding:.3rem .5rem;text-align:right;color:var(--blue);font-weight:600;font-size:10px;white-space:nowrap">Packs</th>
    <th style="padding:.3rem .5rem;text-align:right;color:var(--text3);font-weight:600;font-size:10px;white-space:nowrap">Singles</th>
  </tr>`;

  const tbody = document.getElementById('by-type-body');
  let html = '', grandRev = 0, grandPacks = 0, grandSingles = 0;
  const grandByMonth = {};

  typeOrder.filter(t => tree[t]).forEach(type => {
    const col = typeColors[type];
    const { rev: typeRev, packs: typePacks, singles: typeSingles } = typeTotals[type] || { rev: 0, packs: 0, singles: 0 };
    grandRev += typeRev; grandPacks += typePacks; grandSingles += typeSingles;
    const typeByMonth = {};
    months.forEach(m => {
      const rev = Object.values(tree[type]).reduce((s, sub) => s + ((sub[m] || {}).rev || 0), 0);
      const packs = Object.values(tree[type]).reduce((s, sub) => s + ((sub[m] || {}).packs || 0), 0);
      const singles = Object.values(tree[type]).reduce((s, sub) => s + ((sub[m] || {}).singles || 0), 0);
      typeByMonth[m] = { rev, packs, singles };
      if (!grandByMonth[m]) grandByMonth[m] = { rev: 0, packs: 0, singles: 0 };
      grandByMonth[m].rev += rev; grandByMonth[m].packs += packs; grandByMonth[m].singles += singles;
    });
    html += `<tr style="background:var(--bg3);border-top:1px solid var(--border2)">
      <td style="padding:.55rem 1rem;font-weight:600;color:${col};position:sticky;left:0;background:var(--bg3);z-index:2">${type}</td>
      ${months.map(m => `
        <td style="padding:.5rem .5rem;text-align:right;font-family:var(--font-mono);font-weight:600;color:${col};border-left:1px solid var(--border2)">${$r(typeByMonth[m].rev)}</td>
        <td style="padding:.5rem .5rem;text-align:right;font-family:var(--font-mono);font-weight:600;color:var(--blue)">${$u(typeByMonth[m].packs)}</td>
        <td style="padding:.5rem .5rem;text-align:right;font-family:var(--font-mono);font-weight:600;color:var(--text2)">${$u(typeByMonth[m].singles)}</td>
      `).join('')}
      <td style="padding:.5rem .5rem;text-align:right;font-family:var(--font-mono);font-weight:600;color:${col};border-left:2px solid var(--border2)">${$r(typeRev)}</td>
      <td style="padding:.5rem .5rem;text-align:right;font-family:var(--font-mono);font-weight:600;color:var(--blue)">${$u(typePacks)}</td>
      <td style="padding:.5rem .5rem;text-align:right;font-family:var(--font-mono);font-weight:600;color:var(--text2)">${$u(typeSingles)}</td>
    </tr>`;
    Object.keys(tree[type]).sort().forEach(sub => {
      const sm = tree[type][sub];
      const sRev = Object.values(sm).reduce((s, v) => s + v.rev, 0);
      const sPacks = Object.values(sm).reduce((s, v) => s + v.packs, 0);
      const sSingles = Object.values(sm).reduce((s, v) => s + v.singles, 0);
      html += `<tr style="border-bottom:0.5px solid var(--border)">
        <td style="padding:.4rem 1rem .4rem 1.75rem;color:var(--text2);font-size:11px;position:sticky;left:0;background:var(--bg2);z-index:2">&lfloor; ${sub}</td>
        ${months.map(m => `
          <td style="padding:.4rem .5rem;text-align:right;font-family:var(--font-mono);font-size:11px;color:var(--text2);border-left:1px solid var(--border)">${sm[m] && sm[m].rev > 0 ? $r(sm[m].rev) : '-'}</td>
          <td style="padding:.4rem .5rem;text-align:right;font-family:var(--font-mono);font-size:11px;color:var(--blue)">${sm[m] ? $u(sm[m].packs) : '-'}</td>
          <td style="padding:.4rem .5rem;text-align:right;font-family:var(--font-mono);font-size:11px;color:var(--text3)">${sm[m] ? $u(sm[m].singles) : '-'}</td>
        `).join('')}
        <td style="padding:.4rem .5rem;text-align:right;font-family:var(--font-mono);font-size:11px;color:var(--text2);border-left:2px solid var(--border)">${$r(sRev)}</td>
        <td style="padding:.4rem .5rem;text-align:right;font-family:var(--font-mono);font-size:11px;color:var(--blue)">${$u(sPacks)}</td>
        <td style="padding:.4rem .5rem;text-align:right;font-family:var(--font-mono);font-size:11px;color:var(--text3)">${$u(sSingles)}</td>
      </tr>`;
    });
  });

  html += `<tr style="background:var(--bg3);border-top:2px solid var(--border2)">
    <td style="padding:.6rem 1rem;font-weight:700;color:var(--accent);position:sticky;left:0;background:var(--bg3);z-index:2">Grand Total</td>
    ${months.map(m => `
      <td style="padding:.6rem .5rem;text-align:right;font-family:var(--font-mono);font-weight:700;color:var(--accent);border-left:1px solid var(--border2)">${$r(grandByMonth[m]?.rev || 0)}</td>
      <td style="padding:.6rem .5rem;text-align:right;font-family:var(--font-mono);font-weight:700;color:var(--blue)">${$u(grandByMonth[m]?.packs || 0)}</td>
      <td style="padding:.6rem .5rem;text-align:right;font-family:var(--font-mono);font-weight:700;color:var(--text2)">${$u(grandByMonth[m]?.singles || 0)}</td>
    `).join('')}
    <td style="padding:.6rem .5rem;text-align:right;font-family:var(--font-mono);font-weight:700;color:var(--accent);border-left:2px solid var(--border2)">${$r(grandRev)}</td>
    <td style="padding:.6rem .5rem;text-align:right;font-family:var(--font-mono);font-weight:700;color:var(--blue)">${$u(grandPacks)}</td>
    <td style="padding:.6rem .5rem;text-align:right;font-family:var(--font-mono);font-weight:700;color:var(--text2)">${$u(grandSingles)}</td>
  </tr>`;

  tbody.innerHTML = html;
}
