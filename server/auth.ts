import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  console.log("Setting up authentication...");
  
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "crypto-casino-secret-key",
    resave: true, // Force the session to be saved back to the store
    saveUninitialized: true, // Save uninitialized sessions
    store: storage.sessionStore,
    name: 'casino.sid', // use a unique name for our session cookie
    rolling: true, // refresh session expiry with each request
    cookie: {
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      httpOnly: true,
      sameSite: 'none', // Allow cross-site cookies
      secure: false, // Allow non-HTTPS cookies in development
      path: '/'
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user || !(await comparePasswords(password, user.password))) {
          return done(null, false);
        } else {
          return done(null, user);
        }
      } catch (error) {
        return done(error);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      if (!user) {
        return done(null, false);
      }
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      console.log("Registration attempt:", req.body.username);
      
      const existingUser = await storage.getUserByUsername(req.body.username);
      if (existingUser) {
        console.log("Registration failed: Username already exists");
        return res.status(400).json({ message: "Username already exists" });
      }

      const user = await storage.createUser({
        ...req.body,
        password: await hashPassword(req.body.password),
      });
      
      console.log("User created successfully:", user.id, user.username);

      req.login(user, (err) => {
        if (err) {
          console.error("Session creation error after registration:", err);
          return next(err);
        }
        
        console.log("Auto login after registration successful. Session ID:", req.sessionID);
        
        // Return the user without the password
        const { password, ...safeUser } = user;
        res.status(201).json(safeUser);
      });
    } catch (error) {
      console.error("Registration error:", error);
      next(error);
    }
  });

  app.post("/api/login", (req, res, next) => {
    console.log("Login attempt:", req.body.username);
    
    passport.authenticate("local", (err: any, user: SelectUser | false, info: any) => {
      if (err) {
        console.error("Login error:", err);
        return next(err);
      }
      
      if (!user) {
        console.log("Login failed: Invalid credentials");
        return res.status(401).json({ message: "Invalid credentials" });
      }
      
      req.login(user, (err) => {
        if (err) {
          console.error("Session login error:", err);
          return next(err);
        }
        
        console.log("Login successful for user:", user.username, "Session ID:", req.sessionID);
        
        // Return the user without the password
        const { password, ...safeUser } = user;
        res.status(200).json(safeUser);
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    console.log("Logout attempt: isAuthenticated():", req.isAuthenticated(),
                "User:", req.user?.username,
                "Session ID:", req.sessionID);
                
    if (!req.isAuthenticated()) {
      console.log("Logout called without active session");
      return res.sendStatus(200); // Still return success to client
    }
    
    req.logout((err) => {
      if (err) {
        console.error("Logout error:", err);
        return next(err);
      }
      console.log("User logged out successfully");
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    console.log("User API check: isAuthenticated():", req.isAuthenticated(),
                "Session ID:", req.sessionID,
                "Cookies:", req.headers.cookie);
    
    if (!req.isAuthenticated()) {
      console.log("User API Unauthorized - No valid session");
      return res.sendStatus(401);
    }
    
    console.log("User API Authorized - User:", req.user?.username);
    
    // Return the user without the password
    const { password, ...safeUser } = req.user as SelectUser;
    res.json(safeUser);
  });
}
