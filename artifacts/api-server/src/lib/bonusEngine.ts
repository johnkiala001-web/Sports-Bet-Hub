import { eq, and, count } from "drizzle-orm";
import {
  db,
  walletsTable,
  transactionsTable,
  bonusesTable,
  notificationsTable,
  loyaltyPointsTable,
} from "@workspace/db";
import { logger } from "./logger";

export async function grantDepositBonus(userId: number, depositAmount: number) {
  const existing = await db
    .select({ count: count() })
    .from(transactionsTable)
    .where(and(eq(transactionsTable.userId, userId), eq(transactionsTable.type, "deposit")));

  if (Number(existing[0].count) !== 1) return;

  const bonusAmount = Math.min(depositAmount, 5000);

  const [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, userId));
  if (!wallet) return;

  const newBonus = (parseFloat(wallet.bonusBalance as string) + bonusAmount).toFixed(2);
  await db.update(walletsTable).set({ bonusBalance: newBonus }).where(eq(walletsTable.userId, userId));

  await db.insert(bonusesTable).values({
    userId,
    type: "deposit_bonus",
    amount: bonusAmount.toFixed(2),
    isUsed: false,
    wageringRequirement: (bonusAmount * 5).toFixed(2),
    wageringProgress: "0.00",
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });

  await db.insert(transactionsTable).values({
    userId,
    type: "bonus",
    amount: bonusAmount.toFixed(2),
    status: "completed",
    description: `First deposit bonus — KES ${bonusAmount.toFixed(2)} added to bonus wallet`,
  });

  await db.insert(notificationsTable).values({
    userId,
    title: "🎁 Deposit Bonus!",
    message: `KES ${bonusAmount.toFixed(2)} bonus added for your first deposit! Wager 5x to unlock.`,
    type: "success",
  });

  logger.info({ userId, bonusAmount }, "Deposit bonus granted");
}

export async function grantCashback(userId: number, weeklyNetLoss: number) {
  if (weeklyNetLoss <= 0) return;
  const cashbackAmount = Math.max(weeklyNetLoss * 0.1, 0);
  if (cashbackAmount < 10) return;

  const [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, userId));
  if (!wallet) return;

  const newBonus = (parseFloat(wallet.bonusBalance as string) + cashbackAmount).toFixed(2);
  await db.update(walletsTable).set({ bonusBalance: newBonus }).where(eq(walletsTable.userId, userId));

  await db.insert(bonusesTable).values({
    userId,
    type: "cashback",
    amount: cashbackAmount.toFixed(2),
    isUsed: false,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  await db.insert(transactionsTable).values({
    userId,
    type: "bonus",
    amount: cashbackAmount.toFixed(2),
    status: "completed",
    description: `Weekly cashback — 10% of KES ${weeklyNetLoss.toFixed(2)} net loss`,
  });

  await db.insert(notificationsTable).values({
    userId,
    title: "💰 Weekly Cashback!",
    message: `KES ${cashbackAmount.toFixed(2)} cashback (10% of weekly losses) added to your wallet.`,
    type: "success",
  });

  logger.info({ userId, cashbackAmount }, "Cashback granted");
}

export async function grantFreeBet(userId: number, amount: number, reason: string) {
  await db.insert(bonusesTable).values({
    userId,
    type: "free_bet",
    amount: amount.toFixed(2),
    isUsed: false,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  await db.insert(notificationsTable).values({
    userId,
    title: "🎯 Free Bet!",
    message: `You received a KES ${amount.toFixed(2)} free bet. ${reason}`,
    type: "success",
  });

  logger.info({ userId, amount, reason }, "Free bet granted");
}

export async function trackWageringProgress(userId: number, stakedAmount: number) {
  const activeBonuses = await db
    .select()
    .from(bonusesTable)
    .where(and(eq(bonusesTable.userId, userId), eq(bonusesTable.isUsed, false)));

  for (const bonus of activeBonuses) {
    if (!bonus.wageringRequirement) continue;
    const requirement = parseFloat(bonus.wageringRequirement as string);
    const progress = parseFloat(bonus.wageringProgress as string) + stakedAmount;

    if (progress >= requirement) {
      await db.update(bonusesTable).set({ wageringProgress: progress.toFixed(2), isUsed: true }).where(eq(bonusesTable.id, bonus.id));
      await db.insert(notificationsTable).values({
        userId,
        title: "✅ Wagering Complete!",
        message: `You've met the wagering requirement for your ${bonus.type} bonus. Winnings are now withdrawable.`,
        type: "success",
      });
    } else {
      await db.update(bonusesTable).set({ wageringProgress: progress.toFixed(2) }).where(eq(bonusesTable.id, bonus.id));
    }
  }
}

export async function awardLoyaltyPoints(userId: number, stakeAmount: number, betId: number) {
  const points = Math.floor(stakeAmount / 10);
  if (points <= 0) return;

  await db.insert(loyaltyPointsTable).values({
    userId,
    points,
    action: "bet_placed",
    referenceId: betId,
  });
}

export async function getLoyaltyBalance(userId: number): Promise<number> {
  const rows = await db
    .select()
    .from(loyaltyPointsTable)
    .where(eq(loyaltyPointsTable.userId, userId));

  return rows.reduce((acc, r) => acc + r.points, 0);
}

export async function redeemLoyaltyPoints(userId: number, points: number) {
  const balance = await getLoyaltyBalance(userId);
  if (balance < points) throw new Error("Insufficient loyalty points");

  const kesValue = points * 0.1;

  await db.insert(loyaltyPointsTable).values({
    userId,
    points: -points,
    action: "redeemed",
  });

  const [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, userId));
  if (!wallet) return;

  const newBonus = (parseFloat(wallet.bonusBalance as string) + kesValue).toFixed(2);
  await db.update(walletsTable).set({ bonusBalance: newBonus }).where(eq(walletsTable.userId, userId));

  await db.insert(transactionsTable).values({
    userId,
    type: "bonus",
    amount: kesValue.toFixed(2),
    status: "completed",
    description: `${points} loyalty points redeemed — KES ${kesValue.toFixed(2)} added`,
  });

  logger.info({ userId, points, kesValue }, "Loyalty points redeemed");
  return kesValue;
}

export async function runWeeklyCashback() {
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const txRows = await db
    .select()
    .from(transactionsTable)
    .where(eq(transactionsTable.type, "bet"));

  const recentRows = txRows.filter((t) => {
    const d = t.createdAt instanceof Date ? t.createdAt : new Date(t.createdAt as string);
    return d >= oneWeekAgo;
  });

  const lossPerUser: Record<number, number> = {};
  for (const tx of recentRows) {
    const amt = parseFloat(tx.amount as string);
    lossPerUser[tx.userId] = (lossPerUser[tx.userId] ?? 0) + Math.abs(amt);
  }

  const winRows = txRows.filter((t) => {
    const d = t.createdAt instanceof Date ? t.createdAt : new Date(t.createdAt as string);
    return d >= oneWeekAgo;
  });

  for (const [uid, lost] of Object.entries(lossPerUser)) {
    await grantCashback(Number(uid), lost).catch((err) =>
      logger.error({ err, uid }, "Cashback error"),
    );
  }

  logger.info({ count: Object.keys(lossPerUser).length }, "Weekly cashback run complete");
}
