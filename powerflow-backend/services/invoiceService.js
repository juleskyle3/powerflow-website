const fs = require('fs/promises');
const path = require('path');
const PDFDocument = require('pdfkit');

const COMPANY = {
  name: 'POWER FLOW SERVICES LTD',
  addressLine1: 'Kigali - Gasabo - Kimihurura',
  phone: '+250 781 393 649',
  email: 'powerflowservicesltd@gmail.com',
  website: 'www.powerflowservices.com',
};

const COLORS = {
  primary: '#4c62a8',
  text: '#1f2937',
  muted: '#6b7280',
  border: '#cbd5e1',
  lightBorder: '#e5e7eb',
  lightBg: '#f8fafc',
};

function resolveInvoiceDir() {
  const configured = String(process.env.INVOICE_DIR || '').trim();
  if (!configured) {
    return path.join(__dirname, '../public/invoices');
  }

  return path.isAbsolute(configured)
    ? configured
    : path.resolve(path.join(__dirname, '..', configured));
}

const INVOICE_DIR = resolveInvoiceDir();

function asNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value) {
  return `RWF ${asNumber(value).toLocaleString('en-US')}`;
}

function formatDate(value) {
  const date = value ? new Date(value) : new Date();
  return date.toLocaleDateString('en-GB');
}

function safe(value) {
  if (value === null || value === undefined) return '';
  return String(value);
}

function drawSectionHeader(doc, { x, y, width, text }) {
  doc.save();
  doc.rect(x, y, width, 16).fill(COLORS.primary);
  doc
    .fillColor('#ffffff')
    .font('Helvetica-Bold')
    .fontSize(9)
    .text(text, x + 6, y + 4, { width: width - 12 });
  doc.restore();
}

function drawCellText(doc, text, x, y, width, align = 'left') {
  doc
    .fillColor(COLORS.text)
    .font('Helvetica')
    .fontSize(8)
    .text(safe(text), x + 4, y + 4, {
      width: width - 8,
      align,
      lineBreak: false,
      ellipsis: true,
    });
}

async function ensureInvoiceDir() {
  await fs.mkdir(INVOICE_DIR, { recursive: true });
}

