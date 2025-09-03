import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from "@shared/schema";
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'path';

const sqlite = new Database('database.sqlite');
export const db = drizzle(sqlite, { schema });

// Initialize tables if they don't exist
sqlite.pragma('journal_mode = WAL');

// Insert default users if none exist
const userCount = sqlite.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
if (userCount.count === 0) {
  const currentTimestamp = Math.floor(Date.now() / 1000);
  
  // パスワードは簡単な例として平文で保存（本番では必ずハッシュ化）
  sqlite.prepare(`
    INSERT INTO users (id, username, password, first_name, last_name, roles, created_at, updated_at) VALUES 
    ('handler1', 'tanaka', 'password123', '太郎', '田中', '["handler"]', ${currentTimestamp}, ${currentTimestamp}),
    ('handler2', 'sato', 'password123', '花子', '佐藤', '["handler"]', ${currentTimestamp}, ${currentTimestamp}),
    ('approver1', 'suzuki', 'password123', '次郎', '鈴木', '["approver"]', ${currentTimestamp}, ${currentTimestamp}),
    ('approver2', 'takahashi', 'password123', '美咲', '高橋', '["handler","approver"]', ${currentTimestamp}, ${currentTimestamp}),
    ('admin1', 'tamura', 'password123', '健太', '田村', '["admin"]', ${currentTimestamp}, ${currentTimestamp})
  `).run();
  
  // Insert sample financial institutions
  sqlite.prepare(`
    INSERT INTO financial_institutions (id, bank_code, bank_name, created_at) VALUES 
    ('bank1', '0001', 'みずほ銀行', ${currentTimestamp}),
    ('bank2', '0009', '三井住友銀行', ${currentTimestamp}),
    ('bank3', '0005', '三菱UFJ銀行', ${currentTimestamp})
  `).run();
  
  const banks = sqlite.prepare('SELECT id, bank_code FROM financial_institutions').all() as Array<{id: string, bank_code: string}>;
  
  // Insert sample branches
  for (const bank of banks) {
    sqlite.prepare(`
      INSERT INTO branches (id, institution_id, branch_code, branch_name, created_at) VALUES 
      (?, ?, '001', '本店', ?),
      (?, ?, '002', '支店', ?),
      (?, ?, '003', '営業部', ?)
    `).run(
      `branch_${bank.bank_code}_001`, bank.id, currentTimestamp,
      `branch_${bank.bank_code}_002`, bank.id, currentTimestamp,
      `branch_${bank.bank_code}_003`, bank.id, currentTimestamp
    );
  }
}