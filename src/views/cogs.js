import { state } from '../data/state.js';
import { exportTableCSV, exportTablePDF } from '../export.js';

const $f = v => '$' + (v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const $f4 = v => '$' + (v || 0).toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });

const INGREDIENT_MAP = {
  'Hemp Smalls':    { pid: null, uom: 'g', pattern: 'Flower - Hemp' },
  'HHC':            { pid: 'Oil - HHC', uom: 'g' },
  'HHC Oil':        { pid: 'Oil - HHC', uom: 'g' },
  'THCP':           { pid: 'Oil - D9THCP', uom: 'g' },
  'THCA ISO':       { pid: 'ISO - THCA', uom: 'g' },
  'CBD ISO':        { pid: 'ISO - CBD', uom: 'g' },
  'CBN ISO':        { pid: 'ISO - CBN', uom: 'g' },
  'CBG ISO':        { pid: 'ISO - CBG', uom: 'g' },
  'D9 Oil':         { pid: 'Oil - D9', uom: 'g' },
  'Diluent':        { pid: 'TRP-PEG', uom: 'g' },
  'Terps/Diluent':  { pid: 'TRP-PEG', uom: 'g' },
  'Terpenes':       { pid: null, uom: 'g', avgCostPerG: null },
  'KCA D8':         { pid: 'Oil - KCA D8', uom: 'g' },
  'Amber D8':       { pid: 'Oil - Amber D8', uom: 'g' },
};

const PACKAGING_MAP = {
  'TRY-KDL':     { pid: 'TRY-KDL', label: 'Kinder Lok' },
  'CON-DKI-D':   { pid: 'CON-DKI-D', label: 'Cone (Doink)' },
  'CON-DXP-LP':  { pid: 'CON-DXP-LP', label: 'Cone (Imperial LP)' },
  'CON-DKI-LP':  { pid: 'CON-DKI-LP', label: 'Cone (Doink LP)' },
  'CON-DXP-JH':  { pid: 'CON-DXP-JH', label: 'Cone (Jelly Hole)' },
  'TUB-DD-CLR':  { pid: 'TUB-DD-CLR', label: 'Tube (DD Clear)' },
  'TUB-IL-BLK':  { pid: 'TUB-IL-BLK', label: 'Tube (Imperial)' },
  'LID-IL-BLK':  { pid: 'LID-IL-BLK', label: 'Lid (Imperial)' },
  'TUB-JH-CLR':  { pid: 'TUB-JH-CLR', label: 'Tube (Jelly Hole)' },
  'INS-1GC':     { pid: 'INS-1GC', label: 'Insert (1g Cart)' },
  'TRY-1GC':     { pid: 'TRY-1GC', label: 'Tray (1g Cart)' },
  'INS-LR':      { pid: 'INS-LR', label: 'Insert (Lil Ripper)' },
  'INS-DBX':     { pid: 'INS-DBX', label: 'Insert (Display Box)' },
  'Lid-53mm':    { pid: 'Lid-53mm', label: 'Jar Lid 53mm' },
  'Lid-66mm':    { pid: 'Lid-66mm', label: 'Jar Lid 66mm' },
  'TRY-FJ-BTM':  { pid: 'TRY-FJ-BTM', label: 'Tray Bottom (Froot Jam)' },
  'TRY-FJ-TOP':  { pid: 'TRY-FJ-TOP', label: 'Tray Top (Froot Jam)' },
  'MYL-DD':      { pattern: 'MYL-DD-', label: 'Mylar (Double Doink)' },
  'MYL-05CT':    { pattern: 'MYL-05CT-', label: 'Mylar (5ct)' },
  'MYL-20CT':    { pattern: 'MYL-20CT-', label: 'Mylar (20ct)' },
  'MYL-CC':      { pattern: 'MYL-CC-', label: 'Mylar (Cereal Crunchies)' },
  'MYL-FM':      { pattern: 'MYL-FM-', label: 'Mylar (Microdose)' },
  'SLV-5PK':     { pattern: 'SLV-5PK-', label: 'Sleeve (Mini Doink)' },
  'SLV-1GC':     { pattern: 'SLV-1GC-', label: 'Sleeve (1g Cart)' },
  'SLV-LR':      { pattern: 'SLV-LR-', label: 'Sleeve (Lil Ripper)' },
  'DBX-5PK':     { pattern: 'DBX-5PK-', label: 'Display Box (5pk)' },
  'DBX-DD':      { pattern: 'DBX-DD-', label: 'Display Box (Double Doink)' },
  'DBX-IL':      { pattern: 'DBX-IL-', label: 'Display Box (Imperial Loaded)' },
  'DBX-JH':      { pattern: 'DBX-JH-', label: 'Display Box (Jelly Hole)' },
  'DBX-LR':      { pattern: 'DBX-LR-', label: 'Display Box (Lil Ripper)' },
  'DBX-1GC':     { pattern: 'DBX-1GC-', label: 'Display Box (1g Cart)' },
  'DBX-05CT':    { pattern: 'DBX-05CT-', label: 'Display Box (5ct)' },
  'DBX-20CT':    { pattern: 'DBX-20CT-', label: 'Display Box (20ct)' },
  'LID-JH':      { pattern: 'LID-JH-', label: 'Lid (Jelly Hole)' },
};

