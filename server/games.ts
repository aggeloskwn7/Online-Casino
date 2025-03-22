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
const SYMBOL_WEIGHTS = [
  100, // 🍒 - Very common
  80,  // 🍋
  60,  // 🍊
  40,  // 🍇
  20,  // 🔔
  10,  // 💎
  5,   // 7️⃣
  3,   // 🍀
  2,   // ⭐
  1    // 🎰 - Super rare
];

// Slot machine symbol multipliers (for matching 3 in a row)
const SYMBOL_MULTIPLIERS = {
  "🍒": 1.5,   // Very small win for most common symbol
  "🍋": 2,
  "🍊": 3,
  "🍇": 5,
  "🔔": 8,
  "💎": 12,
  "7️⃣": 25,
  "🍀": 50,
  "⭐": 100,
  "🎰": 500    // Massive jackpot for rarest symbol
};

// Additional multipliers for different patterns
const PATTERN_MULTIPLIERS = {
  "pair": 0.5,        // Any 2 matching symbols in a line (return half the bet)
  "diagonal": 1.25,   // Multiplier boost for diagonal lines
  "middle_row": 1.1,  // Small boost for middle row
  "full_grid": 10     // Extremely rare: all 9 symbols the same
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
      
      // Check for 3 of a kind
      if (symbol1 === symbol2 && symbol2 === symbol3) {
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
      // Check for pairs (2 matching symbols)
      else if ((symbol1 === symbol2 && symbol1 !== symbol3) || 
               (symbol2 === symbol3 && symbol1 !== symbol2) ||
               (symbol1 === symbol3 && symbol1 !== symbol2)) {
        // Much smaller win for pairs
        multiplier += PATTERN_MULTIPLIERS.pair;
        isWin = true;
        // Don't add to winning lines for pairs - only show for 3 of a kind
      }
    }
    
    // Check for super rare full grid win (all 9 symbols the same)
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
    
    if (allSame) {
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
      amount: z.number().positive(),
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
      amount: z.number().positive(),
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
    // With JWT auth, user is set by middleware
    const userId = req.user?.id;
    if (!userId) {
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
