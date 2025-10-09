import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import * as schema from "@shared/schema";

// PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool, { schema });

// Initialize database with schema - PostgreSQL
export async function initializeDatabase() {
  try {
    console.log('🔄 Initializing database...');
    
    // Check database connection
    try {
      await db.execute(sql`SELECT 1`);
      console.log('✅ Database connection successful');
    } catch (error) {
      console.error('❌ Database connection failed:', error);
      throw error;
    }
    
    // Create tables if they don't exist
    try {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS users (
          id text PRIMARY KEY,
          username text NOT NULL UNIQUE,
          password text NOT NULL,
          first_name text,
          last_name text,
          role text NOT NULL DEFAULT 'creator',
          approval_level integer DEFAULT 1,
          created_at integer,
          updated_at integer
        );
      `);
      
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS financial_institutions (
          id text PRIMARY KEY,
          bank_code text NOT NULL UNIQUE,
          bank_name text NOT NULL,
          created_at integer
        );
      `);
      
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS branches (
          id text PRIMARY KEY,
          institution_id text NOT NULL REFERENCES financial_institutions(id),
          branch_code text NOT NULL,
          branch_name text NOT NULL,
          created_at integer
        );
      `);
      
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS reports (
          id text PRIMARY KEY,
          report_number text NOT NULL UNIQUE,
          user_number text NOT NULL,
          bank_code text NOT NULL,
          branch_code text NOT NULL,
          company_name text NOT NULL,
          contact_person_name text NOT NULL,
          handler_id text NOT NULL REFERENCES users(id),
          approver_id text REFERENCES users(id),
          inquiry_content text NOT NULL,
          response_content text NOT NULL,
          escalation_required boolean NOT NULL DEFAULT false,
          escalation_reason text,
          status text NOT NULL DEFAULT 'draft',
          rejection_reason text,
          pdf_file_path text,
          approved_at integer,
          created_at integer,
          updated_at integer
        );
      `);
      
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS sessions (
          sid text PRIMARY KEY,
          sess text NOT NULL,
          expire timestamp NOT NULL
        );
      `);
      
      console.log('✅ Database schema created/verified');
    } catch (error) {
      console.error('❌ Schema creation error:', error);
      throw error;
    }
    
    // Check if users exist and insert default data if needed
    const users = await db.select().from(schema.users);
    if (users.length === 0) {
      const currentTimestamp = Math.floor(Date.now() / 1000);
      
      // Insert default users
      await db.insert(schema.users).values([
        {
          id: 'creator1',
          username: 'tanaka',
          password: 'password123',
          firstName: '太郎',
          lastName: '田中',
          role: 'creator',
          approvalLevel: 1,
          createdAt: currentTimestamp,
          updatedAt: currentTimestamp,
        },
        {
          id: 'creator2',
          username: 'sato',
          password: 'password123',
          firstName: '花子',
          lastName: '佐藤',
          role: 'creator',
          approvalLevel: 1,
          createdAt: currentTimestamp,
          updatedAt: currentTimestamp,
        },
        {
          id: 'approver1',
          username: 'suzuki',
          password: 'password123',
          firstName: '次郎',
          lastName: '鈴木',
          role: 'approver',
          approvalLevel: 2,
          createdAt: currentTimestamp,
          updatedAt: currentTimestamp,
        },
        {
          id: 'approver2',
          username: 'takahashi',
          password: 'password123',
          firstName: '美咲',
          lastName: '高橋',
          role: 'approver',
          approvalLevel: 3,
          createdAt: currentTimestamp,
          updatedAt: currentTimestamp,
        },
        {
          id: 'admin1',
          username: 'tamura',
          password: 'password123',
          firstName: '健太',
          lastName: '田村',
          role: 'admin',
          approvalLevel: 5,
          createdAt: currentTimestamp,
          updatedAt: currentTimestamp,
        }
      ]);
      
      // Insert sample financial institutions
      const institutions = await db.insert(schema.financialInstitutions).values([
        {
          id: 'inst1',
          bankCode: '0001',
          bankName: 'みずほ銀行',
          createdAt: currentTimestamp,
        },
        {
          id: 'inst2',
          bankCode: '0009',
          bankName: '三井住友銀行',
          createdAt: currentTimestamp,
        },
        {
          id: 'inst3',
          bankCode: '0005',
          bankName: '三菱UFJ銀行',
          createdAt: currentTimestamp,
        }
      ]).returning();
      
      // Insert sample branches
      const branches = [];
      for (const inst of institutions) {
        branches.push(
          {
            id: `${inst.id}_branch1`,
            institutionId: inst.id,
            branchCode: '001',
            branchName: '本店',
            createdAt: currentTimestamp,
          },
          {
            id: `${inst.id}_branch2`,
            institutionId: inst.id,
            branchCode: '002',
            branchName: '支店',
            createdAt: currentTimestamp,
          },
          {
            id: `${inst.id}_branch3`,
            institutionId: inst.id,
            branchCode: '003',
            branchName: '営業部',
            createdAt: currentTimestamp,
          }
        );
      }
      
      await db.insert(schema.branches).values(branches);
      
      console.log('✅ Default data inserted');
    }
  } catch (error) {
    console.error('❌ Database initialization error:', error);
    throw error;
  }
}