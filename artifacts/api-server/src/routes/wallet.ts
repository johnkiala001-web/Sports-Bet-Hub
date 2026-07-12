import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, walletsTable, transactionsTable } from "@workspace/db";
import { DepositFundsBody, ListTransactionsQueryParams } from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

router.get("/wallet", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: number }).userId;
  const [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, userId));
  if (!wallet) {
    res.status(404).json({ error: "Wallet not found" });
    return;
  }

  res.json({
    id: wallet.id,
    userId: wallet.userId,
    balance: parseFloat(wallet.balance as string),
    bonusBalance: parseFloat(wallet.bonusBalance as string),
    currency: wallet.currency,
  });
});

router.post("/wallet/deposit", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: number }).userId;
  const parsed = DepositFundsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { amount, method } = parsed.data;
  const depositPhone = (req.body as Record<string, unknown>).phone as string | undefined;

  // For M-Pesa: validate the phone matches the user's registered phone
  if (method === "mpesa" && depositPhone) {
    const { usersTable } = await import("@workspace/db");
    const [user] = await db.select({ phone: usersTable.phone }).from(usersTable).where(eq(usersTable.id, userId));
    if (user) {
      // Normalize both for comparison
      const normalize = (p: string) => p.replace(/[\s\-\(\)]/g, "").replace(/^\+/, "");
      const userPhone = normalize(user.phone);
      const reqPhone  = normalize(depositPhone);
      if (userPhone !== reqPhone && !reqPhone.endsWith(userPhone.slice(-9)) && !userPhone.endsWith(reqPhone.slice(-9))) {
        res.status(400).json({ error: `You can only deposit from your registered M-Pesa number (${user.phone})` });
        return;
      }
    }
  }

  const [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, userId));
  if (!wallet) {
    res.status(404).json({ error: "Wallet not found" });
    return;
  }

  const newBalance = (parseFloat(wallet.balance as string) + amount).toFixed(2);
  const [updated] = await db
    .update(walletsTable)
    .set({ balance: newBalance })
    .where(eq(walletsTable.userId, userId))
    .returning();

  await db.insert(transactionsTable).values({
    userId,
    type: "deposit",
    amount: amount.toFixed(2),
    status: "completed",
    description: `Demo deposit via ${method.toUpperCase()}`,
  });

  res.json({
    id: updated.id,
    userId: updated.userId,
    balance: parseFloat(updated.balance as string),
    bonusBalance: parseFloat(updated.bonusBalance as string),
    currency: updated.currency,
  });
});

router.get("/wallet/transactions", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: number }).userId;
  const parsed = ListTransactionsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { limit = 50, offset = 0 } = parsed.data;

  const rows = await db
    .select()
    .from(transactionsTable)
    .where(eq(transactionsTable.userId, userId))
    .orderBy(transactionsTable.createdAt)
    .limit(Number(limit))
    .offset(Number(offset));

  res.json(
    rows.map((t) => ({
      id: t.id,
      type: t.type,
      amount: parseFloat(t.amount as string),
      status: t.status,
      description: t.description,
      createdAt: t.createdAt instanceof Date ? t.createdAt.toISOString() : t.createdAt,
    })),
  );
});

export default router;
