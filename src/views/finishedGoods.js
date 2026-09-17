import { state } from '../data/state.js';
import { fmt } from '../data/parsers.js';
import BOM from '../data/finishedGoodsBom.json';

// Double Doink Jelly Hole uses 2 prerolls per single unit
const INNER_UNIT_MULT = { 'PDD-': 2 };

function getInnerMult(pid) {
  for (const prefix in INNER_UNIT_MULT) {
    if (pid.startsWith(prefix)) return INNER_UNIT_MULT[prefix];
  }
  return 1;
}

function getProductType(desc) {
  if (desc.startsWith('Edible')) return 'Edibles';
  if (desc.startsWith('Preroll')) return 'Prerolls';
  if (desc.startsWith('Vape')) return 'Vapes';
  return 'Other';
}

function buildData() {
  const raw = state.RAW_DATA;
  if (!raw || !raw.length) return [];

  const byId = {};
  raw.forEach(r => { byId[r.id] = r; });

  const results = [];

  for (const [singleSku, bom] of Object.entries(BOM)) {
    const single = byId[singleSku];
    const pack = bom.packSku ? byId[bom.packSku] : null;

    const singleS30 = single ? single.s30 : 0;
    const singleS90 = single ? single.s90 : 0;
    const packS30 = pack ? pack.s30 : 0;
    const packS90 = pack ? pack.s90 : 0;
    const packQty = bom.packQty || 1;

    // Combined sell-through in equivalent single units
    // Each pack sold = packQty single units (e.g., 838 ten-packs = 8,380 singles)
    const combined30 = singleS30 + (packS30 * packQty);
    const combined90 = singleS90 + (packS90 * packQty);
    const monthlyRate = combined90 / 3;

    const innerMult = getInnerMult(singleSku);

    // Build materials list: each packaging/component item with its per-unit quantity
    // Single unit materials
    const materials = [];
    const seen = new Set();

    bom.pkg.forEach(matId => {
      if (seen.has(matId)) return;
      seen.add(matId);
      // Per single unit: 1 of this material (× innerMult for special cases on components only)
      materials.push({ matId, type: 'pkg', perUnit: 1 });
    });

    bom.comp.forEach(matId => {
      if (seen.has(matId)) return;
      seen.add(matId);
      materials.push({ matId, type: 'comp', perUnit: innerMult });
    });

    // Pack-only materials (e.g., display box DBX- only in pack, not single)
    bom.packPkg.forEach(matId => {
      if (seen.has(matId)) return;
      seen.add(matId);
      // This item only appears in packs — need rate is per pack unit sold (not divided)
      materials.push({ matId, type: 'pkg', perUnit: 0, packOnly: true });
    });

    bom.packComp.forEach(matId => {
      if (seen.has(matId)) return;
      seen.add(matId);
      materials.push({ matId, type: 'comp', perUnit: 0, packOnly: true });
    });

    // Calculate material needs
    const matDetails = materials.map(m => {
      const matRow = byId[m.matId];
      const qoh = matRow ? matRow.onHand : 0;
      const onOrder = matRow ? matRow.onOrder : 0;
      const reserved = matRow ? matRow.reserved : 0;
      const available = qoh - reserved;
      const desc = matRow ? matRow.desc : '';

      let monthlyNeed;
      if (m.packOnly) {
        // Pack-only material (display box): need = pack units sold per month (not divided)
        // For packaging in packs: each pack sold needs 1 display box
        const packMonthlyRate = packS90 / 3;
        monthlyNeed = packMonthlyRate;
      } else {
        // Shared material: single units need perUnit each, pack units need (perUnit × packQty) each
        // Total = (singleRate × perUnit) + (packRate_in_packs × perUnit × packQty)
        // But we want it based on combined single-unit equivalent rate:
        // Actually: single sold needs m.perUnit of this material
        //           each pack sold needs m.perUnit × packQty of this material
        const singleMonthly = (singleS90 / 3) * m.perUnit;
        const packMonthly = (packS90 / 3) * m.perUnit * packQty;
        monthlyNeed = singleMonthly + packMonthly;
      }

      const mos = monthlyNeed > 0 ? available / monthlyNeed : 0;

      return {
        matId: m.matId,
        type: m.type,
        desc,
        perUnit: m.perUnit,
        packOnly: m.packOnly || false,
        monthlyNeed: Math.round(monthlyNeed * 100) / 100,
        qoh,
        available,
        onOrder,
        mos: Math.round(mos * 10) / 10,
      };
    });

    results.push({
      sku: singleSku,
      desc: bom.desc,
      productType: getProductType(bom.desc),
      packSku: bom.packSku,
      packQty,
      innerMult,
      singleS30,
      singleS90,
      packS30,
      packS90,
      combined30: Math.round(combined30 * 100) / 100,
      combined90: Math.round(combined90 * 100) / 100,
      monthlyRate: Math.round(monthlyRate * 100) / 100,
      singleQoh: single ? single.onHand : 0,
      packQoh: pack ? pack.onHand : 0,
      materials: matDetails,
    });
  }

  return results;
}

