import { Router, type IRouter } from "express";
import { eq, and, gt } from "drizzle-orm";
import { db, usersTable, walletsTable, notificationsTable, bonusesTable, otpCodesTable } from "@workspace/db";
import { RegisterUserBody, LoginUserBody, VerifyOtpBody } from "@workspace/api-zod";
import {
  hashPassword,
  comparePassword,
  signToken,
  requireAuth,
  generateReferralCode,
} from "../lib/auth";

const router: IRouter = Router();

/** Normalize Kenyan phone to a consistent format */
function normalizePhone(raw: string): string {
  const s = raw.replace(/[\s\-\(\)]/g, "");
  // 07XXXXXXXX → 2547XXXXXXXX
  if (/^07\d{8}$/.test(s)) return "254" + s.slice(1);
  // 01XXXXXXXX → 2541XXXXXXXX
  if (/^01\d{8}$/.test(s)) return "254" + s.slice(1);
  // +254... → 254...
  if (s.startsWith("+")) return s.slice(1);
  return s;
}

/** Generate a 6-digit OTP code */
function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ─── REGISTER (phone + password) ─────────────────────────────────────────────
router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Phone number and password are required" });
    return;
  }

  const { phone: rawPhone, password } = parsed.data;
  const phone = normalizePhone(rawPhone);

  // Validate phone format
  if (!/^(254|0)\d{9}$/.test(phone) && !/^\d{10,13}$/.test(phone)) {
    res.status(400).json({ error: "Enter a valid Kenyan phone number (e.g. 0712 345 678)" });
    return;
  }

  // Check phone not already registered and verified
  const [existing] = await db.select().from(usersTable).where(eq(usersTable.phone, phone));
  if (existing && existing.isPhoneVerified) {
    res.status(400).json({ error: "This phone number is already registered. Please log in." });
    return;
  }

  const passwordHash = await hashPassword(password);
  const referralCode = generateReferralCode();

  if (existing && !existing.isPhoneVerified) {
    // Re-registration attempt — update password and resend OTP
    await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, existing.id));
  } else {
    // New user — auto-generate unique username and email
    const suffix = phone.slice(-8);
    const username = `KB${suffix}`;
    const email = `${phone}@kiala.bet`;

    await db.insert(usersTable).values({
      username,
      email,
      phone,
      passwordHash,
      referralCode,
      isPhoneVerified: false,
      role: "user",
    });
  }

  // Invalidate old OTPs for this phone
  await db.update(otpCodesTable).set({ used: true }).where(eq(otpCodesTable.phone, phone));

  // Generate and store new OTP (expires in 10 minutes)
  const code = generateOtp();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await db.insert(otpCodesTable).values({ phone, code, expiresAt });

  req.log.info({ phone }, "OTP generated for registration");

  res.status(201).json({
    phone,
    demoCode: code, // In production this would be sent via SMS only
  });
});

// ─── VERIFY OTP (completes registration) ────────────────────────────────────
router.post("/auth/verify-otp", async (req, res): Promise<void> => {
  const parsed = VerifyOtpBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Phone and code are required" });
    return;
  }

  const { phone: rawPhone, code } = parsed.data;
  const phone = normalizePhone(rawPhone);

  // Find valid OTP
  const now = new Date();
  const [otp] = await db
    .select()
    .from(otpCodesTable)
    .where(
      and(
        eq(otpCodesTable.phone, phone),
        eq(otpCodesTable.code, code),
        eq(otpCodesTable.used, false),
        gt(otpCodesTable.expiresAt, now)
      )
    );

  if (!otp) {
    res.status(400).json({ error: "Invalid or expired verification code. Please try again." });
    return;
  }

  // Find user
  const [user] = await db.select().from(usersTable).where(eq(usersTable.phone, phone));
  if (!user) {
    res.status(400).json({ error: "Account not found. Please register first." });
    return;
  }

  // Mark OTP used + user verified
  await db.update(otpCodesTable).set({ used: true }).where(eq(otpCodesTable.id, otp.id));
  await db.update(usersTable).set({ isPhoneVerified: true }).where(eq(usersTable.id, user.id));

  // Create wallet (only if it doesn't already exist)
  const [existingWallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, user.id));
  if (!existingWallet) {
    await db.insert(walletsTable).values({
      userId: user.id,
      balance: "500.00",
      bonusBalance: "100.00",
      currency: "KES",
    });

    await db.insert(notificationsTable).values({
      userId: user.id,
      title: "Welcome to KialaBet!",
      message: "Your account is verified. You have KES 500 demo balance to start betting!",
      type: "info",
    });

    await db.insert(bonusesTable).values({
      userId: user.id,
      type: "welcome",
      amount: "100.00",
      isUsed: false,
    });
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

// ─── LOGIN (phone + password) ────────────────────────────────────────────────
router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Phone number and password are required" });
    return;
  }

  const { phone: rawPhone, password } = parsed.data;
  const phone = normalizePhone(rawPhone);

  // Look up by phone; fallback to email for old accounts
  let [user] = await db.select().from(usersTable).where(eq(usersTable.phone, phone));
  if (!user) {
    // Backward compat: try treating input as email
    [user] = await db.select().from(usersTable).where(eq(usersTable.email, rawPhone));
  }

  if (!user) {
    res.status(401).json({ error: "Invalid phone number or password" });
    return;
  }

  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid phone number or password" });
    return;
  }

  if (user.isSuspended) {
    res.status(403).json({ error: "Account suspended. Contact support." });
    return;
  }

  if (!user.isPhoneVerified) {
    res.status(403).json({ error: "Phone number not verified. Please complete registration." });
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

// ─── ME ─────────────────────────────────────────────────────────────────────
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
