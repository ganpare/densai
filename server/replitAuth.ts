// Simple username/password authentication system
import session from "express-session";
import type { Express, RequestHandler } from "express";
import { storage } from "./storage";

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  
  return session({
    secret: "development-secret-key-for-offline-use",
    resave: true,
    saveUninitialized: true,
    cookie: {
      httpOnly: true,
      secure: false, // Set to false for local development
      maxAge: sessionTtl,
    },
  });
}

export async function setupAuth(app: Express) {
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
        // セッション保存を強制
        req.session.save((err) => {
          if (err) {
            console.error("Session save error:", err);
            return res.status(500).json({ message: "セッション保存エラー" });
          }
          res.json({ success: true, user: { ...user, password: undefined } });
        });
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
  
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  
  // Refresh user data from storage
  const user = await storage.getUser(userId);
  if (!user) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  
  // Attach user to request
  (req as any).user = { claims: { sub: user.id } };
  
  next();
};
