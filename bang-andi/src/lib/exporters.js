import Papa from 'papaparse';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency, formatDate } from './formatters.js';

/**
 * Triggers browser download for a Blob
 * @param {Blob} blob
 * @param {string} filename
 */
function downloadBlob(blob, filename) {
  if (typeof window === 'undefined') return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Export data array to CSV file and trigger download
 * @param {Array<Object>} data
 * @param {Array<string|{key: string, header: string}>} [columns]
 * @param {string} [filename='export.csv']
 */
export function exportToCSV(data = [], columns = null, filename = 'export.csv') {
  if (!Array.isArray(data) || data.length === 0) {
    const emptyBlob = new Blob([''], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(emptyBlob, filename);
    return;
  }

  let formattedData = data;
  if (columns && Array.isArray(columns) && columns.length > 0) {
    formattedData = data.map((item) => {
      const row = {};
      columns.forEach((col) => {
        const key = typeof col === 'string' ? col : (col.key || col.dataKey || col.field);
        const header = typeof col === 'string' ? col : (col.header || col.title || col.label || key);
        row[header] = item[key] !== undefined ? item[key] : '';
      });
      return row;
    });
  }

  const csv = Papa.unparse(formattedData);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, filename.endsWith('.csv') ? filename : `${filename}.csv`);
}

/**
 * Export tabular data to PDF file and trigger download
 * @param {string} title - Document title
 * @param {Array<Object>} data - Table row data
 * @param {Array<{key: string, header: string}>|Array<string>} columns - Column definitions
 * @param {string} [filename='document.pdf']
 */
export function exportToPDF(title, data = [], columns = [], filename = 'document.pdf') {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Header Title
  doc.setFontSize(16);
  doc.setTextColor(30, 41, 59); // slate-800
  doc.text(title || 'Laporan CV Amanah Barokah', 14, 18);

  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text(`Dicetak pada: ${formatDate(new Date(), 'full')}`, 14, 25);

  const head = [
    columns.map((c) =>
      typeof c === 'string' ? c : (c.header || c.title || c.label || c.key)
    ),
  ];

  const body = data.map((row) =>
    columns.map((c) => {
      const key = typeof c === 'string' ? c : (c.key || c.dataKey || c.field);
      const val = row[key];
      return val !== undefined && val !== null ? String(val) : '';
    })
  );

  const tableOptions = {
    startY: 30,
    head: head,
    body: body,
    theme: 'striped',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 9,
      textColor: [51, 65, 85],
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { top: 30, left: 14, right: 14, bottom: 20 },
  };

  if (typeof doc.autoTable === 'function') {
    doc.autoTable(tableOptions);
  } else if (typeof autoTable === 'function') {
    autoTable(doc, tableOptions);
  } else if (autoTable && typeof autoTable.default === 'function') {
    autoTable.default(doc, tableOptions);
  }

  doc.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}

/**
 * Export complete data / database dump as JSON file download
 * @param {Object} data
 * @param {string} [filename='backup.json']
 */
export function exportToJSON(data, filename = 'bang-andi-backup.json') {
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
  downloadBlob(blob, filename.endsWith('.json') ? filename : `${filename}.json`);
}

/**
 * Read and validate JSON file uploaded by user
 * @param {File} file
 * @returns {Promise<Object>}
 */
export async function importFromJSON(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('File tidak ditemukan'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca file JSON'));
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        if (!parsed || typeof parsed !== 'object') {
          throw new Error('Isi file bukan objek JSON yang valid');
        }
        resolve(parsed);
      } catch (err) {
        reject(new Error('Format file JSON tidak valid: ' + err.message));
      }
    };
    reader.readAsText(file);
  });
}

/**
 * Generate formatted WhatsApp message for invoices or reports
 * @param {'tagihan'|'laporan'|'receipt'|string} type
 * @param {Object} data
 * @returns {string}
 */
export function generateWAMessage(type, data = {}) {
  if (type === 'tagihan' || type === 'invoice') {
    const contactName = data.contactName || 'Pelanggan';
    const invoiceNumber = data.invoiceNumber || '-';
    const date = data.date ? formatDate(data.date, 'short') : '-';
    const dueDate = data.dueDate ? formatDate(data.dueDate, 'short') : '-';
    const totalAmount = formatCurrency(data.totalAmount || 0);
    const paidAmount = formatCurrency(data.paidAmount || 0);
    const remainingAmount = formatCurrency(data.remainingAmount || 0);

    let itemsText = '';
    if (Array.isArray(data.items) && data.items.length > 0) {
      itemsText = '\n*Rincian Barang:*\n' + data.items
        .map((it) => `- ${it.itemName}: ${it.qty} ${it.unit || ''} @ ${formatCurrency(it.unitPrice)} = ${formatCurrency(it.subtotal)}`)
        .join('\n');
    }

    return (
      `*TAGIHAN PEMBAYARAN - CV AMANAH BAROKAH*\n` +
      `Kepada Yth: *${contactName}*\n\n` +
      `No. Faktur: ${invoiceNumber}\n` +
      `Tanggal: ${date}\n` +
      `Jatuh Tempo: *${dueDate}*\n` +
      `${itemsText ? itemsText + '\n' : ''}\n` +
      `Total Transaksi: ${totalAmount}\n` +
      `Sudah Dibayar: ${paidAmount}\n` +
      `*Sisa Tagihan: ${remainingAmount}*\n\n` +
      `Pembayaran dapat ditransfer melalui:\n` +
      `*Rekening Resmi*: Bank BCA a.n CV Amanah Barokah\n` +
      `*Kas Tunai*: Langsung ke kasir/gudang\n\n` +
      `Mohon konfirmasi setelah melakukan pembayaran. Terima kasih!`
    );
  }

  if (type === 'laporan' || type === 'report') {
    const period = data.period || formatDate(new Date(), 'short');
    const totalIncome = formatCurrency(data.totalIncome || 0);
    const totalExpense = formatCurrency(data.totalExpense || 0);
    const netProfit = formatCurrency(data.netProfit || 0);
    const totalReceivable = formatCurrency(data.totalReceivable || 0);
    const totalPayable = formatCurrency(data.totalPayable || 0);

    return (
      `*RINGKASAN LAPORAN KEUANGAN CV AMANAH BAROKAH*\n` +
      `Periode: *${period}*\n\n` +
      `• Total Pemasukan: ${totalIncome}\n` +
      `• Total Pengeluaran: ${totalExpense}\n` +
      `• *Laba Bersih: ${netProfit}*\n` +
      `• Sisa Piutang Usaha: ${totalReceivable}\n` +
      `• Sisa Utang Usaha: ${totalPayable}\n\n` +
      `Laporan digenerate otomatis dari Sistem Komoditas & Keuangan CV Amanah Barokah.`
    );
  }

  if (type === 'receipt') {
    const contactName = data.contactName || 'Pelanggan';
    const amount = formatCurrency(data.amount || 0);
    const date = data.date ? formatDate(data.date, 'full') : formatDate(new Date(), 'full');
    const invoiceNumber = data.invoiceNumber || '-';

    return (
      `*BUKTI PEMBAYARAN - CV AMANAH BAROKAH*\n\n` +
      `Telah diterima dari: *${contactName}*\n` +
      `Nominal: *${amount}*\n` +
      `Untuk No. Faktur: ${invoiceNumber}\n` +
      `Tanggal: ${date}\n` +
      `Status: *LUNAS / BERHASIL DITERIMA*\n\n` +
      `Terima kasih banyak atas kerjasamanya.`
    );
  }

  return String(data.message || JSON.stringify(data));
}
