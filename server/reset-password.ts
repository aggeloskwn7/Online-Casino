import { Request, Response, Express, NextFunction } from "express";
import { randomBytes } from "crypto";
import { Resend } from "resend";
import { storage } from "./storage";
import { 
  forgotPasswordSchema, 
  passwordResetSchema 
} from "@shared/schema";
import { scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

// Initialize Resend
if (!process.env.RESEND_API_KEY) {
  console.warn("WARNING: RESEND_API_KEY environment variable is not set. Email functionality will not work.");
}

const resend = new Resend(process.env.RESEND_API_KEY);

// Password hashing functions
async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

// Forgot Password endpoint
export async function forgotPassword(req: Request, res: Response) {
  try {
    const result = forgotPasswordSchema.safeParse(req.body);
    
    if (!result.success) {
      return res.status(400).json({ message: "Invalid request", errors: result.error.flatten() });
    }

    const { username } = result.data;
    
    // Find the user
    const user = await storage.getUserByUsername(username);
    
    if (!user) {
      // Don't reveal that the user doesn't exist for security reasons
      return res.status(200).json({ message: "If a user with that username exists, a password reset link has been sent to their email." });
    }
    
    // Check if the user has an email
    if (!user.email) {
      return res.status(400).json({ message: "Your account doesn't have an email address. Please contact support." });
    }
    
    // Generate a unique token
    const token = randomBytes(32).toString("hex");
    
    // Store the token with expiry (24 hours)
    await storage.createPasswordResetToken(user.id, token, 24);
    
    // Construct the reset URL
    // In production this would be something like https://yourapp.com/reset-password?token=...
    const resetUrl = `${process.env.DOMAIN || 'http://localhost:5000'}/reset-password?token=${token}`;
    
    // Send the email using Resend
    const data = await resend.emails.send({
      from: "Rage Bet <noreply@ragebet.online>",
      to: user.email,
      subject: "Reset your Rage Bet password",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #5E35B1;">Reset Your Rage Bet Password</h2>
          <p>Hi ${user.username},</p>
          <p>We received a request to reset your Rage Bet password. Click the button below to set a new password:</p>
          <a href="${resetUrl}" style="display: inline-block; background-color: #5E35B1; color: white; text-decoration: none; padding: 10px 20px; border-radius: 4px; margin: 15px 0;">Reset Password</a>
          <p>This link will expire in 24 hours.</p>
          <p>If you didn't request a password reset, please ignore this email or contact our support team if you have concerns.</p>
          <p>Thank you,<br>The Rage Bet Team</p>
        </div>
      `,
    });
    
    if (data.error) {
      console.error("Error sending password reset email:", data.error);
      return res.status(500).json({ message: "Failed to send password reset email. Please try again later." });
    }
    
    // Return success without revealing if the user exists for security
    return res.status(200).json({ message: "If a user with that username exists, a password reset link has been sent to their email." });
    
  } catch (error) {
    console.error("Forgot password error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

// Verify token (used to check if token is valid before showing reset form)
export async function verifyResetToken(req: Request, res: Response) {
  try {
    const { token } = req.query;
    
    if (!token || typeof token !== "string") {
      return res.status(400).json({ message: "Invalid or missing token" });
    }
    
    const resetToken = await storage.getPasswordResetToken(token);
    
    // Check if token exists and is valid
    if (!resetToken || resetToken.isUsed || new Date(resetToken.expiresAt) < new Date()) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }
    
    return res.status(200).json({ message: "Token is valid" });
    
  } catch (error) {
    console.error("Verify token error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

// Reset Password endpoint
export async function resetPassword(req: Request, res: Response) {
  try {
    const { token } = req.query;
    
    if (!token || typeof token !== "string") {
      return res.status(400).json({ message: "Invalid or missing token" });
    }
    
    const result = passwordResetSchema.safeParse(req.body);
    
    if (!result.success) {
      return res.status(400).json({ message: "Invalid request", errors: result.error.flatten() });
    }
    
    const { password } = result.data;
    
    // Find the token in the database
    const resetToken = await storage.getPasswordResetToken(token);
    
    // Check if token exists and is valid
    if (!resetToken || resetToken.isUsed || new Date(resetToken.expiresAt) < new Date()) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }
    
    // Hash the new password
    const hashedPassword = await hashPassword(password);
    
    // Update the user's password
    await storage.updateUserPassword(resetToken.userId, hashedPassword);
    
    // Mark the token as used
    await storage.markPasswordResetTokenAsUsed(resetToken.id);
    
    // Get the user to send a confirmation email
    const user = await storage.getUser(resetToken.userId);
    
    if (user && user.email) {
      // Send confirmation email
      await resend.emails.send({
        from: "Rage Bet <noreply@ragebet.online>",
        to: user.email,
        subject: "Your Rage Bet password has been reset",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #5E35B1;">Password Reset Successful</h2>
            <p>Hi ${user.username},</p>
            <p>Your Rage Bet password has been successfully reset.</p>
            <p>If you did not request this change, please contact our support team immediately.</p>
            <p>Thank you,<br>The Rage Bet Team</p>
          </div>
        `,
      });
    }
    
    return res.status(200).json({ message: "Password has been reset successfully" });
    
  } catch (error) {
    console.error("Reset password error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

// Update Email endpoint
export async function updateEmail(req: Request, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    const { email } = req.body;
    
    if (!email || typeof email !== "string" || !email.includes('@')) {
      return res.status(400).json({ message: "Invalid email address" });
    }
    
    // Check if email is already in use
    const existingUser = await storage.getUserByEmail(email);
    if (existingUser && existingUser.id !== req.user.id) {
      return res.status(400).json({ message: "Email is already in use by another account" });
    }
    
    // Update the user's email
    const updatedUser = await storage.updateUserEmail(req.user.id, email);
    
    // Send confirmation email
    await resend.emails.send({
      from: "Rage Bet <noreply@ragebet.online>",
      to: email,
      subject: "Email address updated for your Rage Bet account",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #5E35B1;">Email Updated Successfully</h2>
          <p>Hi ${updatedUser.username},</p>
          <p>Your email address for Rage Bet has been successfully updated to ${email}.</p>
          <p>If you did not request this change, please contact our support team immediately.</p>
          <p>Thank you,<br>The Rage Bet Team</p>
        </div>
      `,
    });
    
    return res.status(200).json({ message: "Email updated successfully", user: updatedUser });
    
  } catch (error) {
    console.error("Update email error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

// Setup Password Reset Routes
export function setupPasswordResetRoutes(app: Express) {
  app.post("/api/forgot-password", forgotPassword);
  app.get("/api/verify-reset-token", verifyResetToken);
  app.post("/api/reset-password", resetPassword);
  app.post("/api/update-email", updateEmail);
}