import { users, transactions, User, InsertUser, Transaction, InsertTransaction } from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";

const MemoryStore = createMemoryStore(session);

// modify the interface with any CRUD methods
// you might need
export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserBalance(userId: number, newBalance: number): Promise<User>;
  getUserTransactions(userId: number, limit?: number): Promise<Transaction[]>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  sessionStore: any; // Use 'any' to avoid type issues with SessionStore
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private transactions: Map<number, Transaction>;
  currentId: number;
  currentTransactionId: number;
  sessionStore: any; // Use 'any' to avoid type issues with SessionStore

  constructor() {
    this.users = new Map();
    this.transactions = new Map();
    this.currentId = 1;
    this.currentTransactionId = 1;
    // More robust session store config
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000, // 24 hours (prune expired entries)
      ttl: 24 * 60 * 60 * 1000, // 24 hours (session time to live)
      stale: false,             // Don't return stale sessions
      noDisposeOnSet: false     // Dispose on set for better gc
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentId++;
    const user: User = { 
      ...insertUser, 
      id,
      balance: "10000" // String to match the schema type
    };
    this.users.set(id, user);
    return user;
  }

  async updateUserBalance(userId: number, newBalance: number): Promise<User> {
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }
    
    const updatedUser = { ...user, balance: String(newBalance) }; // Convert to string to match schema
    this.users.set(userId, updatedUser);
    return updatedUser;
  }

  async getUserTransactions(userId: number, limit = 10): Promise<Transaction[]> {
    const userTransactions = Array.from(this.transactions.values())
      .filter(transaction => transaction.userId === userId)
      .sort((a, b) => {
        // Sort by timestamp descending (most recent first)
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      })
      .slice(0, limit);
    
    return userTransactions;
  }

  async createTransaction(insertTransaction: InsertTransaction): Promise<Transaction> {
    const id = this.currentTransactionId++;
    const transaction: Transaction = {
      ...insertTransaction,
      id,
      timestamp: new Date()
    };
    
    this.transactions.set(id, transaction);
    return transaction;
  }
}

export const storage = new MemStorage();
