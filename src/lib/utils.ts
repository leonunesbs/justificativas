import { clsx } from 'clsx';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { twMerge } from 'tailwind-merge';

import type { ClassValue } from 'clsx';

// Definição dos tipos dos dados do formulário
type FormData = {
  patientName: string;
  medicalRecord: string;
  type: string;
  surgery: string;
  justification: string;
};

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Função para quebrar o texto em múltiplas linhas respeitando a largura da caixa de texto
function splitTextIntoLines(text: string, font: any, fontSize: number, maxWidth: number) {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  words.forEach((word) => {
    const lineWithWord = currentLine ? `${currentLine} ${word}` : word;
    const lineWidth = font.widthOfTextAtSize(lineWithWord, fontSize);

    if (lineWidth <= maxWidth) {
      currentLine = lineWithWord;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

export async function fillPdfTemplateWithDataForPage(
  data: FormData, // Agora usando o tipo FormData
  modelPDFBytes: ArrayBuffer
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(modelPDFBytes);
  const page = pdfDoc.getPage(0);
  const timesRomanFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);

  const fontSize = 14; // Tamanho da fonte ajustado para 14
  page.setFontSize(fontSize);
  page.setFont(timesRomanFont);

  // Create the content with two paragraphs
  const introText = `Solicito a realização de procedimento em caráter ${data.type.toUpperCase()} que beneficiaria o paciente ${data.patientName.toUpperCase()} (prontuário ${data.medicalRecord}), acompanhado no Setor de Oftalmologia deste hospital. A solicitação se justifica pela impossibilidade de convocar pacientes em posições à frente na fila de espera.`;

  // Alteração na justificativa conforme solicitado
  const detailsText = `O paciente tem indicação de ${data.surgery}, justificada por ${data.justification}. A realização do procedimento com brevidade é fundamental para prevenir complicações futuras.`;

  // Definir o limite de largura da área de texto
  const maxWidth = 500;
  const textX = 50;
  let textY = 650;

  // Quebrar o texto em linhas que caibam no limite de largura
  const introLines = splitTextIntoLines(introText, timesRomanFont, fontSize, maxWidth);
  const detailsLines = splitTextIntoLines(detailsText, timesRomanFont, fontSize, maxWidth);

  // Desenhar as linhas do texto de introdução
  introLines.forEach((line) => {
    page.drawText(line, { x: textX, y: textY });
    textY -= fontSize + 4; // Ajusta a posição Y para a próxima linha
  });

  // Adicionar um espaço maior entre os parágrafos
  textY -= 24;

  // Desenhar as linhas do texto de detalhes
  detailsLines.forEach((line) => {
    page.drawText(line, { x: textX, y: textY });
    textY -= fontSize + 4; // Ajusta a posição Y para a próxima linha
  });

  // Adicionar espaço para assinatura e informações finais
  textY -= 50; // Espaço para a assinatura

  // Centralizar linha para assinatura
  const pageWidth = page.getWidth();
  const signatureLine = '___________________________';
  const signatureLineWidth = timesRomanFont.widthOfTextAtSize(signatureLine, fontSize);
  const signatureX = (pageWidth - signatureLineWidth) / 2;
  page.drawText(signatureLine, { x: signatureX, y: textY });

  // Centralizar a data abaixo da linha
  textY -= 20; // Espaçamento entre linha e data
  const dateText = `${new Date().toLocaleDateString('utc', {
    dateStyle: 'long',
  })}`;
  const dateTextWidth = timesRomanFont.widthOfTextAtSize(dateText, fontSize);
  const dateX = (pageWidth - dateTextWidth) / 2;
  page.drawText(dateText, { x: dateX, y: textY });

  // Centralizar "Serviço de Oftalmologia - HGF" abaixo da data
  textY -= 20; // Espaçamento entre data e texto
  const serviceText = 'Serviço de Oftalmologia - HGF';
  const serviceTextWidth = timesRomanFont.widthOfTextAtSize(serviceText, fontSize);
  const serviceX = (pageWidth - serviceTextWidth) / 2;
  page.drawText(serviceText, { x: serviceX, y: textY });

  return await pdfDoc.save();
}

export async function createPdfFromData(
  processedData: FormData[], // Agora usando o tipo FormData para a lista de dados
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
