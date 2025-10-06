import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const UPLOADS_DIR = 'uploads/pdfs';

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
    const base = filename.replace(/[^a-zA-Z0-9 ._\-()]/g, '');
    const noLeadingDot = base.replace(/^\.+/, '');
    const singleDots = noLeadingDot.replace(/\.+/g, '.');
    const trimmed = singleDots.trim();
    return trimmed.slice(0, 120) || 'file';
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
      .replace(/\n/g, '<br>');
  }

  private generateReportHtml(data: ReportPdfData): string {
    return `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700&display=swap');
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Noto Sans JP', sans-serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #000;
      padding: 40px;
    }
    
    .title {
      text-align: center;
      font-size: 20pt;
      font-weight: bold;
      margin-bottom: 30px;
      padding-bottom: 10px;
      border-bottom: 2px solid #000;
    }
    
    .section {
      margin-bottom: 20px;
    }
    
    .section-header {
      background-color: #f0f0f0;
      padding: 8px 10px;
      font-weight: bold;
      font-size: 12pt;
      border: 1px solid #000;
      margin-bottom: 0;
    }
    
    .info-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    
    .info-table td {
      border: 1px solid #000;
      padding: 6px 10px;
      vertical-align: top;
    }
    
    .info-table td.label {
      background-color: #f9f9f9;
      width: 30%;
      font-weight: bold;
    }
    
    .info-table td.value {
      width: 70%;
    }
    
    .text-box {
      border: 1px solid #000;
      padding: 10px;
      min-height: 80px;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
    
    @media print {
      body {
        padding: 20px;
      }
      
      @page {
        margin: 20mm;
        size: A4;
      }
    }
  </style>
</head>
<body>
  <div class="title">電子債権問い合わせ対応報告書</div>
  
  <div class="section">
    <div class="section-header">報告書情報</div>
    <table class="info-table">
      <tr>
        <td class="label">報告書番号</td>
        <td class="value">${this.escapeHtml(data.reportNumber)}</td>
      </tr>
      <tr>
        <td class="label">作成日時</td>
        <td class="value">${this.escapeHtml(this.formatDate(data.createdAt))}</td>
      </tr>
      ${data.approvedAt ? `
      <tr>
        <td class="label">承認日時</td>
        <td class="value">${this.escapeHtml(this.formatDate(data.approvedAt))}</td>
      </tr>
      ` : ''}
    </table>
  </div>
  
  <div class="section">
    <div class="section-header">顧客情報</div>
    <table class="info-table">
      <tr>
        <td class="label">利用者番号</td>
        <td class="value">${this.escapeHtml(data.userNumber)}</td>
      </tr>
      <tr>
        <td class="label">金融機関コード</td>
        <td class="value">${this.escapeHtml(data.bankCode)}</td>
      </tr>
      <tr>
        <td class="label">支店コード</td>
        <td class="value">${this.escapeHtml(data.branchCode)}</td>
      </tr>
      <tr>
        <td class="label">会社名</td>
        <td class="value">${this.escapeHtml(data.companyName)}</td>
      </tr>
      <tr>
        <td class="label">担当者名</td>
        <td class="value">${this.escapeHtml(data.contactPersonName)}</td>
      </tr>
    </table>
  </div>
  
  <div class="section">
    <div class="section-header">対応者情報</div>
    <table class="info-table">
      <tr>
        <td class="label">対応者</td>
        <td class="value">${this.escapeHtml(data.handlerName)}</td>
      </tr>
      <tr>
        <td class="label">承認者</td>
        <td class="value">${this.escapeHtml(data.approverName)}</td>
      </tr>
    </table>
  </div>
  
  <div class="section">
    <div class="section-header">問い合わせ内容</div>
    <div class="text-box">${this.escapeHtml(data.inquiryContent)}</div>
  </div>
  
  <div class="section">
    <div class="section-header">対応内容</div>
    <div class="text-box">${this.escapeHtml(data.responseContent)}</div>
  </div>
  
  ${data.escalationRequired ? `
  <div class="section">
    <div class="section-header">エスカレーション情報</div>
    <table class="info-table">
      <tr>
        <td class="label">エスカレーション</td>
        <td class="value">必要</td>
      </tr>
      ${data.escalationReason ? `
      <tr>
        <td class="label">理由</td>
        <td class="value">${this.escapeHtml(data.escalationReason)}</td>
      </tr>
      ` : ''}
    </table>
  </div>
  ` : ''}
</body>
</html>
    `;
  }

  private generateBatchReportsHtml(reports: ReportPdfData[]): string {
    const now = new Date();
    const printDate = now.toLocaleString('ja-JP');
    
    const reportPages = reports.map(data => `
      <div class="page">
        <div class="title">電子債権問い合わせ対応報告書</div>
        
        <div class="section">
          <div class="section-header">報告書情報</div>
          <table class="info-table">
            <tr>
              <td class="label">報告書番号</td>
              <td class="value">${this.escapeHtml(data.reportNumber)}</td>
            </tr>
            <tr>
              <td class="label">作成日時</td>
              <td class="value">${this.escapeHtml(this.formatDate(data.createdAt))}</td>
            </tr>
            ${data.approvedAt ? `
            <tr>
              <td class="label">承認日時</td>
              <td class="value">${this.escapeHtml(this.formatDate(data.approvedAt))}</td>
            </tr>
            ` : ''}
          </table>
        </div>
        
        <div class="section">
          <div class="section-header">顧客情報</div>
          <table class="info-table">
            <tr>
              <td class="label">利用者番号</td>
              <td class="value">${this.escapeHtml(data.userNumber)}</td>
            </tr>
            <tr>
              <td class="label">金融機関コード</td>
              <td class="value">${this.escapeHtml(data.bankCode)}</td>
            </tr>
            <tr>
              <td class="label">支店コード</td>
              <td class="value">${this.escapeHtml(data.branchCode)}</td>
            </tr>
            <tr>
              <td class="label">会社名</td>
              <td class="value">${this.escapeHtml(data.companyName)}</td>
            </tr>
            <tr>
              <td class="label">担当者名</td>
              <td class="value">${this.escapeHtml(data.contactPersonName)}</td>
            </tr>
          </table>
        </div>
        
        <div class="section">
          <div class="section-header">対応者情報</div>
          <table class="info-table">
            <tr>
              <td class="label">対応者</td>
              <td class="value">${this.escapeHtml(data.handlerName)}</td>
            </tr>
            <tr>
              <td class="label">承認者</td>
              <td class="value">${this.escapeHtml(data.approverName)}</td>
            </tr>
          </table>
        </div>
        
        <div class="section">
          <div class="section-header">問い合わせ内容</div>
          <div class="text-box">${this.escapeHtml(data.inquiryContent)}</div>
        </div>
        
        <div class="section">
          <div class="section-header">対応内容</div>
          <div class="text-box">${this.escapeHtml(data.responseContent)}</div>
        </div>
        
        ${data.escalationRequired ? `
        <div class="section">
          <div class="section-header">エスカレーション情報</div>
          <table class="info-table">
            <tr>
              <td class="label">エスカレーション</td>
              <td class="value">必要</td>
            </tr>
            ${data.escalationReason ? `
            <tr>
              <td class="label">理由</td>
              <td class="value">${this.escapeHtml(data.escalationReason)}</td>
            </tr>
            ` : ''}
          </table>
        </div>
        ` : ''}
      </div>
    `).join('');

    return `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700&display=swap');
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Noto Sans JP', sans-serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #000;
    }
    
    .cover-page {
      height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      page-break-after: always;
    }
    
    .cover-title {
      font-size: 24pt;
      font-weight: bold;
      margin-bottom: 10px;
    }
    
    .cover-subtitle {
      font-size: 18pt;
      font-weight: bold;
      margin-bottom: 40px;
    }
    
    .cover-info {
      border: 2px solid #000;
      padding: 30px 50px;
      margin-top: 20px;
    }
    
    .cover-info-row {
      font-size: 14pt;
      margin: 15px 0;
    }
    
    .page {
      padding: 40px;
      page-break-after: always;
    }
    
    .title {
      text-align: center;
      font-size: 20pt;
      font-weight: bold;
      margin-bottom: 30px;
      padding-bottom: 10px;
      border-bottom: 2px solid #000;
    }
    
    .section {
      margin-bottom: 20px;
    }
    
    .section-header {
      background-color: #f0f0f0;
      padding: 8px 10px;
      font-weight: bold;
      font-size: 12pt;
      border: 1px solid #000;
      margin-bottom: 0;
    }
    
    .info-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    
    .info-table td {
      border: 1px solid #000;
      padding: 6px 10px;
      vertical-align: top;
    }
    
    .info-table td.label {
      background-color: #f9f9f9;
      width: 30%;
      font-weight: bold;
    }
    
    .info-table td.value {
      width: 70%;
    }
    
    .text-box {
      border: 1px solid #000;
      padding: 10px;
      min-height: 80px;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
    
    @media print {
      @page {
        margin: 20mm;
        size: A4;
      }
    }
  </style>
</head>
<body>
  <div class="cover-page">
    <div class="cover-title">電子債権問い合わせ対応報告書</div>
    <div class="cover-subtitle">まとめ印刷</div>
    <div class="cover-info">
      <div class="cover-info-row">印刷日時: ${this.escapeHtml(printDate)}</div>
      <div class="cover-info-row">報告書数: ${reports.length}件</div>
    </div>
  </div>
  
  ${reportPages}
</body>
</html>
    `;
  }

  async generateReportPdf(data: ReportPdfData): Promise<{ filename: string; filepath: string }> {
    const sanitizedReportNumber = this.sanitizeFilename(data.reportNumber);
    const filename = `report_${sanitizedReportNumber}_${Date.now()}.pdf`;
    const filepath = path.join(UPLOADS_DIR, filename);

    const html = this.generateReportHtml(data);
    
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      
      await page.pdf({
        path: filepath,
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '20mm',
          bottom: '20mm',
          left: '20mm'
        }
      });
      
      return { filename, filepath };
    } finally {
      await browser.close();
    }
  }

  async generateBatchReportsPdf(reports: ReportPdfData[]): Promise<{ filename: string; filepath: string }> {
    const today = new Date().toISOString().split('T')[0];
    const filename = `batch_reports_${today}_${Date.now()}.pdf`;
    const filepath = path.join(UPLOADS_DIR, filename);

    const html = this.generateBatchReportsHtml(reports);
    
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      
      await page.pdf({
        path: filepath,
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '20mm',
          bottom: '20mm',
          left: '20mm'
        }
      });
      
      return { filename, filepath };
    } finally {
      await browser.close();
    }
  }

  getPdfPath(filename: string): string {
    const sanitized = path.basename(filename);
    return path.join(UPLOADS_DIR, sanitized);
  }

  pdfExists(filename: string): boolean {
    const filepath = this.getPdfPath(filename);
    return fs.existsSync(filepath);
  }
}

export const pdfService = new PdfService();
