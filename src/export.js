// Export tables to Excel (CSV) or PDF
const $f = v => '$' + (v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function tableToRows(tableEl) {
  const rows = [];
  tableEl.querySelectorAll('tr').forEach(tr => {
    const cells = [];
    tr.querySelectorAll('th, td').forEach(td => {
      const text = td.innerText.replace(/\n/g, ' ').trim();
      const colspan = parseInt(td.getAttribute('colspan') || '1');
      cells.push(text);
      for (let i = 1; i < colspan; i++) cells.push('');
    });
    if (cells.some(c => c)) rows.push(cells);
  });
  return rows;
}

function rowsToCSV(rows) {
  return rows.map(r => r.map(c => {
    if (/[,"\n]/.test(c)) return '"' + c.replace(/"/g, '""') + '"';
    return c;
  }).join(',')).join('\n');
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportTableCSV(tableId, filename) {
  const table = document.getElementById(tableId);
  if (!table) return;
  const rows = tableToRows(table);
  const csv = '﻿' + rowsToCSV(rows);
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), filename);
}

export function exportTablePDF(tableId, title, filename) {
  const table = document.getElementById(tableId);
  if (!table) return;
  const rows = tableToRows(table);
  if (!rows.length) return;

  const maxCols = Math.max(...rows.map(r => r.length));
  const isWide = maxCols > 7;
  const pageW = isWide ? 1120 : 800;
  const pageH = isWide ? 800 : 1120;
  const margin = 40;
  const usableW = pageW - margin * 2;
  const colW = usableW / maxCols;
  const lineH = 18;
  const headerH = 50;

  const pages = [];
  let currentRows = [];
  let currentH = headerH;

  rows.forEach((row, i) => {
    const rowH = lineH + 4;
    if (currentH + rowH > pageH - margin && currentRows.length > 0) {
      pages.push(currentRows);
      currentRows = [];
      currentH = headerH;
    }
    currentRows.push({ cells: row, idx: i });
    currentH += rowH;
  });
  if (currentRows.length) pages.push(currentRows);

  const svgPages = pages.map((pageRows, pi) => {
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${pageW}" height="${pageH}" style="font-family:Arial,sans-serif;background:#fff">`;
    svg += `<text x="${margin}" y="30" font-size="14" font-weight="bold" fill="#222">${title}</text>`;
    svg += `<text x="${pageW - margin}" y="30" font-size="9" fill="#999" text-anchor="end">Page ${pi + 1}/${pages.length} · ${new Date().toLocaleDateString()}</text>`;

    let y = headerH;
    pageRows.forEach(({ cells, idx }) => {
      const isHeader = idx === 0 || idx === 1;
      const isTotal = cells[0]?.includes('Grand Total') || cells[0]?.includes('TOTAL');
      const bg = isHeader ? '#f5f5f5' : isTotal ? '#eef' : (idx % 2 === 0 ? '#fff' : '#fafafa');
      svg += `<rect x="${margin}" y="${y}" width="${usableW}" height="${lineH + 4}" fill="${bg}"/>`;
      cells.forEach((c, ci) => {
        const x = margin + ci * colW + 4;
        const align = ci === 0 ? 'start' : 'end';
        const tx = ci === 0 ? x : margin + (ci + 1) * colW - 4;
        const fw = isHeader || isTotal ? 'bold' : 'normal';
        const fs = isHeader ? 10 : 11;
        const truncated = c.length > 20 ? c.slice(0, 18) + '…' : c;
        svg += `<text x="${tx}" y="${y + 14}" font-size="${fs}" font-weight="${fw}" fill="#333" text-anchor="${align}">${escXml(truncated)}</text>`;
      });
      svg += `<line x1="${margin}" y1="${y + lineH + 4}" x2="${margin + usableW}" y2="${y + lineH + 4}" stroke="#ddd" stroke-width="0.5"/>`;
      y += lineH + 4;
    });

    svg += '</svg>';
    return svg;
  });

  const printWindow = window.open('', '_blank');
  if (!printWindow) return;
  const orientation = isWide ? 'landscape' : 'portrait';
  printWindow.document.write(`<!DOCTYPE html><html><head><title>${title}</title>
    <style>@media print { @page { size: ${orientation}; margin: 0; } body { margin: 0; } .page { page-break-after: always; } .page:last-child { page-break-after: avoid; } }</style>
  </head><body>${svgPages.map(s => `<div class="page">${s}</div>`).join('')}</body></html>`);
  printWindow.document.close();
  printWindow.onload = () => { printWindow.print(); };
}

function escXml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function exportForecastCSV() {
  exportTableCSV('forecast-type-table', 'forecast-by-category.csv');
}

export function exportForecastPDF() {
  exportTablePDF('forecast-type-table', 'Forecast by Category', 'forecast-by-category.pdf');
}

export function exportMonthlyCSV() {
  exportTableCSV('sales-monthly-table', 'monthly-breakdown.csv');
}

export function exportMonthlyPDF() {
  exportTablePDF('sales-monthly-table', 'Monthly Sales Breakdown', 'monthly-breakdown.pdf');
}

export function exportByTypeCSV() {
  exportTableCSV('by-type-table', 'revenue-by-product-type.csv');
}

export function exportByTypePDF() {
  exportTablePDF('by-type-table', 'Monthly Revenue by Product Type & Subcategory', 'revenue-by-product-type.pdf');
}

export function exportAllCSV() {
  exportMonthlyCSV();
  setTimeout(() => exportForecastCSV(), 300);
  setTimeout(() => exportByTypeCSV(), 600);
}
