import { state } from './state.js';

// ── CSV utilities ──
export function parseCSV(text) {
  const lines = text.trim().split('\n');
  const hdr = parseLine(lines[0]);
  return lines.slice(1).map(l => {
    const v = parseLine(l), o = {};
    hdr.forEach((h, i) => o[h.trim().replace(/\r/, '')] = (v[i] || '').trim());
    return o;
  }).filter(r => Object.values(r).some(v => v));
}

function parseLine(l) {
  const r = []; let c = '', q = false;
  for (let i = 0; i < l.length; i++) {
    const ch = l[i];
    if (ch === '"') { q = !q; }
    else if (ch === ',' && !q) { r.push(c); c = ''; }
    else c += ch;
  }
  r.push(c); return r;
}

export const n   = v => parseFloat((v || '0').replace(/,/g, '')) || 0;
export const fmt = v => Math.round(v).toLocaleString();
export const fmtDec = (v, d = 2) => parseFloat(v).toFixed(d);

// ── Category classification ──
export function catSubcat(pid) {
  const p = pid.trim();
  if (p.startsWith('IM-')) return ['Marketing','IM'];
  if (p.startsWith('DBX-') || p.startsWith('Display Box')) return ['Packaging','DBX'];
  if (p.startsWith('INS-')) return ['Packaging','INS'];
  if (p.startsWith('LBL-')) return ['Packaging','LBL'];
  if (p.startsWith('LID-')) return ['Packaging','LID'];
  if (p.startsWith('MYL-')) return ['Packaging','MYL'];
  if (p.startsWith('Rigid')) return ['Packaging','Rigid Box'];
  if (p.startsWith('SLV-')) return ['Packaging','SLV'];
  if (p.startsWith('TRY-')) return ['Packaging','TRY'];
  if (p.startsWith('TUB-')) return ['Packaging','TUB'];
  if (p.startsWith('Tube - ')) return ['Packaging','Tube'];
  if (p.startsWith('Box - Imperial')) return ['Packaging','Box'];
  if (p.startsWith('CON-')) return ['Components','CON'];
  if (p.startsWith('VHW-')) return ['Components','VHW'];
  if (p.includes('L-Bar Sealer Film')) return ['Misc','Auto L-Bar Sealer Film'];
  if (p.startsWith('Film - ')) return ['Misc','Film'];
  if (p.startsWith('Pack - ')) return ['Misc','Pack'];
  if (p.startsWith('ECC-')) return ['Edibles','ECC'];
  if (p.startsWith('EGBD-')) return ['Edibles','EGBD'];
  if (p.startsWith('EGFJ-')) return ['Edibles','EGFJ'];
  if (p.startsWith('EGKB-')) return ['Edibles','EGKB'];
  if (p.startsWith('EGBB-')) return ['Edibles','EGBB'];
  if (p.startsWith('EGMB-')) return ['Edibles','EGMB'];
  if (p.startsWith('EGMCR-')) return ['Edibles','EGMCR'];
  if (p.startsWith('EGPL-')) return ['Edibles','EGPL'];
  if (p.startsWith('EGSS-')) return ['Edibles','EGSS'];
  if (p.startsWith('Gummy - ') || p.startsWith('Cereal Crunchies')) return ['Edibles','Gummy'];
  if (p.startsWith('FLD-')) return ['WIP','FLD'];
  if (p.startsWith('Filled - ')) return ['WIP','Filled'];
  if (p.startsWith('Infused - ')) return ['WIP','Infused'];
  if (p.startsWith('Infusion Mixture - ')) return ['WIP','Infusion Mixture'];
  if (p.startsWith('Mixture - ')) return ['WIP','Mixture'];
  if (p.startsWith('Oil Mixture - ')) return ['WIP','Oil Mixture'];
  if (p.startsWith('P5D-')) return ['WIP','P5D'];
  if (p.startsWith('PDD-')) return ['WIP','PDD'];
  if (p.startsWith('PIL-')) return ['WIP','PIL'];
  if (p.startsWith('PJH-')) return ['WIP','PJH'];
  if (p.startsWith('VIC-')) return ['WIP','VIC'];
  if (p.startsWith('VLRSB-')) return ['WIP','VLRSB'];
  if (p.startsWith('VLR-')) return ['WIP','VLR'];
  if (p.startsWith('FMX-')) return ['Raw Material','FMX'];
  if (p.startsWith('Flower - ')) return ['Raw Material','Flower'];
  if (p.startsWith('Glue - ')) return ['Raw Material','Glue'];
  if (p.startsWith('ISO - ')) return ['Raw Material','ISO'];
  if (p.startsWith('Oil - ')) return ['Raw Material','Oil'];
  if (p.startsWith('TRP-')) return ['Raw Material','TRP'];
  return [null, null];
}

