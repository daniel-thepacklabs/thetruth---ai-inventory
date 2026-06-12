import { state } from '../data/state.js';
import { fmt, getSalesProductType, getPackSize } from '../data/parsers.js';

export function renderSalesView() {
  const hasMonthly = state.MONTHLY_TOTALS && state.MONTHLY_TOTALS.length > 0;
  if (!hasMonthly && !state.SALES_DATA.length) return;

  const monthlyData = hasMonthly ? state.MONTHLY_TOTALS : [];
  const months = monthlyData.map(m => m.period);

  document.getElementById('sales-date-range').textContent =
    `${months[0]} to ${months[months.length - 1]} · ${months.length} months`;

  const byMonth = {};
  monthlyData.forEach(m => {
    byMonth[m.period] = { rev: m.revenue, units: m.units, orders: m.orders };
  });

  const totalRev   = monthlyData.reduce((s, m) => s + m.revenue, 0);
  const totalUnits = monthlyData.reduce((s, m) => s + m.units, 0);
  const totalOrders = monthlyData.reduce((s, m) => s + m.orders, 0);
  const fullMonths = monthlyData.filter(m => m.period !== '2026-06');
  const avgRev     = fullMonths.length ? fullMonths.reduce((s, m) => s + m.revenue, 0) / fullMonths.length : 0;
  const avgUnits   = fullMonths.length ? fullMonths.reduce((s, m) => s + m.units, 0) / fullMonths.length : 0;
  const $f = v => '$' + v.toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 });

  document.getElementById('kpi-revenue').textContent   = $f(totalRev);
  document.getElementById('kpi-units').textContent     = totalUnits.toLocaleString();
  document.getElementById('kpi-avg-rev').textContent   = $f(avgRev);
  document.getElementById('kpi-avg-units').textContent = Math.round(avgUnits).toLocaleString();

  const tbody    = document.getElementById('sales-monthly-body');
  const monthList = months.map((m, i) => ({ m, ...byMonth[m], prev: i > 0 ? byMonth[months[i-1]] : null }));
  tbody.innerHTML = monthList.map(({ m, rev, units, orders, prev }) => {
    const aov     = units > 0 ? rev / units : 0;
    const isPartial = m === '2026-06';
    const vsLabel = m === months[0] ? '—' : (() => {
      const diff = rev - (prev ? prev.rev : 0);
      const pct  = prev && prev.rev > 0 ? (diff / prev.rev * 100).toFixed(1) : '0';
      const col  = diff >= 0 ? 'var(--green)' : 'var(--red)';
      return `<span style="color:${col}">${diff >= 0 ? '+' : ''}${$f(Math.abs(diff))} (${pct}%)</span>`;
    })();
    const maxRev = Math.max(...months.map(mo => byMonth[mo].rev));
    const pct    = (rev / maxRev * 100).toFixed(1);
    return `<tr style="border-bottom:1px solid var(--border)${isPartial ? ';opacity:.7' : ''}">
      <td style="padding:.6rem 1rem;color:var(--text);font-weight:500">${m}${isPartial ? ' <span style="font-size:10px;color:var(--text3)">(partial)</span>' : ''}</td>
      <td style="padding:.6rem 1rem;text-align:right;font-family:var(--font-mono);color:var(--green)">${$f(rev)}</td>
      <td style="padding:.6rem 1rem;text-align:right;font-family:var(--font-mono)">${units.toLocaleString()}</td>
      <td style="padding:.6rem 1rem;text-align:right;font-family:var(--font-mono)">${orders.toLocaleString()}</td>
      <td style="padding:.6rem 1rem;text-align:right;font-family:var(--font-mono)">${$f(aov)}</td>
      <td style="padding:.6rem 1rem">
        <div style="display:flex;align-items:center;gap:8px">
          ${vsLabel}
          <div style="flex:1;height:4px;background:var(--bg4);border-radius:2px;min-width:60px">
            <div style="height:100%;width:${pct}%;background:var(--blue);border-radius:2px"></div>
          </div>
        </div>
      </td>
    </tr>`;
  }).join('');

  const avgAov = totalUnits > 0 ? totalRev / totalUnits : 0;
  tbody.innerHTML += `<tr style="background:var(--bg3);border-top:2px solid var(--border2)">
    <td style="padding:.6rem 1rem;font-weight:700;color:var(--accent)">TOTAL (12 mo)</td>
    <td style="padding:.6rem 1rem;text-align:right;font-family:var(--font-mono);font-weight:700;color:var(--green)">${$f(totalRev)}</td>
    <td style="padding:.6rem 1rem;text-align:right;font-family:var(--font-mono);font-weight:700">${totalUnits.toLocaleString()}</td>
    <td style="padding:.6rem 1rem;text-align:right;font-family:var(--font-mono);font-weight:700">${totalOrders.toLocaleString()}</td>
    <td style="padding:.6rem 1rem;text-align:right;font-family:var(--font-mono);font-weight:700">${$f(avgAov)}</td>
    <td></td>
  </tr>`;

  renderByProductType();
}

