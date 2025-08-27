import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { 
  insertReportSchema, 
  updateReportStatusSchema,
  insertFinancialInstitutionSchema,
  insertBranchSchema 
} from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
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
      const report = await storage.createReport({ ...validatedData, handlerId: userId });
      res.status(201).json(report);
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
        reports = await storage.getReportsForApproval(userId);
      } else {
        reports = await storage.getReportsByUser(userId, status as string);
      }

      res.json(reports);
    } catch (error) {
      console.error("Error fetching reports:", error);
      res.status(500).json({ message: "Failed to fetch reports" });
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
      
      // Check if report exists and user is the approver
      const existingReport = await storage.getReport(id);
      if (!existingReport) {
        return res.status(404).json({ message: "Report not found" });
      }

      if (existingReport.approverId !== userId) {
        return res.status(403).json({ message: "Not authorized to approve this report" });
      }

      const validatedData = updateReportStatusSchema.parse(req.body);
      const updatedReport = await storage.updateReportStatus(id, validatedData);
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

  // PDF Generation route (placeholder - would integrate with PDF service)
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

      // TODO: Implement actual PDF generation
      // For now, return success message
      res.json({ message: "PDF generation would be implemented here", reportId: id });
    } catch (error) {
      console.error("Error generating PDF:", error);
      res.status(500).json({ message: "Failed to generate PDF" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
