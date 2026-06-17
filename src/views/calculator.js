const FORMULATIONS = {
  prerolls: {
    label: 'Prerolls',
    color: 'var(--green)',
    products: [
      {
        name: 'Mini Doink 5-Pack',
        variants: [
          {
            variant: 'THCA',
            jointsPerSingle: 5, gramsPerJoint: 1,
            packName: '10 Pack', jointsPerPack: 50,
            ingredients: [
              { name: 'Hemp Smalls', uom: 'g', wt: 0.72 },
              { name: 'Terps/Diluent', uom: 'g', wt: 0.018 },
              { name: 'HHC', uom: 'g', wt: 0.162 },
              { name: 'THCA ISO', uom: 'g', wt: 0.1 },
            ],
          },
          {
            variant: 'THCP',
            jointsPerSingle: 5, gramsPerJoint: 1,
            packName: '10 Pack', jointsPerPack: 50,
            ingredients: [
              { name: 'Hemp Smalls', uom: 'g', wt: 0.77 },
              { name: 'THCP', uom: 'g', wt: 0.005 },
              { name: 'HHC', uom: 'g', wt: 0.2 },
              { name: 'Terpenes', uom: 'g', wt: 0.026 },
            ],
          },
        ],
      },
      {
        name: 'Double Doink',
        variants: [
          {
            variant: 'THCP',
            jointsPerSingle: 2, gramsPerJoint: 1.5,
            packName: '5 Pack', jointsPerPack: 10,
            ingredients: [
              { name: 'Hemp Smalls', uom: 'g', wt: 0.77 },
              { name: 'HHC', uom: 'g', wt: 0.28 },
              { name: 'THCP', uom: 'g', wt: 0.006 },
              { name: 'Diluent', uom: 'g', wt: 0.28 },
              { name: 'Terpenes', uom: 'g', wt: 0.0256 },
            ],
          },
        ],
      },
      {
        name: 'Imperial Loaded',
        variants: [
          {
            variant: 'THCA',
            jointsPerSingle: 1, gramsPerJoint: 2,
            packName: '10 Pack', jointsPerPack: 10,
            ingredients: [
              { name: 'Hemp Smalls', uom: 'g', wt: 0.72 },
              { name: 'Terps/Diluent', uom: 'g', wt: 0.018 },
              { name: 'HHC', uom: 'g', wt: 0.162 },
              { name: 'THCA ISO', uom: 'g', wt: 0.1 },
            ],
          },
          {
            variant: 'THCP',
            jointsPerSingle: 1, gramsPerJoint: 2,
            packName: '10 Pack', jointsPerPack: 10,
            ingredients: [
              { name: 'Hemp Smalls', uom: 'g', wt: 1.54 },
              { name: 'THCP', uom: 'g', wt: 0.01 },
              { name: 'HHC', uom: 'g', wt: 0.4 },
              { name: 'Terpenes', uom: 'g', wt: 0.052 },
            ],
          },
        ],
      },
      {
        name: 'Jelly Hole',
        variants: [
          {
            variant: 'THCA',
            jointsPerSingle: 1, gramsPerJoint: 2,
            packName: '10 Pack', jointsPerPack: 10,
            ingredients: [
              { name: 'Hemp Smalls', uom: 'g', wt: 0.72 },
              { name: 'Terps/Diluent', uom: 'g', wt: 0.018 },
              { name: 'HHC', uom: 'g', wt: 0.162 },
              { name: 'THCA ISO', uom: 'g', wt: 0.1 },
              { name: 'Terpenes', uom: 'g', wt: 0.009 },
            ],
          },
          {
            variant: 'THCP',
            jointsPerSingle: 1, gramsPerJoint: 2,
            packName: '10 Pack', jointsPerPack: 10,
            ingredients: [
              { name: 'Hemp Smalls', uom: 'g', wt: 1.54 },
              { name: 'THCP', uom: 'g', wt: 0.013 },
              { name: 'HHC', uom: 'g', wt: 0.55 },
              { name: 'Terpenes', uom: 'g', wt: 0.052 },
            ],
          },
        ],
      },
    ],
  },
  vapes: {
    label: 'Vapes',
    color: 'var(--blue)',
    products: [
      {
        name: 'Imperial 1g Cart',
        variants: [
          {
            variant: 'THCP',
            unitsPerSingle: 1, gramsPerUnit: 1,
            packName: '6 Pack', unitsPerPack: 6,
            ingredients: [
              { name: 'HHC', uom: 'g', wt: 0.79 },
              { name: 'Diluent', uom: 'g', wt: 0.08 },
              { name: 'THCP', uom: 'g', wt: 0.05 },
              { name: 'Terpenes', uom: 'g', wt: 0.08 },
            ],
          },
        ],
      },
      {
        name: 'Lil Ripper',
        variants: [
          {
            variant: 'HHC',
            unitsPerSingle: 1, gramsPerUnit: 2,
            packName: '10 Pack', unitsPerPack: 10,
            ingredients: [
              { name: 'HHC', uom: 'g', wt: 1.7 },
              { name: 'Diluent', uom: 'g', wt: 0.16 },
              { name: 'Terpenes', uom: 'g', wt: 0.14 },
            ],
          },
          {
            variant: 'D8',
            unitsPerSingle: 1, gramsPerUnit: 2,
            packName: '10 Pack', unitsPerPack: 10,
            ingredients: [
              { name: 'KCA D8', uom: 'g', wt: 1.62 },
              { name: 'Amber D8', uom: 'g', wt: 0.08 },
              { name: 'Diluent', uom: 'g', wt: 0.16 },
              { name: 'Terpenes', uom: 'g', wt: 0.14 },
            ],
          },
          {
            variant: 'THCA',
            unitsPerSingle: 1, gramsPerUnit: 2,
            packName: '10 Pack', unitsPerPack: 10,
            ingredients: [
              { name: 'THCA ISO', uom: 'g', wt: 0.004 },
              { name: 'HHC', uom: 'g', wt: 1.7 },
              { name: 'Diluent', uom: 'g', wt: 0.16 },
              { name: 'Terpenes', uom: 'g', wt: 0.14 },
            ],
          },
          {
            variant: 'THCP',
            unitsPerSingle: 1, gramsPerUnit: 2,
            packName: '10 Pack', unitsPerPack: 10,
            ingredients: [
              { name: 'THCP', uom: 'g', wt: 0.2 },
              { name: 'HHC', uom: 'g', wt: 1.6 },
              { name: 'Diluent', uom: 'g', wt: 0.06 },
              { name: 'Terpenes', uom: 'g', wt: 0.15 },
            ],
          },
        ],
      },
    ],
  },
  gummies: {
    label: 'Edibles',
    color: 'var(--orange)',
    products: [
      {
        name: 'Froot Jam',
        variants: [
          {
            variant: 'Standard',
            unitsPerSingle: 1, gramsPerUnit: 1,
            packName: '10ct Pack', unitsPerPack: 10,
            ingredients: [
              { name: 'CBD ISO', uom: 'g', wt: 0.02 },
              { name: 'CBN ISO', uom: 'g', wt: 0.0025 },
              { name: 'CBG ISO', uom: 'g', wt: 0.0025 },
              { name: 'D9 Oil', uom: 'g', wt: 0.015 },
              { name: 'HHC Oil', uom: 'g', wt: 0.06 },
            ],
          },
        ],
      },
    ],
  },
};

