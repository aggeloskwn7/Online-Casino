import { Request, Response } from "express";
import { storage } from "./storage";
import { authMiddleware } from "./auth";

/**
 * Check if user is eligible for a daily login reward
 */
export async function checkDailyReward(req: Request, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    const userId = req.user.id;
    const isEligible = await storage.checkDailyRewardStatus(userId);
    
    return res.status(200).json({ 
      isEligible,
      streak: req.user.currentLoginStreak || 0,
      nextRewardDay: (req.user.currentLoginStreak || 0) + 1,
    });
  } catch (error) {
    console.error("Error checking daily reward:", error);
    return res.status(500).json({ message: "Server error" });
  }
}

/**
 * Claim the daily login reward
 */
export async function claimDailyReward(req: Request, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    const userId = req.user.id;
    
    // Check if user is eligible for a reward
    const isEligible = await storage.checkDailyRewardStatus(userId);
    if (!isEligible) {
      return res.status(400).json({ message: "You've already claimed your daily reward today" });
    }
    
    // Calculate the next login streak day
    let newStreak = (req.user.currentLoginStreak || 0) + 1;
    
    // Cap at 30 days
    if (newStreak > 30) {
      newStreak = 1; // Reset back to day 1 after completing the 30-day cycle
    }
    
    // Calculate reward amount for this day
    const rewardAmount = await storage.getRewardAmountForDay(newStreak);
    
    // Update user's streak and last reward date
    await storage.updateLoginStreak(userId, newStreak);
    
    // Add the reward amount to user's balance
    const currentBalance = parseFloat(req.user.balance.toString());
    const newBalance = currentBalance + rewardAmount;
    await storage.updateUserBalance(userId, newBalance);
    
    // Create a record for this login reward
    await storage.createLoginReward({
      userId,
      day: newStreak,
      amount: rewardAmount.toString()
    });
    
    // Create a coin transaction record
    await storage.createCoinTransaction({
      userId,
      amount: rewardAmount.toString(),
      reason: `Daily Login Reward - Day ${newStreak}`,
      adminId: 0 // System action
    });
    
    return res.status(200).json({
      success: true,
      message: `Congratulations! You've received ${rewardAmount} coins for your Day ${newStreak} login reward!`,
      rewardAmount,
      day: newStreak,
      newBalance,
      streak: newStreak
    });
  } catch (error) {
    console.error("Error claiming daily reward:", error);
    return res.status(500).json({ message: "Server error" });
  }
}

/**
 * Get user's reward history
 */
export async function getRewardHistory(req: Request, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    const userId = req.user.id;
    const rewardHistory = await storage.getUserLoginRewards(userId);
    
    return res.status(200).json(rewardHistory);
  } catch (error) {
    console.error("Error getting reward history:", error);
    return res.status(500).json({ message: "Server error" });
  }
}

/**
 * Get the daily reward amounts for all 30 days
 */
export async function getRewardSchedule(req: Request, res: Response) {
  try {
    const rewardSchedule = [];
    
    for (let day = 1; day <= 30; day++) {
      const amount = await storage.getRewardAmountForDay(day);
      rewardSchedule.push({
        day,
        amount,
        isMilestone: (day % 7 === 0 || day % 5 === 0 || day === 30)
      });
    }
    
    return res.status(200).json(rewardSchedule);
  } catch (error) {
    console.error("Error getting reward schedule:", error);
    return res.status(500).json({ message: "Server error" });
  }
}

/**
 * Setup reward routes
 */
export function setupRewardRoutes(app: any) {
  app.get("/api/rewards/check", authMiddleware, checkDailyReward);
  app.post("/api/rewards/claim", authMiddleware, claimDailyReward);
  app.get("/api/rewards/history", authMiddleware, getRewardHistory);
  app.get("/api/rewards/schedule", getRewardSchedule);
}