// ── Edible helpers ──
export function getPiecesPerUnit(pid, desc) {
  const p = (pid || '').toUpperCase();
  const d = (desc || '');
  let piecesPerBag = 1;
  const ctMatch = d.match(/(\d+)(?:ct|CT|pc)\b/);
  if (ctMatch) {
    piecesPerBag = parseInt(ctMatch[1]);
  } else if (p.includes('-05-') || /-05$/.test(p)) {
    piecesPerBag = 5;
  } else if (p.includes('-20-') || /-20$/.test(p)) {
    piecesPerBag = 20;
  } else if (p.includes('-100-') || p.includes('-125-') || p.includes('-150-')) {
    piecesPerBag = 5;
  } else if (p.includes('-400-') || p.includes('-500-') || p.includes('-600-')) {
    piecesPerBag = 20;
  }
  let bagsPerUnit = 1;
  if (p.includes('-8PK'))       bagsPerUnit = 8;
  else if (p.includes('-5PK'))  bagsPerUnit = 5;
  else if (p.includes('-10PK')) bagsPerUnit = 10;
  return piecesPerBag * bagsPerUnit;
}

export function getEdibleFlavor(pid, desc) {
  const d = desc || '';
  const p = (pid || '').toUpperCase();
  const patterns = [
    /Euphoria - ([\w\s]+?) -/,
    /Froot Jam - ([\w\s]+?)(?:\s*-|\s*$)/,
    /Cereal Crunchies - ([\w\s]+?)(?:\s*-|\s*$)/,
    /Microdose[^-]*?- ([\w\s]+?) -/,
    /Gummy D[89] - ([\w\s]+?) -/,
    /D[89] - ([\w\s]+?) -/,
    /Crunchies - ([\w\s]+?)(?:\s*-\s*\d|$)/,
  ];
  for (const pat of patterns) {
    const m = d.match(pat);
    if (m) return m[1].trim();
  }
  if (p.startsWith('ECC-CB')) return 'Cinnamon Brulee';
  if (p.startsWith('ECC-CF')) return 'Cocoa Fudge';
  if (p.startsWith('ECC-DR')) return 'Double Rainbow';
  if (p.startsWith('EGFJ-AN')) return 'Appleberry Nectar';
  if (p.startsWith('EGFJ-SD')) return 'Strawberry Dream';
  if (p.startsWith('EGFJ-TP')) return 'Tropical Passion';
  if (p.startsWith('EGBD')) return 'Blue Dream';
  if (p.startsWith('EGKB')) return 'Kiwi Burst';
  if (p.startsWith('EGMB-05') || p.startsWith('EGMB-20')) return 'Big Brain Gummies';
  if (p.startsWith('EGMB')) return 'Midnight Berry';
  if (p.startsWith('EGMCR')) return 'Mango Crush';
  if (p.startsWith('EGPL')) return 'Pink Lemonade';
  if (p.startsWith('EGSS-05') || p.startsWith('EGSS-20')) return 'Love Gummies';
  if (p.startsWith('EGSS')) return 'Strawberry Shortcake';
  if (p.startsWith('EGBB')) return 'Chillin Gummies';
  return pid.split('-').slice(0, 2).join('-');
}