function getPackagingCost(key, costMap) {
  const mapping = PACKAGING_MAP[key];
  if (!mapping) return 0;
  if (mapping.pid) return costMap[mapping.pid] || 0;
  if (mapping.pattern) {
    const keys = Object.keys(costMap).filter(k => k.startsWith(mapping.pattern));
    if (keys.length === 0) return 0;
    return keys.reduce((s, k) => s + costMap[k], 0) / keys.length;
  }
  return 0;
}

function getPackagingLabel(key) {
  return PACKAGING_MAP[key]?.label || key;
}

function getAvgSalePrice(skuPattern, priceMap) {
  if (!skuPattern || !priceMap) return 0;
  const parts = skuPattern.split('*');
  const prefix = parts[0];
  const suffix = parts.length > 1 ? parts[1] : '';
  const matches = Object.entries(priceMap).filter(([k]) =>
    k.startsWith(prefix) && k.endsWith(suffix)
  );
  if (matches.length === 0) return 0;
  return matches.reduce((s, [, v]) => s + v, 0) / matches.length;
}

const FORMULATIONS = {
  prerolls: {
    label: 'Prerolls', color: 'var(--green)',
    products: [
      {
        name: 'Mini Doink 5-Pack',
        variants: [
          { variant: 'THCA', pcsPerSingle: 5, gramsPerPc: 1, pcsPerPack: 50,
            skuSingle: 'P5D-', skuPack: 'P5D-*-10PK',
            ingredients: [
              { name: 'Hemp Smalls', wt: 0.72 }, { name: 'Terps/Diluent', wt: 0.018 },
              { name: 'HHC', wt: 0.162 }, { name: 'THCA ISO', wt: 0.1 },
            ],
            packagingSingle: [
              { key: 'TRY-KDL', qty: 1 }, { key: 'SLV-5PK', qty: 1 }, { key: 'CON-DKI-D', qty: 5 },
            ],
            packagingPack: [
              { key: 'DBX-5PK', qty: 1 },
            ],
          },
          { variant: 'THCP', pcsPerSingle: 5, gramsPerPc: 1, pcsPerPack: 50,
            skuSingle: 'P5D-', skuPack: 'P5D-*-10PK',
            ingredients: [
              { name: 'Hemp Smalls', wt: 0.77 }, { name: 'THCP', wt: 0.005 },
              { name: 'HHC', wt: 0.2 }, { name: 'Terpenes', wt: 0.026 },
            ],
            packagingSingle: [
              { key: 'TRY-KDL', qty: 1 }, { key: 'SLV-5PK', qty: 1 }, { key: 'CON-DKI-D', qty: 5 },
            ],
            packagingPack: [
              { key: 'DBX-5PK', qty: 1 },
            ],
          },
        ],
      },
      {
        name: 'Double Doink',
        variants: [
          { variant: 'THCP', pcsPerSingle: 2, gramsPerPc: 1.5, pcsPerPack: 10,
            skuSingle: 'PDD-*-01', skuPack: 'PDD-*-5PK',
            ingredients: [
              { name: 'Hemp Smalls', wt: 0.77 }, { name: 'HHC', wt: 0.28 },
              { name: 'THCP', wt: 0.006 }, { name: 'Diluent', wt: 0.28 },
              { name: 'Terpenes', wt: 0.0256 },
            ],
            packagingSingle: [
              { key: 'MYL-DD', qty: 1 }, { key: 'TUB-DD-CLR', qty: 2 },
            ],
            packagingPack: [],
          },
        ],
      },
      {
        name: 'Imperial Loaded',
        variants: [
          { variant: 'THCA', pcsPerSingle: 1, gramsPerPc: 2, pcsPerPack: 10,
            skuSingle: 'PIL-*-01', skuPack: 'PIL-*-10PK',
            ingredients: [
              { name: 'Hemp Smalls', wt: 0.72 }, { name: 'Terps/Diluent', wt: 0.018 },
              { name: 'HHC', wt: 0.162 }, { name: 'THCA ISO', wt: 0.1 },
            ],
            packagingSingle: [
              { key: 'TUB-IL-BLK', qty: 1 }, { key: 'LID-IL-BLK', qty: 1 }, { key: 'CON-DXP-LP', qty: 1 },
            ],
            packagingPack: [
              { key: 'DBX-IL', qty: 1 }, { key: 'INS-DBX', qty: 1 },
            ],
          },
          { variant: 'THCP', pcsPerSingle: 1, gramsPerPc: 2, pcsPerPack: 10,
            skuSingle: 'PIL-*-01', skuPack: 'PIL-*-10PK',
            ingredients: [
              { name: 'Hemp Smalls', wt: 1.54 }, { name: 'THCP', wt: 0.01 },
              { name: 'HHC', wt: 0.4 }, { name: 'Terpenes', wt: 0.052 },
            ],
            packagingSingle: [
              { key: 'TUB-IL-BLK', qty: 1 }, { key: 'LID-IL-BLK', qty: 1 }, { key: 'CON-DKI-LP', qty: 1 },
            ],
            packagingPack: [
              { key: 'DBX-IL', qty: 1 }, { key: 'INS-DBX', qty: 1 },
            ],
          },
        ],
      },
      {
        name: 'Jelly Hole',
        variants: [
          { variant: 'THCA', pcsPerSingle: 1, gramsPerPc: 2, pcsPerPack: 10,
            skuSingle: 'PJH-*-01', skuPack: 'PJH-*-10PK',
            ingredients: [
              { name: 'Hemp Smalls', wt: 0.72 }, { name: 'Terps/Diluent', wt: 0.018 },
              { name: 'HHC', wt: 0.162 }, { name: 'THCA ISO', wt: 0.1 },
              { name: 'Terpenes', wt: 0.009 },
            ],
            packagingSingle: [
              { key: 'TUB-JH-CLR', qty: 1 }, { key: 'LID-JH', qty: 1 }, { key: 'CON-DXP-JH', qty: 1 },
            ],
            packagingPack: [
              { key: 'DBX-JH', qty: 1 }, { key: 'INS-DBX', qty: 1 },
            ],
          },
          { variant: 'THCP', pcsPerSingle: 1, gramsPerPc: 2, pcsPerPack: 10,
            skuSingle: 'PJH-*-01', skuPack: 'PJH-*-10PK',
            ingredients: [
              { name: 'Hemp Smalls', wt: 1.54 }, { name: 'THCP', wt: 0.013 },
              { name: 'HHC', wt: 0.55 }, { name: 'Terpenes', wt: 0.052 },
            ],
            packagingSingle: [
              { key: 'TUB-JH-CLR', qty: 1 }, { key: 'LID-JH', qty: 1 }, { key: 'CON-DXP-JH', qty: 1 },
            ],
            packagingPack: [
              { key: 'DBX-JH', qty: 1 }, { key: 'INS-DBX', qty: 1 },
            ],
          },
        ],
      },
    ],
  },
  vapes: {
    label: 'Vapes', color: 'var(--blue)',
    products: [
      {
        name: 'Imperial 1g Cart',
        variants: [
          { variant: 'THCP', pcsPerSingle: 1, gramsPerPc: 1, pcsPerPack: 6,
            skuSingle: 'VIC-*-01', skuPack: 'VIC-*-6PK',
            ingredients: [
              { name: 'HHC', wt: 0.79 }, { name: 'Diluent', wt: 0.08 },
              { name: 'THCP', wt: 0.05 }, { name: 'Terpenes', wt: 0.08 },
            ],
            packagingSingle: [
              { key: 'TRY-KDL', qty: 1 }, { key: 'SLV-1GC', qty: 1 }, { key: 'INS-1GC', qty: 1 },
            ],
            packagingPack: [
              { key: 'DBX-1GC', qty: 1 },
            ],
          },
        ],
      },
      {
        name: 'Lil Ripper',
        variants: [
          { variant: 'HHC', pcsPerSingle: 1, gramsPerPc: 2, pcsPerPack: 10,
            skuSingle: 'VLR-*-01', skuPack: 'VLR-*-10PK',
            ingredients: [
              { name: 'HHC', wt: 1.7 }, { name: 'Diluent', wt: 0.16 },
              { name: 'Terpenes', wt: 0.14 },
            ],
            packagingSingle: [
              { key: 'TRY-KDL', qty: 1 }, { key: 'SLV-LR', qty: 1 }, { key: 'INS-LR', qty: 1 },
            ],
            packagingPack: [
              { key: 'DBX-LR', qty: 1 },
            ],
          },
          { variant: 'D8', pcsPerSingle: 1, gramsPerPc: 2, pcsPerPack: 10,
            skuSingle: 'VLR-*-01', skuPack: 'VLR-*-10PK',
            ingredients: [
              { name: 'KCA D8', wt: 1.62 }, { name: 'Amber D8', wt: 0.08 },
              { name: 'Diluent', wt: 0.16 }, { name: 'Terpenes', wt: 0.14 },
            ],
            packagingSingle: [
              { key: 'TRY-KDL', qty: 1 }, { key: 'SLV-LR', qty: 1 }, { key: 'INS-LR', qty: 1 },
            ],
            packagingPack: [
              { key: 'DBX-LR', qty: 1 },
            ],
          },
          { variant: 'Liquid Diamonds', pcsPerSingle: 1, gramsPerPc: 2, pcsPerPack: 10,
            skuSingle: 'VLR-*-01', skuPack: 'VLR-*-10PK',
            ingredients: [
              { name: 'THCA ISO', wt: 0.004 }, { name: 'HHC', wt: 1.7 },
              { name: 'Diluent', wt: 0.16 }, { name: 'Terpenes', wt: 0.14 },
            ],
            packagingSingle: [
              { key: 'TRY-KDL', qty: 1 }, { key: 'SLV-LR', qty: 1 }, { key: 'INS-LR', qty: 1 },
            ],
            packagingPack: [
              { key: 'DBX-LR', qty: 1 },
            ],
          },
          { variant: 'THCP', pcsPerSingle: 1, gramsPerPc: 2, pcsPerPack: 10,
            skuSingle: 'VLR-*-01', skuPack: 'VLR-*-10PK',
            ingredients: [
              { name: 'THCP', wt: 0.2 }, { name: 'HHC', wt: 1.6 },
              { name: 'Diluent', wt: 0.06 }, { name: 'Terpenes', wt: 0.15 },
            ],
            packagingSingle: [
              { key: 'TRY-KDL', qty: 1 }, { key: 'SLV-LR', qty: 1 }, { key: 'INS-LR', qty: 1 },
            ],
            packagingPack: [
              { key: 'DBX-LR', qty: 1 },
            ],
          },
        ],
      },
    ],
  },
  edibles: {
    label: 'Edibles', color: 'var(--orange)',
    products: [
      {
        name: 'Euphoria Gummies',
        variants: [
          { variant: 'D9 (5ct)', pcsPerSingle: 5, gramsPerPc: 1, pcsPerPack: 40,
            skuSingle: 'EG*-05-01', skuPack: 'EG*-400-5PK',
            ingredients: [
              { name: 'CBD ISO', wt: 0.02 }, { name: 'CBN ISO', wt: 0.0025 },
              { name: 'CBG ISO', wt: 0.0025 }, { name: 'D9 Oil', wt: 0.015 },
              { name: 'HHC Oil', wt: 0.06 },
            ],
            packagingSingle: [
              { key: 'MYL-05CT', qty: 1 }, { key: 'Lid-53mm', qty: 1 },
            ],
            packagingPack: [{ key: 'DBX-05CT', qty: 1 }],
          },
          { variant: 'D9 (20ct)', pcsPerSingle: 20, gramsPerPc: 1, pcsPerPack: 100,
            skuSingle: 'EG*-20-01', skuPack: 'EG*-20-5PK',
            ingredients: [
              { name: 'CBD ISO', wt: 0.02 }, { name: 'CBN ISO', wt: 0.0025 },
              { name: 'CBG ISO', wt: 0.0025 }, { name: 'D9 Oil', wt: 0.015 },
              { name: 'HHC Oil', wt: 0.06 },
            ],
            packagingSingle: [
              { key: 'MYL-20CT', qty: 1 }, { key: 'Lid-66mm', qty: 1 },
            ],
            packagingPack: [{ key: 'DBX-20CT', qty: 1 }],
          },
        ],
      },
      {
        name: 'Froot Jam',
        variants: [
          { variant: 'Standard (10ct)', pcsPerSingle: 10, gramsPerPc: 1, pcsPerPack: 100,
            skuSingle: 'EGFJ-*-01', skuPack: null,
            ingredients: [
              { name: 'CBD ISO', wt: 0.02 }, { name: 'CBN ISO', wt: 0.0025 },
              { name: 'CBG ISO', wt: 0.0025 }, { name: 'D9 Oil', wt: 0.015 },
              { name: 'HHC Oil', wt: 0.06 },
            ],
            packagingSingle: [
              { key: 'TRY-FJ-BTM', qty: 1 }, { key: 'TRY-FJ-TOP', qty: 1 },
            ],
            packagingPack: [],
          },
        ],
      },
      {
        name: 'Cereal Crunchies',
        variants: [
          { variant: 'Standard (5ct)', pcsPerSingle: 5, gramsPerPc: 1, pcsPerPack: 40,
            skuSingle: 'ECC-*-01', skuPack: 'ECC-*-5PK',
            ingredients: [
              { name: 'CBD ISO', wt: 0.02 }, { name: 'CBN ISO', wt: 0.0025 },
              { name: 'CBG ISO', wt: 0.0025 }, { name: 'D9 Oil', wt: 0.015 },
              { name: 'HHC Oil', wt: 0.06 },
            ],
            packagingSingle: [{ key: 'MYL-CC', qty: 1 }],
            packagingPack: [],
          },
        ],
      },
      {
        name: 'Functional Microdose',
        variants: [
          { variant: 'Standard (5ct)', pcsPerSingle: 5, gramsPerPc: 1, pcsPerPack: 40,
            skuSingle: 'EGPR-*-01', skuPack: null,
            ingredients: [
              { name: 'CBD ISO', wt: 0.02 }, { name: 'CBN ISO', wt: 0.0025 },
              { name: 'CBG ISO', wt: 0.0025 }, { name: 'D9 Oil', wt: 0.015 },
              { name: 'HHC Oil', wt: 0.06 },
            ],
            packagingSingle: [{ key: 'MYL-FM', qty: 1 }],
            packagingPack: [],
          },
        ],
      },
    ],
  },
};

