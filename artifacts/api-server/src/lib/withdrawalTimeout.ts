import { eq, and, lt } from "drizzle-orm";
import { db, withdrawalsTable, walletsTable, transactionsTable, paymentLogsTable } from "@workspace/db";
import { logger } from "./logger";

const TIMEOUT_MINUTES = 12;

export async function runWithdrawalTimeout() {
  const cutoff = new Date(Date.now() - TIMEOUT_MINUTES * 60_000);

  const stale = await db
    .select()
    .from(withdrawalsTable)
    .where(and(eq(withdrawalsTable.status, "pending"), lt(withdrawalsTable.createdAt, cutoff)));

  if (stale.length === 0) return;

  for (const withdrawal of stale) {
    try {
      const amount = parseFloat(withdrawal.amount as string);

      await db
        .update(withdrawalsTable)
        .set({ status: "rejected", adminNote: "Auto-reverted after timeout", processedAt: new Date() })
        .where(eq(withdrawalsTable.id, withdrawal.id));

      const [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, withdrawal.userId));
      if (wallet) {
        const refunded = (parseFloat(wallet.balance as string) + amount).toFixed(2);
        await db.update(walletsTable).set({ balance: refunded }).where(eq(walletsTable.userId, withdrawal.userId));

        await db.insert(transactionsTable).values({
          userId: withdrawal.userId,
          type: "refund",
          amount: amount.toFixed(2),
          status: "completed",
          description: `Withdrawal #${withdrawal.id} timed out — KES ${amount.toFixed(2)} refunded`,
          reference: `WD-${withdrawal.id}-REFUND`,
        });
      }

      await db
        .update(paymentLogsTable)
        .set({ status: "failed" })
        .where(eq(paymentLogsTable.reference, `WD-${withdrawal.id}`));

      logger.info({ withdrawalId: withdrawal.id, userId: withdrawal.userId, amount }, "Withdrawal auto-reverted after timeout");
    } catch (err) {
      logger.warn({ withdrawalId: withdrawal.id, err }, "Failed to auto-revert withdrawal");
    }
  }
}

export function startWithdrawalTimeout(intervalMs = 60_000) {
  runWithdrawalTimeout().catch((err) => logger.error({ err }, "Withdrawal timeout job error"));
  return setInterval(() => {
    runWithdrawalTimeout().catch((err) => logger.error({ err }, "Withdrawal timeout job error"));
  }, intervalMs);
}
