import { Request, Response, NextFunction } from "express";
import { storage } from "./storage";

// Middleware to check if user is an admin
export async function isAdmin(req: any, res: Response, next: NextFunction) {
  try {
    if (!req.user || !req.user.claims || !req.user.claims.sub) {
      return res.status(401).json({ message: "Unauthorized - not authenticated" });
    }

    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.isAdmin) {
      return res.status(403).json({ message: "Forbidden - admin access required" });
    }

    // Attach user to request for later use
    req.adminUser = user;
    next();
  } catch (error) {
    console.error("[ADMIN AUTH] Error checking admin status:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}
