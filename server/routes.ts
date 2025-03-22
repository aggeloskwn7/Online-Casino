import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { playSlots, playDice, startCrash, crashCashout, getTransactions } from "./games";

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up authentication routes
  setupAuth(app);

  // Game routes
  app.post("/api/games/slots", playSlots);
  app.post("/api/games/dice", playDice);
  app.post("/api/games/crash/start", startCrash);
  app.post("/api/games/crash/cashout", crashCashout);
  
  // Transaction history
  app.get("/api/transactions", getTransactions);

  const httpServer = createServer(app);

  return httpServer;
}
