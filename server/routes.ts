import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, authMiddleware } from "./auth";
import { setupAdminRoutes } from "./admin";
import { 
  playSlots, 
  playDice, 
  startCrash, 
  crashCashout, 
  getTransactions, 
  playRoulette,
  startBlackjack,
  blackjackAction
} from "./games";

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up authentication routes
  setupAuth(app);

  // Protected Game routes - all require authentication
  app.post("/api/games/slots", authMiddleware, playSlots);
  app.post("/api/games/dice", authMiddleware, playDice);
  app.post("/api/games/crash/start", authMiddleware, startCrash);
  app.post("/api/games/crash/cashout", authMiddleware, crashCashout);
  app.post("/api/games/roulette", authMiddleware, playRoulette);
  app.post("/api/games/blackjack/start", authMiddleware, startBlackjack);
  app.post("/api/games/blackjack/action", authMiddleware, blackjackAction);
  
  // Transaction history - also protected
  app.get("/api/transactions", authMiddleware, getTransactions);
  
  // Set up admin routes
  setupAdminRoutes(app);

  const httpServer = createServer(app);

  return httpServer;
}
