import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface BOLShipper {
  company: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
}

export interface BOLConsignee {
  name: string;
  company: string;
  address: string;
  address2?: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
}

export interface BOLLineItem {
  qty: number;
  description: string;
  sku: string;
  weight: number | null;
  freightClass: string | null;
}

export interface BOLData {
  orderNumber: string;
  date: string;
  carrier: string;
  trackingNumber?: string;
  shipper: BOLShipper;
  consignee: BOLConsignee;
  items: BOLLineItem[];
  specialInstructions?: string;
  isRush?: boolean;
}

function drawBox(doc: jsPDF, x: number, y: number, w: number, h: number) {
  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.rect(x, y, w, h);
}

function drawSectionHeader(doc: jsPDF, x: number, y: number, w: number, text: string) {
  doc.setFillColor(30, 41, 59); // slate-800
  doc.rect(x, y, w, 7, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text(text, x + 2, y + 5);
  doc.setTextColor(0, 0, 0);
}

export function generateBOL(data: BOLData): jsPDF {
  const doc = new jsPDF("p", "mm", "letter");
  const pageWidth = 215.9;
  const margin = 12;
  const contentWidth = pageWidth - margin * 2;
  const halfWidth = contentWidth / 2 - 2;

  let y = margin;

  // === HEADER ===
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(margin, y, contentWidth, 18, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("BILL OF LADING", margin + 4, y + 7);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("STRAIGHT - NOT NEGOTIABLE", margin + 4, y + 13);

  // Order info on right side of header
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(`BOL #: ${data.orderNumber}`, pageWidth - margin - 4, y + 7, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.text(`Date: ${data.date}`, pageWidth - margin - 4, y + 13, { align: "right" });
  doc.setTextColor(0, 0, 0);

  y += 22;

  // === SHIPPER & CONSIGNEE (side by side) ===
  const shipperX = margin;
  const consigneeX = margin + halfWidth + 4;
  const partyBoxHeight = 38;

  // Shipper
  drawSectionHeader(doc, shipperX, y, halfWidth, "SHIPPER (FROM)");
  drawBox(doc, shipperX, y, halfWidth, partyBoxHeight);
  doc.setFontSize(9);
  let sy = y + 12;
  doc.setFont("helvetica", "bold");
  doc.text(data.shipper.company, shipperX + 2, sy);
  doc.setFont("helvetica", "normal");
  if (data.shipper.address) { sy += 5; doc.text(data.shipper.address, shipperX + 2, sy); }
  const shipperCityLine = [data.shipper.city, data.shipper.state].filter(Boolean).join(", ") + (data.shipper.zip ? ` ${data.shipper.zip}` : "");
  if (shipperCityLine.trim()) { sy += 5; doc.text(shipperCityLine, shipperX + 2, sy); }
  if (data.shipper.phone) { sy += 5; doc.text(`Phone: ${data.shipper.phone}`, shipperX + 2, sy); }

  // Consignee
  drawSectionHeader(doc, consigneeX, y, halfWidth, "CONSIGNEE (TO)");
  drawBox(doc, consigneeX, y, halfWidth, partyBoxHeight);
  doc.setFontSize(9);
  let cy = y + 12;

  // Name first (recipient), then company if different
  const recipientName = data.consignee.name || "";
  const recipientCompany = data.consignee.company || "";

  if (recipientName) {
    doc.setFont("helvetica", "bold");
    doc.text(recipientName, consigneeX + 2, cy);
    cy += 5;
    if (recipientCompany && recipientCompany !== recipientName) {
      doc.setFont("helvetica", "normal");
      doc.text(recipientCompany, consigneeX + 2, cy);
      cy += 5;
    }
  } else if (recipientCompany) {
    doc.setFont("helvetica", "bold");
    doc.text(recipientCompany, consigneeX + 2, cy);
    cy += 5;
  }

  doc.setFont("helvetica", "normal");
  if (data.consignee.address) { doc.text(data.consignee.address, consigneeX + 2, cy); cy += 5; }
  if (data.consignee.address2) { doc.text(data.consignee.address2, consigneeX + 2, cy); cy += 5; }
  const consigneeCityLine = [data.consignee.city, data.consignee.state].filter(Boolean).join(", ") + (data.consignee.zip ? ` ${data.consignee.zip}` : "");
  if (consigneeCityLine.trim()) { doc.text(consigneeCityLine, consigneeX + 2, cy); cy += 5; }
  if (data.consignee.phone) { doc.text(`Phone: ${data.consignee.phone}`, consigneeX + 2, cy); }

  y += partyBoxHeight + 4;

  // === CARRIER INFO ===
  drawSectionHeader(doc, margin, y, contentWidth, "CARRIER INFORMATION");
  drawBox(doc, margin, y, contentWidth, 16);
  doc.setFontSize(9);

  const carrierCol1 = margin + 2;
  const carrierCol2 = margin + contentWidth / 3;
  const carrierCol3 = margin + (contentWidth * 2) / 3;

  doc.setFont("helvetica", "bold");
  doc.text("Carrier:", carrierCol1, y + 12);
  doc.setFont("helvetica", "normal");
  doc.text(data.carrier || "TBD", carrierCol1 + 18, y + 12);

  doc.setFont("helvetica", "bold");
  doc.text("Tracking #:", carrierCol2, y + 12);
  doc.setFont("helvetica", "normal");
  doc.text(data.trackingNumber || "—", carrierCol2 + 24, y + 12);

  if (data.isRush) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(220, 38, 38); // red
    doc.text("RUSH ORDER", carrierCol3, y + 12);
    doc.setTextColor(0, 0, 0);
  }

  y += 20;

  // === LINE ITEMS TABLE ===
  drawSectionHeader(doc, margin, y, contentWidth, "COMMODITIES");
  y += 7;

  const totalWeight = data.items.reduce((sum, item) => sum + (item.weight || 0) * item.qty, 0);

  const tableBody = data.items.map((item) => [
    String(item.qty),
    item.description,
    item.sku,
    item.weight ? `${(item.weight * item.qty).toFixed(1)}` : "—",
    item.freightClass || "—",
  ]);

  // Add totals row
  tableBody.push([
    "",
    "",
    "TOTAL",
    totalWeight > 0 ? `${totalWeight.toFixed(1)}` : "—",
    "",
  ]);

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["QTY", "DESCRIPTION", "SKU", "WEIGHT (LBS)", "CLASS"]],
    body: tableBody,
    theme: "grid",
    styles: {
      fontSize: 8,
      cellPadding: 2,
      lineColor: [0, 0, 0],
      lineWidth: 0.3,
    },
    headStyles: {
      fillColor: [100, 116, 139], // slate-500
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
    },
    columnStyles: {
      0: { cellWidth: 18, halign: "center" },
      1: { cellWidth: "auto" },
      2: { cellWidth: 30 },
      3: { cellWidth: 28, halign: "right" },
      4: { cellWidth: 20, halign: "center" },
    },
    didParseCell: (hookData) => {
      // Bold the totals row
      if (hookData.row.index === tableBody.length - 1) {
        hookData.cell.styles.fontStyle = "bold";
        hookData.cell.styles.fillColor = [241, 245, 249]; // slate-100
      }
    },
  });

  // Get Y after table
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable?.finalY || y + 40;
  y += 4;

  // === SPECIAL INSTRUCTIONS ===
  if (data.specialInstructions) {
    drawSectionHeader(doc, margin, y, contentWidth, "SPECIAL INSTRUCTIONS");
    drawBox(doc, margin, y, contentWidth, 20);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(data.specialInstructions, contentWidth - 4);
    doc.text(lines, margin + 2, y + 12);
    y += 24;
  }

  y += 6;

  // === SIGNATURE LINES ===
  const sigWidth = contentWidth / 2 - 2;
  const sigHeight = 28;

  // Shipper signature
  drawSectionHeader(doc, margin, y, sigWidth, "SHIPPER SIGNATURE");
  drawBox(doc, margin, y, sigWidth, sigHeight);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text("Signature: ________________________________", margin + 2, y + 14);
  doc.text("Date: _______________", margin + 2, y + 22);

  // Carrier signature
  drawSectionHeader(doc, margin + sigWidth + 4, y, sigWidth, "CARRIER SIGNATURE");
  drawBox(doc, margin + sigWidth + 4, y, sigWidth, sigHeight);
  doc.text("Signature: ________________________________", margin + sigWidth + 6, y + 14);
  doc.text("Date: _______________", margin + sigWidth + 6, y + 22);

  y += sigHeight + 6;

  // Receiver signature
  drawSectionHeader(doc, margin, y, sigWidth, "RECEIVER SIGNATURE");
  drawBox(doc, margin, y, sigWidth, sigHeight);
  doc.text("Signature: ________________________________", margin + 2, y + 14);
  doc.text("Date: _______________", margin + 2, y + 22);

  // Received count
  drawSectionHeader(doc, margin + sigWidth + 4, y, sigWidth, "RECEIVED IN GOOD CONDITION");
  drawBox(doc, margin + sigWidth + 4, y, sigWidth, sigHeight);
  doc.text("Pieces: ______  Pallets: ______", margin + sigWidth + 6, y + 14);
  doc.text("Exceptions: ____________________________", margin + sigWidth + 6, y + 22);

  // === FOOTER ===
  y = 267; // near bottom
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Generated by 7 Degrees Co IMS  |  ${data.date}  |  BOL# ${data.orderNumber}`,
    pageWidth / 2,
    y,
    { align: "center" }
  );

  return doc;
}

export function downloadBOL(data: BOLData) {
  const doc = generateBOL(data);
  doc.save(`BOL-${data.orderNumber}.pdf`);
}

export function printBOL(data: BOLData) {
  const doc = generateBOL(data);
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  const printWindow = window.open(url, "_blank");
  if (printWindow) {
    printWindow.addEventListener("load", () => {
      printWindow.print();
    });
  }
}
