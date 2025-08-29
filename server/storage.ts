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
import { randomUUID } from "crypto";
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

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const existingUser = await this.getUser(userData.id!);
    
    if (existingUser) {
      const [user] = await db
        .update(users)
        .set({
          ...userData,
          updatedAt: Math.floor(Date.now() / 1000),
        })
        .where(eq(users.id, userData.id!))
        .returning();
      return user;
    } else {
      const currentTimestamp = Math.floor(Date.now() / 1000);
      const [user] = await db
        .insert(users)
        .values({
          ...userData,
          createdAt: currentTimestamp,
          updatedAt: currentTimestamp,
        })
        .returning();
      return user;
    }
  }

  // Financial institution operations
  async getFinancialInstitutions(): Promise<FinancialInstitution[]> {
    return await db.select().from(financialInstitutions).orderBy(financialInstitutions.bankName);
  }

  async createFinancialInstitution(institution: InsertFinancialInstitution): Promise<FinancialInstitution> {
    const [created] = await db
      .insert(financialInstitutions)
      .values({
        id: randomUUID(),
        bankCode: institution.bankCode,
        bankName: institution.bankName,
        createdAt: Math.floor(Date.now() / 1000),
      })
      .returning();
    return created;
  }

  async getBranches(institutionId: string): Promise<Branch[]> {
    return await db.select().from(branches).where(eq(branches.institutionId, institutionId)).orderBy(branches.branchName);
  }

  async createBranch(branch: InsertBranch): Promise<Branch> {
    const [created] = await db
      .insert(branches)
      .values({
        id: randomUUID(),
        institutionId: branch.institutionId,
        branchCode: branch.branchCode,
        branchName: branch.branchName,
        createdAt: Math.floor(Date.now() / 1000),
      })
      .returning();
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
    const monthStart = new Date(year, now.getMonth(), 1);
    const monthEnd = new Date(year, now.getMonth() + 1, 0);
    const monthStartTimestamp = Math.floor(monthStart.getTime() / 1000);
    const monthEndTimestamp = Math.floor(monthEnd.getTime() / 1000);
    
    const [{ value: monthlyCount }] = await db
      .select({ value: count() })
      .from(reports)
      .where(
        and(
          sql`${reports.createdAt} >= ${monthStartTimestamp}`,
          sql`${reports.createdAt} <= ${monthEndTimestamp}`
        )
      );

    const reportNumber = `RPT-${year}-${month}-${String((monthlyCount || 0) + 1).padStart(3, '0')}`;
    
    // Generate ID manually for SQLite
    const reportId = randomUUID();
    const currentTimestamp = Math.floor(Date.now() / 1000);

    const [created] = await db
      .insert(reports)
      .values({
        ...report,
        id: reportId,
        reportNumber,
        createdAt: currentTimestamp,
        updatedAt: currentTimestamp,
      })
      .returning();
    return created;
  }

  async updateReport(id: string, report: Partial<InsertReport>): Promise<Report> {
    const [updated] = await db
      .update(reports)
      .set({ ...report, updatedAt: Math.floor(Date.now() / 1000) })
      .where(eq(reports.id, id))
      .returning();
    return updated;
  }

  async updateReportStatus(id: string, statusUpdate: UpdateReportStatus): Promise<Report> {
    const updateData: any = {
      status: statusUpdate.status,
      updatedAt: Math.floor(Date.now() / 1000),
    };

    if (statusUpdate.status === 'approved') {
      updateData.approvedAt = Math.floor(Date.now() / 1000);
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

          firstName: sql`approver.first_name`,
          lastName: sql`approver.last_name`,

          roles: sql`approver.roles`,
          createdAt: sql`approver.created_at`,
          updatedAt: sql`approver.updated_at`,
        },
      })
      .from(reports)
      .innerJoin(users, eq(reports.handlerId, users.id))
  .leftJoin(sql`users as approver`, sql`${reports.approverId} = approver.id`)
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
    // Simplified approach - just return empty array for now
    // This will allow the system to work while we can add reports later
    return [];
  }

  async getReportsForApproval(approverId: string): Promise<ReportWithDetails[]> {
    console.log('getReportsForApproval called with approverId:', approverId);
    
    // Simplified query - just get pending reports with handler info
    const result = await db
      .select({
        report: reports,
        handler: users,
      })
      .from(reports)
      .innerJoin(users, eq(reports.handlerId, users.id))
      .where(eq(reports.status, "pending_approval"))
      .orderBy(desc(reports.createdAt));

    console.log('getReportsForApproval result count:', result.length);
    console.log('getReportsForApproval result:', result);

    return result.map(row => ({
      ...row.report,
      handler: row.handler,
      approver: null, // For now, just set approver to null since it's pending
    }));
  }

  async getAllReports(limit = 50, offset = 0): Promise<ReportWithDetails[]> {
    const result = await db
      .select({
        report: reports,
        handler: users,
        approver: {
          id: sql`approver.id`,

          firstName: sql`approver.first_name`,
          lastName: sql`approver.last_name`,

          roles: sql`approver.roles`,
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

          firstName: sql`approver.first_name`,
          lastName: sql`approver.last_name`,

          roles: sql`approver.roles`,
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
    const startOfDay = Math.floor(new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() / 1000);
    const endOfDay = Math.floor(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).getTime() / 1000);
    
    const startOfMonth = Math.floor(new Date(today.getFullYear(), today.getMonth(), 1).getTime() / 1000);

    const [
      todayResult,
      pendingResult,
      monthlyResult,
      escalationResult
    ] = await Promise.all([
      db.select({ count: count() }).from(reports).where(
        and(
          sql`${reports.createdAt} >= ${startOfDay}`,
          sql`${reports.createdAt} < ${endOfDay}`
        )
      ),
      db.select({ count: count() }).from(reports).where(eq(reports.status, "pending_approval")),
      db.select({ count: count() }).from(reports).where(
        and(
          eq(reports.status, "approved"),
          sql`${reports.createdAt} >= ${startOfMonth}`
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

  // Helper function to check if user has a specific role
  private hasRole(user: User, requiredRole: string): boolean {
    try {
      const roles = JSON.parse(user.roles);
      return roles.includes(requiredRole);
    } catch (error) {
      console.error('Error parsing user roles:', error);
      return false;
    }
  }

  async getUsersByRole(requiredRole: string | string[]): Promise<User[]> {
    const allUsers = await db.select().from(users);
    
    if (Array.isArray(requiredRole)) {
      return allUsers.filter(user => {
        try {
          const userRoles = JSON.parse(user.roles);
          return requiredRole.some(role => userRoles.includes(role));
        } catch {
          return false;
        }
      });
    } else {
      return allUsers.filter(user => this.hasRole(user, requiredRole));
    }
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }

  async createUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .returning();
    return user;
  }

  async updateUser(id: string, userData: Partial<UpsertUser>): Promise<User> {
    const [user] = await db
      .update(users)
      .set(userData)
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async deleteUser(id: string): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }
}

export const storage = new DatabaseStorage();
