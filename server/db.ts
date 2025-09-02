import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from "@shared/schema";
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'path';

const sqlite = new Database('database.sqlite');
export const db = drizzle(sqlite, { schema });

// Initialize tables if they don't exist
sqlite.pragma('journal_mode = WAL');

// Create tables manually since we're using SQLite
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    sid TEXT PRIMARY KEY,
    sess TEXT NOT NULL,
    expire INTEGER NOT NULL
  );
  
  CREATE INDEX IF NOT EXISTS IDX_session_expire ON sessions(expire);
  
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    profile_image_url TEXT,
    roles TEXT NOT NULL DEFAULT '["handler"]',
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch())
  );
  
  CREATE TABLE IF NOT EXISTS financial_institutions (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    bank_code TEXT NOT NULL UNIQUE,
    bank_name TEXT NOT NULL,
    created_at INTEGER DEFAULT (unixepoch())
  );
  
  CREATE TABLE IF NOT EXISTS branches (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    institution_id TEXT NOT NULL,
    branch_code TEXT NOT NULL,
    branch_name TEXT NOT NULL,
    created_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY(institution_id) REFERENCES financial_institutions(id)
  );
  
  CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    report_number TEXT NOT NULL UNIQUE,
    user_number TEXT NOT NULL,
    bank_code TEXT NOT NULL,
    branch_code TEXT NOT NULL,
    company_name TEXT NOT NULL,
    contact_person_name TEXT NOT NULL,
    handler_id TEXT NOT NULL,
    approver_id TEXT,
    inquiry_content TEXT NOT NULL,
    response_content TEXT NOT NULL,
    escalation_required INTEGER NOT NULL DEFAULT 0,
    escalation_reason TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    rejection_reason TEXT,
    approved_at INTEGER,
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY(handler_id) REFERENCES users(id),
    FOREIGN KEY(approver_id) REFERENCES users(id)
  );
`);

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
    INSERT INTO financial_institutions (bank_code, bank_name) VALUES 
    ('0001', 'みずほ銀行'),
    ('0009', '三井住友銀行'),
    ('0005', '三菱UFJ銀行')
  `).run();
  
  const banks = sqlite.prepare('SELECT id, bank_code FROM financial_institutions').all() as Array<{id: string, bank_code: string}>;
  
  // Insert sample branches
  for (const bank of banks) {
    sqlite.prepare(`
      INSERT INTO branches (institution_id, branch_code, branch_name) VALUES 
      (?, '001', '本店'),
      (?, '002', '支店'),
      (?, '003', '営業部')
    `).run(bank.id, bank.id, bank.id);
  }
}