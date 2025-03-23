import { Express, Request, Response } from "express";
import { storage } from "./storage";
import { authMiddleware, adminMiddleware, ownerMiddleware } from "./auth";
import { 
  adminUserUpdateSchema, 
  adminCoinAdjustmentSchema,
  adminMassBonusSchema,
  adminAnnouncementSchema,
  adminGameConfigSchema,
  adminAssignSubscriptionSchema
} from "@shared/schema";
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

  // === MASS BONUS ENDPOINTS ===
  
  // Send bonus to all users (admin only)
  app.post("/api/admin/mass-bonus", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      // Validate request body
      const bonusData = adminMassBonusSchema.parse(req.body);
      
      // Get all users
      const users = await storage.getAllUsers(1000, 0); // Get up to 1000 users
      const adminId = req.user!.id;
      
      // Track success and failures
      const results = {
        success: 0,
        failed: 0,
        totalUsers: users.length
      };
      
      // Apply bonus to each user
      for (const user of users) {
        try {
          // Skip banned users
          if (user.isBanned) continue;
          
          // Add bonus to user's balance
          await storage.adjustUserBalance(
            user.id,
            bonusData.amount,
            adminId,
            bonusData.reason
          );
          
          results.success++;
        } catch (err) {
          console.error(`Failed to add bonus to user ${user.id}:`, err);
          results.failed++;
        }
      }
      
      // Store the announcement about the bonus
      const announcement = {
        title: "Bonus coins added!",
        message: bonusData.message,
        type: "success" as const,
        duration: 60,
        isPinned: true
      };
      
      await storage.createAnnouncement(announcement, adminId);
      
      res.json({ 
        message: "Mass bonus processed", 
        results 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input data", errors: error.errors });
      }
      
      console.error("Error processing mass bonus:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ message: "Failed to process mass bonus", error: errorMessage });
    }
  });
  
  // === ANNOUNCEMENTS ENDPOINTS ===
  
  // Create an announcement (admin only)
  app.post("/api/admin/announcements", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      // Validate request body
      const announcementData = adminAnnouncementSchema.parse(req.body);
      
      // Create announcement
      const announcement = await storage.createAnnouncement(announcementData, req.user!.id);
      
      res.status(201).json({ announcement });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input data", errors: error.errors });
      }
      
      console.error("Error creating announcement:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ message: "Failed to create announcement", error: errorMessage });
    }
  });
  
  // Get all announcements (admin only)
  app.get("/api/admin/announcements", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const announcements = await storage.getAnnouncements(true); // Include expired
      
      res.json({ announcements });
    } catch (error) {
      console.error("Error fetching announcements:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ message: "Failed to fetch announcements", error: errorMessage });
    }
  });
  
  // Delete an announcement (admin only)
  app.delete("/api/admin/announcements/:announcementId", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const announcementId = parseInt(req.params.announcementId);
      
      await storage.deleteAnnouncement(announcementId);
      
      res.status(204).end();
    } catch (error) {
      console.error("Error deleting announcement:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ message: "Failed to delete announcement", error: errorMessage });
    }
  });
  
  // === GAME CONFIG ENDPOINTS ===
  
  // Get current game configuration (admin only)
  app.get("/api/admin/game-config/:gameType", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const gameType = req.params.gameType;
      
      // Validate game type
      if (!['slots', 'dice', 'crash', 'roulette', 'blackjack'].includes(gameType)) {
        return res.status(400).json({ message: "Invalid game type" });
      }
      
      const config = await storage.getGameConfig(gameType);
      
      res.json({ config });
    } catch (error) {
      console.error("Error fetching game config:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ message: "Failed to fetch game config", error: errorMessage });
    }
  });
  
  // Update game configuration (admin only)
  app.patch("/api/admin/game-config", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      // Validate request body
      const configData = adminGameConfigSchema.parse(req.body);
      
      // Update game configuration
      const updatedConfig = await storage.updateGameConfig(
        configData.gameType,
        configData.config
      );
      
      res.json({ config: updatedConfig });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input data", errors: error.errors });
      }
      
      console.error("Error updating game config:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ message: "Failed to update game config", error: errorMessage });
    }
  });
  
  // === SUPPORT INBOX ENDPOINTS ===
  
  // Get all support tickets (admin only)
  app.get("/api/admin/support", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      
      const tickets = await storage.getSupportTickets(status, page, limit);
      
      res.json({ tickets });
    } catch (error) {
      console.error("Error fetching support tickets:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ message: "Failed to fetch support tickets", error: errorMessage });
    }
  });
  
  // Get a specific support ticket (admin only)
  app.get("/api/admin/support/:ticketId", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const ticketId = parseInt(req.params.ticketId);
      
      const ticket = await storage.getSupportTicket(ticketId);
      
      if (!ticket) {
        return res.status(404).json({ message: "Support ticket not found" });
      }
      
      res.json({ ticket });
    } catch (error) {
      console.error("Error fetching support ticket:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ message: "Failed to fetch support ticket", error: errorMessage });
    }
  });
  
  // Reply to a support ticket (admin only)
  app.post("/api/admin/support/:ticketId/reply", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const ticketId = parseInt(req.params.ticketId);
      const { message } = req.body;
      
      if (!message || typeof message !== 'string' || message.trim().length === 0) {
        return res.status(400).json({ message: "Reply message is required" });
      }
      
      const ticket = await storage.getSupportTicket(ticketId);
      
      if (!ticket) {
        return res.status(404).json({ message: "Support ticket not found" });
      }
      
      // Add reply to the ticket
      const updatedTicket = await storage.addSupportTicketReply(
        ticketId,
        req.user!.id,
        message,
        true // isAdmin
      );
      
      res.json({ ticket: updatedTicket });
    } catch (error) {
      console.error("Error replying to support ticket:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ message: "Failed to reply to support ticket", error: errorMessage });
    }
  });
  
  // Update support ticket status (admin only)
  app.patch("/api/admin/support/:ticketId/status", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const ticketId = parseInt(req.params.ticketId);
      const { status } = req.body;
      
      if (!status || !['open', 'in-progress', 'resolved', 'closed'].includes(status)) {
        return res.status(400).json({ message: "Valid status is required (open, in-progress, resolved, closed)" });
      }
      
      const ticket = await storage.updateSupportTicketStatus(ticketId, status);
      
      if (!ticket) {
        return res.status(404).json({ message: "Support ticket not found" });
      }
      
      res.json({ ticket });
    } catch (error) {
      console.error("Error updating support ticket status:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ message: "Failed to update support ticket status", error: errorMessage });
    }
  });
}