let editingFormulation = null;

const LIQUID_INGREDIENTS = {
  'HHC': 1.04,
  'HHC Oil': 1.04,
  'THCP': 1.04,
  'Terpenes': 0.86,
  'Terps/Diluent': 0.92,
  'Terpene': 0.86,
  'Diluent': 0.95,
  'KCA D8': 1.04,
  'Amber D8': 1.04,
  'D9 Oil': 1.04,
};

function isLiquid(name) {
  return name in LIQUID_INGREDIENTS;
}

function gramsToMl(grams, name) {
  return grams / (LIQUID_INGREDIENTS[name] || 1);
}

function fmtVol(ml) {
  if (ml >= 1000) return (ml / 1000).toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' L';
  return ml.toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' mL';
}

function fmtG(v) {
  if (v >= 1000) return (v / 1000).toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' kg';
  return v.toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' g';
}

function fmtLbs(grams) {
  const lbs = grams / 453.592;
  return lbs.toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' lbs';
}

function getInputId(catKey, prodIdx, varIdx, type) {
  return `calc-${catKey}-${prodIdx}-${varIdx}-${type}`;
}

function recalculate() {
  const totals = {};
  const flowerMix = {};

  for (const [catKey, cat] of Object.entries(FORMULATIONS)) {
    cat.products.forEach((prod, pi) => {
      prod.variants.forEach((v, vi) => {
        const singleEl = document.getElementById(getInputId(catKey, pi, vi, 'single'));
        const packEl = document.getElementById(getInputId(catKey, pi, vi, 'pack'));
        const singleQty = parseInt(singleEl?.value) || 0;
        const packQty = parseInt(packEl?.value) || 0;

        const isPreroll = catKey === 'prerolls';
        const jointsEl = isPreroll ? document.getElementById(getInputId(catKey, pi, vi, 'joints')) : null;
        const jointsQty = parseInt(jointsEl?.value) || 0;
        let totalUnits;
        if (isPreroll) {
          totalUnits = singleQty * v.jointsPerSingle + packQty * v.jointsPerPack + jointsQty;
        } else {
          totalUnits = singleQty * (v.unitsPerSingle || 1) + packQty * (v.unitsPerPack || 10);
        }

        if (isPreroll && totalUnits > 0) {
          const mixType = v.variant.toUpperCase().includes('THCA') ? 'THCA' : 'THCP';
          const gramsPerJoint = v.gramsPerJoint || 1;
          const totalFlowerGrams = totalUnits * gramsPerJoint;
          if (!flowerMix[mixType]) flowerMix[mixType] = { grams: 0, joints: 0, sources: [] };
          flowerMix[mixType].grams += totalFlowerGrams;
          flowerMix[mixType].joints += totalUnits;
          flowerMix[mixType].sources.push({
            product: `${prod.name} ${v.variant}`,
            joints: totalUnits,
            grams: totalFlowerGrams,
          });
        }

        v.ingredients.forEach(ing => {
          const needed = totalUnits * ing.wt;
          if (needed > 0) {
            const key = ing.name;
            if (!totals[key]) totals[key] = { grams: 0, sources: [] };
            totals[key].grams += needed;
            totals[key].sources.push({
              product: `${prod.name} ${v.variant}`,
              qty: needed,
            });
          }
        });
      });
    });
  }

  renderFlowerTotals(flowerMix);
  renderResults(totals);
}

