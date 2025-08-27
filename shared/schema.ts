import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  boolean,
  integer,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table for Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role").notNull().default("creator"), // creator, approver, admin
  approvalLevel: integer("approval_level").default(1),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Financial institution master data
export const financialInstitutions = pgTable("financial_institutions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bankCode: varchar("bank_code").notNull().unique(),
  bankName: varchar("bank_name").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Branches of financial institutions
export const branches = pgTable("branches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  institutionId: varchar("institution_id").notNull().references(() => financialInstitutions.id),
  branchCode: varchar("branch_code").notNull(),
  branchName: varchar("branch_name").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Inquiry response reports
export const reports = pgTable("reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reportNumber: varchar("report_number").notNull().unique(),
  userNumber: varchar("user_number").notNull(),
  bankCode: varchar("bank_code").notNull(),
  branchCode: varchar("branch_code").notNull(),
  companyName: varchar("company_name").notNull(),
  contactPersonName: varchar("contact_person_name").notNull(),
  handlerId: varchar("handler_id").notNull().references(() => users.id),
  approverId: varchar("approver_id").notNull().references(() => users.id),
  inquiryContent: text("inquiry_content").notNull(),
  responseContent: text("response_content").notNull(),
  escalationRequired: boolean("escalation_required").notNull().default(false),
  escalationReason: text("escalation_reason"),
  status: varchar("status").notNull().default("draft"), // draft, pending_approval, approved, rejected
  rejectionReason: text("rejection_reason"),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
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
  email: true,
  firstName: true,
  lastName: true,
  profileImageUrl: true,
  role: true,
  approvalLevel: true,
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
  status: true,
  approvedAt: true,
  createdAt: true,
  updatedAt: true,
});

export const updateReportStatusSchema = z.object({
  status: z.enum(["pending_approval", "approved", "rejected"]),
  rejectionReason: z.string().optional(),
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
export type UpdateReportStatus = z.infer<typeof updateReportStatusSchema>;

export type ReportWithDetails = Report & {
  handler: User;
  approver: User;
  bankName?: string;
  branchName?: string;
};
