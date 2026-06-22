import * as XLSX from 'xlsx';

export function exportToExcel(filename, rows) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Opens a new browser tab with a fully-styled, print-ready HTML document and
// triggers the print dialog (where the user can "Save as PDF"). This is used
// instead of a PDF-generation library (e.g. jsPDF) because jsPDF's built-in
// fonts cannot render Arabic glyphs or right-to-left text shaping at all —
// only the browser's own text engine renders Arabic correctly. Must be
// called synchronously from a click handler (no awaits before it) or
// popup-blockers may block the new window.
function openPrintWindow(title, bodyHtml, lang = 'ar') {
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const win = window.open('', '_blank', 'width=900,height=1000');
  if (!win) {
    window.alert(lang === 'ar' ? 'الرجاء السماح بالنوافذ المنبثقة لطباعة المستند.' : 'Veuillez autoriser les pop-ups pour imprimer le document.');
    return;
  }
  win.document.write(`<!doctype html>
<html lang="${lang}" dir="${dir}">
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet" />
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Cairo', sans-serif; padding: 32px; color: #16241F; margin: 0; }
  h1 { font-size: 20px; color: #0E7C66; margin: 0 0 4px; }
  .muted { color: #62766F; font-size: 12px; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  th, td { border: 1px solid #E4EBE8; padding: 8px 10px; font-size: 13px; text-align: start; }
  th { background: #0E7C66; color: white; }
  tr:nth-child(even) { background: #F5F8F7; }
  .totals { margin-top: 16px; width: 100%; max-width: 320px; margin-inline-start: auto; }
  .totals div { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; }
  .totals .grand { font-weight: 800; font-size: 16px; border-top: 2px solid #0E7C66; padding-top: 8px; color: #0E7C66; }
  .header-row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 18px; }
  .badge { display: inline-block; background: #E6F4F0; color: #0A5C4C; border-radius: 999px; padding: 4px 10px; font-size: 11px; font-weight: 700; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>${bodyHtml}</body>
</html>`);
  win.document.close();
  win.onload = () => {
    win.focus();
    setTimeout(() => win.print(), 300);
  };
}

// Generic "label / value" report export (used by the Reports screen).
export function printReportPdf({ title, rows, lang = 'ar' }) {
  const rowsHtml = rows.map((r) => `<tr><td>${escapeHtml(r.label)}</td><td>${escapeHtml(r.value)}</td></tr>`).join('');
  const html = `
    <h1>${escapeHtml(title)}</h1>
    <div class="muted">${escapeHtml(new Date().toLocaleString())}</div>
    <table><tbody>${rowsHtml}</tbody></table>
  `;
  openPrintWindow(title, html, lang);
}

// Per-sale invoice / receipt.
export function printSaleInvoice({ sale, appName, currency, lang = 'ar', labels }) {
  const itemsHtml = sale.items
    .map(
      (i) => `<tr>
        <td>${escapeHtml(i.name)}</td>
        <td>${i.qty}</td>
        <td>${Number(i.price).toLocaleString('en-US')}</td>
        <td>${Number(i.price * i.qty).toLocaleString('en-US')}</td>
      </tr>`
    )
    .join('');

  const dateStr = sale.date?.toDate ? sale.date.toDate().toLocaleString() : new Date().toLocaleString();

  const html = `
    <div class="header-row">
      <div>
        <h1>${escapeHtml(appName)}</h1>
        <div class="muted">${dateStr}</div>
      </div>
      <span class="badge">${escapeHtml(labels.invoice)}</span>
    </div>

    <table>
      <thead><tr>
        <th>${escapeHtml(labels.item)}</th>
        <th>${escapeHtml(labels.qty)}</th>
        <th>${escapeHtml(labels.price)}</th>
        <th>${escapeHtml(labels.lineTotal)}</th>
      </tr></thead>
      <tbody>${itemsHtml}</tbody>
    </table>

    <div class="totals">
      <div><span>${escapeHtml(labels.subtotal)}</span><span>${Number(sale.subtotal ?? sale.total).toLocaleString('en-US')} ${escapeHtml(currency)}</span></div>
      ${sale.discount ? `<div><span>${escapeHtml(labels.discount)}</span><span>-${Number(sale.discount).toLocaleString('en-US')} ${escapeHtml(currency)}</span></div>` : ''}
      <div class="grand"><span>${escapeHtml(labels.total)}</span><span>${Number(sale.total).toLocaleString('en-US')} ${escapeHtml(currency)}</span></div>
    </div>

    <p class="muted" style="margin-top:24px;">
      ${escapeHtml(labels.paymentMethod)}: ${escapeHtml(labels.paymentLabel)}
      ${sale.soldByName ? ` · ${escapeHtml(labels.soldBy)}: ${escapeHtml(sale.soldByName)}` : ''}
    </p>
  `;
  openPrintWindow(labels.invoice, html, lang);
}
