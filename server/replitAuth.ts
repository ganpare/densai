// Simple username/password authentication system
import session from "express-session";
import type { Express, RequestHandler } from "express";
import { storage } from "./storage";

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  
  return session({
    secret: "development-secret-key-for-offline-use",
    resave: true, // セッションを強制保存
    saveUninitialized: false, // 空のセッションは保存しない
    rolling: true, // アクセス毎にexpire時間をリセット
    cookie: {
      httpOnly: false, // JavaScriptからアクセス可能
      secure: false, // HTTP環境用
      sameSite: false, // 最も緩い設定
      maxAge: sessionTtl,
      path: '/', // パスを明示的に指定
    },
    name: 'connect.sid', // デフォルトのセッション名に戻す
  });
}

export async function setupAuth(app: Express) {
  // Replitプロキシを信頼
  app.set('trust proxy', 1);
  
  // セッションミドルウェア
  app.use(getSession());

  // Login endpoint with username/password
  app.post("/api/auth/login", async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ message: "ユーザーIDとパスワードが必要です" });
    }

    try {
      const user = await storage.getUserByUsername(username);
      if (user && user.password === password) {
        // セッションに保存
        (req.session as any).userId = user.id;
        (req.session as any).user = user; // ユーザー情報も保存
        
        // セッション保存を強制実行
        req.session.save((err) => {
          if (err) {
            console.error('Session save error:', err);
          } else {
            console.log('✅ Session saved successfully for user:', user.id);
          }
        });
        
        console.log('Login - Session ID:', req.sessionID, 'Setting userId:', user.id);
        console.log('Session after setting:', req.session);
        console.log('🍪 Cookie will be set with name:', 'connect.sid');
        
        res.json({ success: true, user: { ...user, password: undefined } });
      } else {
        res.status(401).json({ message: "ユーザーIDまたはパスワードが正しくありません" });
      }
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "ログインエラーが発生しました" });
    }
  });

  // Logout endpoint
  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error("Logout error:", err);
      }
      res.json({ success: true });
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const userId = (req.session as any).userId;
  const sessionUser = (req.session as any).user;
  
  console.log('Auth check - Session ID:', req.sessionID);
  console.log('Session contents:', req.session);
  console.log('User ID in session:', userId);
  
  if (!userId && !sessionUser) {
    console.log('No user found in session');
    return res.status(401).json({ message: "Unauthorized" });
  }
  
  // セッションにユーザー情報がある場合はそれを使用
  let user = sessionUser;
  if (!user && userId) {
    user = await storage.getUser(userId);
    if (!user) {
      console.log('User not found in database:', userId);
      return res.status(401).json({ message: "Unauthorized" });
    }
  }
  
  console.log('Authentication successful for user:', user.id);
  // Attach user to request
  (req as any).user = { claims: { sub: user.id } };
  
  next();
};
