import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, walletsTable, transactionsTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

// Deduct stake immediately when a bet is placed
router.post("/aviator/bet", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: number }).userId;
  const amount = Number((req.body as Record<string, unknown>).amount);

  if (!amount || isNaN(amount) || amount < 10) {
    res.status(400).json({ error: "Minimum bet is KES 10" });
    return;
  }

  const [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, userId));
  if (!wallet) {
    res.status(404).json({ error: "Wallet not found" });
    return;
  }

  const balance = parseFloat(wallet.balance as string);
  if (balance < amount) {
    res.status(400).json({ error: "Insufficient balance" });
    return;
  }

  const newBalance = (balance - amount).toFixed(2);
  await db.update(walletsTable).set({ balance: newBalance }).where(eq(walletsTable.userId, userId));

  const [transaction] = await db
    .insert(transactionsTable)
    .values({
      userId,
      type: "bet",
      amount: amount.toFixed(2),
      status: "completed",
      description: "Aviator bet placed",
    })
    .returning();

  res.json({ transactionId: transaction.id, balance: parseFloat(newBalance) });
});

// Credit winnings when a player cashes out
router.post("/aviator/cashout", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: number }).userId;
  const amount = Number((req.body as Record<string, unknown>).amount);
  const multiplier = Number((req.body as Record<string, unknown>).multiplier);

  if (!amount || isNaN(amount) || amount < 10) {
    res.status(400).json({ error: "Invalid bet amount" });
    return;
  }
  if (!multiplier || isNaN(multiplier) || multiplier < 1) {
    res.status(400).json({ error: "Invalid multiplier" });
    return;
  }

  const [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, userId));
  if (!wallet) {
    res.status(404).json({ error: "Wallet not found" });
    return;
  }

  const winnings = parseFloat((amount * multiplier).toFixed(2));
  const balance = parseFloat(wallet.balance as string);
  const newBalance = (balance + winnings).toFixed(2);
  await db.update(walletsTable).set({ balance: newBalance }).where(eq(walletsTable.userId, userId));

  const [transaction] = await db
    .insert(transactionsTable)
    .values({
      userId,
      type: "win",
      amount: winnings.toFixed(2),
      status: "completed",
      description: `Aviator cash out at ${multiplier.toFixed(2)}x`,
    })
    .returning();

  res.json({ transactionId: transaction.id, balance: parseFloat(newBalance), winnings });
});

export default router;