function getIngredientCostPerGram(ingredientName, costMap) {
  const mapping = INGREDIENT_MAP[ingredientName];
  if (!mapping) return { cost: 0, source: 'unmapped' };

  if (ingredientName === 'Terpenes') {
    const trpKeys = Object.keys(costMap).filter(k => k.startsWith('TRP-') && k !== 'TRP-PEG');
    if (trpKeys.length === 0) return { cost: 0, source: 'no data' };
    const avg = trpKeys.reduce((s, k) => s + costMap[k], 0) / trpKeys.length;
    return { cost: avg, source: `avg of ${trpKeys.length} terpenes` };
  }

  if (mapping.pattern) {
    const keys = Object.keys(costMap).filter(k => k.startsWith(mapping.pattern) && !(/PREMIUM|CBD/i.test(k)));
    if (keys.length > 0) {
      const avg = keys.reduce((s, k) => s + costMap[k], 0) / keys.length;
      const perLb = avg * 453.592;
      return { cost: avg, source: `avg of ${keys.length} hemp flower ($${perLb.toFixed(2)}/lb)` };
    }
    return { cost: 0, source: 'no hemp cost' };
  }

  const cost = costMap[mapping.pid];
  if (cost != null && cost > 0) return { cost, source: mapping.pid };
  return { cost: 0, source: 'no cost data' };
}

