import { 
  users, 
  transactions, 
  coinTransactions, 
  User, 
  InsertUser, 
  Transaction, 
  InsertTransaction, 
  CoinTransaction, 
  InsertCoinTransaction,
  AdminUserUpdate,
  AdminAnnouncement,
  AdminGameConfig,
  AdminMassBonus
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql, like } from "drizzle-orm";

// modify the interface with any CRUD methods
// you might need
export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserBalance(userId: number, newBalance: number): Promise<User>;
  incrementPlayCount(userId: number): Promise<User>;
  getUserPlayCount(userId: number): Promise<number>;
  updateUserLastLogin(userId: number): Promise<User>;
  
  // Transaction operations
  getUserTransactions(userId: number, limit?: number): Promise<Transaction[]>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  
  // Admin operations
  getAllUsers(limit?: number, offset?: number): Promise<User[]>;
  searchUsers(searchTerm: string): Promise<User[]>;
  updateUserAdminStatus(userId: number, updates: AdminUserUpdate): Promise<User>;
  getUserCount(): Promise<number>;
  
  // Admin coin operations
  adjustUserBalance(userId: number, amount: number, adminId: number, reason: string): Promise<User>;
  getCoinTransactions(userId?: number, limit?: number): Promise<CoinTransaction[]>;
  createCoinTransaction(transaction: InsertCoinTransaction): Promise<CoinTransaction>;
  
  // Announcement operations
  createAnnouncement(announcement: AdminAnnouncement, adminId: number): Promise<any>;
  getAnnouncements(includeExpired?: boolean): Promise<any[]>;
  deleteAnnouncement(id: number): Promise<void>;
  
  // Game config operations
  getGameConfig(gameType: string): Promise<any>;
  updateGameConfig(gameType: string, config: any): Promise<any>;
  
  // Support ticket operations
  getSupportTickets(status?: string, page?: number, limit?: number): Promise<any[]>;
  getSupportTicket(id: number): Promise<any | undefined>;
  createSupportTicket(userId: number, subject: string, message: string): Promise<any>;
  addSupportTicketReply(ticketId: number, userId: number, message: string, isAdmin: boolean): Promise<any>;
  updateSupportTicketStatus(ticketId: number, status: string): Promise<any | undefined>;
}

export class DatabaseStorage implements IStorage {
  // === USER OPERATIONS ===
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    // Special case for username: aggeloskwn, make them the owner
    let isAdmin = false;
    let isOwner = false;
    
    if (insertUser.username === 'aggeloskwn') {
      isAdmin = true;
      isOwner = true;
    }
    
