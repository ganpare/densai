import { sql } from 'drizzle-orm';
import {
  index,
  sqliteTable,
  text,
  integer,
} from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for Replit Auth
export const sessions = sqliteTable(
  "sessions",
  {
    sid: text("sid").primaryKey(),
    sess: text("sess").notNull(),
    expire: integer("expire").notNull(),
  },
  (table) => ({
    expireIdx: index("IDX_session_expire").on(table.expire),
  }),
);

// User storage table with username/password auth
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  roles: text("roles").notNull().default("handler"), // JSON array: ["handler"], ["approver"], ["handler","approver"], ["admin"]
  createdAt: integer("created_at"),
  updatedAt: integer("updated_at"),
});

// Financial institution master data
export const financialInstitutions = sqliteTable("financial_institutions", {
  id: text("id").primaryKey(),
  bankCode: text("bank_code").notNull().unique(),
  bankName: text("bank_name").notNull(),
  createdAt: integer("created_at"),
});

// Branches of financial institutions
export const branches = sqliteTable("branches", {
  id: text("id").primaryKey(),
  institutionId: text("institution_id").notNull().references(() => financialInstitutions.id),
  branchCode: text("branch_code").notNull(),
  branchName: text("branch_name").notNull(),
  createdAt: integer("created_at"),
});

// Inquiry response reports
export const reports = sqliteTable("reports", {
  id: text("id").primaryKey(),
  reportNumber: text("report_number").notNull().unique(),
  userNumber: text("user_number").notNull(),
  bankCode: text("bank_code").notNull(),
  branchCode: text("branch_code").notNull(),
  companyName: text("company_name").notNull(),
  contactPersonName: text("contact_person_name").notNull(),
  handlerId: text("handler_id").notNull().references(() => users.id),
  approverId: text("approver_id").references(() => users.id),
  inquiryContent: text("inquiry_content").notNull(),
  responseContent: text("response_content").notNull(),
  escalationRequired: integer("escalation_required", { mode: 'boolean' }).notNull().default(false),
  escalationReason: text("escalation_reason"),
  status: text("status").notNull().default("draft"), // draft, pending_approval, approved, rejected
  rejectionReason: text("rejection_reason"),
  approvedAt: integer("approved_at"),
  createdAt: integer("created_at"),
  updatedAt: integer("updated_at"),
});

// Relations
export const userRelations = relations(users, ({ many }) => ({
  handledReports: many(reports, { relationName: "handler" }),
  approvedReports: many(reports, { relationName: "approver" }),
}));

export const financialInstitutionRelations = relations(financialInstitutions, ({ many }) => ({
  branches: many(branches),
}));

export const branchRelations = relations(branches, ({ one }) => ({
  institution: one(financialInstitutions, {
    fields: [branches.institutionId],
    references: [financialInstitutions.id],
  }),
}));

export const reportRelations = relations(reports, ({ one }) => ({
  handler: one(users, {
    fields: [reports.handlerId],
    references: [users.id],
    relationName: "handler",
  }),
  approver: one(users, {
    fields: [reports.approverId],
    references: [users.id],
    relationName: "approver",
  }),
}));

// Zod schemas
export const insertUserSchema = createInsertSchema(users).pick({
  id: true,
  username: true,
  password: true,
  firstName: true,
  lastName: true,
  roles: true,
});

export const insertFinancialInstitutionSchema = createInsertSchema(financialInstitutions).omit({
  id: true,
  createdAt: true,
});

export const insertBranchSchema = createInsertSchema(branches).omit({
  id: true,
  createdAt: true,
});

export const insertReportSchema = createInsertSchema(reports).omit({
  id: true,
  reportNumber: true,
  approverId: true,
  status: true,
  approvedAt: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  userNumber: z.string().min(1, "利用者番号は必須です"),
  bankCode: z.string().min(1, "金融機関コードは必須です"),
  branchCode: z.string().min(1, "支店コードは必須です"),
  companyName: z.string().min(1, "企業名は必須です"),
  contactPersonName: z.string().min(1, "連絡者氏名は必須です"),
  inquiryContent: z.string().min(1, "問い合わせ内容は必須です"),
  responseContent: z.string().min(1, "対応内容は必須です"),
});

// Schema for submitting reports for approval (stricter validation)
export const submitReportForApprovalSchema = insertReportSchema.refine(
  (data) => {
    // All required fields must be non-empty
    return data.userNumber.trim().length > 0 &&
           data.bankCode.trim().length > 0 &&
           data.branchCode.trim().length > 0 &&
           data.companyName.trim().length > 0 &&
           data.contactPersonName.trim().length > 0 &&
           data.inquiryContent.trim().length > 0 &&
           data.responseContent.trim().length > 0;
  },
  {
    message: "すべての必須項目を入力してください",
  }
);

export const updateReportStatusSchema = z.object({
  status: z.enum(["pending_approval", "approved", "rejected"]),
  rejectionReason: z.string().optional(),
  approverId: z.string().optional(),
  approvedAt: z.number().optional(),
});

// Types
export type UpsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertFinancialInstitution = z.infer<typeof insertFinancialInstitutionSchema>;
export type FinancialInstitution = typeof financialInstitutions.$inferSelect;
export type InsertBranch = z.infer<typeof insertBranchSchema>;
export type Branch = typeof branches.$inferSelect;
export type InsertReport = z.infer<typeof insertReportSchema>;
export type Report = typeof reports.$inferSelect;
export type SubmitReportForApproval = z.infer<typeof submitReportForApprovalSchema>;
export type UpdateReportStatus = z.infer<typeof updateReportStatusSchema>;

export type ReportWithDetails = Report & {
  handler: User;
  approver: User;
  bankName?: string;
  branchName?: string;
};
