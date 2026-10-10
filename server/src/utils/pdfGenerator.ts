import PDFDocument from 'pdfkit';
import { ICompanySettings } from '../models/CompanySettings.js';
import { IQuote } from '../models/Quote.js';
import { IInvoice } from '../models/Invoice.js';
import { paiseToRupees, numberToIndianWords } from './moneyHelper.js';
import { formatINR } from './formatters.js';

export interface DocumentPDFOptions {
  type: 'quote' | 'invoice';
  doc: IQuote | IInvoice | any;
  company: ICompanySettings | any;
}

/**
 * Format date for PDF display (e.g. 10 Oct, 2026)
 */
function formatDate(d: Date | string | null | undefined): string {
  if (!d) return '-';
  const date = new Date(d);
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Generates an A4 PDF buffer using pdfkit
 */
export async function generateDocumentPDF(options: DocumentPDFOptions): Promise<Buffer> {
  const { type, doc, company } = options;
  const isInvoice = type === 'invoice';
  const title = isInvoice ? 'TAX INVOICE' : 'QUOTATION';

  return new Promise((resolve, reject) => {
    try {
      const pdf = new PDFDocument({
        size: 'A4',
        margin: 40,
        info: {
          Title: `${title} - ${doc.number}`,
          Author: company.legalName || 'Flowdesk CRM',
        },
      });

      const buffers: Buffer[] = [];
      pdf.on('data', (chunk) => buffers.push(chunk));
      pdf.on('end', () => resolve(Buffer.concat(buffers)));
      pdf.on('error', (err) => reject(err));

      const pageWidth = 595.28; // A4 width in pt
      const margin = 40;
      const contentWidth = pageWidth - margin * 2; // ~515.28

      // ================= HEADER =================
      // Left: Company Branding
      pdf.font('Helvetica-Bold').fontSize(16).fillColor('#111111').text(company.legalName || 'Flowdesk Technologies Pvt Ltd', margin, 40);
      pdf.font('Helvetica').fontSize(8).fillColor('#555555');
      pdf.text(company.address || '', margin, 62, { width: 280 });

      let metaY = pdf.y + 3;
      if (company.gstin) {
        pdf.text(`GSTIN: ${company.gstin} | PAN: ${company.pan || '-'}`, margin, metaY);
        metaY += 12;
      }
      pdf.text(`Email: ${company.email || '-'} | Phone: ${company.phone || '-'}`, margin, metaY);

      // Right: Document Badge & Meta
      pdf.font('Helvetica-Bold').fontSize(16).fillColor('#000000').text(title, pageWidth - margin - 200, 40, { width: 200, align: 'right' });
      pdf.font('Helvetica-Bold').fontSize(10).fillColor('#333333').text(doc.number, pageWidth - margin - 200, 62, { width: 200, align: 'right' });

      pdf.font('Helvetica').fontSize(8).fillColor('#666666');
      const dateLabel = isInvoice ? 'Issue Date:' : 'Date:';
      const dueLabel = isInvoice ? 'Due Date:' : 'Valid Until:';
      const issueDate = isInvoice ? doc.issueDate : doc.createdAt;
      const dueDate = isInvoice ? doc.dueDate : doc.validUntil;

      pdf.text(`${dateLabel} ${formatDate(issueDate)}`, pageWidth - margin - 200, 78, { width: 200, align: 'right' });
      pdf.text(`${dueLabel} ${formatDate(dueDate)}`, pageWidth - margin - 200, 90, { width: 200, align: 'right' });
      pdf.text(`Place of Supply: ${doc.account?.state || doc.taxMode === 'intra' ? company.state : 'Inter-State'}`, pageWidth - margin - 200, 102, { width: 200, align: 'right' });

      // Horizontal Divider
      pdf.strokeColor('#E4E4E7').lineWidth(1).moveTo(margin, 125).lineTo(pageWidth - margin, 125).stroke();

      // ================= BILL TO SECTION =================
      const billToY = 135;
      pdf.font('Helvetica-Bold').fontSize(9).fillColor('#111111').text('BILL TO:', margin, billToY);
      pdf.font('Helvetica-Bold').fontSize(10).fillColor('#000000').text(doc.account?.name || 'Customer Account', margin, billToY + 14);

      pdf.font('Helvetica').fontSize(8).fillColor('#555555');
      let custY = billToY + 28;
      const contactName = doc.contact?.firstName ? `${doc.contact.firstName} ${doc.contact.lastName || ''}`.trim() : '';
      if (contactName) {
        pdf.text(`Attn: ${contactName}`, margin, custY);
        custY += 12;
      }
      if (doc.contact?.email) {
        pdf.text(`Email: ${doc.contact.email} | Phone: ${doc.contact?.phone || '-'}`, margin, custY);
        custY += 12;
      }
      if (doc.account?.city || doc.account?.state) {
        pdf.text(`${doc.account?.city || ''}${doc.account?.city && doc.account?.state ? ', ' : ''}${doc.account?.state || ''}`, margin, custY);
      }

      // ================= LINE ITEMS TABLE =================
      const tableTop = 205;
      pdf.rect(margin, tableTop, contentWidth, 20).fill('#F4F4F5');

      pdf.font('Helvetica-Bold').fontSize(8).fillColor('#333333');
      pdf.text('#', margin + 6, tableTop + 6, { width: 20 });
      pdf.text('ITEM & DESCRIPTION', margin + 30, tableTop + 6, { width: 210 });
      pdf.text('QTY', margin + 245, tableTop + 6, { width: 35, align: 'right' });
      pdf.text('UNIT PRICE', margin + 285, tableTop + 6, { width: 65, align: 'right' });
      pdf.text('DISC %', margin + 355, tableTop + 6, { width: 40, align: 'right' });
      pdf.text('TAX', margin + 400, tableTop + 6, { width: 40, align: 'right' });
      pdf.text('AMOUNT', margin + 445, tableTop + 6, { width: 65, align: 'right' });

      let currentY = tableTop + 24;

      (doc.items || []).forEach((item: any, idx: number) => {
        // Alternating background row if needed
        pdf.font('Helvetica').fontSize(8).fillColor('#222222');
        pdf.text(String(idx + 1), margin + 6, currentY, { width: 20 });

        pdf.font('Helvetica-Bold').fontSize(8).fillColor('#111111').text(item.name, margin + 30, currentY, { width: 210 });
        if (item.description) {
          pdf.font('Helvetica').fontSize(7).fillColor('#666666').text(item.description, margin + 30, currentY + 11, { width: 210 });
        }

        const unitPriceRupees = paiseToRupees(item.unitPrice);
        const lineTotalRupees = paiseToRupees(item.lineTotal);

        pdf.font('Helvetica').fontSize(8).fillColor('#333333');
        pdf.text(String(item.qty), margin + 245, currentY, { width: 35, align: 'right' });
        pdf.text(formatINR(unitPriceRupees), margin + 285, currentY, { width: 65, align: 'right' });
        pdf.text(`${item.discountPct || 0}%`, margin + 355, currentY, { width: 40, align: 'right' });
        pdf.text(`${item.taxRate || 18}%`, margin + 400, currentY, { width: 40, align: 'right' });
        pdf.font('Helvetica-Bold').text(formatINR(lineTotalRupees), margin + 445, currentY, { width: 65, align: 'right' });

        const rowHeight = item.description ? 26 : 18;
        currentY += rowHeight;

        // Subtle row line
        pdf.strokeColor('#EEEEEE').lineWidth(0.5).moveTo(margin, currentY - 2).lineTo(pageWidth - margin, currentY - 2).stroke();
      });

      // Bottom separator
      pdf.strokeColor('#E4E4E7').lineWidth(1).moveTo(margin, currentY + 4).lineTo(pageWidth - margin, currentY + 4).stroke();

      // ================= TOTALS SUMMARY =================
      const totalsY = currentY + 12;
      const totalsColWidth = 190;
      const totalsColX = pageWidth - margin - totalsColWidth;

      const subtotalRupees = paiseToRupees(doc.subtotal);
      const discountRupees = paiseToRupees(doc.discountTotal);
      const totalRupees = paiseToRupees(doc.total);

      // Left column: Amount in Words & Bank details
      pdf.font('Helvetica-Bold').fontSize(8).fillColor('#111111').text('AMOUNT IN WORDS:', margin, totalsY);
      pdf.font('Helvetica').fontSize(8).fillColor('#444444').text(numberToIndianWords(doc.total), margin, totalsY + 12, { width: 280 });

      // Bank Details Card
      const bankY = totalsY + 36;
      pdf.rect(margin, bankY, 280, 52).fillAndStroke('#FAFAFA', '#E4E4E7');
      pdf.font('Helvetica-Bold').fontSize(8).fillColor('#111111').text('BANK DETAILS FOR NEFT / RTGS', margin + 8, bankY + 6);
      pdf.font('Helvetica').fontSize(7.5).fillColor('#444444');
      const b = company.bankDetails || {};
      pdf.text(`Bank Name: ${b.bankName || '-'}`, margin + 8, bankY + 18);
      pdf.text(`A/C Holder: ${b.accountName || company.legalName}`, margin + 8, bankY + 28);
      pdf.text(`A/C Number: ${b.accountNumber || '-'}  |  IFSC: ${b.ifsc || '-'}`, margin + 8, bankY + 38);

      // Right column: Financial Summary
      let rY = totalsY;
      function addTotalRow(label: string, val: string, isBold: boolean = false, isHighlight: boolean = false) {
        if (isHighlight) {
          pdf.rect(totalsColX - 8, rY - 4, totalsColWidth + 8, 20).fill('#000000');
          pdf.font('Helvetica-Bold').fontSize(9).fillColor('#FFFFFF');
          pdf.text(label, totalsColX, rY + 2, { width: 100 });
          pdf.text(val, totalsColX + 90, rY + 2, { width: 95, align: 'right' });
          rY += 22;
        } else {
          pdf.font(isBold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8).fillColor(isBold ? '#111111' : '#666666');
          pdf.text(label, totalsColX, rY, { width: 100 });
          pdf.text(val, totalsColX + 90, rY, { width: 95, align: 'right' });
          rY += 14;
        }
      }

      addTotalRow('Subtotal:', formatINR(subtotalRupees));
      if (doc.discountTotal > 0) {
        addTotalRow('Discount:', `-${formatINR(discountRupees)}`);
      }

      if (doc.taxMode === 'intra') {
        const cgstRupees = paiseToRupees(doc.cgstTotal);
        const sgstRupees = paiseToRupees(doc.sgstTotal);
        addTotalRow('CGST:', formatINR(cgstRupees));
        addTotalRow('SGST:', formatINR(sgstRupees));
      } else {
        const igstRupees = paiseToRupees(doc.igstTotal || doc.taxTotal);
        addTotalRow('IGST:', formatINR(igstRupees));
      }

      rY += 4;
      addTotalRow('TOTAL AMOUNT:', formatINR(totalRupees), true, true);

      // If Invoice with payments, show Paid and Balance
      if (isInvoice && doc.paidTotal > 0) {
        pdf.font('Helvetica-Bold').fontSize(8).fillColor('#15803D');
        pdf.text('Paid Amount:', totalsColX, rY, { width: 100 });
        pdf.text(formatINR(paiseToRupees(doc.paidTotal)), totalsColX + 90, rY, { width: 95, align: 'right' });
        rY += 14;

        pdf.font('Helvetica-Bold').fontSize(8).fillColor(doc.balance > 0 ? '#B42318' : '#15803D');
        pdf.text('Balance Due:', totalsColX, rY, { width: 100 });
        pdf.text(formatINR(paiseToRupees(doc.balance)), totalsColX + 90, rY, { width: 95, align: 'right' });
        rY += 16;
      }

      // ================= TERMS & FOOTER =================
      const footerY = Math.max(rY + 20, bankY + 65);
      if (doc.terms || company.defaultTerms) {
        pdf.font('Helvetica-Bold').fontSize(8).fillColor('#222222').text('TERMS & CONDITIONS:', margin, footerY);
        pdf.font('Helvetica').fontSize(7).fillColor('#666666').text(doc.terms || company.defaultTerms, margin, footerY + 12, {
          width: 320,
        });
      }

      // Signatory
      pdf.font('Helvetica-Bold').fontSize(8).fillColor('#111111').text('For ' + (company.legalName || 'Flowdesk CRM'), pageWidth - margin - 150, footerY + 12, {
        width: 150,
        align: 'center',
      });
      pdf.font('Helvetica').fontSize(7).fillColor('#777777').text('Authorized Signatory', pageWidth - margin - 150, footerY + 48, {
        width: 150,
        align: 'center',
      });

      pdf.end();
    } catch (err) {
      reject(err);
    }
  });
}
