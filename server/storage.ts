import { 
  users, 
  transactions, 
  coinTransactions, 
  payments,
  loginRewards,
  subscriptions,
  banAppeals,
  supportTickets,
  ticketMessages,
  User, 
  InsertUser, 
  Transaction, 
  InsertTransaction, 
  CoinTransaction, 
  InsertCoinTransaction,
  AdminUserUpdate,
  AdminBanUser,
  BanAppealType,
  InsertBanAppeal,
  AdminBanAppealResponse,
  AdminAnnouncement,
  SupportTicket,
  InsertSupportTicket,
  TicketMessage,
  InsertTicketMessage,
  AdminGameConfig,
  AdminMassBonus,
  Payment,
  InsertPayment,
  LoginReward,
  InsertLoginReward,
  Subscription,
  InsertSubscription,
  SubscriptionPlan
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, asc, sql, like, and, or, isNull } from "drizzle-orm";

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
  updateLoginStreak(userId: number, streak: number): Promise<User>;
  checkDailyRewardStatus(userId: number): Promise<boolean>;
  
  // Analytics operations
  getActiveUsersCount(startDate: Date, endDate: Date): Promise<number>;
  getCoinsSpent(startDate: Date, endDate: Date): Promise<number>;
  getCoinsEarned(startDate: Date, endDate: Date): Promise<number>;
  getMostPlayedGame(startDate: Date, endDate: Date): Promise<{gameType: string, count: number}>;
  getGameDistribution(startDate: Date, endDate: Date): Promise<{gameType: string, count: number}[]>;
  getDailyNewUsers(): Promise<{date: string, count: number}[]>;
  getDailyTransactions(): Promise<{date: string, bets: number, wins: number}[]>;
  getSubscriptionStats(): Promise<{tier: string, count: number}[]>;
  
  // Transaction operations
  getUserTransactions(userId: number, limit?: number): Promise<Transaction[]>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  
  // Login reward operations
  createLoginReward(reward: InsertLoginReward): Promise<LoginReward>;
  getUserLoginRewards(userId: number, limit?: number): Promise<LoginReward[]>;
  getRewardAmountForDay(day: number): Promise<number>;
  
  // Admin operations
  getAllUsers(limit?: number, offset?: number): Promise<User[]>;
  searchUsers(searchTerm: string): Promise<User[]>;
  updateUserAdminStatus(userId: number, updates: AdminUserUpdate): Promise<User>;
  getUserCount(): Promise<number>;
  
  // Admin coin operations
  adjustUserBalance(userId: number, amount: number, adminId: number, reason: string): Promise<User>;
  getCoinTransactions(userId?: number, limit?: number): Promise<CoinTransaction[]>;
  createCoinTransaction(transaction: InsertCoinTransaction): Promise<CoinTransaction>;
  
  // Payment operations
  createPayment(payment: InsertPayment): Promise<Payment>;
  getUserPayments(userId: number, limit?: number): Promise<Payment[]>;
  getPaymentBySessionId(sessionId: string): Promise<Payment | undefined>;
  updatePaymentStatus(id: number, status: string): Promise<Payment>;
  
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
  
  // Subscription operations
  createSubscription(subscription: InsertSubscription): Promise<Subscription>;
  getUserSubscription(userId: number): Promise<Subscription | undefined>;
  findSubscriptionByStripeId(stripeId: string): Promise<Subscription | undefined>;
  updateSubscription(id: number, updates: Partial<Subscription>): Promise<Subscription>;
  cancelSubscription(id: number): Promise<Subscription>;
  getSubscriptionPlans(): Promise<SubscriptionPlan[]>;
  updateUserSubscriptionTier(userId: number, tier: string | null): Promise<User>;
  assignSubscriptionToUser(userId: number, tier: string, durationMonths: number, adminId: number, reason: string): Promise<Subscription>;
  
  // Ban management operations
  banUser(userId: number, adminId: number, reason: string): Promise<User>;
  unbanUser(userId: number): Promise<User>;
  getBannedUsers(limit?: number, offset?: number): Promise<User[]>;
  
  // Ban appeal operations
  createBanAppeal(userId: number, reason: string): Promise<BanAppealType>;
  getBanAppeals(status?: string, limit?: number, offset?: number): Promise<BanAppealType[]>;
  getUserBanAppeal(userId: number): Promise<BanAppealType | undefined>;
  respondToBanAppeal(appealId: number, adminId: number, status: string, response: string): Promise<BanAppealType>;
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
  
  async updateLoginStreak(userId: number, streak: number): Promise<User> {
    const [updatedUser] = await db
      .update(users)
      .set({ 
        currentLoginStreak: streak,
        lastRewardDate: new Date()
      })
      .where(eq(users.id, userId))
      .returning();
    
    if (!updatedUser) {
      throw new Error("User not found");
    }
    
    return updatedUser;
  }
  
  async checkDailyRewardStatus(userId: number): Promise<boolean> {
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }
    
    // If no lastRewardDate, they have never claimed a reward
    if (!user.lastRewardDate) {
      return true;
    }
    
    const lastReward = new Date(user.lastRewardDate);
    const now = new Date();
    
    // Check if the last reward was claimed on a different day
    return lastReward.toDateString() !== now.toDateString();
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
  
  // === PAYMENT OPERATIONS ===
  async createPayment(payment: InsertPayment): Promise<Payment> {
    const [newPayment] = await db
      .insert(payments)
      .values(payment)
      .returning();
    
    return newPayment;
  }
  
  async getUserPayments(userId: number, limit = 10): Promise<Payment[]> {
    const userPayments = await db
      .select()
      .from(payments)
      .where(eq(payments.userId, userId))
      .orderBy(desc(payments.createdAt))
      .limit(limit);
    
    return userPayments;
  }
  
  async getPaymentBySessionId(sessionId: string): Promise<Payment | undefined> {
    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.stripeSessionId, sessionId));
    
    return payment;
  }
  
  async updatePaymentStatus(id: number, status: string): Promise<Payment> {
    const [updatedPayment] = await db
      .update(payments)
      .set({ 
        status, 
        updatedAt: new Date() 
      })
      .where(eq(payments.id, id))
      .returning();
    
    if (!updatedPayment) {
      throw new Error("Payment not found");
    }
    
    return updatedPayment;
  }
  
  // === LOGIN REWARD OPERATIONS ===
  async createLoginReward(reward: InsertLoginReward): Promise<LoginReward> {
    const [newReward] = await db
      .insert(loginRewards)
      .values(reward)
      .returning();
    
    return newReward;
  }
  
  async getUserLoginRewards(userId: number, limit = 30): Promise<LoginReward[]> {
    const rewards = await db
      .select()
      .from(loginRewards)
      .where(eq(loginRewards.userId, userId))
      .orderBy(desc(loginRewards.createdAt))
      .limit(limit);
    
    return rewards;
  }
  
  async getRewardAmountForDay(day: number): Promise<number> {
    // Return increasing rewards for consecutive days
    // Starting with 100 coins on day 1, up to 3000 coins on day 30
    if (day <= 0 || day > 30) {
      throw new Error("Invalid day number for login rewards");
    }
    
    // Basic formula: 100 + (day - 1) * 100
    // This gives: Day 1: 100, Day 2: 200, ... Day 30: 3000
    const baseReward = 100 + (day - 1) * 100;
    
    // Add bonus for milestone days
    let bonusMultiplier = 1;
    if (day % 7 === 0) {
      // Weekly milestone (days 7, 14, 21, 28) - 2x bonus
      bonusMultiplier = 2;
    } else if (day === 30) {
      // Final milestone (day 30) - 3x bonus
      bonusMultiplier = 3;
    } else if (day % 5 === 0) {
      // Every 5 days milestone (days 5, 10, 15, 20, 25) - 1.5x bonus
      bonusMultiplier = 1.5;
    }
    
    return baseReward * bonusMultiplier;
  }
  
  // === ANALYTICS OPERATIONS ===
  async getActiveUsersCount(startDate: Date, endDate: Date): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(and(
        sql`"lastLogin" IS NOT NULL`,
        sql`"lastLogin" >= ${startDate}`,
        sql`"lastLogin" <= ${endDate}`
      ));
    
    return result[0].count;
  }
  
  async getCoinsSpent(startDate: Date, endDate: Date): Promise<number> {
    const result = await db
      .select({
        total: sql<string>`COALESCE(SUM(CAST("amount" AS NUMERIC)), 0)`
      })
      .from(transactions)
      .where(and(
        sql`"gameType" IS NOT NULL`,
        sql`"timestamp" >= ${startDate}`,
        sql`"timestamp" <= ${endDate}`,
        sql`"isWin" = false`
      ));
    
    return parseFloat(result[0].total);
  }
  
  async getCoinsEarned(startDate: Date, endDate: Date): Promise<number> {
    const result = await db
      .select({
        total: sql<string>`COALESCE(SUM(CAST("payout" AS NUMERIC)), 0)`
      })
      .from(transactions)
      .where(and(
        sql`"gameType" IS NOT NULL`,
        sql`"timestamp" >= ${startDate}`,
        sql`"timestamp" <= ${endDate}`,
        sql`"isWin" = true`
      ));
    
    return parseFloat(result[0].total);
  }
  
  async getMostPlayedGame(startDate: Date, endDate: Date): Promise<{gameType: string, count: number}> {
    const result = await db
      .select({
        gameType: transactions.gameType,
        count: sql<number>`count(*)`
      })
      .from(transactions)
      .where(and(
        sql`"gameType" IS NOT NULL`,
        sql`"timestamp" >= ${startDate}`,
        sql`"timestamp" <= ${endDate}`
      ))
      .groupBy(transactions.gameType)
      .orderBy(sql`count(*) DESC`)
      .limit(1);
    
    if (result.length === 0) {
      return { gameType: 'none', count: 0 };
    }
    
    return { 
      gameType: result[0].gameType!, 
      count: result[0].count 
    };
  }
  
  async getGameDistribution(startDate: Date, endDate: Date): Promise<{gameType: string, count: number}[]> {
    const result = await db
      .select({
        gameType: transactions.gameType,
        count: sql<number>`count(*)`
      })
      .from(transactions)
      .where(and(
        sql`"gameType" IS NOT NULL`,
        sql`"timestamp" >= ${startDate}`,
        sql`"timestamp" <= ${endDate}`
      ))
      .groupBy(transactions.gameType)
      .orderBy(sql`count(*) DESC`);
    
    return result.map(row => ({
      gameType: row.gameType!,
      count: row.count
    }));
  }
  
  async getDailyNewUsers(): Promise<{date: string, count: number}[]> {
    // Get data for the last 30 days
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    startDate.setHours(0, 0, 0, 0);
    
    const result = await db
      .select({
        date: sql<string>`DATE_TRUNC('day', "createdAt")::date`,
        count: sql<number>`count(*)`
      })
      .from(users)
      .where(sql`"createdAt" >= ${startDate}`)
      .groupBy(sql`DATE_TRUNC('day', "createdAt")::date`)
      .orderBy(sql`DATE_TRUNC('day', "createdAt")::date`);
    
    return result.map(row => ({
      date: row.date,
      count: row.count
    }));
  }
  
  async getDailyTransactions(): Promise<{date: string, bets: number, wins: number}[]> {
    // Get data for the last 30 days
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    startDate.setHours(0, 0, 0, 0);
    
    // Get total bets per day
    const betsResult = await db
      .select({
        date: sql<string>`DATE_TRUNC('day', "timestamp")::date`,
        count: sql<number>`count(*)`
      })
      .from(transactions)
      .where(and(
        sql`"timestamp" >= ${startDate}`,
        sql`"gameType" IS NOT NULL`
      ))
      .groupBy(sql`DATE_TRUNC('day', "timestamp")::date`)
      .orderBy(sql`DATE_TRUNC('day', "timestamp")::date`);
    
    // Get winning bets per day
    const winsResult = await db
      .select({
        date: sql<string>`DATE_TRUNC('day', "timestamp")::date`,
        count: sql<number>`count(*)`
      })
      .from(transactions)
      .where(and(
        sql`"timestamp" >= ${startDate}`,
        sql`"gameType" IS NOT NULL`,
        sql`"isWin" = true`
      ))
      .groupBy(sql`DATE_TRUNC('day', "timestamp")::date`)
      .orderBy(sql`DATE_TRUNC('day', "timestamp")::date`);
    
    // Combine the results
    const betsMap = new Map(betsResult.map(row => [row.date, row.count]));
    const winsMap = new Map(winsResult.map(row => [row.date, row.count]));
    
    // Get all unique dates
    const allDates = [...new Set([...betsMap.keys(), ...winsMap.keys()])].sort();
    
    return allDates.map(date => ({
      date,
      bets: betsMap.get(date) || 0,
      wins: winsMap.get(date) || 0
    }));
  }
  
  async getSubscriptionStats(): Promise<{tier: string, count: number}[]> {
    const result = await db
      .select({
        tier: users.subscriptionTier,
        count: sql<number>`count(*)`
      })
      .from(users)
      .groupBy(users.subscriptionTier)
      .orderBy(asc(users.subscriptionTier));
    
    // Make sure we include all tiers in the result
    const tiers = ['bronze', 'silver', 'gold', null]; // null for no subscription
    const resultMap = new Map(result.map(row => [row.tier, row.count]));
    
    return tiers.map(tier => ({
      tier: tier || 'none',
      count: resultMap.get(tier) || 0
    }));
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
  
  async getAnnouncements(includeExpired = false, userId?: number): Promise<any[]> {
    const now = new Date();
    
    console.log("Current announcements:", this.announcements);
    
    // Initialize announcements array if it's undefined
    if (!this.announcements) {
      this.announcements = [];
      console.log("Initialized announcements array");
    }
    
    // Step 1: Get unexpired announcements
    let filteredAnnouncements = includeExpired 
      ? [...this.announcements] 
      : this.announcements.filter(announcement => {
          return announcement.isPinned || 
                !announcement.expiresAt || 
                new Date(announcement.expiresAt) > now;
        });
        
    console.log("Filtered unexpired announcements:", filteredAnnouncements);
    
    // Step 2: If userId provided, filter announcements targeted to this user
    if (userId !== undefined) {
      filteredAnnouncements = filteredAnnouncements.filter(announcement => {
        // Include if:
        // 1. Announcement has no targetUserIds (global)
        // 2. Announcement has targetUserIds and userId is in the list
        const shouldInclude = !announcement.targetUserIds || 
               (announcement.targetUserIds && announcement.targetUserIds.includes(userId));
        
        console.log(`Checking announcement ${announcement.id} for user ${userId}: ${shouldInclude}`);
        
        return shouldInclude;
      });
      
      console.log("Filtered for user:", filteredAnnouncements);
    }
    
    return filteredAnnouncements || [];
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
  // Now using database tables
  
  async getSupportTickets(status?: string, page = 1, limit = 20): Promise<any[]> {
    let queryBase = db.select({
      ticket: supportTickets,
      user: {
        username: users.username
      }
    })
    .from(supportTickets)
    .leftJoin(users, eq(supportTickets.userId, users.id))
    .orderBy(desc(supportTickets.updatedAt));
    
    const offset = (page - 1) * limit;
    
    let results;
    if (status) {
      results = await queryBase
        .where(eq(supportTickets.status, status))
        .limit(limit)
        .offset(offset);
    } else {
      results = await queryBase
        .limit(limit)
        .offset(offset);
    }
    
    // For each ticket, fetch its messages
    const ticketsWithMessages = await Promise.all(
      results.map(async (result) => {
        const messages = await this.getTicketMessages(result.ticket.id);
        
        return {
          ...result.ticket,
          username: result.user?.username || 'Unknown',
          messages
        };
      })
    );
    
    return ticketsWithMessages;
  }
  
  async getTicketMessages(ticketId: number): Promise<any[]> {
    const messageResults = await db.select({
      message: ticketMessages,
      user: {
        username: users.username
      }
    })
    .from(ticketMessages)
    .leftJoin(users, eq(ticketMessages.userId, users.id))
    .where(eq(ticketMessages.ticketId, ticketId))
    .orderBy(desc(ticketMessages.createdAt)); // Using desc instead of asc
    
    return messageResults.map(result => ({
      ...result.message,
      username: result.user?.username || 'Unknown'
    }));
  }
  
  async getSupportTicket(id: number): Promise<any | undefined> {
    const [result] = await db.select({
      ticket: supportTickets,
      user: {
        username: users.username
      }
    })
    .from(supportTickets)
    .leftJoin(users, eq(supportTickets.userId, users.id))
    .where(eq(supportTickets.id, id));
    
    if (!result) return undefined;
    
    const messages = await this.getTicketMessages(id);
    
    return {
      ...result.ticket,
      username: result.user?.username || 'Unknown',
      messages
    };
  }
  
  async createSupportTicket(userId: number, subject: string, message: string): Promise<any> {
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }
    
    // First create the ticket
    const [newTicket] = await db
      .insert(supportTickets)
      .values({
        userId,
        subject,
        status: 'open',
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();
    
    if (!newTicket) {
      throw new Error("Failed to create support ticket");
    }
    
    // Then add the first message
    const [firstMessage] = await db
      .insert(ticketMessages)
      .values({
        ticketId: newTicket.id,
        userId,
        message,
        isAdmin: false,
        createdAt: new Date()
      })
      .returning();
    
    // Return the ticket with the message included
    return {
      ...newTicket,
      username: user.username,
      messages: [
        {
          ...firstMessage,
          username: user.username
        }
      ]
    };
  }
  
  async addSupportTicketReply(ticketId: number, userId: number, message: string, isAdmin: boolean): Promise<any> {
    // First check if ticket exists
    const ticket = await this.getSupportTicket(ticketId);
    if (!ticket) {
      throw new Error("Support ticket not found");
    }
    
    // Verify user exists
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }
    
    // Add the new message
    const [newMessage] = await db
      .insert(ticketMessages)
      .values({
        ticketId,
        userId,
        message,
        isAdmin,
        createdAt: new Date()
      })
      .returning();
    
    // If admin is replying to an 'open' ticket, change status to 'in-progress'
    if (isAdmin && ticket.status === 'open') {
      await this.updateSupportTicketStatus(ticketId, 'in-progress');
    }
    
    // Update the ticket's updatedAt timestamp
    await db
      .update(supportTickets)
      .set({ updatedAt: new Date() })
      .where(eq(supportTickets.id, ticketId));
    
    // Get the updated ticket with all messages
    const updatedTicket = await this.getSupportTicket(ticketId);
    
    return updatedTicket;
  }
  
  async updateSupportTicketStatus(ticketId: number, status: string): Promise<any | undefined> {
    // Check if ticket exists
    const ticket = await this.getSupportTicket(ticketId);
    if (!ticket) {
      return undefined;
    }
    
    // Update the ticket status
    const [updatedTicket] = await db
      .update(supportTickets)
      .set({
        status,
        updatedAt: new Date()
      })
      .where(eq(supportTickets.id, ticketId))
      .returning();
    
    if (!updatedTicket) {
      return undefined;
    }
    
    // Get the full ticket with messages
    return this.getSupportTicket(ticketId);
  }
  
  // === SUBSCRIPTION OPERATIONS ===
  async createSubscription(subscription: InsertSubscription): Promise<Subscription> {
    const [newSubscription] = await db
      .insert(subscriptions)
      .values(subscription)
      .returning();
    
    // Only update the user's subscription tier if status is active
    // This prevents automatic tier updates for incomplete/pending subscriptions
    if (subscription.status === 'active') {
      await this.updateUserSubscriptionTier(subscription.userId, subscription.tier);
    }
    
    return newSubscription;
  }
  
  async getUserSubscription(userId: number): Promise<Subscription | undefined> {
    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .orderBy(desc(subscriptions.createdAt))
      .limit(1);
    
    return subscription;
  }
  
  async findSubscriptionByStripeId(stripeId: string): Promise<Subscription | undefined> {
    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.stripeSubscriptionId, stripeId));
    
    return subscription;
  }
  
  async updateSubscription(id: number, updates: Partial<Subscription>): Promise<Subscription> {
    const [updatedSubscription] = await db
      .update(subscriptions)
      .set({ 
        ...updates,
        updatedAt: new Date() 
      })
      .where(eq(subscriptions.id, id))
      .returning();
    
    if (!updatedSubscription) {
      throw new Error("Subscription not found");
    }
    
    // If tier is being updated, update the user's subscriptionTier as well
    if (updates.tier && updatedSubscription.userId) {
      await this.updateUserSubscriptionTier(updatedSubscription.userId, updates.tier);
    }
    
    // Handle subscription status changes
    if (updates.status && updatedSubscription.userId) {
      // If status is active, set the user's subscription tier
      if (updates.status === 'active') {
        await this.updateUserSubscriptionTier(updatedSubscription.userId, updatedSubscription.tier);
      }
      // If subscription is canceled, past_due, unpaid, or incomplete_expired, remove the tier
      else if (['canceled', 'past_due', 'unpaid', 'incomplete_expired'].includes(updates.status)) {
        await this.updateUserSubscriptionTier(updatedSubscription.userId, null);
      }
    }
    
    return updatedSubscription;
  }
  
  async cancelSubscription(id: number): Promise<Subscription> {
    return this.updateSubscription(id, { 
      status: 'canceled'
    });
  }
  
  async getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    // Define the available subscription plans
    return [
      {
        id: 'bronze',
        tier: 'bronze',
        name: 'Bronze',
        price: 2.99,
        description: 'Basic tier with 300 daily coins and Bronze badge',
        features: [
          '300 daily coins',
          'Bronze VIP badge',
          'Basic support'
        ],
        priceId: process.env.STRIPE_PRICE_ID_BRONZE || '',
        coinReward: 300
      },
      {
        id: 'silver',
        tier: 'silver',
        name: 'Silver',
        price: 5.99,
        description: 'Enhanced tier with 600 daily coins and multiplier benefits',
        features: [
          '600 daily coins',
          'Silver VIP badge',
          '1.1x reward multiplier',
          'Ad-free experience',
          'Priority support'
        ],
        priceId: process.env.STRIPE_PRICE_ID_SILVER || '',
        coinReward: 600,
        multiplier: 1.1
      },
      {
        id: 'gold',
        tier: 'gold',
        name: 'Gold',
        price: 9.99,
        description: 'Premium tier with 1000 daily coins, higher multiplier, and exclusive content',
        features: [
          '1000 daily coins',
          'Gold VIP badge',
          '1.25x reward multiplier',
          'Ad-free experience',
          'Access to premium games',
          'Premium support'
        ],
        priceId: process.env.STRIPE_PRICE_ID_GOLD || '',
        coinReward: 1000,
        multiplier: 1.25
      }
    ];
  }
  
  async assignSubscriptionToUser(userId: number, tier: string, durationMonths: number, adminId: number, reason: string): Promise<Subscription> {
    // Get the user to verify they exist
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }
    
    // Check if the user already has an active subscription
    const existingSubscription = await this.getUserSubscription(userId);
    if (existingSubscription && existingSubscription.status === 'active') {
      // Cancel the existing subscription first
      await this.cancelSubscription(existingSubscription.id);
    }
    
    // Calculate the end date based on duration
    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + durationMonths);
    
    // Get the selected plan to get features
    const plans = await this.getSubscriptionPlans();
    const selectedPlan = plans.find(plan => plan.tier === tier);
    
    if (!selectedPlan) {
      throw new Error("Invalid subscription tier");
    }
    
    // Create a new subscription record
    const newSubscription = await this.createSubscription({
      userId,
      tier: tier as "bronze" | "silver" | "gold",
      status: 'active',
      stripeSubscriptionId: `admin_assigned_${Date.now()}`,
      priceId: selectedPlan.priceId,
      priceAmount: selectedPlan.price.toString(),
      startDate,
      endDate, // Set the end date based on duration
      metadata: JSON.stringify({
        planName: selectedPlan.name,
        features: selectedPlan.features,
        assignedBy: adminId,
        reason
      })
    });
    
    // Create a record in the coin transactions table for audit
    await this.createCoinTransaction({
      userId,
      amount: "0", // No coins added directly, but subscription benefits apply
      reason: `${tier} subscription assigned by admin: ${reason}`,
      adminId
    });
    
    // Update the user's subscription tier in the users table
    await this.updateUserSubscriptionTier(userId, tier);
    
    return newSubscription;
  }
  
  async updateUserSubscriptionTier(userId: number, tier: string | null): Promise<User> {
    const [updatedUser] = await db
      .update(users)
      .set({ 
        subscriptionTier: tier
      })
      .where(eq(users.id, userId))
      .returning();
    
    if (!updatedUser) {
      throw new Error("User not found");
    }
    
    return updatedUser;
  }

  // === BAN MANAGEMENT OPERATIONS ===
  async banUser(userId: number, adminId: number, reason: string): Promise<User> {
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }
    
    // Don't allow banning owners
    if (user.isOwner) {
      throw new Error("Cannot ban an owner account");
    }
    
    const [updatedUser] = await db
      .update(users)
      .set({ 
        isBanned: true,
        banReason: reason,
        bannedAt: new Date(),
        bannedBy: adminId
      })
      .where(eq(users.id, userId))
      .returning();
    
    if (!updatedUser) {
      throw new Error("User not found");
    }
    
    return updatedUser;
  }
  
  async unbanUser(userId: number): Promise<User> {
    const [updatedUser] = await db
      .update(users)
      .set({ 
        isBanned: false,
        banReason: null,
        bannedAt: null,
        bannedBy: null
      })
      .where(eq(users.id, userId))
      .returning();
    
    if (!updatedUser) {
      throw new Error("User not found");
    }
    
    return updatedUser;
  }
  
  async getBannedUsers(limit = 50, offset = 0): Promise<User[]> {
    const bannedUsers = await db
      .select()
      .from(users)
      .where(eq(users.isBanned, true))
      .orderBy(desc(users.bannedAt))
      .limit(limit)
      .offset(offset);
    
    return bannedUsers;
  }
  
  // === BAN APPEAL OPERATIONS ===
  async createBanAppeal(userId: number, reason: string): Promise<BanAppealType> {
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }
    
    if (!user.isBanned) {
      throw new Error("User is not banned");
    }
    
    // Check if user already has a pending or approved appeal
    const existingAppeal = await this.getUserBanAppeal(userId);
    if (existingAppeal && (existingAppeal.status === 'pending' || existingAppeal.status === 'approved')) {
      throw new Error("User already has an active appeal");
    }
    
    const [appeal] = await db
      .insert(banAppeals)
      .values({
        userId,
        reason,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();
    
    return appeal;
  }
  
  async getBanAppeals(status?: string, limit = 50, offset = 0): Promise<BanAppealType[]> {
    if (status) {
      return await db
        .select()
        .from(banAppeals)
        .where(eq(banAppeals.status, status))
        .orderBy(desc(banAppeals.createdAt))
        .limit(limit)
        .offset(offset);
    } else {
      return await db
        .select()
        .from(banAppeals)
        .orderBy(desc(banAppeals.createdAt))
        .limit(limit)
        .offset(offset);
    }
  }
  
  async getUserBanAppeal(userId: number): Promise<BanAppealType | undefined> {
    const [appeal] = await db
      .select()
      .from(banAppeals)
      .where(eq(banAppeals.userId, userId))
      .orderBy(desc(banAppeals.createdAt))
      .limit(1);
    
    return appeal;
  }
  
  async respondToBanAppeal(appealId: number, adminId: number, status: string, response: string): Promise<BanAppealType> {
    // Validate status value
    if (status !== 'approved' && status !== 'rejected') {
      throw new Error("Invalid status. Must be 'approved' or 'rejected'");
    }
    
    const [appeal] = await db
      .select()
      .from(banAppeals)
      .where(eq(banAppeals.id, appealId));
    
    if (!appeal) {
      throw new Error("Appeal not found");
    }
    
    // Update the appeal
    const [updatedAppeal] = await db
      .update(banAppeals)
      .set({
        status,
        adminResponse: response,
        adminId,
        updatedAt: new Date()
      })
      .where(eq(banAppeals.id, appealId))
      .returning();
    
    // If approved, unban the user
    if (status === 'approved') {
      await this.unbanUser(appeal.userId);
    }
    
    return updatedAppeal;
  }
}

// Switch from MemStorage to DatabaseStorage
export const storage = new DatabaseStorage();
