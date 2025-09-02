import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { pdfService } from "./services/pdfService";
import { 
  insertReportSchema, 
  submitReportForApprovalSchema,
  updateReportStatusSchema,
  insertFinancialInstitutionSchema,
  insertBranchSchema 
} from "@shared/schema";
import { z } from "zod";
import { randomUUID } from "crypto";

// Helper function to check if user has required role
function hasRole(user: any, requiredRole: string): boolean {
  try {
    const roles = JSON.parse(user.roles);
    return roles.includes(requiredRole);
  } catch (error) {
    console.error('Error parsing user roles:', error);
    return false;
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.post('/api/auth/logout', isAuthenticated, async (req: any, res) => {
    try {
      req.session.destroy((err: any) => {
        if (err) {
          console.error('Error destroying session:', err);
          return res.status(500).json({ message: 'Failed to logout' });
        }
        res.clearCookie('connect.sid');
        res.json({ success: true, message: 'Logged out successfully' });
      });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({ message: 'Failed to logout' });
    }
  });

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
      
      // Use different validation schemas based on whether this is for approval submission
      if (req.body._submitForApproval) {
        // Stricter validation for approval submission
        const validatedData = submitReportForApprovalSchema.parse(req.body);
        
        // Create report and immediately set to pending_approval
        const report = await storage.createReport({ 
          ...validatedData, 
          handlerId: userId,
          approverId: null,
          status: 'pending_approval'
        });
        
        res.status(201).json(report);
      } else {
        // Lenient validation for draft save (allow partial data)
        const validatedData = insertReportSchema.partial().parse(req.body);
        
        // Create report as draft
        const report = await storage.createReport({ 
          ...validatedData, 
          handlerId: userId,
          approverId: null,
          status: 'draft'
        });
        
        res.status(201).json(report);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.errors.map(err => {
          switch (err.path[0]) {
            case "userNumber":
              return "利用者番号は必須です";
            case "bankCode":
              return "金融機関コードは必須です";
            case "branchCode":
              return "支店コードは必須です";
            case "companyName":
              return "企業名は必須です";
            case "contactPersonName":
              return "連絡者氏名は必須です";
            case "inquiryContent":
              return "問い合わせ内容は必須です";
            case "responseContent":
              return "対応内容は必須です";
            default:
              return err.message;
          }
        });
        res.status(400).json({ 
          message: "入力項目に不備があります", 
          errors: errorMessages
        });
      } else {
        console.error("Error creating report:", error);
        res.status(500).json({ message: "Failed to create report" });
      }
    }
  });

  app.get('/api/reports', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      console.log('GET /api/reports - userId:', userId);
      const user = await storage.getUser(userId);
      console.log('GET /api/reports - user:', user);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const isApprover = hasRole(user, 'approver');
      console.log('GET /api/reports - isApprover:', isApprover);

      let reports;
      const { status, search, limit, offset } = req.query;

      if (search) {
        console.log('GET /api/reports - search branch');
        // For search, pass userId only if user is not an approver (approvers can search all reports)
        reports = await storage.searchReports(search as string, isApprover ? undefined : userId);
      } else if (isApprover) {
        console.log('GET /api/reports - approver branch');
        // Approvers can see all pending approval reports, not just assigned to them
        reports = await storage.getReportsForApproval();
      } else {
        console.log('GET /api/reports - user branch');
        reports = await storage.getReportsByUser(userId, status as string);
      }

      console.log('GET /api/reports - final reports:', reports);
      res.json(reports);
    } catch (error) {
      console.error("Error fetching reports:", error);
      res.status(500).json({ message: "Failed to fetch reports" });
    }
  });

  // Get pending reports for approvers
  app.get('/api/reports/pending', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (!hasRole(user, 'approver')) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const reports = await storage.getReportsForApproval();
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

      // Check if user has approver role
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (!hasRole(user, 'approver')) {
        return res.status(403).json({ message: "Not authorized - approver role required" });
      }

      // Check if report is in pending_approval status
      if (existingReport.status !== 'pending_approval') {
        return res.status(400).json({ message: "Report is not in pending approval status" });
      }

      const validatedData = updateReportStatusSchema.parse(req.body);
      
      // If approving, assign the current user as approver and set approval timestamp
      if (validatedData.status === 'approved') {
        const updatedReport = await storage.updateReportStatus(id, {
          ...validatedData,
          approverId: userId,
          approvedAt: Math.floor(Date.now() / 1000)
        });
        res.json(updatedReport);
      } else {
        // For rejection, also assign approver but no approval timestamp
        const updatedReport = await storage.updateReportStatus(id, {
          ...validatedData,
          approverId: userId
        });
        res.json(updatedReport);
      }
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

      // Validate the existing report has all required fields for approval submission
      const validationResult = submitReportForApprovalSchema.safeParse(existingReport);
      
      if (!validationResult.success) {
        const errorMessages = validationResult.error.issues.map(issue => {
          switch (issue.path[0]) {
            case "userNumber":
              return "利用者番号は必須です";
            case "bankCode":
              return "金融機関コードは必須です";
            case "branchCode":
              return "支店コードは必須です";
            case "companyName":
              return "企業名は必須です";
            case "contactPersonName":
              return "連絡者氏名は必須です";
            case "inquiryContent":
              return "問い合わせ内容は必須です";
            case "responseContent":
              return "対応内容は必須です";
            default:
              return issue.message;
          }
        });
        
        return res.status(400).json({ 
          message: "すべての必須項目を入力してから申請してください", 
          errors: errorMessages
        });
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
  app.get('/api/users/by-role', isAuthenticated, async (req, res) => {
    try {
      const { role } = req.query;
      const users = role 
        ? await storage.getUsersByRole(role as string)
        : await storage.getUsersByRole('handler');
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // PDF Generation route
  app.get('/api/reports/:id/pdf', isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const report = await storage.getReport(id);
      
      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }

      if (report.status !== 'approved') {
        return res.status(400).json({ message: "Only approved reports can be printed" });
      }

      // PDF生成に必要なデータを返す
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
        escalationReason: report.escalationReason,
        approvedAt: report.approvedAt,
        createdAt: report.createdAt
      };

      res.json({ 
        success: true, 
        message: "PDF生成用データを取得しました", 
        data: pdfData 
      });
    } catch (error) {
      console.error("Error generating PDF:", error);
      res.status(500).json({ message: "Failed to generate PDF" });
    }
  });

  // Test endpoint for debugging
  app.get('/api/test/reports', async (req: any, res) => {
    try {
      console.log('TEST: Getting reports for approval');
      const reports = await storage.getReportsForApproval();
      console.log('TEST: Found reports:', reports.length);
      res.json({ 
        success: true, 
        count: reports.length,
        reports: reports 
      });
    } catch (error) {
      console.error("Test endpoint error:", error);
      res.status(500).json({ message: "Test failed", error: error.message });
    }
  });

  // Test endpoint for status
  app.get('/api/test/status', async (req: any, res) => {
    try {
      const stats = await storage.getReportStatistics();
      res.json({ 
        success: true, 
        statistics: stats 
      });
    } catch (error) {
      console.error("Test status error:", error);
      res.status(500).json({ message: "Status test failed", error: error.message });
    }
  });

  // Test approval endpoint (bypasses auth)
  app.patch('/api/test/approve/:id', async (req: any, res) => {
    try {
      const { id } = req.params;
      console.log('TEST: Approving report', id);
      
      const updatedReport = await storage.updateReportStatus(id, { 
        status: "approved" 
      });
      
      console.log('TEST: Report approved successfully');
      res.json({ 
        success: true, 
        report: updatedReport,
        message: "Report approved successfully" 
      });
    } catch (error) {
      console.error("Test approval error:", error);
      res.status(500).json({ message: "Approval test failed", error: error.message });
    }
  });

  // Test PDF endpoint (bypasses auth)
  app.get('/api/test/pdf/:id', async (req, res) => {
    try {
      const { id } = req.params;
      console.log('TEST: Getting PDF data for report', id);
      
      const report = await storage.getReport(id);
      
      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }

      if (report.status !== 'approved') {
        return res.status(400).json({ message: "Only approved reports can be printed" });
      }

      const pdfData = {
        reportNumber: report.reportNumber,
        userNumber: report.userNumber,
        bankCode: report.bankCode,
        branchCode: report.branchCode,
        companyName: report.companyName,
        contactPersonName: report.contactPersonName,
        handlerName: `${report.handler.lastName} ${report.handler.firstName}`,
        approverName: report.approver ? `${report.approver.lastName} ${report.approver.firstName}` : "承認者未設定",
        inquiryContent: report.inquiryContent,
        responseContent: report.responseContent,
        escalationRequired: report.escalationRequired,
        escalationReason: report.escalationReason,
        approvedAt: report.approvedAt,
        createdAt: report.createdAt
      };

      console.log('TEST: PDF data prepared');
      res.json({ 
        success: true, 
        message: "PDF生成用データを取得しました", 
        data: pdfData 
      });
    } catch (error) {
      console.error("Test PDF error:", error);
      res.status(500).json({ message: "PDF test failed", error: error.message });
    }
  });

  // Get available printers
  app.get('/api/printers', isAuthenticated, async (req: any, res) => {
    try {
      const { exec } = require('child_process');
      const util = require('util');
      const execPromise = util.promisify(exec);

      let printers = [];
      
      // Try to get printers based on OS
      try {
        if (process.platform === 'win32') {
          // Windows: Use wmic to get printers
          const { stdout } = await execPromise('wmic printer get name,status /format:csv');
          const lines = stdout.split('\n').filter(line => line.trim() && !line.startsWith('Node'));
          printers = lines.map((line, index) => {
            const parts = line.split(',');
            const name = parts[1]?.trim();
            const status = parts[2]?.trim();
            return name ? {
              id: `printer_${index}`,
              name: name,
              status: status || 'Unknown'
            } : null;
          }).filter(Boolean);
        } else {
          // Linux/Mac: Use lpstat to get printers
          const { stdout } = await execPromise('lpstat -p 2>/dev/null || echo "No printers found"');
          const lines = stdout.split('\n').filter(line => line.startsWith('printer '));
          printers = lines.map((line, index) => {
            const match = line.match(/printer (\S+)/);
            return match ? {
              id: `printer_${index}`,
              name: match[1],
              status: line.includes('disabled') ? 'Disabled' : 'Ready'
            } : null;
          }).filter(Boolean);
        }
      } catch (error) {
        console.log('Could not get system printers, using default list');
      }

      // If no system printers found, provide default/sample printers
      if (printers.length === 0) {
        printers = [
          { id: "default_printer", name: "既定のプリンター", status: "Ready" },
          { id: "main_office_01", name: "本店_金庫連携プリンター_01", status: "Ready" },
          { id: "branch_office_02", name: "支店_金庫連携プリンター_02", status: "Ready" },
          { id: "headquarters_03", name: "本部_金庫連携プリンター_03", status: "Ready" },
        ];
      }

      res.json({ success: true, printers });
    } catch (error) {
      console.error("Error fetching printers:", error);
      res.status(500).json({ message: "Failed to fetch printers" });
    }
  });

  // Print report to specified printer
  app.post('/api/reports/:id/print', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { printerId, printerName } = req.body;
      
      if (!printerId || !printerName) {
        return res.status(400).json({ message: "Printer ID and name are required" });
      }

      const report = await storage.getReport(id);
      
      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }

      if (report.status !== 'approved') {
        return res.status(400).json({ message: "Only approved reports can be printed" });
      }

      // Generate temporary PDF file for printing
      const fs = require('fs').promises;
      const path = require('path');
      const { exec } = require('child_process');
      const util = require('util');
      const execPromise = util.promisify(exec);
      
      // Create a simple text file for printing (in real implementation, you'd generate a proper PDF)
      const printContent = `
電子債権問い合わせ対応報告書

報告書番号: ${report.reportNumber}
ユーザー番号: ${report.userNumber}
金庫コード: ${report.bankCode}
支店コード: ${report.branchCode}
企業名: ${report.companyName}
連絡者: ${report.contactPersonName}

問い合わせ内容:
${report.inquiryContent}

回答内容:
${report.responseContent}

${report.escalationRequired ? `エスカレーション理由: ${report.escalationReason}` : ''}

作成者: ${report.handler.lastName} ${report.handler.firstName}
承認者: ${report.approver ? `${report.approver.lastName} ${report.approver.firstName}` : '未設定'}
承認日時: ${report.approvedAt ? new Date(report.approvedAt * 1000).toLocaleString('ja-JP') : '未承認'}
`;

      const tempDir = require('os').tmpdir();
      const tempFile = path.join(tempDir, `report_${report.id}.txt`);
      
      try {
        await fs.writeFile(tempFile, printContent, 'utf8');
        
        // Print based on OS
        if (process.platform === 'win32') {
          // Windows: Use notepad to print
          await execPromise(`notepad /p "${tempFile}"`);
        } else {
          // Linux/Mac: Use lp command
          if (printerId === 'default_printer') {
            await execPromise(`lp "${tempFile}"`);
          } else {
            await execPromise(`lp -d "${printerName}" "${tempFile}"`);
          }
        }
        
        // Clean up temp file
        setTimeout(async () => {
          try {
            await fs.unlink(tempFile);
          } catch (err) {
            console.log('Could not delete temp file:', err.message);
          }
        }, 5000);
        
        console.log(`Report ${report.id} printed to ${printerName}`);
        res.json({ 
          success: true, 
          message: `報告書を${printerName}で印刷しました`,
          printerId,
          printerName
        });
        
      } catch (printError) {
        console.error('Print error:', printError);
        // Clean up temp file on error
        try {
          await fs.unlink(tempFile);
        } catch (err) {
          // Ignore cleanup errors
        }
        res.status(500).json({ message: "印刷に失敗しました: " + printError.message });
      }
      
    } catch (error) {
      console.error("Error printing report:", error);
      res.status(500).json({ message: "Failed to print report" });
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

  // PDF Print/Save routes
  app.post('/api/reports/:id/print-pdf', isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const { action } = req.body; // 'save' or 'print'
      
      const report = await storage.getReport(id);
      
      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }

      if (report.status !== 'approved') {
        return res.status(400).json({ message: "Only approved reports can be printed" });
      }

      // Generate HTML content for PDF
      const htmlContent = pdfService.generatePDFHTML(report);
      
      if (action === 'save') {
        // For save action, return HTML content to be converted to PDF on client side
        // and saved on server with proper filename
        const filename = pdfService.generatePDFFilename(report);
        
        return res.json({
          success: true,
          action: 'save',
          filename: filename,
          htmlContent: htmlContent,
          message: "PDF保存用データを生成しました"
        });
      } else if (action === 'print') {
        // For print action, return HTML content for direct printing
        return res.json({
          success: true,
          action: 'print',
          htmlContent: htmlContent,
          message: "印刷用データを生成しました"
        });
      } else {
        return res.status(400).json({ message: "Invalid action. Use 'save' or 'print'" });
      }

    } catch (error) {
      console.error("Error processing PDF request:", error);
      res.status(500).json({ message: "PDF処理に失敗しました" });
    }
  });

  // Save PDF to server
  app.post('/api/reports/:id/save-pdf', isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const { filename, pdfBuffer } = req.body;
      
      const report = await storage.getReport(id);
      
      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }

      if (report.status !== 'approved') {
        return res.status(400).json({ message: "Only approved reports can be saved as PDF" });
      }

      // Convert base64 buffer to Buffer and save
      const buffer = Buffer.from(pdfBuffer, 'base64');
      const savedFilename = await pdfService.savePDF(report, buffer);
      
      res.json({
        success: true,
        filename: savedFilename,
        message: "PDFファイルを保存しました"
      });

    } catch (error) {
      console.error("Error saving PDF:", error);
      res.status(500).json({ message: "PDF保存に失敗しました" });
    }
  });

  // List saved PDFs
  app.get('/api/reports/pdf-files', isAuthenticated, async (req, res) => {
    try {
      const files = pdfService.listPDFs();
      res.json({
        success: true,
        files: files
      });
    } catch (error) {
      console.error("Error listing PDFs:", error);
      res.status(500).json({ message: "PDFファイル一覧の取得に失敗しました" });
    }
  });

  // Download saved PDF
  app.get('/api/reports/pdf-files/:filename', isAuthenticated, async (req, res) => {
    try {
      const { filename } = req.params;
      const filepath = pdfService.getPDFPath(filename);
      
      if (!require('fs').existsSync(filepath)) {
        return res.status(404).json({ message: "PDF file not found" });
      }
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      
      const fs = require('fs');
      const fileStream = fs.createReadStream(filepath);
      fileStream.pipe(res);
      
    } catch (error) {
      console.error("Error downloading PDF:", error);
      res.status(500).json({ message: "PDFダウンロードに失敗しました" });
    }
  });

  // Get today's approved reports grouped by bank
  app.get('/api/reports/today-approved', isAuthenticated, async (req, res) => {
    try {
      const groupedReports = await storage.getTodayApprovedReportsByBank();
      const reportCount = await storage.getTodayReportCount();
      
      res.json({
        success: true,
        reportCount: reportCount,
        reportsByBank: groupedReports,
        message: `本日承認された報告書を${Object.keys(groupedReports).length}の金融機関別に取得しました`
      });
    } catch (error) {
      console.error("Error fetching today's approved reports:", error);
      res.status(500).json({ message: "本日の承認済み報告書の取得に失敗しました" });
    }
  });

  // Bulk print today's approved reports by bank
  app.post('/api/reports/bulk-print-today', isAuthenticated, async (req, res) => {
    try {
      const groupedReports = await storage.getTodayApprovedReportsByBank();
      
      if (Object.keys(groupedReports).length === 0) {
        return res.json({
          success: true,
          message: "本日承認済みの報告書はありません",
          files: []
        });
      }

      const generatedFiles = [];

      // Generate PDF for each bank
      for (const [bankCode, reports] of Object.entries(groupedReports)) {
        if (reports.length > 0) {
          const htmlContent = pdfService.generateBulkPDFHTML(reports, bankCode);
          const filename = pdfService.generateBulkPDFFilename(bankCode);
          
          generatedFiles.push({
            bankCode: bankCode,
            reportCount: reports.length,
            filename: filename,
            htmlContent: htmlContent
          });
        }
      }

      res.json({
        success: true,
        message: `${Object.keys(groupedReports).length}の金融機関別にPDFを生成しました`,
        files: generatedFiles,
        totalReports: Object.values(groupedReports).reduce((sum, reports) => sum + reports.length, 0)
      });

    } catch (error) {
      console.error("Error bulk printing today's reports:", error);
      res.status(500).json({ message: "一括印刷に失敗しました" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
