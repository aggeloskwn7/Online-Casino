import { Request, Response } from "express";
import { storage } from "./storage";
import { betSchema, slotsPayoutSchema, diceRollSchema, crashGameSchema } from "@shared/schema";
import { z } from "zod";

// Declare global type extension for Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

// Slot machine symbols with different frequencies
// Higher index = less frequent = higher value
const SLOT_SYMBOLS = ["🍒", "🍋", "🍊", "🍇", "🔔", "💎", "7️⃣", "🍀", "⭐", "🎰"];

// Symbol weights (higher weight = more common)
// ULTRA-tough casino-style distribution with INSANELY rare high-value symbols
const SYMBOL_WEIGHTS = [
  50000, // 🍒 - Ridiculously common (500x more common than original)
  5000,  // 🍋
  1000,  // 🍊
  100,   // 🍇
  10,    // 🔔
  1,     // 💎
  0.1,   // 7️⃣
  0.01,  // 🍀
  0.001, // ⭐
  0.0001 // 🎰 - Virtually impossible (5000x rarer than original)
];

// Slot machine symbol multipliers (for matching 3 in a row)
// Higher payouts for the rarer symbols to maintain excitement
const SYMBOL_MULTIPLIERS = {
  "🍒": 1.2,   // Very small win for most common symbol
  "🍋": 1.5,
  "🍊": 2,
  "🍇": 3,
  "🔔": 5,
  "💎": 10,
  "7️⃣": 25,
  "🍀": 75,
  "⭐": 250,
  "🎰": 1000   // Massive jackpot for rarest symbol (increased from 500x)
};

// Additional multipliers for different patterns
const PATTERN_MULTIPLIERS = {
  "pair": 0.4,        // Any 2 matching symbols in a line (less than half the bet for more house edge)
  "diagonal": 1.5,    // Bigger multiplier boost for diagonal lines
  "middle_row": 1.2,  // Small boost for middle row
  "full_grid": 20     // Extremely rare: all 9 symbols the same (doubled from previous)
};

/**
 * Play slots game
 */
