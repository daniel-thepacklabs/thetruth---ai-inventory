const ExcelJS = require('exceljs');
const path = require('path');

const overall = [
  ['Prerolls','Mini Doink 5-Pack THCA',379428.32,29976],
  ['Prerolls','Mini Doink 5-Pack THCP',330909.82,27871],
  ['Prerolls','Double Doink Jelly Hole',199455.45,20760],
  ['Prerolls','Jelly Hole THCA',80656.69,7822],
  ['Prerolls','Jelly Hole THCP',77820.30,8905],
  ['Prerolls','Imperial Loaded THCA',57090.23,7495],
  ['Prerolls','Imperial Loaded THCP',55395.81,9604],
  ['Prerolls','Double Doink',9120.89,672],
  ['Edibles','Euphoria Gummies D9',360691.17,28396],
  ['Edibles','Froot Jam',33482.70,905],
  ['Edibles','Cereal Crunchies',30496.22,1738],
  ['Edibles','Functional Microdose',14416.88,1351],
  ['Vapes','Lil Ripper THCP',323405.11,20031],
  ['Vapes','Lil Ripper Liquid Diamonds',268731.74,17446],
  ['Vapes','Imperial 1G Cartridge',39720.36,4765],
  ['Vapes','Lil Ripper HHC',4288.66,200],
  ['Vapes','Lil Ripper D8',3041.18,260],
  ['Vapes','Imperial Pod',192.01,10],
  ['Flower','Zaza 3.5g',99037.75,3732],
  ['Flower','Zaza 14g',25453.70,434],
  ['Flower','Fakies 3.5g',22206.42,1166],
  ['Flower','Zaza QP',4418.93,6],
  ['Flower','Fakies QP',1487.89,4],
  ['Flower','Fakies 14g',522.80,4],
  ['Other','Other',6702.21,10437],
];

const texas = [
  ['Prerolls','Mini Doink 5-Pack THCA',193230.95,25623],
  ['Prerolls','Mini Doink 5-Pack THCP',145095.32,19472],
  ['Prerolls','Imperial Loaded THCA',80334.40,21874],
  ['Prerolls','Imperial Loaded THCP',67674.00,18551],
  ['Prerolls','Jelly Hole THCA',42062.33,9302],
  ['Prerolls','Jelly Hole THCP',37189.98,8222],
  ['Prerolls','Double Doink',3344.88,663],
  ['Edibles','Euphoria Gummies D9',33366.09,6752],
  ['Edibles','Cereal Crunchies',2948.52,505],
  ['Edibles','Froot Jam',2159.06,281],
  ['Edibles','Functional Microdose',318.58,57],
  ['Vapes','Lil Ripper Liquid Diamonds',8747.42,968],
  ['Vapes','Lil Ripper THCP',6596.04,494],
  ['Vapes','Lil Ripper D8',2250.00,300],
  ['Vapes','Imperial 1G Cartridge',1182.00,221],
  ['Vapes','Lil Ripper HHC',434.84,25],
  ['Vapes','Imperial Pod',0,2],
  ['Flower','Zaza 3.5g',14625.00,892],
  ['Flower','Zaza 14g',13489.00,376],
  ['Flower','Fakies 3.5g',5927.00,523],
  ['Flower','Fakies QP',1225.00,5],
  ['Flower','Zaza QP',950.00,2],
  ['Flower','Fakies 14g',168.00,2],
  ['Other','Other',67579.18,515955],
];

// Build ex-Texas by subtracting Texas from Overall
const txMap = {};
texas.forEach(([cat,sub,rev,units]) => {
  const key = cat+'|'+sub;
  if (!txMap[key]) txMap[key] = {rev:0, units:0};
  txMap[key].rev += rev;
  txMap[key].units += units;
});

const exTexas = overall.map(([cat,sub,rev,units]) => {
  if (cat === 'Edibles') return [cat, sub, rev, units]; // keep Edibles intact (include TX Edibles)
  const key = cat+'|'+sub;
  const tx = txMap[key] || {rev:0, units:0};
  return [cat, sub, Math.max(0, +(rev - tx.rev).toFixed(2)), Math.max(0, units - tx.units)];
}).filter(r => r[2] > 0 || r[3] > 0);

const catOrder = ['Prerolls','Vapes','Edibles','Flower','Other'];
const headerFill = {type:'pattern',pattern:'solid',fgColor:{argb:'FF2D2D2D'}};
const headerFont = {name:'Arial',bold:true,size:11,color:{argb:'FFFFFFFF'}};
const catFill = {type:'pattern',pattern:'solid',fgColor:{argb:'FFF0F0F0'}};
const catFont = {name:'Arial',bold:true,size:11};
const subFont = {name:'Arial',size:11};
const totalFill = {type:'pattern',pattern:'solid',fgColor:{argb:'FF1A5276'}};
const totalFont = {name:'Arial',bold:true,size:11,color:{argb:'FFFFFFFF'}};
const moneyFmt = '$#,##0.00';
const unitsFmt = '#,##0';