export function exportFinishedGoodsExcel() {
  const data = buildData();
  if (!data.length) return;

  const XLSX = window.XLSX;
  if (!XLSX) {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
    s.onload = () => exportFinishedGoodsExcel();
    document.head.appendChild(s);
    return;
  }

  const wb = XLSX.utils.book_new();
  const typeOrder = ['Prerolls', 'Vapes', 'Edibles', 'Other'];
  const groups = {};
  data.forEach(d => {
    if (!groups[d.productType]) groups[d.productType] = [];
    groups[d.productType].push(d);
  });

  // ── Sheet 1: Executive Summary ──
  const sumRows = [
    ['Finished Goods Summary — The Pack Labs'],
    [`Generated: ${new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })}`],
    [],
    ['Product Line', 'SKUs', 'Combined Units /30d', 'Combined Units /mo (90d avg)', 'Total FG QOH (equiv units)', 'Avg FG MOS'],
  ];

  let grandSkus = 0, grandC30 = 0, grandMo = 0, grandQoh = 0;
  typeOrder.filter(t => groups[t]).forEach(type => {
    const items = groups[type];
    const c30 = items.reduce((s, d) => s + d.combined30, 0);
    const mo = items.reduce((s, d) => s + d.monthlyRate, 0);
    const qoh = items.reduce((s, d) => s + d.singleQoh + d.packQoh * d.packQty, 0);
    const mosItems = items.filter(d => d.monthlyRate > 0);
    const avgMos = mosItems.length ? mosItems.reduce((s, d) => s + (d.singleQoh + d.packQoh * d.packQty) / d.monthlyRate, 0) / mosItems.length : 0;
    sumRows.push([type, items.length, Math.round(c30), Math.round(mo), Math.round(qoh), Math.round(avgMos * 10) / 10]);
    grandSkus += items.length; grandC30 += c30; grandMo += mo; grandQoh += qoh;
  });
  sumRows.push(['TOTAL', grandSkus, Math.round(grandC30), Math.round(grandMo), Math.round(grandQoh), '']);
  sumRows.push([]);
  sumRows.push(['Critical Materials (< 1 MOS)']);
  const critMats = {};
  data.forEach(d => d.materials.forEach(m => {
    if (m.monthlyNeed > 0 && m.mos > 0 && m.mos < 1 && !critMats[m.matId]) {
      critMats[m.matId] = m;
    }
  }));
  if (Object.keys(critMats).length) {
    sumRows.push(['Material', 'Type', 'QOH', 'Available', 'Need /mo (this SKU)', 'MOS']);
    Object.values(critMats).sort((a, b) => a.mos - b.mos).forEach(m => {
      sumRows.push([m.matId, m.type === 'pkg' ? 'Packaging' : 'Component', m.qoh, m.available, Math.round(m.monthlyNeed), m.mos]);
    });
  } else {
    sumRows.push(['None — all materials above 1 month of supply']);
  }

  const wsSummary = XLSX.utils.aoa_to_sheet(sumRows);
  wsSummary['!cols'] = [{wch:18},{wch:8},{wch:20},{wch:24},{wch:24},{wch:12}];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

  // ── Sheet 2: All SKUs ──
  const allHeaders = ['SKU', 'Description', 'Product Line', 'Pack SKU', 'Pack Qty',
    'Single 30d', 'Pack 30d', 'Combined 30d (equiv)', 'Monthly Rate (90d avg)',
    'Single QOH', 'Pack QOH', 'FG QOH (equiv)', 'FG MOS'];
  const allRows = [allHeaders];
  data.forEach(d => {
    const fgQoh = d.singleQoh + d.packQoh * d.packQty;
    const fgMos = d.monthlyRate > 0 ? Math.round(fgQoh / d.monthlyRate * 10) / 10 : 0;
    allRows.push([d.sku, d.desc, d.productType, d.packSku || '', d.packQty,
      d.singleS30, d.packS30, Math.round(d.combined30), Math.round(d.monthlyRate),
      d.singleQoh, d.packQoh, fgQoh, fgMos]);
  });
  const wsAll = XLSX.utils.aoa_to_sheet(allRows);
  wsAll['!cols'] = [{wch:18},{wch:50},{wch:12},{wch:18},{wch:8},{wch:10},{wch:10},{wch:18},{wch:18},{wch:10},{wch:10},{wch:14},{wch:8}];
  XLSX.utils.book_append_sheet(wb, wsAll, 'All SKUs');

  // ── Per product line: Packaging & Component breakdown ──
  typeOrder.filter(t => groups[t]).forEach(type => {
    const items = groups[type];
    items.sort((a, b) => a.sku.localeCompare(b.sku));

    // Aggregate material needs across all SKUs in this product line
    const matTotals = {};
    items.forEach(d => {
      d.materials.forEach(m => {
        if (!matTotals[m.matId]) {
          matTotals[m.matId] = { matId: m.matId, type: m.type, desc: m.desc, totalNeed: 0, qoh: m.qoh, available: m.available, onOrder: m.onOrder };
        }
        matTotals[m.matId].totalNeed += m.monthlyNeed;
      });
    });

    const sheetData = [];
    sheetData.push([`${type} — Finished Goods Breakdown`]);
    sheetData.push([`${items.length} SKUs`]);
    sheetData.push([]);

    // SKU table
    sheetData.push(['SKU', 'Description', 'Single 30d', 'Pack 30d', 'Combined /mo', 'FG QOH (equiv)', 'FG MOS']);
    items.forEach(d => {
      const fgQoh = d.singleQoh + d.packQoh * d.packQty;
      const fgMos = d.monthlyRate > 0 ? Math.round(fgQoh / d.monthlyRate * 10) / 10 : 0;
      sheetData.push([d.sku, d.desc, d.singleS30, d.packS30, Math.round(d.monthlyRate), fgQoh, fgMos]);
    });

    sheetData.push([]);
    sheetData.push([]);

    // Packaging summary
    sheetData.push([`${type} — Packaging Requirements`]);
    sheetData.push(['Material', 'Description', 'Total Need /mo', 'QOH', 'Available', 'On Order', 'MOS']);
    const pkgMats = Object.values(matTotals).filter(m => m.type === 'pkg').sort((a, b) => {
      const mosA = a.totalNeed > 0 ? a.available / a.totalNeed : 999;
      const mosB = b.totalNeed > 0 ? b.available / b.totalNeed : 999;
      return mosA - mosB;
    });
    pkgMats.forEach(m => {
      const mos = m.totalNeed > 0 ? Math.round(m.available / m.totalNeed * 10) / 10 : 0;
      sheetData.push([m.matId, m.desc, Math.round(m.totalNeed), m.qoh, m.available, m.onOrder, mos]);
    });

    sheetData.push([]);
    sheetData.push([]);

    // Component summary
    sheetData.push([`${type} — Component Requirements`]);
    sheetData.push(['Material', 'Description', 'Total Need /mo', 'QOH', 'Available', 'On Order', 'MOS']);
    const compMats = Object.values(matTotals).filter(m => m.type === 'comp').sort((a, b) => {
      const mosA = a.totalNeed > 0 ? a.available / a.totalNeed : 999;
      const mosB = b.totalNeed > 0 ? b.available / b.totalNeed : 999;
      return mosA - mosB;
    });
    if (compMats.length) {
      compMats.forEach(m => {
        const mos = m.totalNeed > 0 ? Math.round(m.available / m.totalNeed * 10) / 10 : 0;
        sheetData.push([m.matId, m.desc, Math.round(m.totalNeed), m.qoh, m.available, m.onOrder, mos]);
      });
    } else {
      sheetData.push(['(No components for this product line)']);
    }

    sheetData.push([]);
    sheetData.push([]);

    // Per-SKU material detail
    sheetData.push([`${type} — Per-SKU Material Detail`]);
    sheetData.push(['SKU', 'Material', 'Type', 'Need /mo', 'QOH', 'Available', 'MOS']);
    items.forEach(d => {
      d.materials.forEach(m => {
        sheetData.push([d.sku, m.matId + (m.packOnly ? ' (pack only)' : ''), m.type === 'pkg' ? 'Packaging' : 'Component',
          Math.round(m.monthlyNeed), m.qoh, m.available, m.mos]);
      });
    });

    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    ws['!cols'] = [{wch:18},{wch:50},{wch:16},{wch:14},{wch:12},{wch:12},{wch:8}];
    XLSX.utils.book_append_sheet(wb, ws, type.substring(0, 31));
  });

  XLSX.writeFile(wb, `Finished_Goods_Summary_${new Date().toISOString().slice(0,10)}.xlsx`);
}