function computeProductCOGS(variant, costMap) {
  let costPerPiece = 0;
  const ingredientBreakdown = [];

  variant.ingredients.forEach(ing => {
    const { cost: costPerG, source } = getIngredientCostPerGram(ing.name, costMap);
    const ingCost = costPerG * ing.wt;
    costPerPiece += ingCost;
    ingredientBreakdown.push({ name: ing.name, wt: ing.wt, costPerG, cost: ingCost, source });
  });

  const rawMaterialPerSingle = costPerPiece * variant.pcsPerSingle;

  let packagingSingleCost = 0;
  const packagingSingleBreakdown = [];
  (variant.packagingSingle || []).forEach(pkg => {
    const unitCost = getPackagingCost(pkg.key, costMap);
    const totalCost = unitCost * pkg.qty;
    packagingSingleCost += totalCost;
    packagingSingleBreakdown.push({ label: getPackagingLabel(pkg.key), qty: pkg.qty, unitCost, cost: totalCost, key: pkg.key });
  });

  let packagingPackCost = 0;
  const packagingPackBreakdown = [];
  const singlesPerPack = variant.pcsPerPack / variant.pcsPerSingle;
  (variant.packagingPack || []).forEach(pkg => {
    const unitCost = getPackagingCost(pkg.key, costMap);
    const totalCost = unitCost * pkg.qty;
    packagingPackCost += totalCost;
    packagingPackBreakdown.push({ label: getPackagingLabel(pkg.key), qty: pkg.qty, unitCost, cost: totalCost, key: pkg.key });
  });

  const singleCost = rawMaterialPerSingle + packagingSingleCost;
  const packCost = (singleCost * singlesPerPack) + packagingPackCost;

  return {
    costPerPiece, rawMaterialPerSingle, packagingSingleCost, packagingPackCost,
    singleCost, packCost, ingredientBreakdown, packagingSingleBreakdown,
    packagingPackBreakdown, singlesPerPack,
  };
}