function renderByProductType() {
  const months = [...new Set(state.SALES_DATA.map(r => r.month))].sort();
  const tree = {}, typeTotals = {};

  state.SALES_DATA.forEach(r => {
    const [type, subtype] = getSalesProductType(r.pid, r.desc);
    const isPack = getPackSize(r.pid) > 1;
    if (!tree[type]) tree[type] = {};
    if (!tree[type][subtype]) tree[type][subtype] = {};
    if (!tree[type][subtype][r.month]) tree[type][subtype][r.month] = { rev:0, packs:0, singles:0 };
    tree[type][subtype][r.month].rev += r.subtotal;
    if (isPack) tree[type][subtype][r.month].packs   += r.qty;
    else        tree[type][subtype][r.month].singles += r.qty;
    if (!typeTotals[type]) typeTotals[type] = { rev:0, packs:0, singles:0 };
    typeTotals[type].rev += r.subtotal;
    if (isPack) typeTotals[type].packs   += r.qty;
    else        typeTotals[type].singles += r.qty;
  });

  const $r = v => '$' + v.toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 });
  const $u = v => v > 0 ? v.toLocaleString() : '-';
  const typeOrder  = ['Prerolls','Vapes','Edibles','Flower'];
  const typeColors = { Prerolls:'var(--green)', Vapes:'var(--blue)', Edibles:'var(--orange)', Flower:'#52c97a', Other:'var(--text3)' };

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
    const { rev:typeRev, packs:typePacks, singles:typeSingles } = typeTotals[type] || { rev:0, packs:0, singles:0 };
    grandRev += typeRev; grandPacks += typePacks; grandSingles += typeSingles;
    const typeByMonth = {};
    months.forEach(m => {
      const rev     = Object.values(tree[type]).reduce((s, sub) => s + ((sub[m] || {}).rev     || 0), 0);
      const packs   = Object.values(tree[type]).reduce((s, sub) => s + ((sub[m] || {}).packs   || 0), 0);
      const singles = Object.values(tree[type]).reduce((s, sub) => s + ((sub[m] || {}).singles || 0), 0);
      typeByMonth[m] = { rev, packs, singles };
      if (!grandByMonth[m]) grandByMonth[m] = { rev:0, packs:0, singles:0 };
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
      const sm      = tree[type][sub];
      const sRev    = Object.values(sm).reduce((s, v) => s + v.rev,     0);
      const sPacks  = Object.values(sm).reduce((s, v) => s + v.packs,   0);
      const sSingles= Object.values(sm).reduce((s, v) => s + v.singles, 0);
      html += `<tr style="border-bottom:0.5px solid var(--border)">
        <td style="padding:.4rem 1rem .4rem 1.75rem;color:var(--text2);font-size:11px;position:sticky;left:0;background:var(--bg2);z-index:2">└ ${sub}</td>
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