function statusColor(mos) {
  if (mos <= 0) return 'var(--text3)';
  if (mos < 1) return 'var(--red)';
  if (mos < 2) return 'var(--orange)';
  if (mos < 3) return 'var(--yellow)';
  return 'var(--green)';
}

function mosLabel(mos) {
  if (mos <= 0) return '—';
  if (mos > 99) return '99+';
  return mos.toFixed(1);
}

export function renderFinishedGoodsView() {
  const el = document.getElementById('finishedgoods-view');
  if (!el) return;

  const data = buildData();
  if (!data.length) {
    el.innerHTML = `<div style="text-align:center;padding:3rem;color:var(--text3)">Waiting for sync to complete...</div>`;
    return;
  }

  // Group by product type
  const groups = {};
  const typeOrder = ['Prerolls', 'Vapes', 'Edibles', 'Other'];
  data.forEach(d => {
    if (!groups[d.productType]) groups[d.productType] = [];
    groups[d.productType].push(d);
  });

  // Sort each group by SKU
  Object.values(groups).forEach(arr => arr.sort((a, b) => a.sku.localeCompare(b.sku)));

  // Summary stats
  const totalSkus = data.length;
  const totalCombined30 = data.reduce((s, d) => s + d.combined30, 0);
  const criticalMats = new Set();
  data.forEach(d => d.materials.forEach(m => { if (m.mos > 0 && m.mos < 1) criticalMats.add(m.matId); }));

  let html = `
    <div style="margin-bottom:1.25rem">
      <div style="display:flex;align-items:center;gap:.75rem;margin-bottom:.5rem">
        <span style="font-size:16px;font-weight:600;color:var(--text)">Finished Goods</span>
        <span style="font-size:11px;color:var(--text3);background:var(--bg4);padding:2px 8px;border-radius:4px">${totalSkus} SKUs</span>
      </div>
      <div style="font-size:11px;color:var(--text3)">Combined sell-through (single + pack → equivalent units), packaging & component run rates</div>
      <button onclick="window.__fgExport()" style="margin-top:6px;padding:4px 12px;font-size:11px;background:var(--accent);color:#fff;border:none;border-radius:4px;cursor:pointer">Export Excel</button>
    </div>

    <div style="display:flex;gap:.75rem;margin-bottom:1.25rem;flex-wrap:wrap">
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--r2);padding:.75rem 1rem;min-width:140px">
        <div style="font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:.06em">Total SKUs</div>
        <div style="font-size:20px;font-weight:600;color:var(--text);font-family:var(--font-mono)">${totalSkus}</div>
      </div>
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--r2);padding:.75rem 1rem;min-width:140px">
        <div style="font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:.06em">Combined Units / 30d</div>
        <div style="font-size:20px;font-weight:600;color:var(--text);font-family:var(--font-mono)">${fmt(Math.round(totalCombined30))}</div>
      </div>
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--r2);padding:.75rem 1rem;min-width:140px">
        <div style="font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:.06em">Critical Materials</div>
        <div style="font-size:20px;font-weight:600;color:${criticalMats.size > 0 ? 'var(--red)' : 'var(--green)'};font-family:var(--font-mono)">${criticalMats.size}</div>
        <div style="font-size:9px;color:var(--text3)">&lt; 1 MOS</div>
      </div>
    </div>

    <div id="fg-filter-bar" style="display:flex;gap:6px;margin-bottom:1rem;flex-wrap:wrap">
      ${typeOrder.filter(t => groups[t]).map(t => `<span class="chip active" data-fg-type="${t}" onclick="window.__fgToggleType('${t}', this)" style="font-size:10px;padding:2px 8px;cursor:pointer">${t} (${groups[t].length})</span>`).join('')}
    </div>
  `;

  typeOrder.filter(t => groups[t]).forEach(type => {
    const items = groups[type];
    html += `
      <div class="fg-type-group" data-fg-group="${type}" style="margin-bottom:1.5rem">
        <div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:.5rem;display:flex;align-items:center;gap:.5rem">
          ${type}
          <span style="font-size:10px;color:var(--text3);font-weight:400">${items.length} SKUs</span>
        </div>
        <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--r2);overflow:hidden">
          <table style="width:100%;border-collapse:collapse;font-size:11px">
            <thead>
              <tr style="background:var(--bg3)">
                <th style="text-align:left;padding:6px 8px;color:var(--text3);font-weight:500;font-size:9px;text-transform:uppercase;letter-spacing:.04em;white-space:nowrap">SKU</th>
                <th style="text-align:left;padding:6px 8px;color:var(--text3);font-weight:500;font-size:9px;text-transform:uppercase;letter-spacing:.04em">Description</th>
                <th style="text-align:right;padding:6px 8px;color:var(--text3);font-weight:500;font-size:9px;text-transform:uppercase;letter-spacing:.04em;white-space:nowrap">Single 30d</th>
                <th style="text-align:right;padding:6px 8px;color:var(--text3);font-weight:500;font-size:9px;text-transform:uppercase;letter-spacing:.04em;white-space:nowrap">Pack 30d</th>
                <th style="text-align:right;padding:6px 8px;color:var(--text3);font-weight:500;font-size:9px;text-transform:uppercase;letter-spacing:.04em;white-space:nowrap">Combined /mo</th>
                <th style="text-align:right;padding:6px 8px;color:var(--text3);font-weight:500;font-size:9px;text-transform:uppercase;letter-spacing:.04em;white-space:nowrap">FG QOH</th>
                <th style="text-align:right;padding:6px 8px;color:var(--text3);font-weight:500;font-size:9px;text-transform:uppercase;letter-spacing:.04em;white-space:nowrap">FG MOS</th>
                <th style="text-align:center;padding:6px 8px;color:var(--text3);font-weight:500;font-size:9px;text-transform:uppercase;letter-spacing:.04em"></th>
              </tr>
            </thead>
            <tbody>
    `;

    items.forEach((item, idx) => {
      const fgAvail = item.singleQoh + (item.packQoh * item.packQty);
      const fgMos = item.monthlyRate > 0 ? fgAvail / item.monthlyRate : 0;
      const fgMosRound = Math.round(fgMos * 10) / 10;
      const rowBg = idx % 2 === 0 ? '' : 'background:var(--bg3);';
      const worstMat = item.materials.filter(m => m.monthlyNeed > 0).sort((a, b) => a.mos - b.mos)[0];
      const worstMos = worstMat ? worstMat.mos : 0;

      html += `
        <tr style="${rowBg}cursor:pointer" onclick="window.__fgToggleDetail('${item.sku}')">
          <td style="padding:5px 8px;font-family:var(--font-mono);color:var(--text);white-space:nowrap;font-size:10px">${item.sku}</td>
          <td style="padding:5px 8px;color:var(--text2);max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${item.desc}</td>
          <td style="padding:5px 8px;text-align:right;font-family:var(--font-mono);color:var(--text2)">${fmt(item.singleS30)}</td>
          <td style="padding:5px 8px;text-align:right;font-family:var(--font-mono);color:var(--text2)">${fmt(item.packS30)}</td>
          <td style="padding:5px 8px;text-align:right;font-family:var(--font-mono);color:var(--text);font-weight:500">${fmt(Math.round(item.monthlyRate))}</td>
          <td style="padding:5px 8px;text-align:right;font-family:var(--font-mono);color:var(--text2)">${fmt(fgAvail)}</td>
          <td style="padding:5px 8px;text-align:right;font-family:var(--font-mono);font-weight:500;color:${statusColor(fgMosRound)}">${mosLabel(fgMosRound)}</td>
          <td style="padding:5px 8px;text-align:center">
            ${worstMat && worstMos < 2 ? `<span style="font-size:9px;padding:1px 5px;border-radius:3px;background:${worstMos < 1 ? 'rgba(224,82,82,.15)' : 'rgba(224,124,58,.15)'};color:${worstMos < 1 ? 'var(--red)' : 'var(--orange)'}">${worstMat.matId} ${worstMos.toFixed(1)}mo</span>` : ''}
            <span style="font-size:9px;color:var(--text3);margin-left:4px">▼</span>
          </td>
        </tr>
        <tr id="fg-detail-${item.sku.replace(/[^a-zA-Z0-9]/g, '_')}" style="display:none">
          <td colspan="8" style="padding:0">
            ${renderDetailPanel(item)}
          </td>
        </tr>
      `;
    });

    html += `</tbody></table></div></div>`;
  });

  el.innerHTML = html;
}