// ── Sales product classification ──
export function getSalesProductType(pid, desc) {
  const p = (pid || '').trim();
  const pu = p.toUpperCase();
  const d = (desc || '').toLowerCase();
  if (pu.startsWith('P5D')) {
    if (['P5D-PD','P5D-MMJ','P5D-TBP','P5D-BLOG','P5D-SKP','P5D-TS'].some(x => pu.startsWith(x))) return ['Prerolls','Mini Doink 5-Pack THCP'];
    return ['Prerolls','Mini Doink 5-Pack THCA'];
  }
  if (pu.startsWith('PDD')) return ['Prerolls','Double Doink'];
  if (pu.startsWith('PJH')) {
    if (['PJH-TBP','PJH-SKP','PJH-MMJ','PJH-TS','PJH-BLOG','PJH-PD'].some(x => pu.startsWith(x))) return ['Prerolls','Jelly Hole THCP'];
    return ['Prerolls','Jelly Hole THCA'];
  }
  if (pu.startsWith('PIL')) {
    if (d.includes('total thc')) return ['Prerolls','Imperial Loaded THCP'];
    return ['Prerolls','Imperial Loaded THCA'];
  }
  if (pu.startsWith('VLRSB')) return ['Vapes','Lil Ripper Liquid Diamonds'];
  if (pu.startsWith('VLR')) {
    if (['VLR-BD','VLR-MW','VLR-SC'].some(x => pu.startsWith(x))) return ['Vapes','Lil Ripper HHC'];
    if (['VLR-CL','VLR-WG','VLR-LAC'].some(x => pu.startsWith(x))) return ['Vapes','Lil Ripper D8'];
    return ['Vapes','Lil Ripper THCP'];
  }
  if (pu.startsWith('VIC')) return ['Vapes','Imperial 1G Cartridge'];
  if (pu.startsWith('VIP')) return ['Vapes','Imperial Pod'];
  if (pu.startsWith('FLD') || p.startsWith('Filled') || p.startsWith('Infused') || p.startsWith('Oil Mixture') || p.startsWith('Mixture') || p.startsWith('Infusion')) return ['Vapes','WIP / Filled'];
  if (pu.startsWith('EGMB') || pu.startsWith('EGKB') || pu.startsWith('EGBD') || pu.startsWith('EGSS') || pu.startsWith('EGPL') || pu.startsWith('EGMCR')) return ['Edibles','Euphoria Gummies D9'];
  if (pu.startsWith('EGFJ')) return ['Edibles','Froot Jam'];
  if (pu.startsWith('EGBB')) return ['Edibles','Functional Microdose'];
  if (pu.startsWith('ECC')) return ['Edibles','Cereal Crunchies'];
  if (pu.startsWith('EGHB') || pu.startsWith('EGSW')) return ['Edibles','D8 Edibles'];
  if (pu.startsWith('FIT')) {
    const isFakies = ['FITDR','FITGUS','FITHZ','FITICC','FITIP','FITJC','FITSFV','FITSSFV','FITTW','FITWC'].some(x => pu.startsWith(x));
    const line = isFakies ? 'Fakies' : 'Zaza';
    if (pu.includes('-3.5-') || pu.includes('-3.5G') || pu.match(/-3\.5$/)) return ['Flower', line + ' 3.5g'];
    if (pu.includes('-14-') || pu.includes('-14G') || pu.match(/-14$/)) return ['Flower', line + ' 14g'];
    if (pu.includes('-QP')) return ['Flower', line + ' QP'];
    if (pu.includes('-450') || pu.includes('1LB')) return ['Flower', line + ' 1lb'];
    return ['Flower', line + ' Other'];
  }
  return ['Other','Other'];
}