function renderFlowerTotals(flowerMix) {
  const el = document.getElementById('calc-flower-totals');
  if (!el) return;
  const types = Object.entries(flowerMix).sort((a, b) => b[1].grams - a[1].grams);

  if (!types.length) {
    el.innerHTML = '';
    return;
  }

  const colors = { THCA: 'var(--green)', THCP: 'var(--blue)' };
  let html = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:.75rem">`;

  for (const [type, data] of types) {
    const color = colors[type] || 'var(--text)';
    const breakdown = data.sources.map(s =>
      `<div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:0.5px solid var(--border)">
        <span style="color:var(--text2)">${s.product}</span>
        <span style="font-family:var(--font-mono);color:var(--text3)">${s.joints.toLocaleString()} joints · ${fmtG(s.grams)}</span>
      </div>`
    ).join('');

    html += `<div style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--r2);overflow:hidden">
      <div style="padding:.5rem .75rem;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">
        <div style="display:flex;align-items:center;gap:.4rem">
          <span style="width:8px;height:8px;border-radius:50%;background:${color}"></span>
          <span style="font-size:12px;font-weight:600;color:${color}">${type} Flower Mixture</span>
        </div>
        <span style="font-size:10px;color:var(--text3)">${data.joints.toLocaleString()} total joints</span>
      </div>
      <div style="padding:.6rem .75rem">
        <div style="display:flex;gap:1.5rem;margin-bottom:.5rem">
          <div>
            <div style="font-size:10px;color:var(--text3);text-transform:uppercase">Total Mix</div>
            <div style="font-size:16px;font-weight:600;font-family:var(--font-mono);color:${color}">${fmtG(data.grams)}</div>
          </div>
          <div>
            <div style="font-size:10px;color:var(--text3);text-transform:uppercase">Lbs</div>
            <div style="font-size:16px;font-weight:600;font-family:var(--font-mono);color:var(--text)">${fmtLbs(data.grams)}</div>
          </div>
        </div>
        <div style="font-size:11px">${breakdown}</div>
      </div>
    </div>`;
  }

  html += '</div>';
  el.innerHTML = html;
}

