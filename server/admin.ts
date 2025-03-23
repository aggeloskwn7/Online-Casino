import { Express, Request, Response } from "express";
import { storage } from "./storage";
import { authMiddleware, adminMiddleware, ownerMiddleware } from "./auth";
import { adminUserUpdateSchema, adminCoinAdjustmentSchema } from "@shared/schema";
import { z } from "zod";

/**
 * Set up admin-related API routes
 */
export function setupAdminRoutes(app: Express) {
  console.log("Setting up admin API routes...");

  // === USER MANAGEMENT ENDPOINTS ===
  
  // Get all users (admin only)
  app.get("/api/admin/users", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      // Support pagination
      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      const offset = (page - 1) * limit;
      
      // Get users with pagination
      const users = await storage.getAllUsers(limit, offset);
      
      // Get total user count for pagination
      const totalUsers = await storage.getUserCount();
      
      // Remove passwords from user objects before sending
      const safeUsers = users.map(user => {
        const { password, ...safeUser } = user;
        return safeUser;
      });
      
      res.json({
        users: safeUsers,
        pagination: {
          page,
          limit,
          totalUsers,
          totalPages: Math.ceil(totalUsers / limit)
        }
      });
    } catch (error) {
      console.error("Error fetching users:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ message: "Failed to fetch users", error: errorMessage });
    }
  });
  
  // Search users by username (admin only)
  app.get("/api/admin/users/search", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const searchTerm = req.query.q as string;
      
      if (!searchTerm || searchTerm.length < 2) {
        return res.status(400).json({ message: "Search term must be at least 2 characters" });
      }
      
      const users = await storage.searchUsers(searchTerm);
      
      // Remove passwords from user objects before sending
      const safeUsers = users.map(user => {
        const { password, ...safeUser } = user;
        return safeUser;
      });
      
      res.json({ users: safeUsers });
    } catch (error) {
      console.error("Error searching users:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ message: "Failed to search users", error: errorMessage });
    }
  });

  // Update user admin status (owner only)
  app.patch("/api/admin/users/:userId/admin-status", authMiddleware, ownerMiddleware, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      
      // Validate request body against schema
      const updateData = adminUserUpdateSchema.parse(req.body);
      
      // Prevent owner from modifying their own status
      if (userId === req.user?.id) {
        return res.status(403).json({ message: "Cannot modify your own admin status" });
      }
      
      // Update user admin status
      const updatedUser = await storage.updateUserAdminStatus(userId, updateData);
      
      // Remove password from user object before sending
      const { password, ...safeUser } = updatedUser;
      
      res.json({ user: safeUser });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input data", errors: error.errors });
      }
      
      console.error("Error updating user admin status:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ message: "Failed to update user admin status", error: errorMessage });
    }
  });
  
  // Ban or unban a user (admin only)
  app.patch("/api/admin/users/:userId/ban", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const { isBanned } = req.body;
      
      if (typeof isBanned !== 'boolean') {
        return res.status(400).json({ message: "isBanned field must be a boolean" });
      }
      
      // Prevent admin from banning themselves or an owner
      if (userId === req.user?.id) {
        return res.status(403).json({ message: "Cannot ban yourself" });
      }
      
      // Check if target user is an owner
      const targetUser = await storage.getUser(userId);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      if (targetUser.isOwner) {
        return res.status(403).json({ message: "Cannot ban an owner" });
      }
      
      // Update user ban status
      const updatedUser = await storage.updateUserAdminStatus(userId, { isBanned });
      
      // Remove password from user object before sending
      const { password, ...safeUser } = updatedUser;
      
      res.json({ user: safeUser });
    } catch (error) {
      console.error("Error updating user ban status:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ message: "Failed to update user ban status", error: errorMessage });
    }
  });

  // === COIN MANAGEMENT ENDPOINTS ===
  
  // Adjust user balance (admin only)
  app.post("/api/admin/users/:userId/adjust-balance", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      
      // Validate request body
      const { amount, reason } = adminCoinAdjustmentSchema.omit({ username: true }).parse(req.body);
      
      // Make sure target user exists
      const targetUser = await storage.getUser(userId);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Adjust user balance
      const updatedUser = await storage.adjustUserBalance(
        userId,
        amount,
        req.user!.id,
        reason
      );
      
      // Remove password from user object before sending
      const { password, ...safeUser } = updatedUser;
      
      res.json({ user: safeUser });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input data", errors: error.errors });
      }
      
      console.error("Error adjusting user balance:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ message: "Failed to adjust user balance", error: errorMessage });
    }
  });
  
  // Get coin transaction history (admin only)
  app.get("/api/admin/coin-transactions", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const userId = req.query.userId ? parseInt(req.query.userId as string) : undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      
      const transactions = await storage.getCoinTransactions(userId, limit);
      
      res.json({ transactions });
    } catch (error) {
      console.error("Error fetching coin transactions:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ message: "Failed to fetch coin transactions", error: errorMessage });
    }
  });
  
  // Get user transactions (admin only)
  app.get("/api/admin/users/:userId/transactions", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      
      // Make sure target user exists
      const targetUser = await storage.getUser(userId);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const transactions = await storage.getUserTransactions(userId, limit);
      
      res.json({ transactions });
    } catch (error) {
      console.error("Error fetching user transactions:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ message: "Failed to fetch user transactions", error: errorMessage });
    }
  });
}