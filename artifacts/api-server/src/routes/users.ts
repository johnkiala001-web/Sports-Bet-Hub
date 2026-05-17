import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, usersTable, walletsTable, betsTable, betSelectionsTable, notificationsTable, bonusesTable } from "@workspace/db";
import { UpdateProfileBody } from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

router.get("/dashboard", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: number }).userId;

  const [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, userId));
  const allBets = await db.select().from(betsTable).where(eq(betsTable.userId, userId));

  const won = allBets.filter((b) => b.status === "won").length;
  const lost = allBets.filter((b) => b.status === "lost").length;
  const pending = allBets.filter((b) => b.status === "pending").length;
  const totalStaked = allBets.reduce((acc, b) => acc + parseFloat(b.stake as string), 0);
  const totalWinnings = allBets.filter((b) => b.actualWin != null).reduce((acc, b) => acc + parseFloat(b.actualWin as string), 0);

  const recentBetsRaw = await db
    .select()
    .from(betsTable)
    .where(eq(betsTable.userId, userId))
    .orderBy(desc(betsTable.createdAt))
    .limit(5);

  const recentBets = await Promise.all(
    recentBetsRaw.map(async (bet) => {
      const selections = await db.select().from(betSelectionsTable).where(eq(betSelectionsTable.betId, bet.id));
      return {
        id: bet.id,
        stake: parseFloat(bet.stake as string),
        totalOdds: parseFloat(bet.totalOdds as string),
        potentialWin: parseFloat(bet.potentialWin as string),
        actualWin: bet.actualWin != null ? parseFloat(bet.actualWin as string) : null,
        status: bet.status,
        type: bet.type,
        createdAt: bet.createdAt instanceof Date ? bet.createdAt.toISOString() : bet.createdAt,
        selections: selections.map((s) => ({
          id: s.id,
          matchId: s.matchId,
          homeTeam: s.homeTeam,
          awayTeam: s.awayTeam,
          market: s.market,
          label: s.label,
          odds: parseFloat(s.odds as string),
          result: s.result,
        })),
      };
    }),
  );

  const activeBonusesRaw = await db
    .select()
    .from(bonusesTable)
    .where(eq(bonusesTable.userId, userId));

  const activeBonuses = activeBonusesRaw.map((b) => ({
    id: b.id,
    type: b.type,
    amount: parseFloat(b.amount as string),
    isUsed: b.isUsed,
    expiresAt: b.expiresAt instanceof Date ? b.expiresAt.toISOString() : b.expiresAt ?? null,
    createdAt: b.createdAt instanceof Date ? b.createdAt.toISOString() : b.createdAt,
  }));

  res.json({
    wallet: {
      id: wallet?.id ?? 0,
      userId,
      balance: parseFloat((wallet?.balance as string) ?? "0"),
      bonusBalance: parseFloat((wallet?.bonusBalance as string) ?? "0"),
      currency: wallet?.currency ?? "KES",
    },
    betSummary: {
      totalBets: allBets.length,
      totalWon: won,
      totalLost: lost,
      totalPending: pending,
      totalStaked,
      totalWinnings,
      winRate: allBets.length > 0 ? Math.round((won / allBets.length) * 10000) / 100 : 0,
    },
    recentBets,
    activeBonuses,
    pendingBets: pending,
  });
});

router.get("/profile", requireAuth, async (req, res): Promise<void> => {
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
    createdAt: user.createdAt instanceof Date ? user.createdAt.toISOString() : user.createdAt,
  });
});

router.patch("/profile", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: number }).userId;
  const parsed = UpdateProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.username) updates.username = parsed.data.username;
  if (parsed.data.phone) updates.phone = parsed.data.phone;
  if (parsed.data.avatarUrl !== undefined) updates.avatarUrl = parsed.data.avatarUrl;

  const [user] = await db.update(usersTable).set(updates).where(eq(usersTable.id, userId)).returning();

  res.json({
    id: user.id,
    username: user.username,
    email: user.email,
    phone: user.phone,
    role: user.role,
    isSuspended: user.isSuspended,
    referralCode: user.referralCode,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt instanceof Date ? user.createdAt.toISOString() : user.createdAt,
  });
});

router.get("/notifications", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: number }).userId;
  const rows = await db
    .select()
    .from(notificationsTable)
    .where(eq(notificationsTable.userId, userId))
    .orderBy(desc(notificationsTable.createdAt));

  res.json(
    rows.map((n) => ({
      id: n.id,
      title: n.title,
      message: n.message,
      isRead: n.isRead,
      type: n.type,
      createdAt: n.createdAt instanceof Date ? n.createdAt.toISOString() : n.createdAt,
    })),
  );
});

router.post("/notifications/:notificationId/read", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: number }).userId;
  const raw = Array.isArray(req.params.notificationId) ? req.params.notificationId[0] : req.params.notificationId;
  const notificationId = parseInt(raw, 10);

  await db
    .update(notificationsTable)
    .set({ isRead: true })
    .where(eq(notificationsTable.id, notificationId));

  res.json({ success: true });
});

router.get("/bonuses", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: number }).userId;
  const rows = await db.select().from(bonusesTable).where(eq(bonusesTable.userId, userId));

  res.json(
    rows.map((b) => ({
      id: b.id,
      type: b.type,
      amount: parseFloat(b.amount as string),
      isUsed: b.isUsed,
      expiresAt: b.expiresAt instanceof Date ? b.expiresAt.toISOString() : b.expiresAt ?? null,
      createdAt: b.createdAt instanceof Date ? b.createdAt.toISOString() : b.createdAt,
    })),
  );
});

export default router;