function renderResults(totals) {
  const el = document.getElementById('calc-results');
  const sorted = Object.entries(totals).sort((a, b) => b[1].grams - a[1].grams);

  if (!sorted.length) {
    el.innerHTML = `<div style="text-align:center;padding:2rem;color:var(--text3);font-size:12px">Enter quantities above to see ingredient requirements</div>`;
    return;
  }

  let html = `<div style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--r2);overflow:hidden">
    <div style="padding:.6rem 1rem;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:.5rem">
      <span style="font-size:13px;font-weight:600;color:var(--text)">Total Ingredients Needed</span>
      <span style="font-size:10px;color:var(--text3);background:var(--bg4);padding:1px 6px;border-radius:3px">${sorted.length} materials</span>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead><tr style="background:var(--bg4);position:sticky;top:0;z-index:2">
        <th style="padding:.5rem 1rem;text-align:left;color:var(--text3);font-weight:500">Ingredient</th>
        <th style="padding:.5rem .75rem;text-align:right;color:var(--text3);font-weight:500">Amount</th>
        <th style="padding:.5rem .75rem;text-align:right;color:var(--text3);font-weight:500">Weight</th>
        <th style="padding:.5rem 1rem;text-align:left;color:var(--text3);font-weight:500">Breakdown</th>
      </tr></thead><tbody>`;

  sorted.forEach(([name, data]) => {
    const liquid = isLiquid(name);
    const breakdown = data.sources.map(s => {
      const display = liquid ? fmtVol(gramsToMl(s.qty, name)) : fmtG(s.qty);
      return `<span style="display:inline-block;padding:1px 5px;background:var(--bg2);border:1px solid var(--border);border-radius:3px;margin:1px;font-size:10px;white-space:nowrap">${s.product}: ${display}</span>`;
    }).join(' ');

    const amountCol = liquid
      ? fmtVol(gramsToMl(data.grams, name))
      : fmtG(data.grams);
    const typeTag = liquid
      ? `<span style="font-size:9px;color:var(--blue);background:var(--bg2);padding:0 4px;border-radius:2px;margin-left:4px">LIQUID</span>`
      : '';
    const weightCol = liquid
      ? (gramsToMl(data.grams, name) / 1000).toLocaleString('en-US', { maximumFractionDigits: 3 }) + ' L'
      : fmtLbs(data.grams);

    html += `<tr style="border-bottom:1px solid var(--border)">
      <td style="padding:.5rem 1rem;font-weight:500;color:var(--text)">${name}${typeTag}</td>
      <td style="padding:.5rem .75rem;text-align:right;font-family:var(--font-mono);color:var(--green)">${amountCol}</td>
      <td style="padding:.5rem .75rem;text-align:right;font-family:var(--font-mono);color:var(--blue)">${weightCol}</td>
      <td style="padding:.5rem 1rem">${breakdown}</td>
    </tr>`;
  });

  html += '</tbody></table></div>';
  el.innerHTML = html;
}