const SUBTYPE_TO_VARIANT = {
  'Mini Doink 5-Pack THCA': ['Mini Doink 5-Pack', 'THCA'],
  'Mini Doink 5-Pack THCP': ['Mini Doink 5-Pack', 'THCP'],
  'Double Doink': ['Double Doink', 'THCP'],
  'Imperial Loaded THCA': ['Imperial Loaded', 'THCA'],
  'Imperial Loaded THCP': ['Imperial Loaded', 'THCP'],
  'Jelly Hole THCA': ['Jelly Hole', 'THCA'],
  'Jelly Hole THCP': ['Jelly Hole', 'THCP'],
  'Imperial 1G Cartridge': ['Imperial 1g Cart', 'THCP'],
  'Lil Ripper HHC': ['Lil Ripper', 'HHC'],
  'Lil Ripper D8': ['Lil Ripper', 'D8'],
  'Lil Ripper Liquid Diamonds': ['Lil Ripper', 'Liquid Diamonds'],
  'Lil Ripper THCP': ['Lil Ripper', 'THCP'],
  'Euphoria Gummies D9': ['Euphoria Gummies', 'D9 (5ct)'],
  'Froot Jam': ['Froot Jam', 'Standard (10ct)'],
  'Cereal Crunchies': ['Cereal Crunchies', 'Standard (5ct)'],
  'Functional Microdose': ['Functional Microdose', 'Standard (5ct)'],
};

