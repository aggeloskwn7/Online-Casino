import type { Express, Request, Response } from "express";
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
import Stripe from 'stripe';
import { createPaymentIntentSchema, CoinPackage } from '@shared/schema';

// Define our coin packages
const coinPackages: CoinPackage[] = [
  {
    id: 'small',
    name: 'Starter Package',
    coins: 5000,
    price: 4.99,
    featured: false,
    discount: 0
  },
  {
    id: 'medium',
    name: 'Popular Package',
    coins: 15000,
    price: 9.99,
    featured: true,
    discount: 15
  },
  {
    id: 'large',
    name: 'Gold Package',
    coins: 50000,
    price: 24.99,
    featured: false,
    discount: 20
  },
  {
    id: 'whale',
    name: 'Whale Package',
    coins: 150000,
    price: 49.99,
    featured: false,
    discount: 25
  }
];

// Initialize Stripe with the secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia'
});

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
  
  // Coin purchase routes
  app.get("/api/coins/packages", (req: Request, res: Response) => {
    res.json(coinPackages);
  });
  
  app.post("/api/coins/create-payment-intent", authMiddleware, async (req: Request, res: Response) => {
    try {
      const { packageId } = createPaymentIntentSchema.parse(req.body);
      
      // Find the selected package
      const selectedPackage = coinPackages.find(pkg => pkg.id === packageId);
      if (!selectedPackage) {
        return res.status(400).json({ error: "Invalid package ID" });
      }
      
      // Calculate amount in cents for Stripe
      const amount = Math.round(selectedPackage.price * 100);
      
      // Create a payment intent with Stripe
      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency: "usd",
        metadata: {
          userId: req.user!.id.toString(),
          packageId,
          coins: selectedPackage.coins.toString()
        }
      });
      
      // Create a record in our database
      await storage.createPayment({
        userId: req.user!.id,
        amount: selectedPackage.price.toString(),
        coins: selectedPackage.coins.toString(),
        stripeSessionId: paymentIntent.id,
        status: 'pending'
      });
      
      // Return the client secret to the client
      res.json({
        clientSecret: paymentIntent.client_secret,
        packageDetails: selectedPackage
      });
    } catch (error: any) {
      console.error("Error creating payment intent:", error);
      res.status(400).json({
        error: error.message || "Failed to create payment"
      });
    }
  });
  
  // Webhook for Stripe events
  app.post("/api/coins/webhook", async (req: Request, res: Response) => {
    const sig = req.headers['stripe-signature'];
    
    let event;
    
    try {
      // Verify the event came from Stripe
      // In production, you should set up your webhook secret
      if (!sig) {
        return res.status(400).json({ error: "Missing Stripe signature" });
      }
      
      // Process the event
      event = req.body;
      
      if (event.type === 'payment_intent.succeeded') {
        const paymentIntent = event.data.object;
        
        // Get our payment from the database
        const payment = await storage.getPaymentBySessionId(paymentIntent.id);
        
        if (payment) {
          // Update payment status
          await storage.updatePaymentStatus(payment.id, 'completed');
          
          // Add coins to user's balance
          const userId = parseInt(paymentIntent.metadata.userId);
          const coins = parseInt(paymentIntent.metadata.coins);
          const user = await storage.getUser(userId);
          
          if (user) {
            const currentBalance = parseFloat(user.balance.toString());
            const newBalance = currentBalance + coins;
            
            // Update user balance
            await storage.updateUserBalance(userId, newBalance);
            
            // Create coin transaction record (adminId 0 means system)
            await storage.createCoinTransaction({
              userId,
              amount: coins.toString(),
              reason: `Purchased ${coins} coins`,
              adminId: 0
            });
          }
        }
      }
      
      // Return a 200 response to acknowledge receipt of the event
      res.json({ received: true });
    } catch (err: any) {
      console.error('Error handling webhook:', err.message);
      res.status(400).send(`Webhook Error: ${err.message}`);
    }
  });
  
  // Payment history
  app.get("/api/coins/purchases", authMiddleware, async (req: Request, res: Response) => {
    try {
      const payments = await storage.getUserPayments(req.user!.id);
      res.json(payments);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Set up admin routes
  setupAdminRoutes(app);

  const httpServer = createServer(app);

  return httpServer;
}