export function getPackSize(pid) {
  const p = (pid || '').trim().toUpperCase();
  if (p.includes('-10PK')) return 10;
  if (p.includes('-8PK'))  return 8;
  if (p.includes('-6PK'))  return 6;
  if (p.includes('-5PK'))  return 5;
  if (p.includes('-2PK') || p.endsWith('-2P')) return 2;
  return 1;
}

// ── Main data processor — called by Finale API after fetching ──
export function processData(stockCSV, salesCSV, consumeCSV, consume30CSV) {
  const stockRows = parseCSV(stockCSV);
  const salesRows = parseCSV(salesCSV);
  const stockMap  = {};

  stockRows.forEach(r => {
    if ((r['Location'] || '').trim() !== 'SFS-HQ') return;
    const pid = (r['Product ID'] || '').trim(); if (!pid) return;
    if (!stockMap[pid]) stockMap[pid] = { onHand:0, onOrder:0, reserved:0, desc:'' };
    stockMap[pid].onHand   += n(r['On hand']);
    stockMap[pid].onOrder  += n(r['On order']);
    stockMap[pid].reserved += n(r['Reserved']);
    if (!stockMap[pid].desc) stockMap[pid].desc = (r['Description'] || '').trim();
  });

  const salesMap = {};
  salesRows.forEach(r => {
    const pid = (r['Product ID'] || '').trim(); if (!pid) return;
    const col = (names, row) => {
      for (const nm of names) { if (row[nm] !== undefined) return nm; }
      const keys = Object.keys(row);
      for (const nm of names) {
        const k = keys.find(k => k.toLowerCase().includes(nm.toLowerCase().replace('sales ', '')));
        if (k) return k;
      }
      return null;
    };
    const c90 = col(['Sales last 90 days','Sales Last 90 Days'], r);
    const c30 = col(['Sales last 30 days','Sales Last 30 Days'], r);
    const clm = col(['Sales last month','Sales Last Month'], r);
    salesMap[pid] = { s90: n(c90 ? r[c90] : '0'), s30: n(c30 ? r[c30] : '0'), slm: n(clm ? r[clm] : '0') };
  });

  const consumeMap = {};
  if (consumeCSV) {
    parseCSV(consumeCSV).forEach(r => {
      const pid = (r['Product ID'] || '').trim(); if (!pid) return;
      consumeMap[pid] = n(r['Quantity sum']);
    });
  }

  const consume30Map = {};
  if (consume30CSV) {
    parseCSV(consume30CSV).forEach(r => {
      const pid = (r['Product ID'] || '').trim(); if (!pid) return;
      consume30Map[pid] = n(r['Quantity sum']);
    });
  }

  // Non-edible rows
  const nonEdibleRows = Object.entries(stockMap)
    .filter(([pid]) => !/^(EG|ECC)/i.test(pid))
    .map(([pid, st]) => {
      const [cat, subcat] = catSubcat(pid); if (!cat) return null;
      const sl = salesMap[pid] || { s90:0, s30:0, slm:0 };
      const consumed90 = consumeMap[pid] != null ? consumeMap[pid] : sl.s90;
      const runRate30  = parseFloat((consumed90 / 3).toFixed(2));
      const actual30   = consume30Map[pid] != null ? consume30Map[pid] : sl.s30;
      if (consumeCSV && consumed90 === 0) return null;
      const remaining = st.onHand - st.reserved;
      const months = runRate30 > 0 ? parseFloat((remaining / runRate30).toFixed(4)) : 0;
      return {
        id: pid, desc: st.desc, cat, subcat,
        consumed90, runRate30, actual30, dem: runRate30,
        s30: sl.s30, slm: sl.slm,
        onHand: st.onHand, onOrder: st.onOrder, reserved: st.reserved,
        remaining, totalInv: st.onHand + st.onOrder, months, ss: 1.75,
        hasConsumption: consumeMap[pid] != null,
        has30Consumption: consume30Map[pid] != null,
        isEdibleFlavor: false,
      };
    }).filter(Boolean);

  // Edible rows — consolidate by flavor into individual pieces
  state.EDIBLE_ONHAND = {};
  Object.entries(stockMap).forEach(([pid, st]) => {
    if (!/^(EG|ECC)/i.test(pid)) return;
    const flavor = getEdibleFlavor(pid, st.desc);
    const ppu    = getPiecesPerUnit(pid, st.desc);
    if (!state.EDIBLE_ONHAND[flavor]) state.EDIBLE_ONHAND[flavor] = { onHand:0, onOrder:0, reserved:0, desc:'' };
    state.EDIBLE_ONHAND[flavor].onHand   += Math.max(0, st.onHand) * ppu;
    state.EDIBLE_ONHAND[flavor].onOrder  += st.onOrder * ppu;
    state.EDIBLE_ONHAND[flavor].reserved += st.reserved * ppu;
    if (!state.EDIBLE_ONHAND[flavor].desc) state.EDIBLE_ONHAND[flavor].desc = st.desc;
  });

  const edibleRows = Object.entries(state.EDIBLE_ONHAND).map(([flavor, oh]) => {
    let avgMoPieces = 0;
    if (state.SALES_DATA.length) {
      const flavorSales = state.SALES_DATA.filter(r => /^(EG|ECC)/i.test(r.pid) && getEdibleFlavor(r.pid, r.desc) === flavor);
      const totalPieces = flavorSales.reduce((s, r) => s + r.qty * getPiecesPerUnit(r.pid, r.desc), 0);
      const months = [...new Set(flavorSales.map(r => r.month))];
      avgMoPieces = months.length > 0 ? totalPieces / months.length : 0;
    }
    const dem = parseFloat(avgMoPieces.toFixed(2));
    const totalSupply = oh.onHand + oh.onOrder;
    const months = dem > 0 ? parseFloat((totalSupply / dem).toFixed(4)) : 0;
    return {
      id: 'EDIBLE-' + flavor.replace(/\s+/g, '-').toUpperCase(),
      desc: flavor, cat: 'Edibles', subcat: 'Gummy',
      consumed90: dem * 3, runRate30: dem, actual30: 0,
      dem, s30: 0, slm: 0,
      onHand: oh.onHand, onOrder: oh.onOrder, reserved: oh.reserved,
      remaining: totalSupply, totalInv: totalSupply, months, ss: 1.75,
      hasConsumption: false, has30Consumption: false,
      isEdibleFlavor: true, flavorName: flavor,
    };
  }).filter(r => r.dem > 0 || r.onHand > 0);

  state.RAW_DATA = [...nonEdibleRows, ...edibleRows];
}

