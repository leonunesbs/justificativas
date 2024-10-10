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

// Função auxiliar para dividir o texto em linhas que caibam na largura máxima

// Função auxiliar para dividir o texto em linhas que caibam na largura máxima
function splitTextIntoLines(text: string, font: any, fontSize: number, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  words.forEach((word) => {
    const lineWithWord = currentLine ? `${currentLine} ${word}` : word;
    const lineWidth = font.widthOfTextAtSize(lineWithWord, fontSize);
    if (lineWidth < maxWidth) {
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
  data: any,
  modelPDFBytes: ArrayBuffer,
  doctorInfo?: { doctorName?: string; crm?: string } // Tornamos doctorInfo opcional e seus campos também
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(modelPDFBytes);
  const page = pdfDoc.getPage(0);
  const timesRomanFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);

  const fontSize = 14; // Tamanho da fonte ajustado para 14
  page.setFontSize(fontSize);
  page.setFont(timesRomanFont);

  // Criar o conteúdo com dois parágrafos
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

  // Variável para controlar o espaçamento vertical
  let spacingAfterSignature = 20;

  // Verificar se o nome do médico foi fornecido
  if (doctorInfo?.doctorName) {
    textY -= spacingAfterSignature; // Espaçamento entre linha de assinatura e nome do médico
    const doctorNameText = doctorInfo.doctorName.toUpperCase();
    const doctorNameWidth = timesRomanFont.widthOfTextAtSize(doctorNameText, fontSize);
    const doctorNameX = (pageWidth - doctorNameWidth) / 2;
    page.drawText(doctorNameText, { x: doctorNameX, y: textY });
    spacingAfterSignature = 20; // Atualiza o espaçamento para o próximo elemento
  }

  // Verificar se o CRM foi fornecido
  if (doctorInfo?.crm) {
    textY -= spacingAfterSignature; // Espaçamento entre nome do médico e CRM
    const crmText = `CRM: ${doctorInfo.crm.toUpperCase()}`;
    const crmTextWidth = timesRomanFont.widthOfTextAtSize(crmText, fontSize);
    const crmX = (pageWidth - crmTextWidth) / 2;
    page.drawText(crmText, { x: crmX, y: textY });
    spacingAfterSignature = 40; // Atualiza o espaçamento para o próximo elemento
  }

  // Centralizar a data abaixo do último elemento adicionado
  textY -= spacingAfterSignature; // Espaçamento entre o último elemento e a data
  const dateText = `${new Date().toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
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
  processedData: FormData[],
  modelPDFBytes: ArrayBuffer,
  doctorInfo: { doctorName: string; crm: string }
): Promise<PDFDocument> {
  const pdfDoc = await PDFDocument.create();

  for (const data of processedData) {
    const newPdfBytes = await fillPdfTemplateWithDataForPage(data, modelPDFBytes, doctorInfo);
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