function renderFormulationEditor(catKey, prodIdx, varIdx) {
  const v = FORMULATIONS[catKey].products[prodIdx].variants[varIdx];
  const prod = FORMULATIONS[catKey].products[prodIdx];
  const editorId = `formula-editor-${catKey}-${prodIdx}-${varIdx}`;
  const existing = document.getElementById(editorId);

  if (existing) {
    existing.remove();
    editingFormulation = null;
    return;
  }

  // Remove any other open editor
  document.querySelectorAll('.formula-editor').forEach(e => e.remove());

  const card = document.getElementById(`card-${catKey}-${prodIdx}-${varIdx}`);
  if (!card) return;

  const editor = document.createElement('div');
  editor.id = editorId;
  editor.className = 'formula-editor';
  editor.style.cssText = 'background:var(--bg1);border:1px solid var(--border2);border-radius:var(--r);padding:.75rem;margin-top:.5rem';

  let html = `<div style="font-size:11px;font-weight:600;color:var(--text);margin-bottom:.5rem">Edit Formulation: ${prod.name} ${v.variant}</div>
    <div style="display:grid;grid-template-columns:1fr 50px 80px;gap:4px;font-size:11px">
      <div style="color:var(--text3);font-weight:500">Ingredient</div>
      <div style="color:var(--text3);font-weight:500">UOM</div>
      <div style="color:var(--text3);font-weight:500">Wt/Unit</div>`;

  v.ingredients.forEach((ing, ii) => {
    html += `
      <div style="color:var(--text2);padding:2px 0">${ing.name}</div>
      <div style="color:var(--text3);padding:2px 0">${ing.uom}</div>
      <input type="number" step="0.001" value="${ing.wt}" data-ing="${ii}"
        style="padding:2px 4px;background:var(--bg3);border:1px solid var(--border2);border-radius:3px;color:var(--text);font-size:11px;font-family:var(--font-mono);width:100%;text-align:right"
        onchange="window.__calcUpdateFormula('${catKey}',${prodIdx},${varIdx},${ii},this.value)" />`;
  });

  html += `</div>
    <div style="margin-top:.5rem;display:flex;gap:.5rem;align-items:center">
      <button onclick="window.__calcAddIngredient('${catKey}',${prodIdx},${varIdx})"
        style="padding:3px 8px;background:var(--bg3);border:1px solid var(--border2);border-radius:3px;color:var(--green);font-size:10px;cursor:pointer">+ Add Ingredient</button>
      <span style="font-size:10px;color:var(--text3)">Changes apply immediately</span>
    </div>`;

  editor.innerHTML = html;
  card.appendChild(editor);
  editingFormulation = editorId;
}