export function processSalesReport(csv) {
  const rows = parseCSV(csv);
  state.SALES_DATA = rows.map(r => ({
    date:     r['Order date'] || '',
    status:   r['Status'] || '',
    category: r['Category'] || '',
    pid:      (r['Product ID'] || '').trim(),
    desc:     (r['Description'] || '').trim(),
    qty:      n(r['Quantity']),
    price:    n(r['Unit price']),
    subtotal: n(r['Subtotal sum']),
  })).filter(r => r.date && r.pid);

  state.SALES_DATA.forEach(r => {
    const d = new Date(r.date);
    r.month = isNaN(d) ? r.date.slice(0, 7) : `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  });
}

// ── Subcat index — call after processData ──
export function buildSubcatIndex() {
  Object.keys(state.ALL_SUBCATS).forEach(k => delete state.ALL_SUBCATS[k]);
  state.ALL_SUBCAT_LIST.clear();
  state.RAW_DATA.forEach(item => {
    if (!state.ALL_SUBCATS[item.cat]) state.ALL_SUBCATS[item.cat] = new Set();
    state.ALL_SUBCATS[item.cat].add(item.subcat);
    state.ALL_SUBCAT_LIST.add(item.subcat);
  });
  state.activeSubcats = new Set(state.ALL_SUBCAT_LIST);
}
