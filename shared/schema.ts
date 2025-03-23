import { pgTable, text, serial, integer, boolean, timestamp, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  balance: decimal("balance", { precision: 10, scale: 2 }).default("10000").notNull(),
  playCount: integer("play_count").default(0).notNull(),
});

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  gameType: text("game_type").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  multiplier: decimal("multiplier", { precision: 10, scale: 4 }).notNull(),
  payout: decimal("payout", { precision: 10, scale: 2 }).notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  isWin: boolean("is_win").notNull(),
  metadata: text("metadata"),
  gameData: text("game_data"),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
  timestamp: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactions.$inferSelect;

// Game related schemas
export const betSchema = z.object({
  amount: z.number().positive().min(1).max(10000),
});

export const slotsPayoutSchema = z.object({
  symbols: z.array(z.array(z.string())), // 2D array for 3x3 grid
  multiplier: z.number(),
  payout: z.number(),
  isWin: z.boolean(),
  winningLines: z.array(z.array(z.number())).optional(), // Winning line coordinates
});

export const diceRollSchema = z.object({
  target: z.number().int().min(1).max(100),
  result: z.number().int().min(1).max(100),
  multiplier: z.number(),
  payout: z.number(),
  isWin: z.boolean()
});

export const crashGameSchema = z.object({
  crashPoint: z.number(),
  cashoutPoint: z.number().optional(),
  multiplier: z.number(),
  payout: z.number(),
  isWin: z.boolean()
});

// Roulette bet types
export const rouletteBetTypeSchema = z.enum([
  'straight', // Single number (35:1)
  'split', // Two numbers (17:1)
  'street', // Three numbers (11:1)
  'corner', // Four numbers (8:1)
  'line', // Six numbers (5:1)
  'dozen', // 12 numbers (2:1) - first, second, or third dozen
  'column', // 12 numbers (2:1) - 1st, 2nd, or 3rd column
  'even', // Even numbers (1:1)
  'odd', // Odd numbers (1:1)
  'red', // Red numbers (1:1)
  'black', // Black numbers (1:1)
  'low', // 1-18 (1:1)
  'high', // 19-36 (1:1)
]);

export const singleBetSchema = z.object({
  amount: z.number().positive().min(1).max(10000),
  type: rouletteBetTypeSchema,
  numbers: z.array(z.number().int().min(0).max(36)), // Array of numbers being bet on (can be a single number, or multiple)
});

export const rouletteBetSchema = z.object({
  bets: z.array(singleBetSchema),
});

export const rouletteResultSchema = z.object({
  spin: z.number().int().min(0).max(36), // The number that the ball landed on
  color: z.enum(['red', 'black', 'green']), // Color of the pocket
  multiplier: z.number(),
  payout: z.number(),
  isWin: z.boolean(),
  metadata: z.string().optional() // For storing additional data
});

// Blackjack schemas
export const cardSchema = z.object({
  suit: z.enum(['hearts', 'diamonds', 'clubs', 'spades']),
  value: z.enum(['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']),
  hidden: z.boolean().optional(),
});

export const blackjackActionSchema = z.enum([
  'hit',
  'stand',
  'double',
  'split',
  'surrender',
  'insurance'
]);

export const blackjackHandSchema = z.object({
  cards: z.array(cardSchema),
  value: z.number().int(),
  isBusted: z.boolean().optional(),
  isSplit: z.boolean().optional(),
  isBlackjack: z.boolean().optional(),
  isSurrendered: z.boolean().optional(),
  bet: z.number().optional(),
});

export const blackjackBetSchema = z.object({
  amount: z.number().positive().min(1).max(10000),
  action: blackjackActionSchema.optional(),
  handIndex: z.number().int().min(0).optional(),
});

export const blackjackStateSchema = z.object({
  playerHands: z.array(blackjackHandSchema),
  dealerHand: blackjackHandSchema,
  currentHandIndex: z.number().int().min(0).optional(),
  status: z.enum(['betting', 'player-turn', 'dealer-turn', 'complete']),
  insurance: z.number().optional(),
  allowedActions: z.array(blackjackActionSchema).optional(),
  result: z.enum(['win', 'lose', 'push', 'blackjack', 'surrender']).optional(),
  payout: z.number().optional(),
  isComplete: z.boolean().optional(),
});

// Poker schemas
export const pokerHandTypeSchema = z.enum([
  'high-card',
  'pair',
  'two-pair',
  'three-of-a-kind',
  'straight',
  'flush',
  'full-house',
  'four-of-a-kind',
  'straight-flush',
  'royal-flush'
]);

export const pokerActionSchema = z.enum([
  'check',
  'bet',
  'call',
  'raise',
  'fold',
  'all-in'
]);

export const pokerPlayerSchema = z.object({
  id: z.number().int(),
  username: z.string(),
  chips: z.number().int().min(0),
  cards: z.array(cardSchema).optional(),
  bet: z.number().int().min(0).optional(),
  action: pokerActionSchema.optional(),
  isActive: z.boolean().optional(),
  hasFolded: z.boolean().optional(),
  isAllIn: z.boolean().optional(),
});

export const pokerGameStateSchema = z.object({
  players: z.array(pokerPlayerSchema),
  communityCards: z.array(cardSchema),
  pot: z.number().int().min(0),
  currentBet: z.number().int().min(0),
  currentPlayer: z.number().int().min(0).optional(),
  dealerPosition: z.number().int().min(0),
  stage: z.enum(['pre-flop', 'flop', 'turn', 'river', 'showdown']),
  results: z.record(z.string(), z.object({
    handType: pokerHandTypeSchema,
    bestHand: z.array(cardSchema),
    winAmount: z.number().optional()
  })).optional(),
});

export type SlotsPayout = z.infer<typeof slotsPayoutSchema>;
export type DiceRoll = z.infer<typeof diceRollSchema>;
export type CrashGame = z.infer<typeof crashGameSchema>;
export type RouletteBetType = z.infer<typeof rouletteBetTypeSchema>;
export type SingleBet = z.infer<typeof singleBetSchema>;
export type RouletteBet = z.infer<typeof rouletteBetSchema>;
export type RouletteResult = z.infer<typeof rouletteResultSchema>;
export type Card = z.infer<typeof cardSchema>;
export type BlackjackAction = z.infer<typeof blackjackActionSchema>;
export type BlackjackHand = z.infer<typeof blackjackHandSchema>;
export type BlackjackBet = z.infer<typeof blackjackBetSchema>;
export type BlackjackState = z.infer<typeof blackjackStateSchema>;
export type PokerHandType = z.infer<typeof pokerHandTypeSchema>;
export type PokerAction = z.infer<typeof pokerActionSchema>;
export type PokerPlayer = z.infer<typeof pokerPlayerSchema>;
export type PokerGameState = z.infer<typeof pokerGameStateSchema>;