export function buildCogsLookup() {
  const costMap = state.COST_MAP || {};
  if (!Object.keys(costMap).length) return {};
  const lookup = {};
  Object.entries(FORMULATIONS).forEach(([, cat]) => {
    cat.products.forEach(prod => {
      prod.variants.forEach(v => {
        const cogs = computeProductCOGS(v, costMap);
        lookup[`${prod.name}|${v.variant}`] = { singleCost: cogs.singleCost, packCost: cogs.packCost };
      });
    });
  });
  const result = {};
  Object.entries(SUBTYPE_TO_VARIANT).forEach(([subtype, [prodName, variant]]) => {
    const key = `${prodName}|${variant}`;
    if (lookup[key]) result[subtype] = lookup[key];
  });
  return result;
}

export function renderCogsView() {
  const container = document.getElementById('cogs-view');
  if (!container) return;

  const costMap = state.COST_MAP || {};
  const hasCosts = Object.keys(costMap).length > 0;

  const cs = 'padding:8px 12px;text-align:right;font-size:12px;white-space:nowrap;font-family:var(--font-mono);';
  const hs = 'padding:8px 12px;text-align:right;font-size:10px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;white-space:nowrap;border-bottom:2px solid var(--border);';
  const ns = 'padding:8px 12px;text-align:left;font-size:12px;white-space:nowrap;';

  let html = '';

  if (!hasCosts) {
    html += '<div style="padding:2rem;text-align:center;color:var(--text3)">Sync with Finale to load component costs</div>';
    container.innerHTML = html;
    return;
  }

  const shopifyPriceMap = state.SHOPIFY_PRICE_MAP || {};
  const wholesalePriceMap = state.WHOLESALE_PRICE_MAP || {};

  const allProducts = [];
  Object.entries(FORMULATIONS).forEach(([catKey, cat]) => {
    cat.products.forEach(prod => {
      prod.variants.forEach(v => {
        const cogs = computeProductCOGS(v, costMap);
        const priceSingle = getAvgSalePrice(v.skuSingle, shopifyPriceMap);
        let pricePack = getAvgSalePrice(v.skuPack, wholesalePriceMap);
        if (!pricePack && v.skuSingle) pricePack = getAvgSalePrice(v.skuSingle, wholesalePriceMap);
        const marginSingle = priceSingle > 0 ? ((priceSingle - cogs.singleCost) / priceSingle) * 100 : 0;
        const marginPack = pricePack > 0 ? ((pricePack - cogs.packCost) / pricePack) * 100 : 0;
        allProducts.push({ catKey, catLabel: cat.label, catColor: cat.color, product: prod.name, variant: v.variant, ...v, ...cogs, priceSingle, pricePack, marginSingle, marginPack });
      });
    });
  });

  // Raw Material Costs table
  html += `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--r2);overflow:hidden;margin-bottom:1.25rem">`;
  html += `<div style="padding:.75rem 1rem;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">
    <span style="font-size:12px;font-weight:500;color:var(--text)">Raw Material Costs (from Purchase Orders)</span>
    <div style="display:flex;gap:.5rem">
      <button onclick="exportCogsIngCSV()" class="export-btn">CSV</button>
      <button onclick="exportCogsIngPDF()" class="export-btn">PDF</button>
    </div>
  </div>`;
  html += `<div style="overflow-x:auto"><table id="cogs-ingredient-table" style="width:100%;border-collapse:collapse;font-size:12px">`;
  html += `<thead><tr style="background:var(--bg3)">
    <th style="${hs}text-align:left">Ingredient</th>
    <th style="${hs}">Finale Product ID</th>
    <th style="${hs}">Cost / gram</th>
    <th style="${hs}text-align:left">Source</th>
  </tr></thead><tbody>`;

  const ingredientsSeen = new Set();
  allProducts.forEach(p => p.ingredientBreakdown.forEach(b => {
    if (ingredientsSeen.has(b.name)) return;
    ingredientsSeen.add(b.name);
    const map = INGREDIENT_MAP[b.name];
    html += `<tr style="border-bottom:1px solid var(--border)">
      <td style="${ns}font-weight:500">${b.name}</td>
      <td style="${cs}color:var(--text2)">${map?.pid || '—'}</td>
      <td style="${cs}color:${b.costPerG > 0 ? 'var(--green)' : 'var(--red)'}">${b.costPerG > 0 ? $f4(b.costPerG) : 'N/A'}</td>
      <td style="${ns}color:var(--text3);font-size:11px">${b.source}</td>
    </tr>`;
  }));
  html += '</tbody></table></div></div>';

  // Packaging Costs table
  html += `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--r2);overflow:hidden;margin-bottom:1.25rem">`;
  html += `<div style="padding:.75rem 1rem;border-bottom:1px solid var(--border)">
    <span style="font-size:12px;font-weight:500;color:var(--text)">Packaging Costs (from Purchase Orders)</span>
  </div>`;
  html += `<div style="overflow-x:auto"><table id="cogs-packaging-table" style="width:100%;border-collapse:collapse;font-size:12px">`;
  html += `<thead><tr style="background:var(--bg3)">
    <th style="${hs}text-align:left">Component</th>
    <th style="${hs}">Product ID / Pattern</th>
    <th style="${hs}">Cost / Unit</th>
  </tr></thead><tbody>`;

  const pkgSeen = new Set();
  allProducts.forEach(p => {
    [...p.packagingSingleBreakdown, ...p.packagingPackBreakdown].forEach(b => {
      if (pkgSeen.has(b.key)) return;
      pkgSeen.add(b.key);
      const map = PACKAGING_MAP[b.key];
      const idStr = map?.pid || map?.pattern || b.key;
      html += `<tr style="border-bottom:1px solid var(--border)">
        <td style="${ns}font-weight:500">${b.label}</td>
        <td style="${cs}color:var(--text2)">${idStr}</td>
        <td style="${cs}color:${b.unitCost > 0 ? 'var(--green)' : 'var(--red)'}">${b.unitCost > 0 ? $f4(b.unitCost) : 'N/A'}</td>
      </tr>`;
    });
  });
  html += '</tbody></table></div></div>';

  // COGS by Product
  html += `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--r2);overflow:hidden;margin-bottom:1.25rem">`;
  html += `<div style="padding:.75rem 1rem;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">
    <span style="font-size:12px;font-weight:500;color:var(--text)">COGS by Product (Materials + Packaging)</span>
    <div style="display:flex;gap:.5rem">
      <button onclick="exportCogsProductCSV()" class="export-btn">CSV</button>
      <button onclick="exportCogsProductPDF()" class="export-btn">PDF</button>
    </div>
  </div>`;
  html += `<div style="overflow-x:auto"><table id="cogs-product-table" style="width:100%;border-collapse:collapse;font-size:12px">`;
  html += `<thead><tr style="background:var(--bg3)">
    <th style="${hs}text-align:left;min-width:200px">Product / Variant</th>
    <th style="${hs}">COGS/Single</th>
    <th style="${hs}">Price/Single</th>
    <th style="${hs}">Margin %</th>
    <th style="${hs}">COGS/Pack</th>
    <th style="${hs}">Price/Pack</th>
    <th style="${hs}">Margin %</th>
  </tr></thead><tbody>`;

  let currentCat = '';
  allProducts.forEach((p, i) => {
    if (p.catLabel !== currentCat) {
      currentCat = p.catLabel;
      html += `<tr style="background:var(--bg3);border-top:2px solid var(--border2)">
        <td colspan="7" style="${ns}font-weight:700;color:${p.catColor};font-size:13px">${p.catLabel}</td>
      </tr>`;
    }
    const stripe = i % 2 === 0 ? '' : 'background:rgba(255,255,255,0.02);';
    const mClr = m => m >= 70 ? 'var(--green)' : m >= 50 ? 'var(--blue)' : m >= 30 ? 'var(--orange)' : 'var(--red)';
    html += `<tr style="${stripe}border-bottom:1px solid var(--border);cursor:pointer" onclick="window.__toggleCogsDetail(${i})">
      <td style="${ns}font-weight:500;padding-left:1.5rem"><span id="cogs-chev-${i}" style="display:inline-block;transition:transform .15s;margin-right:6px;font-size:10px;color:var(--text3)">&#9654;</span>${p.product} — ${p.variant}</td>
      <td style="${cs}color:var(--orange);font-weight:600">${$f(p.singleCost)}</td>
      <td style="${cs}color:var(--text)">${p.priceSingle > 0 ? $f(p.priceSingle) : '—'}</td>
      <td style="${cs}color:${mClr(p.marginSingle)};font-weight:600">${p.marginSingle > 0 ? p.marginSingle.toFixed(1) + '%' : '—'}</td>
      <td style="${cs}color:var(--blue);font-weight:600">${$f(p.packCost)}</td>
      <td style="${cs}color:var(--text)">${p.pricePack > 0 ? $f(p.pricePack) : '—'}</td>
      <td style="${cs}color:${mClr(p.marginPack)};font-weight:600">${p.marginPack > 0 ? p.marginPack.toFixed(1) + '%' : '—'}</td>
    </tr>`;

    // Expandable: ingredients
    html += `<tr class="cogs-detail-${i}" style="display:none;background:rgba(255,255,255,0.015)">
      <td colspan="7" style="${ns}padding-left:2.5rem;font-size:10px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;padding-top:8px">Raw Materials (per piece × ${p.pcsPerSingle} pcs)</td>
    </tr>`;
    p.ingredientBreakdown.forEach(b => {
      html += `<tr class="cogs-detail-${i}" style="display:none;background:rgba(255,255,255,0.015);border-bottom:1px solid rgba(255,255,255,0.04)">
        <td style="${ns}padding-left:3rem;color:var(--text3);font-size:11px">${b.name}</td>
        <td style="${cs}font-size:11px;color:var(--text3)">${b.wt}g × ${b.costPerG > 0 ? $f4(b.costPerG) + '/g' : 'N/A'}</td>
        <td></td>
        <td style="${cs}font-size:11px;color:var(--orange)">${b.cost > 0 ? $f4(b.cost) : '—'}</td>
        <td colspan="3"></td>
      </tr>`;
    });

    // Expandable: packaging per single
    if (p.packagingSingleBreakdown.length) {
      html += `<tr class="cogs-detail-${i}" style="display:none;background:rgba(255,255,255,0.015)">
        <td colspan="7" style="${ns}padding-left:2.5rem;font-size:10px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;padding-top:6px">Packaging (per single)</td>
      </tr>`;
      p.packagingSingleBreakdown.forEach(b => {
        html += `<tr class="cogs-detail-${i}" style="display:none;background:rgba(255,255,255,0.015);border-bottom:1px solid rgba(255,255,255,0.04)">
          <td style="${ns}padding-left:3rem;color:var(--text3);font-size:11px">${b.label}</td>
          <td style="${cs}font-size:11px;color:var(--text3)">${b.qty > 1 ? b.qty + ' × ' : ''}${$f4(b.unitCost)}</td>
          <td style="${cs}font-size:11px;color:var(--purple)">${$f4(b.cost)}</td>
          <td colspan="4"></td>
        </tr>`;
      });
    }

    // Expandable: packaging per pack
    if (p.packagingPackBreakdown.length) {
      html += `<tr class="cogs-detail-${i}" style="display:none;background:rgba(255,255,255,0.015)">
        <td colspan="7" style="${ns}padding-left:2.5rem;font-size:10px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;padding-top:6px">Packaging (per display pack)</td>
      </tr>`;
      p.packagingPackBreakdown.forEach(b => {
        html += `<tr class="cogs-detail-${i}" style="display:none;background:rgba(255,255,255,0.015);border-bottom:1px solid rgba(255,255,255,0.04)">
          <td style="${ns}padding-left:3rem;color:var(--text3);font-size:11px">${b.label}</td>
          <td style="${cs}font-size:11px;color:var(--text3)">${b.qty > 1 ? b.qty + ' × ' : ''}${$f4(b.unitCost)}</td>
          <td colspan="3"></td>
          <td style="${cs}font-size:11px;color:var(--purple)">${$f4(b.cost)}</td>
          <td></td>
        </tr>`;
      });
    }
  });

  html += '</tbody></table></div></div>';
  container.innerHTML = html;
}

window.__toggleCogsDetail = (idx) => {
  const rows = document.querySelectorAll(`.cogs-detail-${idx}`);
  const chev = document.getElementById(`cogs-chev-${idx}`);
  const isOpen = rows[0]?.style.display !== 'none';
  rows.forEach(r => r.style.display = isOpen ? 'none' : 'table-row');
  if (chev) chev.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(90deg)';
};

export function exportCogsIngCSV() { exportTableCSV('cogs-ingredient-table', 'cogs-ingredients.csv'); }
export function exportCogsIngPDF() { exportTablePDF('cogs-ingredient-table', 'Raw Material Costs', 'cogs-ingredients.pdf'); }
export function exportCogsProductCSV() { exportTableCSV('cogs-product-table', 'cogs-by-product.csv'); }
export function exportCogsProductPDF() { exportTablePDF('cogs-product-table', 'COGS by Product', 'cogs-by-product.pdf'); }
