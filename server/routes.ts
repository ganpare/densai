import express from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { pdfService } from "./pdfService";
import {
  insertReportSchema,
  updateReportStatusSchema,
  insertFinancialInstitutionSchema,
  insertBranchSchema
} from "@shared/schema";
import { z } from "zod";
import { randomUUID } from "crypto";
import path from "path";
import fs from "fs";
import { htmlToPdfFile } from "./pdfUtils";
import { fileURLToPath } from "url";
import { dirname } from "path";

// ESモジュールで __dirname の代替
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 複数レポート用HTML生成関数
function generateMultiReportHtml(template: string, reports: any[], bankCode: string): string {
  const formatDate = (timestamp: number): string => {
    if (!timestamp) return '';
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  let htmlBlocks = '';
  reports.forEach((report, index) => {
    if (index > 0) {
      htmlBlocks += '<div style="page-break-before: always;"></div>';
    }
    
    // テンプレート変数を置換
    let reportHtml = template
      .replace(/{{reportNumber}}/g, report.reportNumber || '')
      .replace(/{{userNumber}}/g, report.userNumber || '')
      .replace(/{{bankCode}}/g, report.bankCode || '')
      .replace(/{{branchCode}}/g, report.branchCode || '')
      .replace(/{{companyName}}/g, report.companyName || '')
      .replace(/{{contactPersonName}}/g, report.contactPersonName || '')
      .replace(/{{handlerName}}/g, `${report.handler?.lastName || ''} ${report.handler?.firstName || ''}`.trim())
      .replace(/{{approverName}}/g, `${report.approver?.lastName || ''} ${report.approver?.firstName || ''}`.trim())
      .replace(/{{inquiryContent}}/g, report.inquiryContent || '')
      .replace(/{{responseContent}}/g, report.responseContent || '')
      .replace(/{{escalationRequired}}/g, report.escalationRequired ? '必要' : '不要')
      .replace(/{{escalationReason}}/g, report.escalationReason || '')
      .replace(/{{createdAt}}/g, formatDate(report.createdAt))
      .replace(/{{approvedAt}}/g, formatDate(report.approvedAt))
      .replace(/{{status}}/g, report.status || '')
      .replace(/{{id}}/g, report.id || '');
    
    htmlBlocks += reportHtml;
  });

  return htmlBlocks;
}

export async function registerRoutes(app: express.Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // User management routes
  app.get('/api/users', isAuthenticated, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.post('/api/users', isAuthenticated, async (req, res) => {
    try {
      const userData = {
        ...req.body,
        id: randomUUID(),
        createdAt: Math.floor(Date.now() / 1000),
        updatedAt: Math.floor(Date.now() / 1000),
      };
      const user = await storage.createUser(userData);
      res.status(201).json(user);
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  app.put('/api/users/:id', isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const userData = {
        ...req.body,
        updatedAt: Math.floor(Date.now() / 1000),
      };
      const user = await storage.updateUser(id, userData);
      res.json(user);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  app.delete('/api/users/:id', isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteUser(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Financial institution routes
  app.get('/api/financial-institutions', isAuthenticated, async (req, res) => {
    try {
      const institutions = await storage.getFinancialInstitutions();
      res.json(institutions);
    } catch (error) {
      console.error("Error fetching financial institutions:", error);
      res.status(500).json({ message: "Failed to fetch financial institutions" });
    }
  });

  app.post('/api/financial-institutions', isAuthenticated, async (req, res) => {
    try {
      const validatedData = insertFinancialInstitutionSchema.parse(req.body);
      const institution = await storage.createFinancialInstitution(validatedData);
      res.status(201).json(institution);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        console.error("Error creating financial institution:", error);
        res.status(500).json({ message: "Failed to create financial institution" });
      }
    }
  });

  app.get('/api/financial-institutions/:institutionId/branches', isAuthenticated, async (req, res) => {
    try {
      const { institutionId } = req.params;
      const branches = await storage.getBranches(institutionId);
      res.json(branches);
    } catch (error) {
      console.error("Error fetching branches:", error);
      res.status(500).json({ message: "Failed to fetch branches" });
    }
  });

  app.post('/api/branches', isAuthenticated, async (req, res) => {
    try {
      const validatedData = insertBranchSchema.parse(req.body);
      const branch = await storage.createBranch(validatedData);
      res.status(201).json(branch);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        console.error("Error creating branch:", error);
        res.status(500).json({ message: "Failed to create branch" });
      }
    }
  });

  // Report routes
  app.post('/api/reports', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validatedData = insertReportSchema.parse(req.body);
      
      // Create report as draft first
      const report = await storage.createReport({ 
        ...validatedData, 
        handlerId: userId
      });
      
      // If this is a direct submission (not just draft save), change status to pending_approval
      if (req.body._submitForApproval) {
        const updatedReport = await storage.updateReportStatus(report.id, {
          status: 'pending_approval'
        });
        res.status(201).json(updatedReport);
      } else {
        res.status(201).json(report);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        console.error("Error creating report:", error);
        res.status(500).json({ message: "Failed to create report" });
      }
    }
  });

  app.get('/api/reports', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      let reports;
      const { status, search, limit, offset } = req.query;

      if (search) {
        reports = await storage.searchReports(search as string);
      } else if (user.role === 'approver') {
        // 承認者は自分が承認した報告書を表示
        reports = await storage.getApprovedReportsByApprover(userId);
      } else {
        reports = await storage.getReportsByUser(userId, status as string);
      }

      res.json(reports);
    } catch (error) {
      console.error("Error fetching reports:", error);
      res.status(500).json({ message: "Failed to fetch reports" });
    }
  });

  // Get today's approved reports (must be BEFORE /api/reports/:id to avoid param capture)
  app.get('/api/reports/today-approved', isAuthenticated, async (req: any, res) => {
    try {
      const approved = await storage.getTodayApprovedReports();

      // Group by bankCode for UI display
      const reportsByBank: Record<string, any[]> = {};
      for (const r of approved) {
        const bank = r.bankCode;
        if (!reportsByBank[bank]) reportsByBank[bank] = [];
        reportsByBank[bank].push({
          id: r.id,
          reportNumber: r.reportNumber,
          companyName: r.companyName,
          bankCode: r.bankCode,
          branchCode: r.branchCode,
          approvedAt: r.approvedAt,
        });
      }

      return res.json({
        success: true,
        reportCount: approved.length,
        reportsByBank,
        message: approved.length > 0 ? "OK" : "No approved reports for today",
      });
    } catch (error) {
      console.error("Error fetching today's approved reports:", error);
      res.status(500).json({ success: false, reportCount: 0, reportsByBank: {}, message: "Failed to fetch today's approved reports" });
    }
  });

  // Generate bulk PDF for today's approved reports grouped by bank code
  app.post('/api/reports/bulk-pdf/generate', isAuthenticated, async (req: any, res) => {
    try {
      const { template = 'simple' } = req.body; // テンプレート選択パラメータ
      const approved = await storage.getTodayApprovedReports();
      
      if (approved.length === 0) {
        return res.status(200).json({ 
          success: true, 
          message: "No approved reports for today", 
          files: [] 
        });
      }

      // 金融機関番号ごとにグループ化
      const reportsByBank = new Map<string, any[]>();
      for (const report of approved) {
        const bankCode = report.bankCode;
        if (!reportsByBank.has(bankCode)) {
          reportsByBank.set(bankCode, []);
        }
        reportsByBank.get(bankCode)!.push(report);
      }

      const generatedFiles = [];
      const today = new Date();
      const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;

      // 各金融機関ごとにPDF生成
      for (const [bankCode, reports] of reportsByBank) {
        const filename = `${dateStr}_${bankCode}.pdf`;
        const outPath = path.join(__dirname, '..', 'uploads', 'pdfs', filename);

        // テンプレート選択
        const templateFile = `report-pdf-${template}.html`;
        const templatePath = path.join(__dirname, '..', 'server', 'templates', templateFile);
        
        if (!fs.existsSync(templatePath)) {
          console.warn(`Template ${templateFile} not found, using default`);
          const defaultTemplatePath = path.join(__dirname, '..', 'server', 'templates', 'report-pdf-simple.html');
          if (fs.existsSync(defaultTemplatePath)) {
            const template = fs.readFileSync(defaultTemplatePath, 'utf8');
            const html = generateMultiReportHtml(template, reports, bankCode);
            
            console.log(`[PDF Generation] Generating PDF for bank ${bankCode} with ${reports.length} reports...`);
            await htmlToPdfFile(html, outPath);
            console.log(`[PDF Generation] PDF saved to ${outPath}`);
            
            generatedFiles.push({
              filename,
              bankCode,
              reportCount: reports.length
            });
          }
        } else {
          const template = fs.readFileSync(templatePath, 'utf8');
          const html = generateMultiReportHtml(template, reports, bankCode);
          
          console.log(`[PDF Generation] Generating PDF for bank ${bankCode} with ${reports.length} reports...`);
          await htmlToPdfFile(html, outPath);
          console.log(`[PDF Generation] PDF saved to ${outPath}`);
          
          generatedFiles.push({
            filename,
            bankCode,
            reportCount: reports.length
          });
        }
      }

      return res.json({ 
        success: true, 
        message: `Generated ${generatedFiles.length} PDF files for ${approved.length} reports`,
        files: generatedFiles,
        totalReports: approved.length
      });
    } catch (error) {
      console.error("Error generating bulk PDF:", error);
      return res.status(500).json({ message: "Failed to generate bulk PDF" });
    }
  });

  // Get reports pending approval (must be before /api/reports/:id)
  app.get('/api/reports/pending', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Check if user has approval permission
      const user = await storage.getUser(userId);
      if (!user || (user.role !== 'approver' && user.role !== 'admin')) {
        return res.status(403).json({ message: "Not authorized to view pending approvals" });
      }

      const reports = await storage.getReportsForApproval(userId);
      res.json(reports);
    } catch (error) {
      console.error("Error fetching pending reports:", error);
      res.status(500).json({ message: "Failed to fetch pending reports" });
    }
  });

  app.get('/api/reports/:id', isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const report = await storage.getReport(id);
      
      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }
      
      res.json(report);
    } catch (error) {
      console.error("Error fetching report:", error);
      res.status(500).json({ message: "Failed to fetch report" });
    }
  });

  app.patch('/api/reports/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      
      // Check if report exists and belongs to user or user is approver
      const existingReport = await storage.getReport(id);
      if (!existingReport) {
        return res.status(404).json({ message: "Report not found" });
      }

      if (existingReport.handlerId !== userId && existingReport.approverId !== userId) {
        return res.status(403).json({ message: "Not authorized to update this report" });
      }

      const validatedData = insertReportSchema.partial().parse(req.body);
      const updatedReport = await storage.updateReport(id, validatedData);
      res.json(updatedReport);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        console.error("Error updating report:", error);
        res.status(500).json({ message: "Failed to update report" });
      }
    }
  });

  app.patch('/api/reports/:id/status', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      
      // Check if report exists
      const existingReport = await storage.getReport(id);
      if (!existingReport) {
        return res.status(404).json({ message: "Report not found" });
      }

      // Check if user has approval permission
      const user = await storage.getUser(userId);
      if (!user || (user.role !== 'approver' && user.role !== 'admin')) {
        return res.status(403).json({ message: "Not authorized to approve reports" });
      }

      const validatedData = updateReportStatusSchema.parse(req.body);
      // 承認時に承認者IDを渡す
      const updatedReport = await storage.updateReportStatus(id, validatedData, userId);
      res.json(updatedReport);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        console.error("Error updating report status:", error);
        res.status(500).json({ message: "Failed to update report status" });
      }
    }
  });

  // Submit report for approval
  app.patch('/api/reports/:id/submit', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      
      const existingReport = await storage.getReport(id);
      if (!existingReport) {
        return res.status(404).json({ message: "Report not found" });
      }

      if (existingReport.handlerId !== userId) {
        return res.status(403).json({ message: "Not authorized to submit this report" });
      }

      const updatedReport = await storage.updateReportStatus(id, { status: "pending_approval" });
      res.json(updatedReport);
    } catch (error) {
      console.error("Error submitting report:", error);
      res.status(500).json({ message: "Failed to submit report" });
    }
  });

  // Statistics
  app.get('/api/statistics', isAuthenticated, async (req, res) => {
    try {
      const statistics = await storage.getReportStatistics();
      res.json(statistics);
    } catch (error) {
      console.error("Error fetching statistics:", error);
      res.status(500).json({ message: "Failed to fetch statistics" });
    }
  });

  // Users for dropdowns
  app.get('/api/users', isAuthenticated, async (req, res) => {
    try {
      const { role } = req.query;
      const users = role 
        ? await storage.getUsersByRole(role as string)
        : await storage.getUsersByRole('creator');
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // (moved above)

  // PDF Generation route - Generate and save PDF on server
  app.post('/api/reports/:id/pdf/generate', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      const report = await storage.getReport(id);
      
      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }

      // Authorization check: Only handler, approver, or admin can generate PDF
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const isAuthorized = 
        report.handlerId === userId || 
        report.approverId === userId || 
        user.role === 'admin';

      if (!isAuthorized) {
        return res.status(403).json({ message: "Not authorized to generate PDF for this report" });
      }

      if (report.status !== 'approved') {
        return res.status(400).json({ message: "Only approved reports can be printed" });
      }

      // Check if PDF already exists
      if (report.pdfFilePath && pdfService.pdfExists(report.pdfFilePath)) {
        return res.json({ 
          success: true, 
          message: "PDFは既に生成されています", 
          filename: report.pdfFilePath
        });
      }

      // Generate PDF using pdfService
      const pdfData = {
        reportNumber: report.reportNumber,
        userNumber: report.userNumber,
        bankCode: report.bankCode,
        branchCode: report.branchCode,
        companyName: report.companyName,
        contactPersonName: report.contactPersonName,
        handlerName: `${report.handler.lastName} ${report.handler.firstName}`,
        approverName: `${report.approver.lastName} ${report.approver.firstName}`,
        inquiryContent: report.inquiryContent,
        responseContent: report.responseContent,
        escalationRequired: report.escalationRequired,
        escalationReason: report.escalationReason || undefined,
        approvedAt: report.approvedAt || undefined,
        createdAt: report.createdAt || 0
      };

      const { filename, filepath } = await pdfService.generateReportPdf(pdfData);
      
      // Update report with PDF filename only (not full path)
      await storage.updateReport(id, { pdfFilePath: filename });

      res.json({ 
        success: true, 
        message: "PDFの生成が完了しました", 
        filename
      });
    } catch (error) {
      console.error("Error generating PDF:", error);
      res.status(500).json({ message: "Failed to generate PDF" });
    }
  });

  // Batch PDF Generation - Generate PDF for today's approved reports
  app.post('/api/reports/bulk-print-today', isAuthenticated, async (req: any, res) => {
    try {
      const approved = await storage.getTodayApprovedReports();

      if (approved.length === 0) {
        return res.status(200).json({ success: true, message: "No approved reports for today", files: [], totalReports: 0 });
      }

      // Group by bankCode and generate simple HTML content (client creates PDFs)
      const grouped: Record<string, typeof approved> = {};
      for (const r of approved) {
        if (!grouped[r.bankCode]) grouped[r.bankCode] = [];
        grouped[r.bankCode].push(r);
      }

      const today = new Date();
      const y = today.getFullYear();
      const m = String(today.getMonth() + 1).padStart(2, '0');
      const d = String(today.getDate()).padStart(2, '0');
      const dateStr = `${y}${m}${d}`;

      const files = Object.entries(grouped).map(([bankCode, reports]) => {
        const htmlContent = `<!doctype html><html><head><meta charset="utf-8"><title>${bankCode} Reports ${dateStr}</title></head><body>` +
          reports.map((r) => `
            <div style="page-break-after: always;">
              <h2>報告書番号: ${r.reportNumber}</h2>
              <div>企業名: ${r.companyName}</div>
              <div>金融機関: ${r.bankCode} / 支店: ${r.branchCode}</div>
              <div>承認日時: ${r.approvedAt ? new Date(r.approvedAt * 1000).toLocaleString('ja-JP') : ''}</div>
              <hr />
              <pre style="white-space: pre-wrap;">${r.responseContent}</pre>
            </div>
          `).join('') +
          `</body></html>`;

        return {
          bankCode,
          reportCount: reports.length,
          filename: `${bankCode}_BULK_${dateStr}.pdf`,
          htmlContent,
        };
      });

      return res.json({ success: true, message: 'OK', files, totalReports: approved.length });
    } catch (error) {
      console.error("Error generating bulk print payload:", error);
      res.status(500).json({ success: false, message: "Failed to generate bulk print payload", files: [], totalReports: 0 });
    }
  });

  // PDF Download route - Download existing PDF
  app.get('/api/reports/:id/pdf/download', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      const report = await storage.getReport(id);
      
      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }

      // Authorization check: Only handler, approver, or admin can download PDF
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const isAuthorized = 
        report.handlerId === userId || 
        report.approverId === userId || 
        user.role === 'admin';

      if (!isAuthorized) {
        return res.status(403).json({ message: "Not authorized to download PDF for this report" });
      }

      if (!report.pdfFilePath) {
        return res.status(404).json({ message: "PDF not generated yet" });
      }

      // Construct safe file path from filename stored in DB
      const filename = report.pdfFilePath;
      const fullPath = pdfService.getPdfPath(filename);

      if (!pdfService.pdfExists(filename)) {
        return res.status(404).json({ message: "PDF file not found" });
      }

      res.download(fullPath, filename);
    } catch (error) {
      console.error("Error downloading PDF:", error);
      res.status(500).json({ message: "Failed to download PDF" });
    }
  });

  // Change password endpoint
  app.post('/api/auth/change-password', isAuthenticated, async (req: any, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.user.claims.sub;
      
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "現在のパスワードと新しいパスワードが必要です" });
      }
      
      // 現在のユーザー取得
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "ユーザーが見つかりません" });
      }
      
      // 現在のパスワード確認
      if (user.password !== currentPassword) {
        return res.status(400).json({ message: "現在のパスワードが正しくありません" });
      }
      
      // パスワード更新
      await storage.updateUser(userId, { password: newPassword });
      
      res.json({ success: true, message: "パスワードが正常に変更されました" });
    } catch (error) {
      console.error("Password change error:", error);
      res.status(500).json({ message: "パスワード変更に失敗しました" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
