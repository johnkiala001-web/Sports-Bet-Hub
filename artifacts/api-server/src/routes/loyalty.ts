import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, loyaltyPointsTable, promotionsTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { getLoyaltyBalance, redeemLoyaltyPoints } from "../lib/bonusEngine";
import { z } from "zod";

const router: IRouter = Router();

router.get("/loyalty", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: number }).userId;
  const balance = await getLoyaltyBalance(userId);

  const history = await db
    .select()
    .from(loyaltyPointsTable)
    .where(eq(loyaltyPointsTable.userId, userId))
    .limit(20);

  res.json({
    balance,
    kesValue: (balance * 0.1).toFixed(2),
    history: history.map((r) => ({
      id: r.id,
      points: r.points,
      action: r.action,
      referenceId: r.referenceId,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
    })),
  });
});

router.post("/loyalty/redeem", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: number }).userId;
  const parsed = z.object({ points: z.number().int().min(100) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Minimum redemption is 100 points (KES 10)" });
    return;
  }

  try {
    const kesValue = await redeemLoyaltyPoints(userId, parsed.data.points);
    res.json({ success: true, kesValue, message: `KES ${kesValue} added to your bonus wallet` });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Redemption failed";
    res.status(400).json({ error: message });
  }
});

router.get("/promotions", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(promotionsTable)
    .where(eq(promotionsTable.isActive, true));

  res.json(
    rows.map((p) => ({
      id: p.id,
      name: p.name,
      type: p.type,
      description: p.description,
      bonusPercent: p.bonusPercent ? parseFloat(p.bonusPercent as string) : null,
      bonusAmount: p.bonusAmount ? parseFloat(p.bonusAmount as string) : null,
      minDeposit: p.minDeposit ? parseFloat(p.minDeposit as string) : null,
      wageringRequirement: parseFloat(p.wageringRequirement as string),
      maxBonus: p.maxBonus ? parseFloat(p.maxBonus as string) : null,
      expiresAt: p.expiresAt instanceof Date ? p.expiresAt.toISOString() : p.expiresAt,
    })),
  );
});

export default router;