function renderDetailPanel(item) {
  const pkgMats = item.materials.filter(m => m.type === 'pkg');
  const compMats = item.materials.filter(m => m.type === 'comp');

  let html = `<div style="padding:8px 16px 12px;background:var(--bg1);border-top:1px solid var(--border)">`;

  // Sell-through breakdown
  html += `<div style="display:flex;gap:1.5rem;margin-bottom:10px;flex-wrap:wrap">
    <div>
      <span style="font-size:9px;color:var(--text3);text-transform:uppercase">Single (${item.sku})</span>
      <div style="font-family:var(--font-mono);font-size:12px;color:var(--text)">30d: ${fmt(item.singleS30)} &nbsp;|&nbsp; 90d: ${fmt(item.singleS90)} &nbsp;|&nbsp; QOH: ${fmt(item.singleQoh)}</div>
    </div>
    <div>
      <span style="font-size:9px;color:var(--text3);text-transform:uppercase">Pack (${item.packSku || '—'}) × ${item.packQty}</span>
      <div style="font-family:var(--font-mono);font-size:12px;color:var(--text)">30d: ${fmt(item.packS30)} &nbsp;|&nbsp; 90d: ${fmt(item.packS90)} &nbsp;|&nbsp; QOH: ${fmt(item.packQoh)}</div>
    </div>
    <div>
      <span style="font-size:9px;color:var(--text3);text-transform:uppercase">Combined Equiv Units /mo</span>
      <div style="font-family:var(--font-mono);font-size:12px;color:var(--accent);font-weight:600">${fmt(Math.round(item.monthlyRate))}</div>
    </div>
    ${item.innerMult > 1 ? `<div><span style="font-size:9px;color:var(--orange);text-transform:uppercase">⚠ ${item.innerMult}x inner units</span><div style="font-size:10px;color:var(--text3)">${item.innerMult} units of each pkg/comp per single</div></div>` : ''}
  </div>`;

  // Materials table
  const allMats = [...pkgMats, ...compMats];
  if (allMats.length) {
    html += `<table style="width:100%;border-collapse:collapse;font-size:10px;margin-top:4px">
      <thead><tr style="border-bottom:1px solid var(--border)">
        <th style="text-align:left;padding:4px 6px;color:var(--text3);font-weight:500;font-size:9px;text-transform:uppercase">Material</th>
        <th style="text-align:left;padding:4px 6px;color:var(--text3);font-weight:500;font-size:9px;text-transform:uppercase">Type</th>
        <th style="text-align:right;padding:4px 6px;color:var(--text3);font-weight:500;font-size:9px;text-transform:uppercase">Need /mo</th>
        <th style="text-align:right;padding:4px 6px;color:var(--text3);font-weight:500;font-size:9px;text-transform:uppercase">QOH</th>
        <th style="text-align:right;padding:4px 6px;color:var(--text3);font-weight:500;font-size:9px;text-transform:uppercase">Available</th>
        <th style="text-align:right;padding:4px 6px;color:var(--text3);font-weight:500;font-size:9px;text-transform:uppercase">On Order</th>
        <th style="text-align:right;padding:4px 6px;color:var(--text3);font-weight:500;font-size:9px;text-transform:uppercase">MOS</th>
      </tr></thead><tbody>`;

    allMats.forEach(m => {
      html += `<tr style="border-bottom:1px solid var(--bg3)">
        <td style="padding:4px 6px;font-family:var(--font-mono);color:var(--text)">${m.matId}${m.packOnly ? ' <span style="font-size:8px;color:var(--text3)">(pack only)</span>' : ''}</td>
        <td style="padding:4px 6px;color:var(--text3)">${m.type === 'pkg' ? 'Packaging' : 'Component'}</td>
        <td style="padding:4px 6px;text-align:right;font-family:var(--font-mono);color:var(--text)">${fmt(Math.round(m.monthlyNeed))}</td>
        <td style="padding:4px 6px;text-align:right;font-family:var(--font-mono);color:var(--text2)">${fmt(m.qoh)}</td>
        <td style="padding:4px 6px;text-align:right;font-family:var(--font-mono);color:var(--text2)">${fmt(m.available)}</td>
        <td style="padding:4px 6px;text-align:right;font-family:var(--font-mono);color:var(--text2)">${fmt(m.onOrder)}</td>
        <td style="padding:4px 6px;text-align:right;font-family:var(--font-mono);font-weight:500;color:${statusColor(m.mos)}">${mosLabel(m.mos)}</td>
      </tr>`;
    });

    html += `</tbody></table>`;
  }

  html += `</div>`;
  return html;
}

// Toggle type filter
window.__fgToggleType = function(type, el) {
  el.classList.toggle('active');
  document.querySelectorAll(`[data-fg-group="${type}"]`).forEach(g => {
    g.style.display = el.classList.contains('active') ? '' : 'none';
  });
};

// Export
window.__fgExport = exportFinishedGoodsExcel;

// Toggle detail row
window.__fgToggleDetail = function(sku) {
  const id = 'fg-detail-' + sku.replace(/[^a-zA-Z0-9]/g, '_');
  const row = document.getElementById(id);
  if (row) row.style.display = row.style.display === 'none' ? '' : 'none';
};
