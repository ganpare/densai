import {
  users,
  financialInstitutions,
  branches,
  reports,
  type User,
  type UpsertUser,
  type InsertFinancialInstitution,
  type FinancialInstitution,
  type InsertBranch,
  type Branch,
  type InsertReport,
  type Report,
  type ReportWithDetails,
  type UpdateReportStatus,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, or, like, sql, count } from "drizzle-orm";

export interface IStorage {
  // User operations (mandatory for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Financial institution operations
  getFinancialInstitutions(): Promise<FinancialInstitution[]>;
  createFinancialInstitution(institution: InsertFinancialInstitution): Promise<FinancialInstitution>;
  getBranches(institutionId: string): Promise<Branch[]>;
  createBranch(branch: InsertBranch): Promise<Branch>;
  getInstitutionByCode(bankCode: string): Promise<FinancialInstitution | undefined>;
  getBranchByCode(institutionId: string, branchCode: string): Promise<Branch | undefined>;
  
  // Report operations
  createReport(report: InsertReport): Promise<Report>;
  updateReport(id: string, report: Partial<InsertReport>): Promise<Report>;
  updateReportStatus(id: string, status: UpdateReportStatus): Promise<Report>;
  getReport(id: string): Promise<ReportWithDetails | undefined>;
  getReportsByUser(userId: string, status?: string): Promise<ReportWithDetails[]>;
  getReportsForApproval(approverId: string): Promise<ReportWithDetails[]>;
  getAllReports(limit?: number, offset?: number): Promise<ReportWithDetails[]>;
  searchReports(query: string): Promise<ReportWithDetails[]>;
  
  // Statistics
  getReportStatistics(): Promise<{
    todayInquiries: number;
    pendingApprovals: number;
    monthlyCompleted: number;
    escalations: number;
  }>;
  
  // Users for dropdowns
  getUsersByRole(role: string): Promise<User[]>;
}

export class DatabaseStorage implements IStorage {
  // User operations (mandatory for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Financial institution operations
  async getFinancialInstitutions(): Promise<FinancialInstitution[]> {
    return await db.select().from(financialInstitutions).orderBy(financialInstitutions.bankName);
  }

  async createFinancialInstitution(institution: InsertFinancialInstitution): Promise<FinancialInstitution> {
    const [created] = await db.insert(financialInstitutions).values(institution).returning();
    return created;
  }

  async getBranches(institutionId: string): Promise<Branch[]> {
    return await db.select().from(branches).where(eq(branches.institutionId, institutionId)).orderBy(branches.branchName);
  }

  async createBranch(branch: InsertBranch): Promise<Branch> {
    const [created] = await db.insert(branches).values(branch).returning();
    return created;
  }

  async getInstitutionByCode(bankCode: string): Promise<FinancialInstitution | undefined> {
    const [institution] = await db.select().from(financialInstitutions).where(eq(financialInstitutions.bankCode, bankCode));
    return institution;
  }

  async getBranchByCode(institutionId: string, branchCode: string): Promise<Branch | undefined> {
    const [branch] = await db.select().from(branches).where(
      and(
        eq(branches.institutionId, institutionId),
        eq(branches.branchCode, branchCode)
      )
    );
    return branch;
  }

  // Report operations
  async createReport(report: InsertReport): Promise<Report> {
    // Generate report number
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    
    // Get count of reports this month to generate sequential number
    const [{ value: monthlyCount }] = await db
      .select({ value: count() })
      .from(reports)
      .where(
        and(
          sql`EXTRACT(YEAR FROM created_at) = ${year}`,
          sql`EXTRACT(MONTH FROM created_at) = ${parseInt(month)}`
        )
      );

    const reportNumber = `RPT-${year}-${month}-${String((monthlyCount || 0) + 1).padStart(3, '0')}`;

    const [created] = await db
      .insert(reports)
      .values({
        ...report,
        reportNumber,
      })
      .returning();
    return created;
  }

  async updateReport(id: string, report: Partial<InsertReport>): Promise<Report> {
    const [updated] = await db
      .update(reports)
      .set({ ...report, updatedAt: new Date() })
      .where(eq(reports.id, id))
      .returning();
    return updated;
  }

  async updateReportStatus(id: string, statusUpdate: UpdateReportStatus): Promise<Report> {
    const updateData: any = {
      status: statusUpdate.status,
      updatedAt: new Date(),
    };

    if (statusUpdate.status === 'approved') {
      updateData.approvedAt = new Date();
    }

    if (statusUpdate.rejectionReason) {
      updateData.rejectionReason = statusUpdate.rejectionReason;
    }

    const [updated] = await db
      .update(reports)
      .set(updateData)
      .where(eq(reports.id, id))
      .returning();
    return updated;
  }

  async getReport(id: string): Promise<ReportWithDetails | undefined> {
    const result = await db
      .select({
        report: reports,
        handler: users,
        approver: {
          id: sql`approver.id`,
          email: sql`approver.email`,
          firstName: sql`approver.first_name`,
          lastName: sql`approver.last_name`,
          profileImageUrl: sql`approver.profile_image_url`,
          role: sql`approver.role`,
          approvalLevel: sql`approver.approval_level`,
          createdAt: sql`approver.created_at`,
          updatedAt: sql`approver.updated_at`,
        },
      })
      .from(reports)
      .innerJoin(users, eq(reports.handlerId, users.id))
      .innerJoin(sql`users as approver`, sql`${reports.approverId} = approver.id`)
      .where(eq(reports.id, id))
      .limit(1);

    if (!result.length) return undefined;

    const row = result[0];
    return {
      ...row.report,
      handler: row.handler,
      approver: row.approver as User,
    };
  }