export async function playSlots(req: Request, res: Response) {
  try {
    // With JWT auth, user is set by middleware
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const parsedBody = betSchema.parse(req.body);
    const { amount } = parsedBody;
    
    // Get current user with balance
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    // Check if user has enough balance
    if (Number(user.balance) < amount) {
      return res.status(400).json({ message: "Insufficient balance" });
    }
    
    // Helper function to get a weighted random symbol
    const getWeightedRandomSymbol = () => {
      // Calculate total weight
      const totalWeight = SYMBOL_WEIGHTS.reduce((sum, weight) => sum + weight, 0);
      // Get a random value between 0 and total weight
      let random = Math.random() * totalWeight;
      
      // Find the symbol based on weights
      for (let i = 0; i < SYMBOL_WEIGHTS.length; i++) {
        random -= SYMBOL_WEIGHTS[i];
        if (random <= 0) {
          return SLOT_SYMBOLS[i];
        }
      }
      // Fallback (should never happen)
      return SLOT_SYMBOLS[0];
    };
    
    // Generate a 3x3 grid of random symbols using weighted random
    const symbols = Array(3).fill(null).map(() => 
      Array(3).fill(null).map(() => getWeightedRandomSymbol())
    );
    
    // Check for winning combinations
    let multiplier = 0;
    let isWin = false;
    let winningLines: number[][] = [];
    
    // Define the 8 possible winning lines (3 horizontal, 3 vertical, 2 diagonal)
    const winLines = [
      // Horizontal lines
      [[0,0], [0,1], [0,2]],
      [[1,0], [1,1], [1,2]],
      [[2,0], [2,1], [2,2]],
      // Vertical lines
      [[0,0], [1,0], [2,0]],
      [[0,1], [1,1], [2,1]],
      [[0,2], [1,2], [2,2]],
      // Diagonal lines
      [[0,0], [1,1], [2,2]],
      [[0,2], [1,1], [2,0]]
    ];
    
    // Check each line for wins
    for (const line of winLines) {
      const [row1, col1] = line[0];
      const [row2, col2] = line[1];
      const [row3, col3] = line[2];
      
      const symbol1 = symbols[row1][col1];
      const symbol2 = symbols[row2][col2];
      const symbol3 = symbols[row3][col3];
      
      // Check for 3 of a kind but with EXTREME luck factor
      // Only 10% of legitimate 3-of-a-kind matches will actually pay out
      if (symbol1 === symbol2 && symbol2 === symbol3 && Math.random() < 0.1) {
        // Get the base multiplier for this symbol
        const baseMultiplier = SYMBOL_MULTIPLIERS[symbol1 as keyof typeof SYMBOL_MULTIPLIERS];
        
        // Add additional multiplier based on line type
        let lineMultiplier = baseMultiplier;
        
        // Check if it's a diagonal line
        if ((row1 === 0 && col1 === 0 && row3 === 2 && col3 === 2) || 
            (row1 === 0 && col1 === 2 && row3 === 2 && col3 === 0)) {
          lineMultiplier *= PATTERN_MULTIPLIERS.diagonal;
        }
        
        // Check if it's the middle row (higher payout)
        if (row1 === 1 && row2 === 1 && row3 === 1) {
          lineMultiplier *= PATTERN_MULTIPLIERS.middle_row;
        }
        
        multiplier += lineMultiplier;
        isWin = true;
        winningLines.push([row1, col1, row2, col2, row3, col3]);
      }
      // Extreme reduction in chances of winning with pairs (only 2% chance of counting)
      else if (Math.random() < 0.02 && ((symbol1 === symbol2 && symbol1 !== symbol3) || 
               (symbol2 === symbol3 && symbol1 !== symbol2) ||
               (symbol1 === symbol3 && symbol1 !== symbol2))) {
        // Much smaller win for pairs
        multiplier += PATTERN_MULTIPLIERS.pair;
        isWin = true;
        // Don't add to winning lines for pairs - only show for 3 of a kind
      }
    }
    
    // Check for super rare full grid win (all 9 symbols the same)
    // But add an extreme random factor - only 5% chance of actually paying out even if grid matches
    const firstSymbol = symbols[0][0];
    let allSame = true;
    
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        if (symbols[i][j] !== firstSymbol) {
          allSame = false;
          break;
        }
      }
      if (!allSame) break;
    }
    
    // Even if all symbols match, only 5% chance of actually getting the win
    if (allSame && Math.random() < 0.05) {
      // Massive multiplier for full grid of the same symbol
      // Base symbol multiplier * full grid bonus
      multiplier = SYMBOL_MULTIPLIERS[firstSymbol as keyof typeof SYMBOL_MULTIPLIERS] * PATTERN_MULTIPLIERS.full_grid;
      isWin = true;
      // Don't add specific winning lines for full grid - it's obvious
    }
    
    const payout = amount * multiplier;
    
    // Update user balance
    const newBalance = Number(user.balance) - amount + payout;
    await storage.updateUserBalance(userId, newBalance);
    
    // Create transaction record
    await storage.createTransaction({
      userId,
      gameType: "slots",
      amount: amount.toString(),
      multiplier: multiplier.toString(),
      payout: payout.toString(),
      isWin
    });
    
    // Return result
    const result = slotsPayoutSchema.parse({
      symbols,
      multiplier,
      payout,
      isWin,
      winningLines: winningLines.length > 0 ? winningLines : undefined
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
    // With JWT auth, user is set by middleware
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    // Validate request body
    const parsedBody = z.object({
      amount: z.number().positive().min(1).max(10000),
      target: z.number().int().min(1).max(99)
    }).parse(req.body);
    
    const { amount, target } = parsedBody;
    
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
    
    // Calculate multiplier and payout with extremely harsh casino odds
    // Multiplier formula: (100 - house_edge) / target
    // Massively increased house edge to 15% for much harder odds
    const houseEdge = 15.0; 
    const multiplier = isWin ? Number(((100 - houseEdge) / target).toFixed(4)) : 0;
    
    // Add additional random factor to make winning much harder (50% chance of forced loss)
    // This creates a hidden double-house edge that makes winning rare
    if (isWin && Math.random() < 0.5) {
        // Force a loss by overriding the result
        const forcedResult = target + Math.floor(Math.random() * (100 - target)) + 1; // A number higher than target
        const gameResult = diceRollSchema.parse({
            target,
            result: forcedResult,
            multiplier: 0,
            payout: 0,
            isWin: false
        });
        
        // Update user balance (deduct the bet amount)
        const newBalance = Number(user.balance) - amount;
        await storage.updateUserBalance(userId, newBalance);
        
        // Create transaction record for the loss
        await storage.createTransaction({
            userId,
            gameType: "dice",
            amount: amount.toString(),
            multiplier: "0",
            payout: "0",
            isWin: false
        });
        
        return res.status(200).json(gameResult);
    }
    
    // Add small random variation to payouts to make it feel more realistic
    // This is within 0.5% of the calculated amount
    const variation = 1 + (Math.random() * 0.01 - 0.005);
    const payout = isWin ? Number((amount * multiplier * variation).toFixed(2)) : 0;
    
    // Update user balance
    const newBalance = Number(user.balance) - amount + payout;
    await storage.updateUserBalance(userId, newBalance);
    
    // Create transaction record
    await storage.createTransaction({
      userId,
      gameType: "dice",
      amount: amount.toString(),
      multiplier: multiplier.toString(),
      payout: payout.toString(),
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
    // With JWT auth, user is set by middleware
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    // Validate request body
    const parsedBody = z.object({
      amount: z.number().positive().min(1).max(10000),
      autoCashout: z.number().positive().optional()
    }).parse(req.body);
    
    const { amount, autoCashout } = parsedBody;
    
    // Get user with balance
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    // Check if user has enough balance
    if (Number(user.balance) < amount) {
      return res.status(400).json({ message: "Insufficient balance" });
    }
    
    // Generate crash point using an even tougher exponential distribution
    // This creates a curve similar to real crypto crash games with rare high multipliers
    // Formula: 0.95 / (1 - random^2.5)
    // - House edge increased to 5% (down from 0.99 to 0.95)
    // - Exponent increased from 2 to 2.5 for more frequent early crashes
    // - Results pattern: ~60% crash below 2x, ~5% above 10x, ~0.5% above 100x
    const random = Math.random();
    // Ensure random is not 1 to avoid division by zero
    const safeRandom = random === 1 ? 0.999999 : random;
    
    // Calculate crash point with bounded result (max: 1000.00)
    const rawCrashPoint = 0.95 / (1 - Math.pow(safeRandom, 2.5));
    let crashPoint = Number(Math.min(1000, rawCrashPoint).toFixed(2));
    
    // Additional 20% chance for an immediate crash (1.00x) for even more frequent losses
    if (Math.random() < 0.2) {
      crashPoint = 1.00;
    }
    
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
    // With JWT auth, user is set by middleware
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    // Validate request body
    const parsedBody = z.object({
      gameId: z.string(),
      amount: z.number().positive().min(1),
      crashPoint: z.number().positive(),
      cashoutPoint: z.number().positive()
    }).parse(req.body);
    
    const { gameId, amount, crashPoint, cashoutPoint } = parsedBody;
    
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
      amount: amount.toString(),
      multiplier: multiplier.toString(),
      payout: payout.toString(),
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
    // With JWT auth, user is set by middleware
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    
    const transactions = await storage.getUserTransactions(userId, limit);
    
    res.status(200).json(transactions);
  } catch (error) {
    console.error("Get transactions error:", error);
    res.status(500).json({ message: "Failed to get transactions" });
  }
}
