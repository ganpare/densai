import fs from 'fs';
import path from 'path';
import { ReportWithDetails } from '@shared/schema';

export class PDFService {
  private pdfStoragePath: string;

  constructor() {
    this.pdfStoragePath = path.join(process.cwd(), 'server', 'pdf-storage');
    this.ensureStorageDirectory();
  }

  private ensureStorageDirectory(): void {
    if (!fs.existsSync(this.pdfStoragePath)) {
      fs.mkdirSync(this.pdfStoragePath, { recursive: true });
    }
  }

  /**
   * Generate PDF filename based on report data
   * Format: {bankCode}_{branchCode}_{YYYYMMDD}_{sequence}.pdf
   */
  public generatePDFFilename(report: ReportWithDetails): string {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    
    // Generate sequence number for the day
    const sequence = this.getSequenceNumber(report.bankCode, report.branchCode, dateStr);
    
    return `${report.bankCode}_${report.branchCode}_${dateStr}_${sequence.toString().padStart(3, '0')}.pdf`;
  }

  /**
   * Get next sequence number for the day
   */
  private getSequenceNumber(bankCode: string, branchCode: string, dateStr: string): number {
    const pattern = `${bankCode}_${branchCode}_${dateStr}_`;
    const files = fs.readdirSync(this.pdfStoragePath);
    const matchingFiles = files.filter(file => file.startsWith(pattern));
    
    if (matchingFiles.length === 0) {
      return 1;
    }

    // Extract sequence numbers and find the maximum
    const sequences = matchingFiles
      .map(file => {
        const match = file.match(/_(\d{3})\.pdf$/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter(seq => seq > 0);

    return Math.max(...sequences) + 1;
  }

  /**
   * Generate PDF content as HTML template
   */
  public generatePDFHTML(report: ReportWithDetails): string {
    const formatDate = (timestamp: number | string | undefined): string => {
      if (!timestamp) return '';
      const date = new Date(typeof timestamp === 'string' ? parseInt(timestamp) * 1000 : timestamp * 1000);
      return date.toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    };

    const approverName = report.approver?.firstName && report.approver?.lastName 
      ? `${report.approver.firstName} ${report.approver.lastName}` 
      : '未設定';

    return `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>電子債権問い合わせ対応報告書</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'MS Gothic', 'Hiragino Kaku Gothic ProN', monospace;
      font-size: 12px;
      line-height: 1.6;
      color: #333;
      padding: 20mm;
    }
    .header { 
      text-align: center;
      margin-bottom: 20px;
      border-bottom: 2px solid #333;
      padding-bottom: 10px;
    }
    .title { 
      font-size: 18px;
      font-weight: bold;
      margin-bottom: 10px;
    }
    .report-info { 
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 20px;
    }
    .info-group { 
      border: 1px solid #ccc;
      padding: 10px;
    }
    .info-group h3 { 
      background-color: #f5f5f5;
      padding: 5px;
      margin: -10px -10px 10px -10px;
      font-size: 14px;
    }
    .field { 
      margin-bottom: 8px;
    }
    .field-label { 
      font-weight: bold;
      display: inline-block;
      width: 100px;
    }
    .content-section { 
      margin-bottom: 20px;
      border: 1px solid #ccc;
    }
    .content-header { 
      background-color: #f5f5f5;
      padding: 8px;
      font-weight: bold;
      border-bottom: 1px solid #ccc;
    }
    .content-body { 
      padding: 10px;
      min-height: 80px;
      white-space: pre-wrap;
    }
    .escalation { 
      background-color: #fff3cd;
      border-color: #ffeaa7;
    }
    .rejection { 
      background-color: #f8d7da;
      border-color: #f5c6cb;
    }
    .approval-info { 
      margin-top: 30px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }
    .signature-box { 
      border: 1px solid #333;
      height: 60px;
      text-align: center;
      line-height: 60px;
    }
    .footer { 
      margin-top: 30px;
      text-align: right;
      font-size: 10px;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">電子債権問い合わせ対応報告書</div>
    <div>Report No: ${report.reportNumber}</div>
  </div>

  <div class="report-info">
    <div class="info-group">
      <h3>基本情報</h3>
      <div class="field">
        <span class="field-label">利用者番号:</span>
        ${report.userNumber}
      </div>
      <div class="field">
        <span class="field-label">金庫コード:</span>
        ${report.bankCode}
      </div>
      <div class="field">
        <span class="field-label">支店コード:</span>
        ${report.branchCode}
      </div>
      <div class="field">
        <span class="field-label">企業名:</span>
        ${report.companyName}
      </div>
      <div class="field">
        <span class="field-label">連絡者:</span>
        ${report.contactPersonName}
      </div>
    </div>

    <div class="info-group">
      <h3>処理情報</h3>
      <div class="field">
        <span class="field-label">対応者:</span>
        ${report.handler.firstName} ${report.handler.lastName}
      </div>
      <div class="field">
        <span class="field-label">承認者:</span>
        ${approverName}
      </div>
      <div class="field">
        <span class="field-label">作成日時:</span>
        ${formatDate(report.createdAt)}
      </div>
      <div class="field">
        <span class="field-label">承認日時:</span>
        ${formatDate(report.approvedAt)}
      </div>
      <div class="field">
        <span class="field-label">エスカレーション:</span>
        ${report.escalationRequired ? '必要' : '不要'}
      </div>
    </div>
  </div>

  <div class="content-section">
    <div class="content-header">問い合わせ内容</div>
    <div class="content-body">${report.inquiryContent}</div>
  </div>

  <div class="content-section">
    <div class="content-header">対応内容</div>
    <div class="content-body">${report.responseContent}</div>
  </div>

  ${report.escalationRequired && report.escalationReason ? `
  <div class="content-section escalation">
    <div class="content-header">エスカレーション理由</div>
    <div class="content-body">${report.escalationReason}</div>
  </div>
  ` : ''}

  ${report.status === 'rejected' && report.rejectionReason ? `
  <div class="content-section rejection">
    <div class="content-header">差し戻し理由</div>
    <div class="content-body">${report.rejectionReason}</div>
  </div>
  ` : ''}

  <div class="approval-info">
    <div>
      <div style="margin-bottom: 10px;">対応者署名</div>
      <div class="signature-box">
        ${report.handler.firstName} ${report.handler.lastName}
      </div>
    </div>
    <div>
      <div style="margin-bottom: 10px;">承認者署名</div>
      <div class="signature-box">
        ${approverName}
      </div>
    </div>
  </div>

  <div class="footer">
    印刷日時: ${new Date().toLocaleString('ja-JP')}<br>
    システム: 電債報告書システム v1.0
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * Save PDF content to file system
   */
  public async savePDF(report: ReportWithDetails, pdfContent: Buffer): Promise<string> {
    const filename = this.generatePDFFilename(report);
    const filepath = path.join(this.pdfStoragePath, filename);
    
    fs.writeFileSync(filepath, pdfContent);
    
    return filename;
  }

  /**
   * Get PDF file path
   */
  public getPDFPath(filename: string): string {
    return path.join(this.pdfStoragePath, filename);
  }

  /**
   * List all PDF files
   */
  public listPDFs(): string[] {
    try {
      return fs.readdirSync(this.pdfStoragePath)
        .filter(file => file.endsWith('.pdf'))
        .sort()
        .reverse(); // Most recent first
    } catch (error) {
      return [];
    }
  }

  /**
   * Delete PDF file
   */
  public deletePDF(filename: string): boolean {
    try {
      const filepath = path.join(this.pdfStoragePath, filename);
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate bulk PDF filename for same bank reports
   * Format: {bankCode}_BULK_{YYYYMMDD}_{sequence}.pdf
   */
  public generateBulkPDFFilename(bankCode: string): string {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    
    // Generate sequence number for bulk files of the day
    const sequence = this.getBulkSequenceNumber(bankCode, dateStr);
    
    return `${bankCode}_BULK_${dateStr}_${sequence.toString().padStart(3, '0')}.pdf`;
  }

  /**
   * Get next sequence number for bulk files of the day
   */
  private getBulkSequenceNumber(bankCode: string, dateStr: string): number {
    const pattern = `${bankCode}_BULK_${dateStr}_`;
    const files = fs.readdirSync(this.pdfStoragePath);
    const matchingFiles = files.filter(file => file.startsWith(pattern));
    
    if (matchingFiles.length === 0) {
      return 1;
    }

    // Extract sequence numbers and find the maximum
    const sequences = matchingFiles
      .map(file => {
        const match = file.match(/_(\d{3})\.pdf$/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter(seq => seq > 0);

    return Math.max(...sequences) + 1;
  }

  /**
   * Generate bulk PDF HTML content for multiple reports from same bank
   */
  public generateBulkPDFHTML(reports: ReportWithDetails[], bankCode: string): string {
    const formatDate = (timestamp: number | string | undefined): string => {
      if (!timestamp) return '';
      const date = new Date(typeof timestamp === 'string' ? parseInt(timestamp) * 1000 : timestamp * 1000);
      return date.toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    };

    const today = new Date().toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });

    return `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>電子債権問い合わせ対応報告書 - 一括印刷</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'MS Gothic', 'Hiragino Kaku Gothic ProN', monospace;
      font-size: 12px;
      line-height: 1.4;
      color: #333;
      padding: 15mm;
    }
    .cover-page {
      text-align: center;
      margin-bottom: 30px;
      border-bottom: 3px solid #333;
      padding-bottom: 20px;
    }
    .cover-title { 
      font-size: 20px;
      font-weight: bold;
      margin-bottom: 10px;
    }
    .cover-subtitle {
      font-size: 16px;
      margin-bottom: 20px;
    }
    .cover-info { 
      font-size: 14px;
      margin-bottom: 10px;
    }
    .summary-table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    .summary-table th, .summary-table td {
      border: 1px solid #333;
      padding: 8px;
      text-align: left;
    }
    .summary-table th {
      background-color: #f5f5f5;
      font-weight: bold;
    }
    .page-break { 
      page-break-before: always; 
    }
    .report-header { 
      text-align: center;
      margin-bottom: 20px;
      border-bottom: 2px solid #333;
      padding-bottom: 10px;
    }
    .report-title { 
      font-size: 16px;
      font-weight: bold;
      margin-bottom: 5px;
    }
    .report-info { 
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 20px;
    }
    .info-group { 
      border: 1px solid #ccc;
      padding: 10px;
    }
    .info-group h3 { 
      background-color: #f5f5f5;
      padding: 5px;
      margin: -10px -10px 10px -10px;
      font-size: 14px;
    }
    .field { 
      margin-bottom: 6px;
    }
    .field-label { 
      font-weight: bold;
      display: inline-block;
      width: 90px;
    }
    .content-section { 
      margin-bottom: 15px;
      border: 1px solid #ccc;
    }
    .content-header { 
      background-color: #f5f5f5;
      padding: 6px;
      font-weight: bold;
      border-bottom: 1px solid #ccc;
    }
    .content-body { 
      padding: 8px;
      min-height: 60px;
      white-space: pre-wrap;
      font-size: 11px;
    }
    .escalation { 
      background-color: #fff3cd;
      border-color: #ffeaa7;
    }
    .approval-info { 
      margin-top: 20px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
    }
    .signature-box { 
      border: 1px solid #333;
      height: 40px;
      text-align: center;
      line-height: 40px;
      font-size: 11px;
    }
    .report-footer { 
      margin-top: 20px;
      text-align: right;
      font-size: 10px;
      color: #666;
      border-top: 1px solid #ccc;
      padding-top: 10px;
    }
  </style>
</head>
<body>
  <!-- Cover Page -->
  <div class="cover-page">
    <div class="cover-title">電子債権問い合わせ対応報告書</div>
    <div class="cover-subtitle">一括印刷 - 金融機関別まとめ</div>
    <div class="cover-info">金融機関コード: ${bankCode}</div>
    <div class="cover-info">対象日: ${today}</div>
    <div class="cover-info">報告書件数: ${reports.length}件</div>
  </div>

  <!-- Summary Table -->
  <table class="summary-table">
    <thead>
      <tr>
        <th>No.</th>
        <th>報告書番号</th>
        <th>支店コード</th>
        <th>企業名</th>
        <th>対応者</th>
        <th>承認者</th>
        <th>承認日時</th>
      </tr>
    </thead>
    <tbody>
      ${reports.map((report, index) => {
        const approverName = report.approver?.firstName && report.approver?.lastName 
          ? `${report.approver.firstName} ${report.approver.lastName}` 
          : '未設定';
        
        return `
        <tr>
          <td>${index + 1}</td>
          <td>${report.reportNumber}</td>
          <td>${report.branchCode}</td>
          <td>${report.companyName}</td>
          <td>${report.handler.firstName} ${report.handler.lastName}</td>
          <td>${approverName}</td>
          <td>${formatDate(report.approvedAt)}</td>
        </tr>
        `;
      }).join('')}
    </tbody>
  </table>

  ${reports.map((report, index) => {
    const approverName = report.approver?.firstName && report.approver?.lastName 
      ? `${report.approver.firstName} ${report.approver.lastName}` 
      : '未設定';

    return `
    <!-- Report ${index + 1} -->
    <div class="${index > 0 ? 'page-break' : ''}">
      <div class="report-header">
        <div class="report-title">電子債権問い合わせ対応報告書 (${index + 1}/${reports.length})</div>
        <div>Report No: ${report.reportNumber}</div>
      </div>

      <div class="report-info">
        <div class="info-group">
          <h3>基本情報</h3>
          <div class="field">
            <span class="field-label">利用者番号:</span>
            ${report.userNumber}
          </div>
          <div class="field">
            <span class="field-label">金庫コード:</span>
            ${report.bankCode}
          </div>
          <div class="field">
            <span class="field-label">支店コード:</span>
            ${report.branchCode}
          </div>
          <div class="field">
            <span class="field-label">企業名:</span>
            ${report.companyName}
          </div>
          <div class="field">
            <span class="field-label">連絡者:</span>
            ${report.contactPersonName}
          </div>
        </div>

        <div class="info-group">
          <h3>処理情報</h3>
          <div class="field">
            <span class="field-label">対応者:</span>
            ${report.handler.firstName} ${report.handler.lastName}
          </div>
          <div class="field">
            <span class="field-label">承認者:</span>
            ${approverName}
          </div>
          <div class="field">
            <span class="field-label">作成日時:</span>
            ${formatDate(report.createdAt)}
          </div>
          <div class="field">
            <span class="field-label">承認日時:</span>
            ${formatDate(report.approvedAt)}
          </div>
          <div class="field">
            <span class="field-label">エスカレーション:</span>
            ${report.escalationRequired ? '必要' : '不要'}
          </div>
        </div>
      </div>

      <div class="content-section">
        <div class="content-header">問い合わせ内容</div>
        <div class="content-body">${report.inquiryContent}</div>
      </div>

      <div class="content-section">
        <div class="content-header">対応内容</div>
        <div class="content-body">${report.responseContent}</div>
      </div>

      ${report.escalationRequired && report.escalationReason ? `
      <div class="content-section escalation">
        <div class="content-header">エスカレーション理由</div>
        <div class="content-body">${report.escalationReason}</div>
      </div>
      ` : ''}

      <div class="approval-info">
        <div>
          <div style="margin-bottom: 8px;">対応者署名</div>
          <div class="signature-box">
            ${report.handler.firstName} ${report.handler.lastName}
          </div>
        </div>
        <div>
          <div style="margin-bottom: 8px;">承認者署名</div>
          <div class="signature-box">
            ${approverName}
          </div>
        </div>
      </div>

      <div class="report-footer">
        印刷日時: ${new Date().toLocaleString('ja-JP')}<br>
        システム: 電債報告書システム v1.0 - 一括印刷<br>
        ページ: ${index + 1} / ${reports.length}
      </div>
    </div>
    `;
  }).join('')}
</body>
</html>
    `.trim();
  }
}

export const pdfService = new PDFService();