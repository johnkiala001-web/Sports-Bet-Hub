import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, walletsTable, notificationsTable, bonusesTable } from "@workspace/db";
import { RegisterUserBody, LoginUserBody } from "@workspace/api-zod";
import {
  hashPassword,
  comparePassword,
  signToken,
  requireAuth,
  generateReferralCode,
} from "../lib/auth";

const router: IRouter = Router();

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { username, email, password, phone, referralCode } = parsed.data;

  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existing.length > 0) {
    res.status(400).json({ error: "Email already in use" });
    return;
  }

  const passwordHash = await hashPassword(password);
  const userReferralCode = generateReferralCode();

  const [user] = await db.insert(usersTable).values({
    username,
    email,
    phone,
    passwordHash,
    referralCode: userReferralCode,
    referredById: referralCode ?? null,
    role: "user",
  }).returning();

  await db.insert(walletsTable).values({
    userId: user.id,
    balance: "500.00",
    bonusBalance: "100.00",
    currency: "KES",
  });

  await db.insert(notificationsTable).values({
    userId: user.id,
    title: "Welcome to KialaBet!",
    message: "Your account has been created. You have KES 500 demo balance and KES 100 bonus to start betting.",
    type: "info",
  });

  await db.insert(bonusesTable).values({
    userId: user.id,
    type: "welcome",
    amount: "100.00",
    isUsed: false,
  });

  const token = signToken({ userId: user.id, role: user.role });

  res.status(201).json({
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      phone: user.phone,
      role: user.role,
      isSuspended: user.isSuspended,
      referralCode: user.referralCode,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt.toISOString(),
    },
  });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { email, password } = parsed.data;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (!user) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  if (user.isSuspended) {
    res.status(403).json({ error: "Account suspended" });
    return;
  }

  const token = signToken({ userId: user.id, role: user.role });

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      phone: user.phone,
      role: user.role,
      isSuspended: user.isSuspended,
      referralCode: user.referralCode,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt.toISOString(),
    },
  });
});

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: number }).userId;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json({
    id: user.id,
    username: user.username,
    email: user.email,
    phone: user.phone,
    role: user.role,
    isSuspended: user.isSuspended,
    referralCode: user.referralCode,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt.toISOString(),
  });
});

export default router;
