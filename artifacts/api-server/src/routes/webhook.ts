import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, transactionsTable, walletsTable, paymentLogsTable, webhookLogsTable } from "@workspace/db";
import { verifyWebhookSignature } from "../lib/webhookVerification";
import { logger } from "../lib/logger";
import type { RawBodyRequest } from "../middlewares/rawBody";

const router: IRouter = Router();

interface SiteAWebhookPayload {
  event: "payment.success" | "payment.failed" | string;
  transaction_id?: string | number;
  checkout_request_id?: string;
  payment_id?: string;
  receipt?: string;
  result_code?: string | number;
  result_desc?: string;
  [key: string]: unknown;
}

router.post("/", async (req, res): Promise<void> => {
  const rawReq = req as RawBodyRequest;
  const rawBody = rawReq.rawBody || "";

  const headers = {
    signature: req.header("X-Webhook-Signature") || undefined,
    timestamp: req.header("X-Webhook-Timestamp") || undefined,
    event: req.header("X-Webhook-Event") || undefined,
    authorization: req.header("Authorization") || undefined,
  };

  const verification = verifyWebhookSignature(rawBody, headers);

  let payload: SiteAWebhookPayload | null = null;
  try {
    payload = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    payload = null;
  }

  const [logEntry] = await db
    .insert(webhookLogsTable)
    .values({
      headers: headers as Record<string, unknown>,
      payload: (payload ?? {}) as Record<string, unknown>,
      signature: headers.signature ?? null,
      verified: verification.valid,
    })
    .returning();

  if (!verification.valid) {
    logger.warn({ reason: verification.reason }, "Rejected webhook: verification failed");
    res.status(401).json({ error: verification.reason });
    return;
  }

  if (!payload || !payload.event) {
    res.status(400).json({ error: "Invalid webhook payload" });
    return;
  }

  const idempotencyKey = payload.checkout_request_id || payload.payment_id;
  if (!idempotencyKey) {
    res.status(400).json({ error: "Missing idempotency key" });
    return;
  }

  // Idempotency: look up the payment_logs row created at deposit-initiation time.
  const [paymentLog] = await db
    .select()
    .from(paymentLogsTable)
    .where(eq(paymentLogsTable.reference, idempotencyKey));

  if (!paymentLog) {
    logger.warn({ idempotencyKey }, "Webhook for unknown payment_logs reference");
    res.status(200).json({ message: "Acknowledged" });
    return;
  }

  if (paymentLog.status !== "pending") {
    if (logEntry) await db.update(webhookLogsTable).set({ processed: true }).where(eq(webhookLogsTable.id, logEntry.id));
    res.status(200).json({ message: "Already processed" });
    return;
  }

  const transactionId = paymentLog.transactionId;
  const [transaction] = transactionId
    ? await db.select().from(transactionsTable).where(eq(transactionsTable.id, transactionId))
    : [];

  if (!transaction) {
    logger.error({ transactionId }, "payment_logs pointed at missing transaction");
    res.status(200).json({ message: "Acknowledged" });
    return;
  }

  try {
    if (payload.event === "payment.success") {
      await db.update(paymentLogsTable).set({
        status: "completed",
        rawResponse: JSON.stringify(payload),
      }).where(eq(paymentLogsTable.id, paymentLog.id));

      await db.update(transactionsTable).set({
        status: "completed",
        description: `M-Pesa deposit confirmed${payload.receipt ? ` (receipt ${payload.receipt})` : ""}`,
      }).where(eq(transactionsTable.id, transaction.id));

      const [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, transaction.userId));
      if (wallet) {
        const newBalance = (parseFloat(wallet.balance as string) + parseFloat(transaction.amount as string)).toFixed(2);
        await db.update(walletsTable).set({ balance: newBalance }).where(eq(walletsTable.userId, transaction.userId));
      }
    } else if (payload.event === "payment.failed") {
      await db.update(paymentLogsTable).set({
        status: "failed",
        rawResponse: JSON.stringify(payload),
      }).where(eq(paymentLogsTable.id, paymentLog.id));

      await db.update(transactionsTable).set({
        status: "failed",
        description: `M-Pesa deposit failed${payload.result_desc ? `: ${payload.result_desc}` : ""}`,
      }).where(eq(transactionsTable.id, transaction.id));
    } else {
      logger.warn({ event: payload.event }, "Unrecognized webhook event");
    }

    if (logEntry) await db.update(webhookLogsTable).set({ processed: true }).where(eq(webhookLogsTable.id, logEntry.id));
    res.status(200).json({ success: true });
  } catch (err) {
    logger.error({ err, transactionId: transaction.id }, "Failed to process webhook");
    res.status(500).json({ error: "Processing failed" });
  }
});

export default router;
