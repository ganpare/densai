import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

const UPLOADS_DIR = 'uploads/pdfs';
const FONT_PATH = path.join(__dirname, 'assets', 'fonts', 'NotoSansJP-Regular.ttf');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

export interface ReportPdfData {
  reportNumber: string;
  userNumber: string;
  bankCode: string;
  branchCode: string;
  companyName: string;
  contactPersonName: string;
  handlerName: string;
  approverName: string;
  inquiryContent: string;
  responseContent: string;
  escalationRequired: boolean;
  escalationReason?: string;
  approvedAt?: number;
  createdAt: number;
}

export class PdfService {
  private formatDate(timestamp: number): string {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private registerFont(doc: PDFKit.PDFDocument): void {
    if (fs.existsSync(FONT_PATH)) {
      doc.registerFont('NotoSansJP', FONT_PATH);
      doc.font('NotoSansJP');
    }
  }

  private drawSectionHeader(doc: PDFKit.PDFDocument, title: string, y: number): number {
    doc.fontSize(14).font('NotoSansJP');
    doc.fillColor('#000000');
    doc.rect(doc.page.margins.left, y, doc.page.width - doc.page.margins.left - doc.page.margins.right, 30)
       .fill('#f0f0f0');
    doc.fillColor('#000000');
    doc.text(title, doc.page.margins.left + 10, y + 8);
    return y + 30;
  }

  private drawLabelValueRow(
    doc: PDFKit.PDFDocument, 
    label: string, 
    value: string, 
    y: number,
    isLastRow: boolean = false
  ): number {
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const labelWidth = pageWidth * 0.3;
    const valueWidth = pageWidth * 0.7;
    const rowHeight = 25;
    const x = doc.page.margins.left;

    // Draw borders
    doc.rect(x, y, labelWidth, rowHeight).stroke();
    doc.rect(x + labelWidth, y, valueWidth, rowHeight).stroke();

    // Fill label cell with light background
    doc.rect(x, y, labelWidth, rowHeight).fill('#f9f9f9');

    // Draw text
    doc.fillColor('#000000');
    doc.fontSize(10).font('NotoSansJP');
    doc.text(label, x + 5, y + 7, { width: labelWidth - 10, align: 'left' });
    doc.text(value, x + labelWidth + 5, y + 7, { width: valueWidth - 10, align: 'left' });

    return y + rowHeight;
  }

  private drawTextBox(
    doc: PDFKit.PDFDocument,
    title: string,
    content: string,
    y: number
  ): number {
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const x = doc.page.margins.left;
    
    // Title bar
    y = this.drawSectionHeader(doc, title, y);

    // Calculate content height
    doc.fontSize(10).font('NotoSansJP');
    const textHeight = doc.heightOfString(content, { width: pageWidth - 20 });
    const boxHeight = Math.max(60, textHeight + 20);

    // Draw content box
    doc.rect(x, y, pageWidth, boxHeight).stroke();
    doc.fillColor('#000000');
    doc.text(content, x + 10, y + 10, { width: pageWidth - 20, align: 'left' });

    return y + boxHeight;
  }

  private sanitizeFilename(filename: string): string {
    // Allow alphanumeric, spaces, dots, hyphens, underscores, and parentheses
    const base = filename.replace(/[^a-zA-Z0-9 ._\-()]/g, '');
    // Remove leading dots to prevent hidden files
    const noLeadingDot = base.replace(/^\.+/, '');
    // Collapse multiple dots to prevent double extensions
    const singleDots = noLeadingDot.replace(/\.+/g, '.');
    // Trim whitespace
    const trimmed = singleDots.trim();
    // Limit length and provide fallback
    return trimmed.slice(0, 120) || 'file';
  }

  async generateReportPdf(data: ReportPdfData): Promise<{ filename: string; filepath: string }> {
    // Sanitize report number to prevent path traversal
    const sanitizedReportNumber = this.sanitizeFilename(data.reportNumber);
    const filename = `report_${sanitizedReportNumber}_${Date.now()}.pdf`;
    const filepath = path.join(UPLOADS_DIR, filename);

    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        const writeStream = fs.createWriteStream(filepath);

        doc.pipe(writeStream);

        // Register Japanese font
        this.registerFont(doc);

        // Title
        doc.fontSize(18).font('NotoSansJP').fillColor('#000000');
        doc.text('電子債権問い合わせ対応報告書', { align: 'center' });
        doc.moveDown(2);

        let y = doc.y;

        // Report details section
        y = this.drawSectionHeader(doc, '報告書情報', y);
        y = this.drawLabelValueRow(doc, '報告書番号', data.reportNumber, y);
        y = this.drawLabelValueRow(doc, '作成日時', this.formatDate(data.createdAt), y);
        if (data.approvedAt) {
          y = this.drawLabelValueRow(doc, '承認日時', this.formatDate(data.approvedAt), y);
        }
        y += 20;

        // Customer information
        y = this.drawSectionHeader(doc, '顧客情報', y);
        y = this.drawLabelValueRow(doc, '利用者番号', data.userNumber, y);
        y = this.drawLabelValueRow(doc, '金融機関コード', data.bankCode, y);
        y = this.drawLabelValueRow(doc, '支店コード', data.branchCode, y);
        y = this.drawLabelValueRow(doc, '会社名', data.companyName, y);
        y = this.drawLabelValueRow(doc, '担当者名', data.contactPersonName, y);
        y += 20;

        // Handler information
        y = this.drawSectionHeader(doc, '対応者情報', y);
        y = this.drawLabelValueRow(doc, '対応者', data.handlerName, y);
        y = this.drawLabelValueRow(doc, '承認者', data.approverName, y);
        y += 20;

        // Inquiry content
        y = this.drawTextBox(doc, '問い合わせ内容', data.inquiryContent, y);
        y += 20;

        // Response content
        y = this.drawTextBox(doc, '対応内容', data.responseContent, y);
        y += 20;

        // Escalation information
        if (data.escalationRequired) {
          y = this.drawSectionHeader(doc, 'エスカレーション情報', y);
          y = this.drawLabelValueRow(doc, 'エスカレーション', '必要', y);
          if (data.escalationReason) {
            y = this.drawLabelValueRow(doc, '理由', data.escalationReason, y);
          }
        }

        doc.end();

        writeStream.on('finish', () => {
          resolve({ filename, filepath });
        });

        writeStream.on('error', (error) => {
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  getPdfPath(filename: string): string {
    // Always construct path from base directory to prevent path traversal
    const sanitized = path.basename(filename);
    return path.join(UPLOADS_DIR, sanitized);
  }

  pdfExists(filename: string): boolean {
    // Construct safe path and check existence
    const filepath = this.getPdfPath(filename);
    return fs.existsSync(filepath);
  }

  async generateBatchReportsPdf(reports: ReportPdfData[]): Promise<{ filename: string; filepath: string }> {
    const today = new Date().toISOString().split('T')[0];
    const filename = `batch_reports_${today}_${Date.now()}.pdf`;
    const filepath = path.join(UPLOADS_DIR, filename);

    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        const writeStream = fs.createWriteStream(filepath);

        doc.pipe(writeStream);

        // Register Japanese font
        this.registerFont(doc);

        // Cover page
        doc.fontSize(20).font('NotoSansJP').fillColor('#000000');
        doc.text('電子債権問い合わせ対応報告書', { align: 'center' });
        doc.fontSize(16).text('まとめ印刷', { align: 'center' });
        doc.moveDown(2);
        
        const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
        const boxY = doc.y;
        const boxHeight = 80;
        
        // Draw info box
        doc.rect(doc.page.margins.left, boxY, pageWidth, boxHeight).stroke();
        doc.fontSize(12).font('NotoSansJP');
        doc.text(`印刷日時: ${new Date().toLocaleString('ja-JP')}`, doc.page.margins.left + 20, boxY + 20);
        doc.text(`報告書数: ${reports.length}件`, doc.page.margins.left + 20, boxY + 45);
        
        doc.addPage();

        // Each report on a new page
        reports.forEach((data, index) => {
          if (index > 0) {
            doc.addPage();
          }

          // Title
          doc.fontSize(18).font('NotoSansJP').fillColor('#000000');
          doc.text('電子債権問い合わせ対応報告書', { align: 'center' });
          doc.moveDown(2);

          let y = doc.y;

          // Report details section
          y = this.drawSectionHeader(doc, '報告書情報', y);
          y = this.drawLabelValueRow(doc, '報告書番号', data.reportNumber, y);
          y = this.drawLabelValueRow(doc, '作成日時', this.formatDate(data.createdAt), y);
          if (data.approvedAt) {
            y = this.drawLabelValueRow(doc, '承認日時', this.formatDate(data.approvedAt), y);
          }
          y += 20;

          // Customer information
          y = this.drawSectionHeader(doc, '顧客情報', y);
          y = this.drawLabelValueRow(doc, '利用者番号', data.userNumber, y);
          y = this.drawLabelValueRow(doc, '金融機関コード', data.bankCode, y);
          y = this.drawLabelValueRow(doc, '支店コード', data.branchCode, y);
          y = this.drawLabelValueRow(doc, '会社名', data.companyName, y);
          y = this.drawLabelValueRow(doc, '担当者名', data.contactPersonName, y);
          y += 20;

          // Handler information
          y = this.drawSectionHeader(doc, '対応者情報', y);
          y = this.drawLabelValueRow(doc, '対応者', data.handlerName, y);
          y = this.drawLabelValueRow(doc, '承認者', data.approverName, y);
          y += 20;

          // Inquiry content
          y = this.drawTextBox(doc, '問い合わせ内容', data.inquiryContent, y);
          y += 20;

          // Response content
          y = this.drawTextBox(doc, '対応内容', data.responseContent, y);
          y += 20;

          // Escalation information
          if (data.escalationRequired) {
            y = this.drawSectionHeader(doc, 'エスカレーション情報', y);
            y = this.drawLabelValueRow(doc, 'エスカレーション', '必要', y);
            if (data.escalationReason) {
              y = this.drawLabelValueRow(doc, '理由', data.escalationReason, y);
            }
          }
        });

        doc.end();

        writeStream.on('finish', () => {
          resolve({ filename, filepath });
        });

        writeStream.on('error', (error) => {
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }
}

export const pdfService = new PdfService();
