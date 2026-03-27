// ============================================================
// Shipping Manifest PDF Generator
// Uses jsPDF + autoTable to produce a professional manifest
// ============================================================

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Order } from '@/types';

interface ManifestData {
  orders: Order[];
  trackingNumbers: Record<string, string>;
  courierName?: string;
  courierTime?: string;
  batchLabel?: string;
  mode?: 'one_time' | 'subscription'; // Optional — unified stations
}

export function generateShippingManifest(data: ManifestData) {
  const { orders, trackingNumbers, courierName, courierTime, batchLabel, mode } = data;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-AE', { year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit' });
  const modeLabel = mode === 'subscription' ? 'Subscription' : 'One-Time';

  // ── Header ──
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('MAISON EM', 14, 16);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text('OPS CONSOLE — Shipping Manifest', 14, 22);

  doc.setFontSize(9);
  doc.text(`Date: ${dateStr}  |  Time: ${timeStr}  |  Mode: ${modeLabel}`, 14, 28);
  if (batchLabel) {
    doc.text(`Batch: ${batchLabel}`, 14, 33);
  }

  // ── Summary box ──
  const summaryY = batchLabel ? 38 : 33;
  doc.setDrawColor(200);
  doc.setFillColor(248, 248, 248);
  doc.roundedRect(14, summaryY, 269, 14, 2, 2, 'FD');

  doc.setFontSize(9);
  doc.setTextColor(60);
  doc.setFont('helvetica', 'bold');
  doc.text(`Total Orders: ${orders.length}`, 20, summaryY + 6);

  const totalItems = orders.reduce((sum, o) => sum + o.items.length, 0);
  doc.text(`Total Items: ${totalItems}`, 80, summaryY + 6);

  if (courierName) {
    doc.text(`Courier: ${courierName}`, 140, summaryY + 6);
  }
  if (courierTime) {
    doc.text(`Pickup: ${courierTime}`, 210, summaryY + 6);
  }

  // ── Orders table ──
  const tableY = summaryY + 20;

  const tableHead = [
    ['#', 'Order ID', 'Customer', 'City / Country', 'Items', 'Qty', 'Box Serial', 'Tracking #', 'Status'],
  ];

  const tableBody = orders.map((order, idx) => {
    const itemsSummary = order.items
      .map(i => `${i.perfume_name} (${i.size_ml}ml)`)
      .join(', ');
    const totalQty = order.items.reduce((s, i) => s + (i.qty || 1), 0);
    const tracking = trackingNumbers[order.order_id] || '—';
    const boxSerial = `BOX-${String(idx + 1).padStart(3, '0')}`;
    const status = order.status === 'shipped' ? 'SHIPPED' : 'PACKED';

    return [
      String(idx + 1),
      order.order_id,
      order.customer.name,
      `${order.customer.city}, ${order.customer.country}`,
      itemsSummary,
      String(totalQty),
      boxSerial,
      tracking,
      status,
    ];
  });

  autoTable(doc, {
    startY: tableY,
    head: tableHead,
    body: tableBody,
    theme: 'grid',
    headStyles: {
      fillColor: [45, 45, 45],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'left',
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [40, 40, 40],
      cellPadding: 2,
    },
    alternateRowStyles: {
      fillColor: [250, 250, 250],
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 28, fontStyle: 'bold' },
      2: { cellWidth: 30 },
      3: { cellWidth: 30 },
      4: { cellWidth: 70 },
      5: { cellWidth: 10, halign: 'center' },
      6: { cellWidth: 22, halign: 'center' },
      7: { cellWidth: 35, fontStyle: 'bold' },
      8: { cellWidth: 18, halign: 'center' },
    },
    margin: { left: 14, right: 14 },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 8) {
        const val = data.cell.raw as string;
        if (val === 'SHIPPED') {
          data.cell.styles.textColor = [34, 139, 34];
          data.cell.styles.fontStyle = 'bold';
        } else {
          data.cell.styles.textColor = [200, 150, 50];
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
  });

  // ── Footer ──
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text(
      `Maison Em OS — Shipping Manifest — Page ${i} of ${pageCount} — Generated ${dateStr} ${timeStr}`,
      14,
      doc.internal.pageSize.getHeight() - 8
    );
  }

  // ── Signature area on last page ──
  doc.setPage(pageCount);
  const finalY = (doc as any).lastAutoTable?.finalY || 160;
  const sigY = Math.min(finalY + 15, doc.internal.pageSize.getHeight() - 35);

  doc.setDrawColor(180);
  doc.setFontSize(8);
  doc.setTextColor(80);

  doc.text('Prepared by:', 14, sigY);
  doc.line(40, sigY, 100, sigY);

  doc.text('Courier signature:', 120, sigY);
  doc.line(155, sigY, 220, sigY);

  doc.text('Date:', 235, sigY);
  doc.line(248, sigY, 280, sigY);

  // ── Save ──
  const filename = `manifest-${mode}-${now.toISOString().slice(0, 10)}-${now.getTime().toString(36)}.pdf`;
  doc.save(filename);

  return filename;
}
