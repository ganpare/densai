// Simplified authentication system for offline local network use
import session from "express-session";
import type { Express, RequestHandler } from "express";
import { storage } from "./storage";

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  
  return session({
    secret: "development-secret-key-for-offline-use",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false, // Set to false for local development
      maxAge: sessionTtl,
    },
  });
}

export async function setupAuth(app: Express) {
  app.use(getSession());

  // Simple login endpoint for offline use - auto-login as creator
  app.get("/api/login", async (req, res) => {
    // For offline demo, automatically log in as the creator user
    const user = await storage.getUser("creator1");
    if (user) {
      (req.session as any).user = user;
      res.redirect("/");
    } else {
      res.status(500).json({ message: "Demo user not found" });
    }
  });

  // Logout endpoint
  app.get("/api/logout", (req, res) => {
    req.session.destroy((err) => {
      res.redirect("/");
    });
  });

  // Switch user endpoint for testing (offline only)
  app.post("/api/switch-user", async (req, res) => {
    const { userId } = req.body;
    const user = await storage.getUser(userId);
    if (user) {
      (req.session as any).user = user;
      res.json({ success: true, user });
    } else {
      res.status(404).json({ message: "User not found" });
    }
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const sessionUser = (req.session as any).user;
  
  if (!sessionUser) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  
  // Refresh user data from storage
  const user = await storage.getUser(sessionUser.id);
  if (!user) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  
  // Attach user to request
  (req as any).user = { claims: { sub: user.id } };
  
  next();
};
