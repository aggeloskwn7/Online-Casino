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
    
    // Ensure currentLoginStreak is properly defaulted if it doesn't exist
    const currentStreak = typeof req.user.currentLoginStreak === 'number' ? req.user.currentLoginStreak : 0;
    const nextDay = currentStreak + 1;
    
    console.log(`User ${req.user.username} reward check: currentStreak=${currentStreak}, nextDay=${nextDay}, isEligible=${isEligible}`);
    
    return res.status(200).json({ 
      isEligible,
      streak: currentStreak,
      nextRewardDay: nextDay,
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
    // If undefined/null, use 0 so the first claim is Day 1
    // Check req.user.currentLoginStreak exists and has a numeric value
    const currentStreak = typeof req.user.currentLoginStreak === 'number' ? req.user.currentLoginStreak : 0;
    console.log(`User ${req.user.username} current streak: ${currentStreak}`);
    let newStreak = currentStreak + 1;
    
    // Cap at 30 days
    if (newStreak > 30) {
      newStreak = 1; // Reset back to day 1 after completing the 30-day cycle
    }
    
    console.log(`User ${req.user.username} new streak will be: ${newStreak}`);
    
    // Calculate base reward amount for this day
    let baseRewardAmount = await storage.getRewardAmountForDay(newStreak);
    let rewardAmount = baseRewardAmount;
    let vipBonusAmount = 0;
    let multiplierApplied = 1;
    
    // Apply VIP subscription benefits if applicable
    if (req.user.subscriptionTier) {
      // Log the subscription tier for debugging
      console.log(`User subscription tier for reward calculation: ${req.user.subscriptionTier}`);
      
      // Get subscription plans to retrieve multipliers and bonuses
      const subscriptionPlans = await storage.getSubscriptionPlans();
      console.log(`Available subscription plans for reward calculation: ${subscriptionPlans.map(p => p.tier).join(', ')}`);
      
      // Find the exact matching plan using strict equality
      const userPlan = subscriptionPlans.find(plan => plan.tier === req.user!.subscriptionTier);
      console.log(`Found matching plan for ${req.user.subscriptionTier}: ${userPlan ? 'Yes' : 'No'}`);
      
      if (userPlan) {
        // Log the plan details
        console.log(`User's specific plan details: tier=${userPlan.tier}, multiplier=${userPlan.multiplier}, coinReward=${userPlan.coinReward}`);
        
        // 1. Apply multiplier to the base reward amount if available (Silver and Gold tiers)
        if (userPlan.multiplier) {
          multiplierApplied = userPlan.multiplier;
          rewardAmount = Math.round(baseRewardAmount * userPlan.multiplier);
          console.log(`Applied ${userPlan.tier} multiplier (${userPlan.multiplier}x) to daily reward: ${baseRewardAmount} -> ${rewardAmount}`);
        } else {
          console.log(`No multiplier found for tier ${userPlan.tier}, using base reward amount`);
        }
        
        // 2. Add the fixed VIP bonus on top of the multiplied base reward
        if (userPlan.coinReward > 0) {
          vipBonusAmount = userPlan.coinReward;
          rewardAmount += vipBonusAmount;
          console.log(`Added ${userPlan.tier} fixed bonus (${vipBonusAmount} coins) to daily reward: Total = ${rewardAmount}`);
        } else {
          console.log(`No coin reward found for tier ${userPlan.tier}`);
        }
      } else {
        console.log(`Warning: User has subscription tier ${req.user.subscriptionTier} but no matching plan configuration was found`);
      }
    } else {
      console.log("User has no subscription tier - using standard reward calculations");
    }
    
    // Update user's streak and last reward date
    await storage.updateLoginStreak(userId, newStreak);
    
    // Add the reward amount to user's balance
    const currentBalance = parseFloat(req.user.balance.toString());
    const newBalance = currentBalance + rewardAmount;
    await storage.updateUserBalance(userId, newBalance);
    
    // Create a record for this login reward with detailed logging
    console.log(`Creating login reward record for user ID ${userId} - day ${newStreak}, amount: ${rewardAmount}`);
    try {
      const loginReward = await storage.createLoginReward({
        userId,
        day: newStreak,
        amount: rewardAmount.toString()
      });
      console.log(`Successfully created login reward record: ${loginReward.id}`);
    } catch (error) {
      console.error(`Error creating login reward record for user ID ${userId}:`, error);
      throw error; // Re-throw to be handled by the outer try/catch
    }
    
    // Create a coin transaction record with detailed logging
    console.log(`Creating coin transaction record for user ID ${userId} - amount: ${rewardAmount}`);
    try {
      const transaction = await storage.createCoinTransaction({
        userId,
        amount: rewardAmount.toString(),
        reason: `Daily Login Reward - Day ${newStreak}`,
        adminId: 0 // System action
      });
      console.log(`Successfully created coin transaction record: ${transaction.id}`);
    } catch (error) {
      console.error(`Error creating coin transaction for user ID ${userId}:`, error);
      throw error; // Re-throw to be handled by the outer try/catch
    }
    
    // Prepare a detailed message for VIP users
    let rewardMessage = `Congratulations! You've received ${rewardAmount} coins for your Day ${newStreak} login reward!`;
    
    // For VIP users, provide a breakdown of the reward calculation
    if (req.user.subscriptionTier && vipBonusAmount > 0) {
      rewardMessage = `Congratulations! You've received ${rewardAmount} coins for your Day ${newStreak} login reward!\n` +
                      `Base reward: ${baseRewardAmount} coins\n` +
                      `${req.user.subscriptionTier.toUpperCase()} multiplier (${multiplierApplied}x): ${Math.round(baseRewardAmount * multiplierApplied) - baseRewardAmount} additional coins\n` +
                      `${req.user.subscriptionTier.toUpperCase()} VIP bonus: ${vipBonusAmount} coins`;
    }
    
    return res.status(200).json({
      success: true,
      message: rewardMessage,
      rewardAmount,
      baseRewardAmount,
      vipBonusAmount: vipBonusAmount || 0,
      multiplier: multiplierApplied,
      day: newStreak,
      newBalance,
      streak: newStreak,
      subscriptionTier: req.user.subscriptionTier || null
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
    let multiplier = 1; // Default multiplier
    let minimumReward = 0; // Minimum reward from subscription
    
    // Make sure user is authenticated
    if (!req.user) {
      console.log("Reward schedule requested by unauthenticated user");
      
      // For unauthenticated users, return the basic schedule without any VIP bonuses
      for (let day = 1; day <= 30; day++) {
        const baseAmount = await storage.getRewardAmountForDay(day);
        rewardSchedule.push({
          day,
          amount: baseAmount,
          baseAmount,
          isMilestone: (day % 7 === 0 || day % 5 === 0 || day === 30)
        });
      }
      
      return res.status(200).json(rewardSchedule);
    }
    
    console.log("Reward Schedule - User data:", {
      id: req.user.id,
      username: req.user.username,
      subscriptionTier: req.user.subscriptionTier || "none"
    });
    
    // If user has a subscription, apply their specific tier bonuses
    if (req.user.subscriptionTier) {
      console.log(`User has subscription tier: ${req.user.subscriptionTier}`);
      
      // Get the subscription plans to find user's plan details
      const subscriptionPlans = await storage.getSubscriptionPlans();
      console.log("Available subscription plans found:", subscriptionPlans.length);
      
      const userPlan = subscriptionPlans.find(plan => plan.tier === req.user!.subscriptionTier);
      console.log("User's plan:", userPlan ? `${userPlan.tier} tier found` : "No matching tier found");
      
      if (userPlan) {
        // Apply the VIP multiplier if exists
        if (userPlan.multiplier) {
          multiplier = userPlan.multiplier;
          console.log(`Applying ${userPlan.tier} multiplier: ${multiplier}x - Standard rewards will be multiplied by this value`);
        }
        
        // Set VIP daily bonus reward
        if (userPlan.coinReward) {
          minimumReward = userPlan.coinReward;
          console.log(`Applying ${userPlan.tier} VIP bonus: ${minimumReward} coins - This will be added on top of the multiplied base rewards`);
        }
      } else {
        console.log(`Warning: User has tier ${req.user.subscriptionTier} but no matching plan was found`);
      }
    } else {
      console.log("User has no subscription tier - using default reward values");
    }
    
    for (let day = 1; day <= 30; day++) {
      // Get base reward amount for this day
      let baseAmount = await storage.getRewardAmountForDay(day);
      let amount = baseAmount;
      
      // Apply VIP subscription benefits if user has one
      if (multiplier !== 1 || minimumReward > 0) {
        // 1. First apply multiplier to base reward
        if (multiplier !== 1) {
          amount = Math.round(baseAmount * multiplier);
        }
        
        // 2. Then add VIP fixed bonus
        if (minimumReward > 0) {
          amount += minimumReward;
        }
      }
      
      // Create a reward object with detailed breakdown for VIP users
      const rewardObject = {
        day,
        amount,
        baseAmount,
        isMilestone: (day % 7 === 0 || day % 5 === 0 || day === 30)
      };
      
      // For VIP users, include the breakdown of the calculation
      if (multiplier !== 1 || minimumReward > 0) {
        Object.assign(rewardObject, {
          multiplier,
          vipBonus: minimumReward,
          calculationBreakdown: {
            baseReward: baseAmount,
            afterMultiplier: Math.round(baseAmount * multiplier),
            bonusAdded: minimumReward
          }
        });
      }
      
      rewardSchedule.push(rewardObject);
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
  app.get("/api/rewards/schedule", authMiddleware, getRewardSchedule);
}