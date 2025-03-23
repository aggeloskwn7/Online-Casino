import { Request, Response } from "express";
import { storage } from "./storage";
import { betSchema, slotsPayoutSchema, diceRollSchema, crashGameSchema, rouletteBetSchema, rouletteResultSchema, RouletteBetType } from "@shared/schema";
import { z } from "zod";
import { getAdjustedWinChance, shouldBeBigWin, getBigWinMultiplierBoost } from "./win-rate";

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
// More balanced distribution but with very rare high-value symbols
const SYMBOL_WEIGHTS = [
  100, // 🍒 - Common but not overwhelming
  95,  // 🍋
  90,  // 🍊
  75,  // 🍇
  50,  // 🔔
  20,  // 💎
  10,  // 7️⃣
  5,   // 🍀
  1,   // ⭐
  0.5  // 🎰 - Still very rare but possible
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
    
    // Get play count for this user to adjust win rates
    const playCount = await storage.getUserPlayCount(userId);
    
    // Determine the adjusted win chance based on play count
    const slotWinChance = getAdjustedWinChance('slots', playCount);
    
    // Check if this should be a big win (special treatment)
    const isBigWin = shouldBeBigWin(playCount);
    
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
      
      // Check for 3 of a kind with dynamically adjusted odds based on play count
      if (symbol1 === symbol2 && symbol2 === symbol3 && Math.random() * 100 < slotWinChance) {
        // Get the base multiplier for this symbol
        const baseMultiplier = SYMBOL_MULTIPLIERS[symbol1 as keyof typeof SYMBOL_MULTIPLIERS];
        
        // Add additional multiplier based on line type
        let lineMultiplier = baseMultiplier;
        
        // Apply big win boost if this is designated as a big win
        if (isBigWin) {
          lineMultiplier *= getBigWinMultiplierBoost();
        }
        
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
      // Better chances of winning with pairs based on dynamic win rate (scaled down version of main win rate)
      else if (Math.random() * 100 < (slotWinChance / 2) && ((symbol1 === symbol2 && symbol1 !== symbol3) || 
               (symbol2 === symbol3 && symbol1 !== symbol2) ||
               (symbol1 === symbol3 && symbol1 !== symbol2))) {
        // Much smaller win for pairs
        let pairMultiplier = PATTERN_MULTIPLIERS.pair;
        
        // Apply a smaller boost for big wins on pairs
        if (isBigWin) {
          pairMultiplier *= 1.5;
        }
        
        multiplier += pairMultiplier;
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
    
    // Chance to win on full grid match based on player's dynamically adjusted win rate
    // New players get a higher chance of this jackpot win
    const fullGridWinChance = (slotWinChance / 2) + (isBigWin ? 20 : 0);
    if (allSame && Math.random() * 100 < fullGridWinChance) {
      // Massive multiplier for full grid of the same symbol
      // Base symbol multiplier * full grid bonus
      let jackpotMultiplier = SYMBOL_MULTIPLIERS[firstSymbol as keyof typeof SYMBOL_MULTIPLIERS] * PATTERN_MULTIPLIERS.full_grid;
      
      // For big wins, increase the jackpot multiplier even more
      if (isBigWin) {
        jackpotMultiplier *= getBigWinMultiplierBoost();
      }
      
      multiplier = jackpotMultiplier;
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
    
    // Increment user's play count
    await storage.incrementPlayCount(userId);
    
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
    
    // Get play count for this user to adjust win rates
    const playCount = await storage.getUserPlayCount(userId);
    
    // Determine the adjusted win chance based on play count
    const diceWinChance = getAdjustedWinChance('dice', playCount);
    
    // Check if this should be a big win (special treatment)
    const isBigWin = shouldBeBigWin(playCount);
    
    // Generate random dice result (1-100)
    const result = Math.floor(Math.random() * 100) + 1;
    
    // Determine if it's a win (roll under target)
    const isWin = result <= target;
    
    // Calculate multiplier and payout
    // Multiplier formula: (100 - house_edge) / target
    // House edge varies based on player experience
    const baseHouseEdge = 15.0;
    // Reduce house edge for new players (better odds)
    const adjustedHouseEdge = baseHouseEdge * (1 - (diceWinChance - 50) / 100);
    let multiplier = isWin ? Number(((100 - adjustedHouseEdge) / target).toFixed(4)) : 0;
    
    // For big wins, boost the multiplier
    if (isWin && isBigWin) {
      multiplier *= 1.0 + (Math.random() * 0.5); // 1-1.5x boost
      multiplier = Number(multiplier.toFixed(4));
    }
    
    // Chance of forced loss depends on player's experience
    // New players have lower chance of forced loss
    const forceLossChance = 0.2 * (100 - diceWinChance) / 100;
    if (isWin && Math.random() < forceLossChance) {
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
        
        // Increment user's play count
        await storage.incrementPlayCount(userId);
        
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
    
    // Increment user's play count
    await storage.incrementPlayCount(userId);
    
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
    
    // Get play count for this user to adjust win rates
    const playCount = await storage.getUserPlayCount(userId);
    
    // Determine the adjusted win chance based on play count
    const crashWinChance = getAdjustedWinChance('crash', playCount);
    
    // Check if this should be a big win (special treatment)
    const isBigWin = shouldBeBigWin(playCount);
    
    // Generate crash point using an exponential distribution
    // This creates a curve similar to real crypto crash games with rare high multipliers
    // Formula: 0.95 / (1 - random^2.5)
    const random = Math.random();
    // Ensure random is not 1 to avoid division by zero
    const safeRandom = random === 1 ? 0.999999 : random;
    
    // Calculate crash point with bounded result (max: 1000.00)
    const rawCrashPoint = 0.95 / (1 - Math.pow(safeRandom, 2.5));
    let crashPoint = Number(Math.min(1000, rawCrashPoint).toFixed(2));
    
    // For big wins, boost the crash point significantly
    if (isBigWin && crashPoint > 2.0) {
      crashPoint *= getBigWinMultiplierBoost();
      crashPoint = Number(Math.min(1000, crashPoint).toFixed(2));
    }
    
    // Chance of immediate crash varies based on player's win rate
    // New players have lower chance of immediate crash (better experience)
    const immediateCrashChance = 0.1 * (100 - crashWinChance) / 100;
    if (Math.random() < immediateCrashChance) {
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
    
    // Increment user's play count
    await storage.incrementPlayCount(userId);
    
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

// Constants for the roulette game
const ROULETTE_NUMBERS = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
];

const ROULETTE_COLORS: { [key: number]: 'red' | 'black' | 'green' } = {
  0: 'green',
  1: 'red', 2: 'black', 3: 'red', 4: 'black', 5: 'red', 6: 'black',
  7: 'red', 8: 'black', 9: 'red', 10: 'black', 11: 'black', 12: 'red',
  13: 'black', 14: 'red', 15: 'black', 16: 'red', 17: 'black', 18: 'red',
  19: 'red', 20: 'black', 21: 'red', 22: 'black', 23: 'red', 24: 'black',
  25: 'red', 26: 'black', 27: 'red', 28: 'black', 29: 'black', 30: 'red',
  31: 'black', 32: 'red', 33: 'black', 34: 'red', 35: 'black', 36: 'red'
};

// Roulette bet type multipliers
const ROULETTE_PAYOUTS: { [key: string]: number } = {
  'straight': 35, // Single number (35:1)
  'split': 17, // Two numbers (17:1)
  'street': 11, // Three numbers (11:1)
  'corner': 8, // Four numbers (8:1)
  'line': 5, // Six numbers (5:1)
  'dozen': 2, // 12 numbers (2:1)
  'column': 2, // 12 numbers (2:1)
  'even': 1, // Even numbers (1:1)
  'odd': 1, // Odd numbers (1:1)
  'red': 1, // Red numbers (1:1)
  'black': 1, // Black numbers (1:1)
  'low': 1, // 1-18 (1:1)
  'high': 1, // 19-36 (1:1)
};

// Helper functions for checking roulette bet wins
const isRed = (number: number) => ROULETTE_COLORS[number] === 'red';
const isBlack = (number: number) => ROULETTE_COLORS[number] === 'black';
const isGreen = (number: number) => ROULETTE_COLORS[number] === 'green';
const isEven = (number: number) => number !== 0 && number % 2 === 0;
const isOdd = (number: number) => number % 2 === 1;
const isLow = (number: number) => number >= 1 && number <= 18;
const isHigh = (number: number) => number >= 19 && number <= 36;
const isInFirstDozen = (number: number) => number >= 1 && number <= 12;
const isInSecondDozen = (number: number) => number >= 13 && number <= 24;
const isInThirdDozen = (number: number) => number >= 25 && number <= 36;
const isInFirstColumn = (number: number) => number % 3 === 1;
const isInSecondColumn = (number: number) => number % 3 === 2;
const isInThirdColumn = (number: number) => number % 3 === 0 && number !== 0;

/**
 * Play roulette game
 */
export async function playRoulette(req: Request, res: Response) {
  try {
    // With JWT auth, user is set by middleware
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    // Validate request body
    const parsedBody = rouletteBetSchema.parse(req.body);
    const { bets } = parsedBody;
    
    // If no bets provided, return error
    if (!bets || bets.length === 0) {
      return res.status(400).json({ message: "No bets placed" });
    }
    
    // Get user with balance
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    // Calculate total bet amount
    const totalAmount = bets.reduce((sum, bet) => sum + bet.amount, 0);
    
    // Check if user has enough balance
    if (Number(user.balance) < totalAmount) {
      return res.status(400).json({ message: "Insufficient balance" });
    }
    
    // Get play count for this user to adjust win rates
    const playCount = await storage.getUserPlayCount(userId);
    
    // Determine the adjusted win chance based on play count
    const rouletteWinChance = getAdjustedWinChance('roulette', playCount);
    
    // Check if this should be a big win (special treatment)
    const isBigWin = shouldBeBigWin(playCount);
    
    // Generate random roulette spin (0-36)
    // Use the ROULETTE_NUMBERS array to pick a number in the correct sequence
    const randomIndex = Math.floor(Math.random() * ROULETTE_NUMBERS.length);
    const spin = ROULETTE_NUMBERS[randomIndex];
    const color = ROULETTE_COLORS[spin];
    
    // Process each bet and determine wins/losses
    let totalWinnings = 0;
    let anyWin = false;
    let biggestMultiplier = 0;
    let totalPayout = 0;
    let betResults: Array<{
      betType: RouletteBetType,
      amount: number,
      isWin: boolean,
      payout: number
    }> = [];
    
    // Process each bet
    for (const bet of bets) {
      // Make sure we destructure bet correctly, with validation to avoid "Cannot read properties of undefined (reading 'toString')"
      if (!bet || typeof bet !== 'object') {
        console.error("Invalid bet object:", bet);
        continue;
      }
      
      const amount = bet.amount;
      const type = bet.type;
      const numbers = bet.numbers || [];
      let isWin = false;
      
      // Determine if this specific bet is a win
      switch (type) {
        case 'straight':
          // Single number bet
          isWin = numbers.includes(spin);
          break;
        case 'split':
          // Two adjacent numbers
          isWin = numbers.includes(spin);
          break;
        case 'street':
          // Three numbers in a row
          isWin = numbers.includes(spin);
          break;
        case 'corner':
          // Four numbers forming a square
          isWin = numbers.includes(spin);
          break;
        case 'line':
          // Six numbers (two rows)
          isWin = numbers.includes(spin);
          break;
        case 'dozen':
          // 12 numbers (1-12, 13-24, 25-36)
          isWin = numbers.includes(spin);
          break;
        case 'column':
          // 12 numbers (1st, 2nd, or 3rd column)
          isWin = numbers.includes(spin);
          break;
        case 'even':
          // Even numbers
          isWin = isEven(spin);
          break;
        case 'odd':
          // Odd numbers
          isWin = isOdd(spin);
          break;
        case 'red':
          // Red numbers
          isWin = isRed(spin);
          break;
        case 'black':
          // Black numbers
          isWin = isBlack(spin);
          break;
        case 'low':
          // 1-18
          isWin = isLow(spin);
          break;
        case 'high':
          // 19-36
          isWin = isHigh(spin);
          break;
        default:
          break;
      }
      
      // Use dynamic win chance to determine odds based on player's play count
      // New players have lower chance of forced loss, experienced players slightly higher
      const forceLossFactor = 100 - rouletteWinChance; // Inverse of win chance (higher win chance = lower forced loss chance)
      const forceLossChance = (forceLossFactor / 100) * 0.12; // Scale the base 12% by win factor
      
      if (isWin && Math.random() < forceLossChance) {
        isWin = false;
      }
      
      // Chance of lucky win is higher for new players and lower for experienced ones
      // This adds excitement and occasional surprising wins
      let luckyMultiplier = 0;
      const luckyWinChance = (rouletteWinChance / 100) * 0.02; // Up to 2% for new players
      
      if (!isWin && Math.random() < luckyWinChance) {
        isWin = true;
        
        // Set a higher multiplier for "big wins" designated by our algorithm
        if (isBigWin) {
          // Special big wins get higher multipliers (3-7x)
          luckyMultiplier = 3 + Math.floor(Math.random() * 4);
        } else {
          // Normal lucky wins get 2-4x
          luckyMultiplier = 2 + Math.floor(Math.random() * 2);
        }
      }
      
      // Calculate payout for this bet
      const multiplier = luckyMultiplier > 0 ? luckyMultiplier : (isWin ? ROULETTE_PAYOUTS[type] : 0);
      
      // Add small random variation to payouts to make it feel more realistic (within 0.5%)
      const variation = 1 + (Math.random() * 0.01 - 0.005);
      const payout = isWin ? Number((amount * multiplier * variation).toFixed(2)) : 0;
      
      // Update running totals
      totalWinnings += payout;
      totalPayout += payout;
      
      if (isWin) {
        anyWin = true;
        if (multiplier > biggestMultiplier) {
          biggestMultiplier = multiplier;
        }
      }
      
      // Store the result of this bet
      betResults.push({
        betType: type,
        amount,
        isWin,
        payout
      });
    }
    
    // Update user balance
    const newBalance = Number(user.balance) - totalAmount + totalWinnings;
    await storage.updateUserBalance(userId, newBalance);
    
    // Create transaction record
    await storage.createTransaction({
      userId,
      gameType: "roulette",
      amount: totalAmount.toString(),
      multiplier: (biggestMultiplier || 0).toString(), 
      payout: totalPayout.toString(),
      isWin: anyWin,
      metadata: JSON.stringify({ betResults })
    });
    
    // Increment user's play count
    await storage.incrementPlayCount(userId);
    
    // Return result
    const gameResult = rouletteResultSchema.parse({
      spin,
      color,
      multiplier: biggestMultiplier || 0,
      payout: totalPayout,
      isWin: anyWin,
      metadata: JSON.stringify({ betResults })
    });
    
    res.status(200).json(gameResult);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid bet data", errors: error.errors });
    }
    
    console.error("Roulette game error:", error);
    res.status(500).json({ message: "Failed to process roulette game" });
  }
}