function drawInvoiceLayout(doc, order) {
  const left = 44;
  const right = 552;
  const pageWidth = right - left;

  doc.rect(left, 40, pageWidth, 740).strokeColor(COLORS.lightBorder).lineWidth(1).stroke();

  doc
    .font('Helvetica-Bold')
    .fontSize(14)
    .fillColor(COLORS.text)
    .text(COMPANY.name, left + 18, 62);
  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor(COLORS.muted)
    .text(COMPANY.addressLine1, left + 18, 82)
    .text(`Phone: ${COMPANY.phone}`, left + 18, 94)
    .text(`Email: ${COMPANY.email}`, left + 18, 106)
    .text(`Website: ${COMPANY.website}`, left + 18, 118);

  doc
    .font('Helvetica-Bold')
    .fontSize(34)
    .fillColor(COLORS.primary)
    .text('INVOICE', right - 170, 58, { width: 150, align: 'right' });

  const metadataX = right - 170;
  const metadataY = 110;
  const metadataWidth = 150;
  const metadataRowHeight = 18;
  const metadataRows = [
    ['DATE', formatDate(order.createdAt)],
    ['INVOICE #', order.invoiceNumber],
    ['CUSTOMER ID', safe(order._id).slice(-6).toUpperCase()],
  ];

  metadataRows.forEach(([label, value], index) => {
    const y = metadataY + (index * metadataRowHeight);
    doc.rect(metadataX, y, metadataWidth, metadataRowHeight).strokeColor(COLORS.border).stroke();
    doc
      .font('Helvetica-Bold')
      .fontSize(7)
      .fillColor(COLORS.muted)
      .text(label, metadataX + 6, y + 6, { width: 58, align: 'left' });
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(COLORS.text)
      .text(safe(value), metadataX + 64, y + 5, { width: metadataWidth - 70, align: 'right', lineBreak: false, ellipsis: true });
  });

  const billY = 182;
  const billWidth = 242;

  drawSectionHeader(doc, { x: left + 12, y: billY, width: billWidth, text: 'BILL TO:' });
  drawSectionHeader(doc, { x: right - billWidth - 12, y: billY, width: billWidth, text: 'SHIP TO:' });

  const billBodyY = billY + 18;
  const customerLines = [
    order.customerName,
    order.customerEmail,
    order.customerPhone,
    order.customerAddress,
  ].filter(Boolean);

  customerLines.forEach((line, index) => {
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(COLORS.text)
      .text(safe(line), left + 18, billBodyY + (index * 11), { width: billWidth - 12, ellipsis: true });
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(COLORS.text)
      .text(safe(line), right - billWidth - 6, billBodyY + (index * 11), { width: billWidth - 12, ellipsis: true });
  });

  const salesY = billBodyY + 58;
  const salesHeader = [
    'SALESPERSON',
    'P.O. #',
    'SHIP DATE',
    'SHIP VIA',
    'F.O.B.',
    'TERMS',
  ];
  const salesValues = [
    'Online Store',
    '-',
    formatDate(order.createdAt),
    order.shippingMethod || 'Standard',
    'Kigali',
    'Due on receipt',
  ];

  const salesWidths = [84, 50, 74, 62, 50, 94];

  drawSectionHeader(doc, { x: left + 12, y: salesY, width: pageWidth - 24, text: '' });

  let salesCursor = left + 12;
  salesHeader.forEach((header, index) => {
    const width = salesWidths[index];
    doc
      .font('Helvetica-Bold')
      .fontSize(7)
      .fillColor('#ffffff')
      .text(header, salesCursor + 4, salesY + 5, { width: width - 8, align: 'center' });

    doc.rect(salesCursor, salesY + 16, width, 18).strokeColor(COLORS.border).stroke();
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(COLORS.text)
      .text(salesValues[index], salesCursor + 4, salesY + 22, { width: width - 8, align: 'center', lineBreak: false, ellipsis: true });

    salesCursor += width;
  });

  const tableY = salesY + 44;
  const tableHeader = ['ITEM #', 'DESCRIPTION', 'QTY', 'UNIT PRICE', 'TOTAL'];
  const tableWidths = [74, 186, 54, 64, 86];
  const tableX = left + 12;

  drawSectionHeader(doc, { x: tableX, y: tableY, width: tableWidths.reduce((sum, width) => sum + width, 0), text: '' });

  let headerX = tableX;
  tableHeader.forEach((header, index) => {
    const width = tableWidths[index];
    doc
      .font('Helvetica-Bold')
      .fontSize(7)
      .fillColor('#ffffff')
      .text(header, headerX + 4, tableY + 5, { width: width - 8, align: index === 1 ? 'left' : 'center' });
    headerX += width;
  });

  const rows = order.items.map((item, index) => ({
    itemNumber: safe(item.productId || item._id || index + 1).slice(-8),
    description: item.productName,
    quantity: asNumber(item.quantity),
    unitPrice: asNumber(item.price),
    total: asNumber(item.price) * asNumber(item.quantity),
  }));

  const minRows = 9;
  const rowHeight = rows.length > 12 ? 16 : 18;
  const displayRows = Math.max(rows.length, minRows);
  const tableBodyY = tableY + 16;

  for (let i = 0; i < displayRows; i += 1) {
    const y = tableBodyY + (i * rowHeight);
    const row = rows[i];
    let x = tableX;

    tableWidths.forEach((width, colIndex) => {
      doc.rect(x, y, width, rowHeight).strokeColor(COLORS.border).lineWidth(0.6).stroke();

      if (row) {
        if (colIndex === 0) drawCellText(doc, row.itemNumber, x, y, width, 'left');
        if (colIndex === 1) drawCellText(doc, row.description, x, y, width, 'left');
        if (colIndex === 2) drawCellText(doc, row.quantity, x, y, width, 'center');
        if (colIndex === 3) drawCellText(doc, asNumber(row.unitPrice).toLocaleString('en-US'), x, y, width, 'right');
        if (colIndex === 4) drawCellText(doc, asNumber(row.total).toLocaleString('en-US'), x, y, width, 'right');
      }

      x += width;
    });
  }

  const afterTableY = tableBodyY + (displayRows * rowHeight) + 10;

  const commentsWidth = 230;
  drawSectionHeader(doc, {
    x: tableX,
    y: afterTableY,
    width: commentsWidth,
    text: 'OTHER COMMENTS OR SPECIAL INSTRUCTIONS',
  });
  doc.rect(tableX, afterTableY + 16, commentsWidth, 62).strokeColor(COLORS.border).stroke();

  const comments = (order.notes && safe(order.notes).trim())
    ? safe(order.notes).trim()
    : '1. Payment due as agreed terms\n2. Please include invoice number in payment reference';

  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor(COLORS.text)
    .text(comments, tableX + 6, afterTableY + 22, {
      width: commentsWidth - 12,
      height: 52,
      ellipsis: true,
    });

  const totalsX = right - 168;
  const totalsY = afterTableY - 2;
  const totalsRows = [
    ['SUBTOTAL', formatCurrency(order.subtotal)],
    ['DELIVERY', formatCurrency(order.shippingCost)],
    ['TAX', formatCurrency(order.tax)],
    ['TOTAL', formatCurrency(order.totalAmount), true],
  ];

  totalsRows.forEach(([label, value, isTotal], index) => {
    const y = totalsY + (index * 18);
    const height = isTotal ? 20 : 18;

    doc.rect(totalsX, y, 160, height).strokeColor(COLORS.border).stroke();

    if (isTotal) {
      doc.save();
      doc.rect(totalsX, y, 160, height).fill(COLORS.primary);
      doc.restore();
      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .fillColor('#ffffff')
        .text(label, totalsX + 6, y + 6, { width: 70 });
      doc
        .font('Helvetica-Bold')
        .fontSize(10)
        .fillColor('#ffffff')
        .text(value, totalsX + 76, y + 5, { width: 78, align: 'right' });
    } else {
      doc
        .font('Helvetica-Bold')
        .fontSize(8)
        .fillColor(COLORS.muted)
        .text(label, totalsX + 6, y + 5, { width: 70 });
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor(COLORS.text)
        .text(value, totalsX + 76, y + 5, { width: 78, align: 'right' });
    }
  });

  const footerY = afterTableY + 88;

  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor(COLORS.text)
    .text('Make all payments payable to:', tableX + 286, footerY, { width: 160, align: 'center' })
    .font('Helvetica-Bold')
    .text(COMPANY.name, tableX + 286, footerY + 12, { width: 160, align: 'center' });

  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor(COLORS.muted)
    .text(
      'If you have any questions about this invoice, please contact us at ' + COMPANY.phone,
      left + 24,
      footerY + 34,
      { width: pageWidth - 48, align: 'center' }
    );

  doc
    .font('Helvetica-BoldOblique')
    .fontSize(10)
    .fillColor(COLORS.text)
    .text('Thank You For Your Business!', left + 24, footerY + 52, {
      width: pageWidth - 48,
      align: 'center',
    });
}

function generateInvoiceBuffer(order) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 0 });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    drawInvoiceLayout(doc, order);
    doc.end();
  });
}

async function saveInvoiceBuffer(invoiceNumber, buffer) {
  await ensureInvoiceDir();
  const fileName = `${invoiceNumber}.pdf`;
  const filePath = path.join(INVOICE_DIR, fileName);
  await fs.writeFile(filePath, buffer);
  return { fileName, filePath };
}

async function generateAndStoreInvoice(order) {
  const pdfBuffer = await generateInvoiceBuffer(order);
  const file = await saveInvoiceBuffer(order.invoiceNumber, pdfBuffer);
  return {
    ...file,
    pdfBuffer,
  };
}

function getInvoiceFilePath(invoiceNumber) {
  return path.join(INVOICE_DIR, `${invoiceNumber}.pdf`);
}

module.exports = {
  formatCurrency,
  generateInvoiceBuffer,
  generateAndStoreInvoice,
  getInvoiceFilePath,
  saveInvoiceBuffer,
};
