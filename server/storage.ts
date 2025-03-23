import { users, transactions, User, InsertUser, Transaction, InsertTransaction } from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

// modify the interface with any CRUD methods
// you might need
export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserBalance(userId: number, newBalance: number): Promise<User>;
  incrementPlayCount(userId: number): Promise<User>;
  getUserPlayCount(userId: number): Promise<number>;
  getUserTransactions(userId: number, limit?: number): Promise<Transaction[]>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        ...insertUser,
        balance: "10000", // Default starting balance
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
}

// Switch from MemStorage to DatabaseStorage
export const storage = new DatabaseStorage();
