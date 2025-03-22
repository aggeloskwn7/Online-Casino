import { pgTable, text, serial, integer, boolean, timestamp, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  balance: decimal("balance", { precision: 10, scale: 2 }).default("10000").notNull(),
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
  amount: z.number().positive().min(10).max(1000000),
});

export const slotsPayoutSchema = z.object({
  symbols: z.array(z.string()),
  multiplier: z.number(),
  payout: z.number(),
  isWin: z.boolean(),
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

export type SlotsPayout = z.infer<typeof slotsPayoutSchema>;
export type DiceRoll = z.infer<typeof diceRollSchema>;
export type CrashGame = z.infer<typeof crashGameSchema>;
