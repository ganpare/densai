import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from "@shared/schema";

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });

// Initialize database with schema - PostgreSQL
async function initializeDatabase() {
  try {
    console.log('🔄 Initializing database...');
    
    // Initialize database if needed (using drizzle push)
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    
    try {
      await execAsync('npm run db:push');
      console.log('✅ Database schema initialized');
    } catch (error) {
      console.log('ℹ️ Database schema may already exist');
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
  }
}

// Initialize on module load
initializeDatabase();