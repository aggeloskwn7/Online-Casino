import { Request, Response } from "express";
import { storage } from "./storage";
import { betSchema, slotsPayoutSchema, diceRollSchema, crashGameSchema } from "@shared/schema";
import { z } from "zod";

// Slot machine symbols
const SLOT_SYMBOLS = ["🍒", "🍋", "🍊", "🍇", "🔔", "💎", "7️⃣", "🍀", "⭐", "🎰"];

// Slot machine payouts based on combinations
const SLOT_PAYOUTS = {
  "🍒🍒🍒": 3,
  "🍋🍋🍋": 5,
  "🍊🍊🍊": 8,
  "🍇🍇🍇": 10,
  "🔔🔔🔔": 15,
  "💎💎💎": 20,
  "7️⃣7️⃣7️⃣": 50,
  "🍀🍀🍀": 25,
  "⭐⭐⭐": 30,
  "🎰🎰🎰": 100,
  // Any pairs
  "pair": 1.5,
};

/**
 * Play slots game
 */
export async function playSlots(req: Request, res: Response) {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const parsedBody = betSchema.parse(req.body);
    const { amount } = parsedBody;
    const userId = req.user!.id;
    
    // Get current user with balance
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    // Check if user has enough balance
    if (Number(user.balance) < amount) {
      return res.status(400).json({ message: "Insufficient balance" });
    }
    
    // Generate random symbols
    const symbols = Array(3).fill(null).map(() => 
      SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)]
    );
    
    // Determine if it's a win and calculate payout
    const symbolsKey = symbols.join("");
    let multiplier = 0;
    let isWin = false;
    
    // Check for three of a kind
    if (SLOT_PAYOUTS[symbolsKey as keyof typeof SLOT_PAYOUTS]) {
      multiplier = SLOT_PAYOUTS[symbolsKey as keyof typeof SLOT_PAYOUTS];
      isWin = true;
    } 
    // Check for pairs (at least 2 same symbols)
    else if (
      symbols[0] === symbols[1] || 
      symbols[1] === symbols[2] || 
      symbols[0] === symbols[2]
    ) {
      multiplier = SLOT_PAYOUTS.pair;
      isWin = true;
    }
    
    const payout = amount * multiplier;
    
    // Update user balance
    const newBalance = Number(user.balance) - amount + payout;
    await storage.updateUserBalance(userId, newBalance);
    
    // Create transaction record
    await storage.createTransaction({
      userId,
      gameType: "slots",
      amount,
      multiplier,
      payout,
      isWin
    });
    
    // Return result
    const result = slotsPayoutSchema.parse({
      symbols,
      multiplier,
      payout,
      isWin
    });
    
    res.status(200).json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid bet data", errors: error.errors });
    }
    
    console.error("Slots game error:", error);
    res.status(500).json({ message: "Failed to process slots game" });
  }
}

/**
 * Play dice game
 */
export async function playDice(req: Request, res: Response) {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    // Validate request body
    const parsedBody = z.object({
      amount: z.number().positive(),
      target: z.number().int().min(1).max(99)
    }).parse(req.body);
    
    const { amount, target } = parsedBody;
    const userId = req.user!.id;
    
    // Get user with balance
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    // Check if user has enough balance
    if (Number(user.balance) < amount) {
      return res.status(400).json({ message: "Insufficient balance" });
    }
    
    // Generate random dice result (1-100)
    const result = Math.floor(Math.random() * 100) + 1;
    
    // Determine if it's a win (roll under target)
    const isWin = result <= target;
    
    // Calculate multiplier and payout
    // Multiplier formula: 99 / target (with 1% house edge)
    const multiplier = isWin ? Number((99 / target).toFixed(4)) : 0;
    const payout = isWin ? Number((amount * multiplier).toFixed(2)) : 0;
    
    // Update user balance
    const newBalance = Number(user.balance) - amount + payout;
    await storage.updateUserBalance(userId, newBalance);
    
    // Create transaction record
    await storage.createTransaction({
      userId,
      gameType: "dice",
      amount,
      multiplier,
      payout,
      isWin
    });
    
    // Return result
    const gameResult = diceRollSchema.parse({
      target,
      result,
      multiplier,
      payout,
      isWin
    });
    
    res.status(200).json(gameResult);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid bet data", errors: error.errors });
    }
    
    console.error("Dice game error:", error);
    res.status(500).json({ message: "Failed to process dice game" });
  }
}

/**
 * Start a crash game
 */
export async function startCrash(req: Request, res: Response) {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    // Validate request body
    const parsedBody = z.object({
      amount: z.number().positive(),
      autoCashout: z.number().positive().optional()
    }).parse(req.body);
    
    const { amount, autoCashout } = parsedBody;
    const userId = req.user!.id;
    
    // Get user with balance
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    // Check if user has enough balance
    if (Number(user.balance) < amount) {
      return res.status(400).json({ message: "Insufficient balance" });
    }
    
    // Generate crash point (between 1.00 and 10.00, with a bias towards lower values)
    // Using a simple formula for randomization
    const random = Math.random();
    // Formula to bias towards low values but allow occasional high values
    const crashPoint = Number((1 + (100 * random * random) / 10).toFixed(2));
    
    // Subtract the bet amount from user balance immediately
    await storage.updateUserBalance(userId, Number(user.balance) - amount);
    
    res.status(200).json({ 
      gameId: Date.now().toString(),
      crashPoint,
      betAmount: amount,
      autoCashout
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid bet data", errors: error.errors });
    }
    
    console.error("Crash game error:", error);
    res.status(500).json({ message: "Failed to start crash game" });
  }
}

/**
 * Cash out from crash game
 */
export async function crashCashout(req: Request, res: Response) {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    // Validate request body
    const parsedBody = z.object({
      gameId: z.string(),
      amount: z.number().positive(),
      crashPoint: z.number().positive(),
      cashoutPoint: z.number().positive()
    }).parse(req.body);
    
    const { gameId, amount, crashPoint, cashoutPoint } = parsedBody;
    const userId = req.user!.id;
    
    // Get user
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    // Determine if it's a win (cashed out before crash)
    const isWin = cashoutPoint <= crashPoint;
    const multiplier = isWin ? cashoutPoint : 0;
    const payout = isWin ? Number((amount * multiplier).toFixed(2)) : 0;
    
    // Update user balance with winnings (bet amount was already subtracted when game started)
    await storage.updateUserBalance(userId, Number(user.balance) + payout);
    
    // Create transaction record
    await storage.createTransaction({
      userId,
      gameType: "crash",
      amount,
      multiplier,
      payout,
      isWin
    });
    
    // Return result
    const gameResult = crashGameSchema.parse({
      crashPoint,
      cashoutPoint,
      multiplier,
      payout,
      isWin
    });
    
    res.status(200).json(gameResult);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid cashout data", errors: error.errors });
    }
    
    console.error("Crash cashout error:", error);
    res.status(500).json({ message: "Failed to process crash cashout" });
  }
}

/**
 * Get user transactions
 */
export async function getTransactions(req: Request, res: Response) {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    const userId = req.user!.id;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    
    const transactions = await storage.getUserTransactions(userId, limit);
    
    res.status(200).json(transactions);
  } catch (error) {
    console.error("Get transactions error:", error);
    res.status(500).json({ message: "Failed to get transactions" });
  }
}
