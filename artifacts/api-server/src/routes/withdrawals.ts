import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, withdrawalsTable, walletsTable, transactionsTable, paymentLogsTable, notificationsTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { auditLog } from "../lib/auditLogger";
import { z } from "zod";

const router: IRouter = Router();

const WithdrawBody = z.object({
  amount: z.number().min(100).max(70000),
  method: z.enum(["mpesa", "bank"]).default("mpesa"),
  phone: z.string().optional(),
  accountNumber: z.string().optional(),
});

router.post("/wallet/withdraw", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: number }).userId;
  const parsed = WithdrawBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { amount, method, phone, accountNumber } = parsed.data;

  const [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, userId));
  if (!wallet) {
    res.status(404).json({ error: "Wallet not found" });
    return;
  }

  const balance = parseFloat(wallet.balance as string);
  if (balance <= 0) {
    res.status(400).json({ error: "Insufficient balance" });
    return;
  }
  if (balance < amount) {
    res.status(400).json({ error: `Insufficient balance. Available: KES ${balance.toFixed(2)}` });
    return;
  }

  const wins = await db
    .select()
    .from(transactionsTable)
    .where(and(eq(transactionsTable.userId, userId), eq(transactionsTable.type, "win")))
    .limit(1);
  if (wins.length === 0) {
    res.status(400).json({ error: "Please bet to withdraw" });
    return;
  }

  const pending = await db
    .select()
    .from(withdrawalsTable)
    .where(and(eq(withdrawalsTable.userId, userId), eq(withdrawalsTable.status, "pending")));

  if (pending.length > 0) {
    res.status(400).json({ error: "You already have a pending withdrawal. Wait for it to be processed." });
    return;
  }

  const newBalance = (balance - amount).toFixed(2);
  await db.update(walletsTable).set({ balance: newBalance }).where(eq(walletsTable.userId, userId));

  const [withdrawal] = await db
    .insert(withdrawalsTable)
    .values({ userId, amount: amount.toFixed(2), method, phone: phone ?? null, accountNumber: accountNumber ?? null, status: "pending" })
    .returning();

  await db.insert(transactionsTable).values({
    userId,
    type: "withdrawal",
    amount: (-amount).toFixed(2),
    status: "pending",
    description: `Withdrawal request via ${method.toUpperCase()} — pending approval`,
    reference: `WD-${withdrawal.id}`,
  });

  await db.insert(paymentLogsTable).values({
    userId,
    type: "withdrawal",
    amount: amount.toFixed(2),
    provider: method,
    reference: `WD-${withdrawal.id}`,
    status: "pending",
  });

  await auditLog({ userId, action: "withdrawal_request", entity: "withdrawals", entityId: withdrawal.id, details: { amount, method }, ipAddress: req.ip });

  res.status(201).json({
    id: withdrawal.id,
    amount,
    method,
    status: "pending",
    message: "Withdrawal submitted. Processing within 24 hours.",
  });
});

router.get("/wallet/withdrawals", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: number }).userId;
  const rows = await db
    .select()
    .from(withdrawalsTable)
    .where(eq(withdrawalsTable.userId, userId))
    .orderBy(desc(withdrawalsTable.createdAt))
    .limit(20);

  res.json(
    rows.map((w) => ({
      id: w.id,
      amount: parseFloat(w.amount as string),
      method: w.method,
      status: w.status,
      adminNote: w.adminNote,
      processedAt: w.processedAt instanceof Date ? w.processedAt.toISOString() : w.processedAt,
      createdAt: w.createdAt instanceof Date ? w.createdAt.toISOString() : w.createdAt,
    })),
  );
});

export default router;
