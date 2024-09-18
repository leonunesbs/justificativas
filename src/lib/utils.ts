import { clsx } from 'clsx';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { twMerge } from 'tailwind-merge';

import type { ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export async function fillPdfTemplateWithDataForPage(
  data: any, // Replace 'any' with a proper type if needed
  modelPDFBytes: ArrayBuffer
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(modelPDFBytes);
  const page = pdfDoc.getPage(0);
  const timesRomanFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);

  page.setFontSize(10);
  page.setFont(timesRomanFont);

  // Fill the template with data
  page.drawText(data.patientName.toUpperCase(), { x: 100, y: 633 });
  page.drawText(data.medicalRecord, { x: 475, y: 633 });
  page.drawText(data.type, { x: 50, y: 300 });
  page.drawText(data.surgery, { x: 50, y: 250 });
  page.drawText(data.clinicalData, { x: 50, y: 200 });
  page.drawText(data.justification, { x: 50, y: 150 });

  return await pdfDoc.save();
}

export async function createPdfFromData(
  processedData: any[], // Replace 'any' with the type of the data list
  modelPDFBytes: ArrayBuffer
): Promise<PDFDocument> {
  const pdfDoc = await PDFDocument.create();

  for (const data of processedData) {
    const newPdfBytes = await fillPdfTemplateWithDataForPage(data, modelPDFBytes);
    const newPdfDoc = await PDFDocument.load(newPdfBytes);
    const [copiedPage] = await pdfDoc.copyPages(newPdfDoc, [0]);
    pdfDoc.addPage(copiedPage);
  }

  return pdfDoc;
}

export function createPdfUrl(pdfBytes: Uint8Array): string {
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  return window.URL.createObjectURL(blob);
}