    const [user] = await db
      .insert(users)
      .values({
        ...insertUser,
        balance: "10000", // Default starting balance
        isAdmin,
        isOwner,
      })
      .returning();
    return user;
  }

  async updateUserBalance(userId: number, newBalance: number): Promise<User> {
    const [updatedUser] = await db
      .update(users)
      .set({ balance: String(newBalance) })
      .where(eq(users.id, userId))
      .returning();
    
    if (!updatedUser) {
      throw new Error("User not found");
    }
    
    return updatedUser;
  }
  
  async updateUserLastLogin(userId: number): Promise<User> {
    const [updatedUser] = await db
      .update(users)
      .set({ lastLogin: new Date() })
      .where(eq(users.id, userId))
      .returning();
    
    if (!updatedUser) {
      throw new Error("User not found");
    }
    
    return updatedUser;
  }

  // === TRANSACTION OPERATIONS ===
  async getUserTransactions(userId: number, limit = 10): Promise<Transaction[]> {
    const userTransactions = await db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, userId))
      .orderBy(desc(transactions.timestamp))
      .limit(limit);
    
    return userTransactions;
  }

  async createTransaction(insertTransaction: InsertTransaction): Promise<Transaction> {
    const [transaction] = await db
      .insert(transactions)
      .values(insertTransaction)
      .returning();
    
    return transaction;
  }
  
  async incrementPlayCount(userId: number): Promise<User> {
    // Get current user to access playCount
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }
    
    // Increment playCount by 1
    const newPlayCount = (user.playCount || 0) + 1;
    
    // Update the user's playCount
    const [updatedUser] = await db
      .update(users)
      .set({ playCount: newPlayCount })
      .where(eq(users.id, userId))
      .returning();
    
    return updatedUser;
  }
  
  async getUserPlayCount(userId: number): Promise<number> {
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }
    
    return user.playCount || 0;
  }
  
  // === ADMIN OPERATIONS ===
  async getAllUsers(limit = 50, offset = 0): Promise<User[]> {
    const allUsers = await db
      .select()
      .from(users)
      .orderBy(users.id)
      .limit(limit)
      .offset(offset);
    
    return allUsers;
  }
  
  async searchUsers(searchTerm: string): Promise<User[]> {
    const matchedUsers = await db
      .select()
      .from(users)
      .where(like(users.username, `%${searchTerm}%`))
      .orderBy(users.username)
      .limit(50);
    
    return matchedUsers;
  }
  
  async updateUserAdminStatus(userId: number, updates: AdminUserUpdate): Promise<User> {
    const [updatedUser] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, userId))
      .returning();
    
    if (!updatedUser) {
      throw new Error("User not found");
    }
    
    return updatedUser;
  }
  
  async getUserCount(): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(users);
    
    return result[0].count;
  }
  
  // === ADMIN COIN OPERATIONS ===
  async adjustUserBalance(userId: number, amount: number, adminId: number, reason: string): Promise<User> {
    // Get current user to access current balance
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }
    
    // Calculate new balance
    const currentBalance = parseFloat(user.balance.toString());
    const newBalance = currentBalance + amount;
    
    // Don't allow negative balances
    if (newBalance < 0) {
      throw new Error("Operation would result in negative balance");
    }
    
    // Update user balance
    const updatedUser = await this.updateUserBalance(userId, newBalance);
    
    // Create coin transaction record
    await this.createCoinTransaction({
      userId,
      amount: amount.toString(),
      reason,
      adminId,
    });
    
    return updatedUser;
  }
  
  async getCoinTransactions(userId?: number, limit = 50): Promise<CoinTransaction[]> {
    let query = db
      .select()
      .from(coinTransactions)
      .orderBy(desc(coinTransactions.timestamp))
      .limit(limit);
    
    if (userId !== undefined) {
      return await db
        .select()
        .from(coinTransactions)
        .where(eq(coinTransactions.userId, userId))
        .orderBy(desc(coinTransactions.timestamp))
        .limit(limit);
    }
    
    return await query;
  }
  
  async createCoinTransaction(transaction: InsertCoinTransaction): Promise<CoinTransaction> {
    const [coinTransaction] = await db
      .insert(coinTransactions)
      .values(transaction)
      .returning();
    
    return coinTransaction;
  }
  
  // === ANNOUNCEMENT OPERATIONS ===
  // Since we don't have a dedicated table for announcements yet, we'll store in memory
  private announcements: any[] = [];
  private announcementIdCounter = 1;
  
  async createAnnouncement(announcement: AdminAnnouncement, adminId: number): Promise<any> {
    const newAnnouncement = {
      id: this.announcementIdCounter++,
      ...announcement,
      adminId,
      createdAt: new Date(),
      expiresAt: announcement.isPinned 
        ? null // Pinned announcements don't expire
        : new Date(Date.now() + announcement.duration * 1000) // Convert seconds to milliseconds
    };
    
    this.announcements.push(newAnnouncement);
    return newAnnouncement;
  }
  
  async getAnnouncements(includeExpired = false): Promise<any[]> {
    const now = new Date();
    
    if (includeExpired) {
      return this.announcements;
    }
    
    // Return only active announcements
    return this.announcements.filter(announcement => {
      return announcement.isPinned || 
             !announcement.expiresAt || 
             announcement.expiresAt > now;
    });
  }
  
  async deleteAnnouncement(id: number): Promise<void> {
    const index = this.announcements.findIndex(a => a.id === id);
    if (index !== -1) {
      this.announcements.splice(index, 1);
    }
  }
  
  // === GAME CONFIG OPERATIONS ===
  // Since we don't have a dedicated table yet, we'll store in memory
  private gameConfigs: Record<string, any> = {
    slots: {
      winChance: 0.85, // 85% chance of winning
      minWinMultiplier: 0.2,
      maxWinMultiplier: 50,
      paylineCount: 5
    },
    dice: {
      houseEdge: 0.01, // 1% house edge
      forceLossChance: 0.2 // 20% chance to force a loss
    },
    crash: {
      immediateFailChance: 0.1, // 10% chance of crash at start
      minMultiplier: 1.01,
      maxMultiplier: 100,
      growthFactor: 0.05
    },
    roulette: {
      // Standard roulette odds
    },
    blackjack: {
      deckCount: 6,
      shuffleThreshold: 0.25, // Reshuffle when 25% of cards remain
      dealerStandsOnSoft17: true,
      blackjackPayout: 1.5 // 3:2 payout for blackjack
    }
  };
  
  async getGameConfig(gameType: string): Promise<any> {
    return this.gameConfigs[gameType] || {};
  }
  
  async updateGameConfig(gameType: string, config: any): Promise<any> {
    this.gameConfigs[gameType] = {
      ...this.gameConfigs[gameType],
      ...config
    };
    
    return this.gameConfigs[gameType];
  }
  
  // === SUPPORT TICKET OPERATIONS ===
  // Since we don't have a dedicated table yet, we'll store in memory
  private supportTickets: any[] = [];
  private ticketIdCounter = 1;
  
  async getSupportTickets(status?: string, page = 1, limit = 20): Promise<any[]> {
    let filteredTickets = this.supportTickets;
    
    if (status) {
      filteredTickets = filteredTickets.filter(ticket => ticket.status === status);
    }
    
    // Sort by most recent first
    filteredTickets.sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
    
    // Apply pagination
    const offset = (page - 1) * limit;
    return filteredTickets.slice(offset, offset + limit);
  }
  
  async getSupportTicket(id: number): Promise<any | undefined> {
    return this.supportTickets.find(ticket => ticket.id === id);
  }
  
  async createSupportTicket(userId: number, subject: string, message: string): Promise<any> {
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }
    
    const newTicket = {
      id: this.ticketIdCounter++,
      userId,
      username: user.username,
      subject,
      status: 'open',
      createdAt: new Date(),
      updatedAt: new Date(),
      messages: [
        {
          id: 1,
          userId,
          username: user.username,
          message,
          isAdmin: false,
          timestamp: new Date()
        }
      ]
    };
    
    this.supportTickets.push(newTicket);
    return newTicket;
  }
  
  async addSupportTicketReply(ticketId: number, userId: number, message: string, isAdmin: boolean): Promise<any> {
    const ticketIndex = this.supportTickets.findIndex(ticket => ticket.id === ticketId);
    
    if (ticketIndex === -1) {
      throw new Error("Support ticket not found");
    }
    
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }
    
    const ticket = this.supportTickets[ticketIndex];
    
    // Add new message
    const newMessage = {
      id: ticket.messages.length + 1,
      userId,
      username: user.username,
      message,
      isAdmin,
      timestamp: new Date()
    };
    
    ticket.messages.push(newMessage);
    ticket.updatedAt = new Date();
    
    // If admin is replying to an 'open' ticket, change status to 'in-progress'
    if (isAdmin && ticket.status === 'open') {
      ticket.status = 'in-progress';
    }
    
    return ticket;
  }
  
  async updateSupportTicketStatus(ticketId: number, status: string): Promise<any | undefined> {
    const ticketIndex = this.supportTickets.findIndex(ticket => ticket.id === ticketId);
    
    if (ticketIndex === -1) {
      return undefined;
    }
    
    this.supportTickets[ticketIndex].status = status;
    this.supportTickets[ticketIndex].updatedAt = new Date();
    
    return this.supportTickets[ticketIndex];
  }
}

// Switch from MemStorage to DatabaseStorage
export const storage = new DatabaseStorage();