function renderProductInputs() {
  const container = document.getElementById('calc-product-inputs');
  let html = '';

  for (const [catKey, cat] of Object.entries(FORMULATIONS)) {
    html += `<div style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--r2);overflow:hidden">
      <div style="padding:.5rem 1rem;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:.5rem">
        <span style="width:8px;height:8px;border-radius:50%;background:${cat.color}"></span>
        <span style="font-size:12px;font-weight:600;color:${cat.color}">${cat.label}</span>
      </div>
      <div style="display:grid;gap:0">`;

    cat.products.forEach((prod, pi) => {
      prod.variants.forEach((v, vi) => {
        const singleId = getInputId(catKey, pi, vi, 'single');
        const packId = getInputId(catKey, pi, vi, 'pack');
        const isPreroll = catKey === 'prerolls';
        const packLabel = v.packName || 'Pack';
        const singleDesc = isPreroll
          ? `${v.jointsPerSingle}J × ${v.gramsPerJoint}g`
          : `${v.gramsPerUnit}g`;
        const packDesc = isPreroll
          ? `${v.jointsPerPack}J × ${v.gramsPerJoint}g`
          : `${v.unitsPerPack} × ${v.gramsPerUnit}g`;

        html += `<div id="card-${catKey}-${pi}-${vi}" style="padding:.6rem 1rem;border-bottom:0.5px solid var(--border);display:flex;align-items:center;gap:1rem;flex-wrap:wrap">
          <div style="min-width:180px;flex:1">
            <div style="font-size:12px;font-weight:500;color:var(--text)">${prod.name} <span style="color:${cat.color};font-size:10px;background:var(--bg2);padding:1px 5px;border-radius:3px">${v.variant}</span></div>
            <div style="font-size:10px;color:var(--text3);margin-top:2px">${v.ingredients.map(i => i.name).join(' · ')}</div>
          </div>
          <div style="display:flex;gap:.75rem;align-items:center">
            <div style="display:flex;flex-direction:column;align-items:center;gap:2px">
              <span style="font-size:9px;color:var(--text3);text-transform:uppercase">Singles <span style="color:var(--text4)">(${singleDesc})</span></span>
              <input type="number" id="${singleId}" value="0" min="0" step="1"
                oninput="window.__calcRecalc()"
                style="width:80px;padding:4px 6px;background:var(--bg2);border:1px solid var(--border2);border-radius:var(--r);color:var(--text);font-size:12px;font-family:var(--font-mono);text-align:center" />
            </div>
            <div style="display:flex;flex-direction:column;align-items:center;gap:2px">
              <span style="font-size:9px;color:var(--text3);text-transform:uppercase">${packLabel} <span style="color:var(--text4)">(${packDesc})</span></span>
              <input type="number" id="${packId}" value="0" min="0" step="1"
                oninput="window.__calcRecalc()"
                style="width:80px;padding:4px 6px;background:var(--bg2);border:1px solid var(--border2);border-radius:var(--r);color:var(--text);font-size:12px;font-family:var(--font-mono);text-align:center" />
            </div>${isPreroll ? `
            <div style="display:flex;flex-direction:column;align-items:center;gap:2px">
              <span style="font-size:9px;color:var(--text3);text-transform:uppercase">Joints <span style="color:var(--text4)">(${v.gramsPerJoint}g ea)</span></span>
              <input type="number" id="${getInputId(catKey, pi, vi, 'joints')}" value="0" min="0" step="1"
                oninput="window.__calcRecalc()"
                style="width:80px;padding:4px 6px;background:var(--bg2);border:1px solid var(--border2);border-radius:var(--r);color:var(--text);font-size:12px;font-family:var(--font-mono);text-align:center" />
            </div>` : ''}
            <button onclick="window.__calcEditFormula('${catKey}',${pi},${vi})"
              style="padding:3px 8px;background:none;border:1px solid var(--border2);border-radius:3px;color:var(--text3);font-size:10px;cursor:pointer;white-space:nowrap" title="Edit formulation">⚙ Formula</button>
          </div>
        </div>`;
      });
    });

    html += '</div></div>';
  }

  container.innerHTML = html;
}

export function renderCalculatorView() {
  renderProductInputs();
  recalculate();

  window.__calcRecalc = recalculate;
  window.__calcResetAll = () => {
    document.querySelectorAll('#calc-product-inputs input[type="number"]').forEach(el => { el.value = '0'; });
    recalculate();
  };
  window.__calcEditFormula = renderFormulationEditor;
  window.__calcUpdateFormula = (catKey, pi, vi, ii, val) => {
    FORMULATIONS[catKey].products[pi].variants[vi].ingredients[ii].wt = parseFloat(val) || 0;
    recalculate();
  };
  window.__calcAddIngredient = (catKey, pi, vi) => {
    const name = prompt('Ingredient name:');
    if (!name) return;
    const wt = parseFloat(prompt('Weight per unit (grams):')) || 0;
    FORMULATIONS[catKey].products[pi].variants[vi].ingredients.push({ name, uom: 'g', wt });
    renderFormulationEditor(catKey, pi, vi);
    renderFormulationEditor(catKey, pi, vi);
    renderProductInputs();
    recalculate();
  };
}