function buildSheet(ws, title, subtitle, data) {
  ws.properties.tabColor = {argb:'FF1A5276'};
  ws.columns = [{width:18},{width:32},{width:18},{width:18}];

  ws.mergeCells('A1:D1');
  ws.getCell('A1').value = title;
  ws.getCell('A1').font = {name:'Arial',bold:true,size:14};
  ws.mergeCells('A2:D2');
  ws.getCell('A2').value = subtitle;
  ws.getCell('A2').font = {name:'Arial',size:11,color:{argb:'FF666666'}};

  ['Category','Subcategory','Revenue','Units (Singles)'].forEach((h,i) => {
    const c = ws.getCell(4, i+1);
    c.value = h;
    c.font = headerFont;
    c.fill = headerFill;
    c.alignment = {horizontal: i>1?'center':'left'};
  });

  const cats = {};
  data.forEach(([cat,sub,rev,units]) => {
    if (!cats[cat]) cats[cat] = [];
    cats[cat].push([sub,rev,units]);
  });

  let row = 5;
  const catTotalRows = [];

  catOrder.forEach(cat => {
    if (!cats[cat]) return;
    const subs = cats[cat];
    const catRev = subs.reduce((s,x) => s+x[1], 0);
    const catUnits = subs.reduce((s,x) => s+x[2], 0);

    const r = ws.getRow(row);
    r.getCell(1).value = cat;
    r.getCell(1).font = catFont;
    r.getCell(1).fill = catFill;
    r.getCell(2).fill = catFill;
    r.getCell(3).value = catRev;
    r.getCell(3).font = catFont;
    r.getCell(3).fill = catFill;
    r.getCell(3).numFmt = moneyFmt;
    r.getCell(3).alignment = {horizontal:'center'};
    r.getCell(4).value = catUnits;
    r.getCell(4).font = catFont;
    r.getCell(4).fill = catFill;
    r.getCell(4).numFmt = unitsFmt;
    r.getCell(4).alignment = {horizontal:'center'};
    catTotalRows.push(row);
    row++;

    subs.sort((a,b) => b[1]-a[1]).forEach(([sub,rev,units]) => {
      const sr = ws.getRow(row);
      sr.getCell(2).value = sub;
      sr.getCell(2).font = subFont;
      sr.getCell(3).value = rev;
      sr.getCell(3).font = subFont;
      sr.getCell(3).numFmt = moneyFmt;
      sr.getCell(3).alignment = {horizontal:'center'};
      sr.getCell(4).value = units;
      sr.getCell(4).font = subFont;
      sr.getCell(4).numFmt = unitsFmt;
      sr.getCell(4).alignment = {horizontal:'center'};
      [2,3,4].forEach(c => {
        sr.getCell(c).border = {bottom:{style:'thin',color:{argb:'FFDDDDDD'}}};
      });
      row++;
    });
  });

  row++;
  const tr = ws.getRow(row);
  [1,2,3,4].forEach(c => {
    tr.getCell(c).fill = totalFill;
    tr.getCell(c).font = totalFont;
  });
  tr.getCell(1).value = 'TOTAL';
  const revRefs = catTotalRows.map(r => 'C'+r).join(',');
  const unitRefs = catTotalRows.map(r => 'D'+r).join(',');
  tr.getCell(3).value = {formula: 'SUM('+revRefs+')'};
  tr.getCell(3).numFmt = moneyFmt;
  tr.getCell(3).alignment = {horizontal:'center'};
  tr.getCell(4).value = {formula: 'SUM('+unitRefs+')'};
  tr.getCell(4).numFmt = unitsFmt;
  tr.getCell(4).alignment = {horizontal:'center'};

  return row;
}

async function main() {
  const wb = new ExcelJS.Workbook();

  const ws1 = wb.addWorksheet('June 2026 - All Sales');
  buildSheet(ws1, 'June 2026 Sales Summary', 'All Regions \u2014 Units = Single Units', overall);

  const ws2 = wb.addWorksheet('June 2026 - Texas');
  buildSheet(ws2, 'June 2026 Sales Summary \u2014 Texas', 'Texas Only \u2014 Units = Single Units', texas);

  const ws3 = wb.addWorksheet('June 2026 - Ex Texas');
  buildSheet(ws3, 'June 2026 Sales Summary \u2014 Excluding Texas', 'All Regions Minus Texas (Texas Edibles Included) \u2014 Units = Single Units', exTexas);

  const out = path.join('C:\\Users\\Daniel Kim\\OneDrive\\Desktop\\thetruth', 'June_2026_Sales_Summary.xlsx');
  await wb.xlsx.writeFile(out);
  console.log('Saved:', out);
}

main().catch(console.error);
