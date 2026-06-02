import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { registerSchema, loginSchema, type User } from "@shared/schema";

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export async function verifyPassword(
  stored: string,
  supplied: string,
): Promise<boolean> {
  const [hashed, salt] = stored.split(".");
  if (!hashed || !salt) return false;
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  if (hashedBuf.length !== suppliedBuf.length) return false;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "SESSION_SECRET must be set in production. Generate one with `openssl rand -hex 32`.",
      );
    }
    console.warn(
      "[AUTH] SESSION_SECRET is not set — using an insecure development default. Set SESSION_SECRET before deploying.",
    );
  }
  return session({
    secret: sessionSecret || "insecure-dev-secret-change-me",
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      // Secure cookies require HTTPS. Enabled in production (Railway/Render/etc.
      // terminate TLS at their proxy, hence trust proxy below).
      secure: process.env.NODE_ENV === "production",
      maxAge: sessionTtl,
    },
  });
}

// Session/user shape kept compatible with the rest of the codebase, which reads
// `req.user.claims.sub` for the authenticated user's id.
type SessionUser = {
  claims: {
    sub: string;
    email: string | null;
    first_name: string | null;
    last_name: string | null;
    profile_image_url: string | null;
  };
  expires_at: number;
};

function toSessionUser(u: User): SessionUser {
  return {
    claims: {
      sub: u.id,
      email: u.email,
      first_name: u.firstName,
      last_name: u.lastName,
      profile_image_url: u.profileImageUrl,
    },
    expires_at: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
  };
}

// Recursively removes `passwordHash` from any object/array before it is sent to
// a client. Single chokepoint so no user-returning endpoint can leak the hash.
function stripSensitiveFields(value: any, seen = new WeakSet<object>()): any {
  if (value === null || typeof value !== "object") return value;
  if (seen.has(value)) return value;
  seen.add(value);
  if (Array.isArray(value)) {
    for (const item of value) stripSensitiveFields(item, seen);
    return value;
  }
  if ("passwordHash" in value) delete (value as any).passwordHash;
  for (const key of Object.keys(value)) {
    const v = (value as any)[key];
    if (v && typeof v === "object") stripSensitiveFields(v, seen);
  }
  return value;
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);

  // Strip sensitive fields (passwordHash) from every JSON response.
  app.use((_req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = (body: any) => originalJson(stripSensitiveFields(body));
    next();
  });

  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(
      { usernameField: "email", passwordField: "password" },
      async (email, password, done) => {
        try {
          const user = await storage.getUserByEmail(email.toLowerCase().trim());
          if (!user || !user.passwordHash) {
            return done(null, false, { message: "Invalid email or password" });
          }
          if (user.isBanned) {
            return done(null, false, { message: "This account has been banned" });
          }
          const ok = await verifyPassword(user.passwordHash, password);
          if (!ok) {
            return done(null, false, { message: "Invalid email or password" });
          }
          return done(null, toSessionUser(user));
        } catch (err) {
          return done(err as Error);
        }
      },
    ),
  );

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) =>
    cb(null, user as Express.User),
  );

  app.post("/api/register", async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ message: parsed.error.errors[0]?.message || "Invalid input" });
    }
    const email = parsed.data.email.toLowerCase().trim();
    try {
      const existing = await storage.getUserByEmail(email);
      if (existing && existing.passwordHash) {
        return res
          .status(409)
          .json({ message: "An account with this email already exists" });
      }
      const passwordHash = await hashPassword(parsed.data.password);
      // If a legacy account exists for this email without a password (e.g. one
      // migrated from the old Replit OIDC login), let the owner claim it by
      // setting a password instead of erroring out.
      const user = existing
        ? await storage.setUserPassword(existing.id, passwordHash)
        : await storage.upsertUser({
            email,
            passwordHash,
            isEmailVerified: true,
          });
      try {
        await storage.updateLoginStreak(user.id);
      } catch (err) {
        console.error("[AUTH] login streak error on register:", err);
      }
      const sessionUser = toSessionUser(user);
      req.login(sessionUser, (err) => {
        if (err) {
          console.error("[AUTH] req.login error after register:", err);
          return res.status(500).json({ message: "Could not start session" });
        }
        return res.status(201).json(sessionUser.claims);
      });
    } catch (err) {
      console.error("[AUTH] register error:", err);
      return res.status(500).json({ message: "Registration failed" });
    }
  });

  app.post("/api/login", (req, res, next) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }
    passport.authenticate(
      "local",
      (
        err: Error | null,
        user: SessionUser | false,
        info: { message?: string } | undefined,
      ) => {
        if (err) return next(err);
        if (!user) {
          return res
            .status(401)
            .json({ message: info?.message || "Invalid email or password" });
        }
        req.login(user, async (loginErr) => {
          if (loginErr) return next(loginErr);
          try {
            await storage.updateLoginStreak(user.claims.sub);
          } catch (streakErr) {
            console.error("[AUTH] login streak error:", streakErr);
          }
          return res.json(user.claims);
        });
      },
    )(req, res, next);
  });

  const handleLogout: RequestHandler = (req, res) => {
    req.logout((err) => {
      if (err) console.error("[AUTH] logout error:", err);
      req.session?.destroy(() => {
        res.clearCookie("connect.sid");
        if (req.method === "POST") {
          res.json({ ok: true });
        } else {
          res.redirect("/");
        }
      });
    });
  };
  app.get("/api/logout", handleLogout);
  app.post("/api/logout", handleLogout);
}

export const isAuthenticated: RequestHandler = (req, res, next) => {
  const user = req.user as SessionUser | undefined;
  if (!req.isAuthenticated() || !user || !user.claims?.sub) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  return next();
};