  async getReportsByUser(userId: string, status?: string): Promise<ReportWithDetails[]> {
    let query = db
      .select({
        report: reports,
        handler: users,
        approver: {
          id: sql`approver.id`,
          email: sql`approver.email`,
          firstName: sql`approver.first_name`,
          lastName: sql`approver.last_name`,
          profileImageUrl: sql`approver.profile_image_url`,
          role: sql`approver.role`,
          approvalLevel: sql`approver.approval_level`,
          createdAt: sql`approver.created_at`,
          updatedAt: sql`approver.updated_at`,
        },
      })
      .from(reports)
      .innerJoin(users, eq(reports.handlerId, users.id))
      .innerJoin(sql`users as approver`, sql`${reports.approverId} = approver.id`)
      .where(eq(reports.handlerId, userId));

    if (status) {
      query = query.where(and(eq(reports.handlerId, userId), eq(reports.status, status)));
    }

    const result = await query.orderBy(desc(reports.createdAt));

    return result.map(row => ({
      ...row.report,
      handler: row.handler,
      approver: row.approver as User,
    }));
  }

  async getReportsForApproval(approverId: string): Promise<ReportWithDetails[]> {
    const result = await db
      .select({
        report: reports,
        handler: users,
        approver: {
          id: sql`approver.id`,
          email: sql`approver.email`,
          firstName: sql`approver.first_name`,
          lastName: sql`approver.last_name`,
          profileImageUrl: sql`approver.profile_image_url`,
          role: sql`approver.role`,
          approvalLevel: sql`approver.approval_level`,
          createdAt: sql`approver.created_at`,
          updatedAt: sql`approver.updated_at`,
        },
      })
      .from(reports)
      .innerJoin(users, eq(reports.handlerId, users.id))
      .innerJoin(sql`users as approver`, sql`${reports.approverId} = approver.id`)
      .where(and(eq(reports.approverId, approverId), eq(reports.status, "pending_approval")))
      .orderBy(desc(reports.createdAt));

    return result.map(row => ({
      ...row.report,
      handler: row.handler,
      approver: row.approver as User,
    }));
  }

  async getAllReports(limit = 50, offset = 0): Promise<ReportWithDetails[]> {
    const result = await db
      .select({
        report: reports,
        handler: users,
        approver: {
          id: sql`approver.id`,
          email: sql`approver.email`,
          firstName: sql`approver.first_name`,
          lastName: sql`approver.last_name`,
          profileImageUrl: sql`approver.profile_image_url`,
          role: sql`approver.role`,
          approvalLevel: sql`approver.approval_level`,
          createdAt: sql`approver.created_at`,
          updatedAt: sql`approver.updated_at`,
        },
      })
      .from(reports)
      .innerJoin(users, eq(reports.handlerId, users.id))
      .innerJoin(sql`users as approver`, sql`${reports.approverId} = approver.id`)
      .orderBy(desc(reports.createdAt))
      .limit(limit)
      .offset(offset);

    return result.map(row => ({
      ...row.report,
      handler: row.handler,
      approver: row.approver as User,
    }));
  }

  async searchReports(query: string): Promise<ReportWithDetails[]> {
    const result = await db
      .select({
        report: reports,
        handler: users,
        approver: {
          id: sql`approver.id`,
          email: sql`approver.email`,
          firstName: sql`approver.first_name`,
          lastName: sql`approver.last_name`,
          profileImageUrl: sql`approver.profile_image_url`,
          role: sql`approver.role`,
          approvalLevel: sql`approver.approval_level`,
          createdAt: sql`approver.created_at`,
          updatedAt: sql`approver.updated_at`,
        },
      })
      .from(reports)
      .innerJoin(users, eq(reports.handlerId, users.id))
      .innerJoin(sql`users as approver`, sql`${reports.approverId} = approver.id`)
      .where(
        or(
          like(reports.reportNumber, `%${query}%`),
          like(reports.companyName, `%${query}%`),
          like(reports.contactPersonName, `%${query}%`),
          like(reports.inquiryContent, `%${query}%`)
        )
      )
      .orderBy(desc(reports.createdAt));

    return result.map(row => ({
      ...row.report,
      handler: row.handler,
      approver: row.approver as User,
    }));
  }

  async getReportStatistics(): Promise<{
    todayInquiries: number;
    pendingApprovals: number;
    monthlyCompleted: number;
    escalations: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const [
      todayResult,
      pendingResult,
      monthlyResult,
      escalationResult
    ] = await Promise.all([
      db.select({ count: count() }).from(reports).where(sql`DATE(created_at) = CURRENT_DATE`),
      db.select({ count: count() }).from(reports).where(eq(reports.status, "pending_approval")),
      db.select({ count: count() }).from(reports).where(
        and(
          eq(reports.status, "approved"),
          sql`created_at >= ${startOfMonth}`
        )
      ),
      db.select({ count: count() }).from(reports).where(eq(reports.escalationRequired, true))
    ]);

    return {
      todayInquiries: todayResult[0]?.count || 0,
      pendingApprovals: pendingResult[0]?.count || 0,
      monthlyCompleted: monthlyResult[0]?.count || 0,
      escalations: escalationResult[0]?.count || 0,
    };
  }

  async getUsersByRole(role: string): Promise<User[]> {
    return await db.select().from(users).where(eq(users.role, role));
  }
}

export const storage = new DatabaseStorage();
