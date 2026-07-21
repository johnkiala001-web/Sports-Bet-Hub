import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, walletsTable, transactionsTable, paymentLogsTable } from "@workspace/db";
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
  
  let phone = (req.body as Record<string, unknown>).phone as string | undefined;
  if (phone && phone.startsWith('0')) {
    phone = '254' + phone.slice(1);
  } else if (phone && phone.startsWith('+')) {
    phone = phone.replace('+', '');
  }
  

  if (method !== "mpesa") {
    res.status(400).json({ error: "Only mpesa deposits are supported right now" });
    return;
  }
  if (!phone) {
    res.status(400).json({ error: "phone is required for mpesa deposits" });
    return;
  }

  const { usersTable } = await import("@workspace/db");
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, userId));
  if (!wallet) {
    res.status(404).json({ error: "Wallet not found" });
    return;
  }

  const [transaction] = await db
    .insert(transactionsTable)
    .values({
      userId,
      type: "deposit",
      amount: amount.toFixed(2),
      status: "pending",
      description: "M-Pesa deposit - awaiting confirmation",
    })
    .returning();

  const [paymentLog] = await db
    .insert(paymentLogsTable)
    .values({
      userId,
      transactionId: transaction.id,
      type: "deposit",
      amount: amount.toFixed(2),
      provider: "mpesa",
      status: "pending",
    })
    .returning();

  try {
    const { initiateSiteADeposit } = await import("../lib/paymentGateway");
    const gatewayResult = await initiateSiteADeposit({
      transactionId: transaction.id,
      amount,
      phone,
    });

    await db
      .update(paymentLogsTable)
      .set({
        reference: gatewayResult.checkoutRequestId ?? null,
        rawResponse: JSON.stringify(gatewayResult),
      })
      .where(eq(paymentLogsTable.id, paymentLog.id));

    res.json({
      transactionId: transaction.id,
      status: "pending",
      message: "Deposit request sent. Check your phone to complete payment.",
    });
  } catch (err) {
    res.status(502).json({ error: "Failed to initiate deposit. Please try again." });
  }
});

router.get("/wallet/deposit/status/:transactionId", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: number }).userId;
  const transactionId = parseInt(req.params.transactionId as string, 10);

  const [transaction] = await db.select().from(transactionsTable).where(eq(transactionsTable.id, transactionId));
  if (!transaction || transaction.userId !== userId) {
    res.status(404).json({ error: "Transaction not found" });
    return;
  }

  res.json({
    transactionId: transaction.id,
    status: transaction.status,
    amount: parseFloat(transaction.amount as string),
    description: transaction.description,
    createdAt: transaction.createdAt instanceof Date ? transaction.createdAt.toISOString() : transaction.createdAt,
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
    .orderBy(desc(transactionsTable.createdAt))
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
