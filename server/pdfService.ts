import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

const UPLOADS_DIR = 'uploads/pdfs';

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

  private sanitizeFilename(filename: string): string {
    // Remove any path traversal attempts and special characters
    return filename.replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  async generateReportPdf(data: ReportPdfData): Promise<string> {
    // Sanitize report number to prevent path traversal
    const sanitizedReportNumber = this.sanitizeFilename(data.reportNumber);
    const filename = `report_${sanitizedReportNumber}_${Date.now()}.pdf`;
    const filepath = path.join(UPLOADS_DIR, filename);

    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        const writeStream = fs.createWriteStream(filepath);

        doc.pipe(writeStream);

        // Register font for Japanese text (using built-in font as fallback)
        // In production, you would want to use a Japanese-compatible font
        doc.fontSize(20).text('電子債権問い合わせ対応報告書', { align: 'center' });
        doc.moveDown();

        // Report details
        doc.fontSize(12);
        doc.text(`報告書番号: ${data.reportNumber}`);
        doc.text(`作成日時: ${this.formatDate(data.createdAt)}`);
        if (data.approvedAt) {
          doc.text(`承認日時: ${this.formatDate(data.approvedAt)}`);
        }
        doc.moveDown();

        // Customer information
        doc.fontSize(14).text('顧客情報', { underline: true });
        doc.fontSize(12);
        doc.text(`利用者番号: ${data.userNumber}`);
        doc.text(`金融機関コード: ${data.bankCode}`);
        doc.text(`支店コード: ${data.branchCode}`);
        doc.text(`会社名: ${data.companyName}`);
        doc.text(`担当者名: ${data.contactPersonName}`);
        doc.moveDown();

        // Handler information
        doc.fontSize(14).text('対応者情報', { underline: true });
        doc.fontSize(12);
        doc.text(`対応者: ${data.handlerName}`);
        doc.text(`承認者: ${data.approverName}`);
        doc.moveDown();

        // Inquiry content
        doc.fontSize(14).text('問い合わせ内容', { underline: true });
        doc.fontSize(12);
        doc.text(data.inquiryContent, { align: 'left' });
        doc.moveDown();

        // Response content
        doc.fontSize(14).text('対応内容', { underline: true });
        doc.fontSize(12);
        doc.text(data.responseContent, { align: 'left' });
        doc.moveDown();

        // Escalation information
        if (data.escalationRequired) {
          doc.fontSize(14).text('エスカレーション情報', { underline: true });
          doc.fontSize(12);
          doc.text(`エスカレーション: 必要`);
          if (data.escalationReason) {
            doc.text(`理由: ${data.escalationReason}`);
          }
        }

        doc.end();

        writeStream.on('finish', () => {
          resolve(filepath);
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
    return path.join(UPLOADS_DIR, filename);
  }

  pdfExists(filepath: string): boolean {
    return fs.existsSync(filepath);
  }
}

export const pdfService = new PdfService();
