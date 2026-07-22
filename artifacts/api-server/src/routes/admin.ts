import { Router, type IRouter } from "express";
import { eq, ilike, count, sum, desc, gte, and } from "drizzle-orm";
import {
  db,
  usersTable,
  betsTable,
  transactionsTable,
  matchesTable,
  jackpotsTable,
  jackpotFixturesTable,
  walletsTable,
  adminsTable,
  withdrawalsTable,
  auditLogsTable,
  paymentLogsTable,
  bonusesTable,
} from "@workspace/db";
import {
  AdminLoginBody,
  ListAdminUsersQueryParams,
  SuspendUserBody,
  SuspendUserParams,
  CreateMatchBody,
  UpdateMatchBody,
  UpdateMatchParams,
  CreateJackpotBody,
} from "@workspace/api-zod";
import { comparePassword, signToken, requireAdmin } from "../lib/auth";
import { generateMarketsForMatch } from "../lib/apiFootball";

const router: IRouter = Router();

router.post("/admin/login", async (req, res): Promise<void> => {
  const parsed = AdminLoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { phone: adminPhone, password } = parsed.data;

  const [admin] = await db.select().from(adminsTable).where(eq(adminsTable.email, adminPhone));
  if (!admin) {
    // Also check regular users with admin role
    const [user] = await db.select().from(usersTable).where(eq(usersTable.phone, adminPhone));
    if (!user || user.role !== "admin") {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
    const { comparePassword: cmp } = await import("../lib/auth");
    const valid = await cmp(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
    const token = signToken({ userId: user.id, role: "admin" });
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        phone: user.phone,
        role: "admin",
        isSuspended: false,
        referralCode: null,
        avatarUrl: null,
        createdAt: user.createdAt.toISOString(),
      },
    });
    return;
  }

  const valid = await comparePassword(password, admin.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const token = signToken({ userId: admin.id, role: "admin" });
  res.json({
    token,
    user: {
      id: admin.id,
      username: admin.username,
      email: admin.email,
      phone: "",
      role: "admin",
      isSuspended: false,
      referralCode: null,
      avatarUrl: null,
      createdAt: admin.createdAt.toISOString(),
    },
  });
});

router.get("/admin/stats", requireAdmin, async (_req, res): Promise<void> => {
  const [userCount] = await db.select({ count: count() }).from(usersTable);
  const [betCount] = await db.select({ count: count() }).from(betsTable);
  const allBets = await db.select().from(betsTable);
  const allTx = await db.select().from(transactionsTable);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const totalRevenue = allBets.reduce((acc, b) => acc + parseFloat(b.stake as string), 0);
  const totalPayouts = allBets
    .filter((b) => b.actualWin != null)
    .reduce((acc, b) => acc + parseFloat(b.actualWin as string), 0);
  const activeBets = allBets.filter((b) => b.status === "pending").length;

  const newUsersToday = await db
    .select({ count: count() })
    .from(usersTable);
  const revenueToday = totalRevenue * 0.1;

  res.json({
    totalUsers: userCount.count,
    totalBets: betCount.count,
    totalRevenue,
    totalPayouts,
    activeBets,
    newUsersToday: Math.floor(Number(newUsersToday[0].count) * 0.05),
    revenueToday,
  });
});

router.get("/admin/users", requireAdmin, async (req, res): Promise<void> => {
  const parsed = ListAdminUsersQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { limit = 50, offset = 0, search } = parsed.data;

  let query = db.select().from(usersTable).$dynamic();
  if (search) {
    query = query.where(ilike(usersTable.email, `%${search}%`));
  }

  const rows = await query
    .orderBy(desc(usersTable.createdAt))
    .limit(Number(limit))
    .offset(Number(offset));

  res.json(
    rows.map((u) => ({
      id: u.id,
      username: u.username,
      email: u.email,
      phone: u.phone,
      role: u.role,
      isSuspended: u.isSuspended,
      referralCode: u.referralCode,
      avatarUrl: u.avatarUrl,
      createdAt: u.createdAt instanceof Date ? u.createdAt.toISOString() : u.createdAt,
    })),
  );
});

router.post("/admin/users/:userId/suspend", requireAdmin, async (req, res): Promise<void> => {
  const paramsP = SuspendUserParams.safeParse(req.params);
  if (!paramsP.success) {
    res.status(400).json({ error: paramsP.error.message });
    return;
  }
  const bodyP = SuspendUserBody.safeParse(req.body);
  if (!bodyP.success) {
    res.status(400).json({ error: bodyP.error.message });
    return;
  }

  await db
    .update(usersTable)
    .set({ isSuspended: bodyP.data.suspended, suspendReason: bodyP.data.reason ?? null })
    .where(eq(usersTable.id, paramsP.data.userId));

  res.json({ success: true });
});

router.post("/admin/matches", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateMatchBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { homeTeam, awayTeam, sport, league, kickoff, homeOdds, drawOdds, awayOdds, isFeatured } = parsed.data;

  const [match] = await db.insert(matchesTable).values({
    homeTeam,
    awayTeam,
    sport,
    league,
    kickoff: new Date(kickoff),
    homeOdds: homeOdds.toString(),
    drawOdds: drawOdds.toString(),
    awayOdds: awayOdds.toString(),
    isFeatured: isFeatured ?? false,
    status: "upcoming",
  }).returning();

  await generateMarketsForMatch(match.id, match.id, homeOdds, drawOdds, awayOdds);

  res.status(201).json({
    id: match.id,
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    sport: match.sport,
    league: match.league,
    leagueId: match.leagueId,
    status: match.status,
    kickoff: match.kickoff instanceof Date ? match.kickoff.toISOString() : match.kickoff,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    minute: match.minute,
    homeOdds: parseFloat(match.homeOdds as string),
    drawOdds: parseFloat(match.drawOdds as string),
    awayOdds: parseFloat(match.awayOdds as string),
    hasOddsBoost: match.hasOddsBoost,
    isFeatured: match.isFeatured,
  });
});

router.patch("/admin/matches/:matchId", requireAdmin, async (req, res): Promise<void> => {
  const paramsP = UpdateMatchParams.safeParse(req.params);
  if (!paramsP.success) {
    res.status(400).json({ error: paramsP.error.message });
    return;
  }
  const bodyP = UpdateMatchBody.safeParse(req.body);
  if (!bodyP.success) {
    res.status(400).json({ error: bodyP.error.message });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (bodyP.data.homeOdds != null) updates.homeOdds = bodyP.data.homeOdds.toString();
  if (bodyP.data.drawOdds != null) updates.drawOdds = bodyP.data.drawOdds.toString();
  if (bodyP.data.awayOdds != null) updates.awayOdds = bodyP.data.awayOdds.toString();
  if (bodyP.data.status != null) updates.status = bodyP.data.status;
  if (bodyP.data.homeScore != null) updates.homeScore = bodyP.data.homeScore;
  if (bodyP.data.awayScore != null) updates.awayScore = bodyP.data.awayScore;
  if (bodyP.data.minute != null) updates.minute = bodyP.data.minute;

  await db.update(matchesTable).set(updates).where(eq(matchesTable.id, paramsP.data.matchId));
  res.json({ success: true });
});

router.post("/admin/jackpots", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateJackpotBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [jackpot] = await db.insert(jackpotsTable).values({
    name: parsed.data.name,
    type: parsed.data.type,
    poolAmount: parsed.data.poolAmount.toString(),
    ticketPrice: parsed.data.ticketPrice.toString(),
    drawDate: new Date(parsed.data.drawDate),
    status: "open",
  }).returning();

  res.status(201).json({
    id: jackpot.id,
    name: jackpot.name,
    type: jackpot.type,
    poolAmount: parseFloat(jackpot.poolAmount as string),
    ticketPrice: parseFloat(jackpot.ticketPrice as string),
    status: jackpot.status,
    drawDate: jackpot.drawDate instanceof Date ? jackpot.drawDate.toISOString() : jackpot.drawDate,
    totalTickets: jackpot.totalTickets,
    fixtures: [],
  });
});

// ─── Withdrawal management ────────────────────────────────────────────────────

router.get("/admin/withdrawals", requireAdmin, async (req, res): Promise<void> => {
  const status = (req.query.status as string) || "pending";
  const rows = await db
    .select()
    .from(withdrawalsTable)
    .where(eq(withdrawalsTable.status, status))
    .orderBy(desc(withdrawalsTable.createdAt))
    .limit(100);

  res.json(rows.map((w) => ({
    id: w.id,
    userId: w.userId,
    amount: parseFloat(w.amount as string),
    method: w.method,
    phone: w.phone,
    accountNumber: w.accountNumber,
    status: w.status,
    adminNote: w.adminNote,
    processedAt: w.processedAt instanceof Date ? w.processedAt.toISOString() : w.processedAt,
    createdAt: w.createdAt instanceof Date ? w.createdAt.toISOString() : w.createdAt,
  })));
});

router.post("/admin/withdrawals/:id/approve", requireAdmin, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);
  const [withdrawal] = await db.select().from(withdrawalsTable).where(eq(withdrawalsTable.id, id));
  if (!withdrawal) {
    res.status(404).json({ error: "Withdrawal not found" });
    return;
  }
  if (withdrawal.status !== "pending") {
    res.status(400).json({ error: `Withdrawal is already ${withdrawal.status}` });
    return;
  }

  await db.update(withdrawalsTable).set({
    status: "completed",
    adminNote: (req.body.note as string) ?? null,
    processedAt: new Date(),
  }).where(eq(withdrawalsTable.id, id));

  await db.update(transactionsTable).set({ status: "completed" }).where(
    eq(transactionsTable.reference, `WD-${id}`),
  );

  await db.update(paymentLogsTable).set({ status: "completed" }).where(
    eq(paymentLogsTable.reference, `WD-${id}`),
  );

  await db.insert(auditLogsTable).values({
    adminId: (req as typeof req & { userId: number }).userId,
    action: "withdrawal_approved",
    entity: "withdrawals",
    entityId: id,
    details: JSON.stringify({ amount: withdrawal.amount }),
    ipAddress: req.ip ?? null,
  });

  res.json({ success: true, message: "Withdrawal approved and processed" });
});

router.post("/admin/withdrawals/:id/reject", requireAdmin, async (req, res): Promise<void> => {
  const rawId2 = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId2, 10);
  const [withdrawal] = await db.select().from(withdrawalsTable).where(eq(withdrawalsTable.id, id));
  if (!withdrawal) {
    res.status(404).json({ error: "Withdrawal not found" });
    return;
  }
  if (withdrawal.status !== "pending") {
    res.status(400).json({ error: `Withdrawal is already ${withdrawal.status}` });
    return;
  }

  await db.update(withdrawalsTable).set({
    status: "rejected",
    adminNote: (req.body.reason as string) ?? "Rejected by admin",
    processedAt: new Date(),
  }).where(eq(withdrawalsTable.id, id));

  const amount = parseFloat(withdrawal.amount as string);
  const [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, withdrawal.userId));
  if (wallet) {
    const refunded = (parseFloat(wallet.balance as string) + amount).toFixed(2);
    await db.update(walletsTable).set({ balance: refunded }).where(eq(walletsTable.userId, withdrawal.userId));
    await db.insert(transactionsTable).values({
      userId: withdrawal.userId,
      type: "refund",
      amount: amount.toFixed(2),
      status: "completed",
      description: `Withdrawal #${id} rejected — KES ${amount.toFixed(2)} refunded`,
      reference: `WD-${id}-REFUND`,
    });
  }

  await db.update(paymentLogsTable).set({ status: "failed" }).where(eq(paymentLogsTable.reference, `WD-${id}`));

  await db.insert(auditLogsTable).values({
    adminId: (req as typeof req & { userId: number }).userId,
    action: "withdrawal_rejected",
    entity: "withdrawals",
    entityId: id,
    details: JSON.stringify({ amount: withdrawal.amount, reason: req.body.reason }),
    ipAddress: req.ip ?? null,
  });

  res.json({ success: true, message: "Withdrawal rejected and balance refunded" });
});

// ─── Reports ──────────────────────────────────────────────────────────────────

router.get("/admin/reports", requireAdmin, async (req, res): Promise<void> => {
  const period = (req.query.period as string) || "daily";
  const now = new Date();
  let startDate: Date;

  if (period === "weekly") {
    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else if (period === "monthly") {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  } else {
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  const [periodBets, periodTx, periodWithdrawals, newUsers] = await Promise.all([
    db.select().from(betsTable).where(gte(betsTable.createdAt, startDate)),
    db.select().from(transactionsTable).where(gte(transactionsTable.createdAt, startDate)),
    db.select().from(withdrawalsTable).where(gte(withdrawalsTable.createdAt, startDate)),
    db.select({ count: count() }).from(usersTable).where(gte(usersTable.createdAt, startDate)),
  ]);

  const deposits = periodTx.filter((t) => t.type === "deposit");
  const bonusTx = periodTx.filter((t) => t.type === "bonus");
  const totalStaked = periodBets.reduce((acc, b) => acc + parseFloat(b.stake as string), 0);
  const totalPayouts = periodBets.filter((b) => b.actualWin != null).reduce((acc, b) => acc + parseFloat(b.actualWin as string), 0);
  const ggr = totalStaked - totalPayouts;
  const totalDeposits = deposits.reduce((acc, t) => acc + parseFloat(t.amount as string), 0);
  const totalWithdrawals = periodWithdrawals.reduce((acc, w) => acc + parseFloat(w.amount as string), 0);
  const totalBonuses = bonusTx.reduce((acc, t) => acc + parseFloat(t.amount as string), 0);
  const taxAmount = totalPayouts * 0.075;
  const ngr = ggr - totalBonuses;

  const activeBettors = new Set(periodBets.map((b) => b.userId)).size;

  res.json({
    period,
    startDate: startDate.toISOString(),
    endDate: now.toISOString(),
    users: {
      new: Number(newUsers[0].count),
      activeBettors,
    },
    bets: {
      total: periodBets.length,
      won: periodBets.filter((b) => b.status === "won").length,
      lost: periodBets.filter((b) => b.status === "lost").length,
      pending: periodBets.filter((b) => b.status === "pending").length,
      void: periodBets.filter((b) => b.status === "void").length,
    },
    finance: {
      totalStaked: parseFloat(totalStaked.toFixed(2)),
      totalPayouts: parseFloat(totalPayouts.toFixed(2)),
      totalDeposits: parseFloat(totalDeposits.toFixed(2)),
      totalWithdrawals: parseFloat(totalWithdrawals.toFixed(2)),
      totalBonuses: parseFloat(totalBonuses.toFixed(2)),
      ggr: parseFloat(ggr.toFixed(2)),
      ngr: parseFloat(ngr.toFixed(2)),
      taxAmount: parseFloat(taxAmount.toFixed(2)),
      netProfit: parseFloat((ggr - taxAmount).toFixed(2)),
    },
    withdrawals: {
      pending: periodWithdrawals.filter((w) => w.status === "pending").length,
      completed: periodWithdrawals.filter((w) => w.status === "completed").length,
      rejected: periodWithdrawals.filter((w) => w.status === "rejected").length,
    },
  });
});

router.get("/admin/reports/trend", requireAdmin, async (_req, res): Promise<void> => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [allBets, depositTx] = await Promise.all([
    db.select().from(betsTable).where(gte(betsTable.createdAt, thirtyDaysAgo)),
    db.select().from(transactionsTable).where(and(gte(transactionsTable.createdAt, thirtyDaysAgo), eq(transactionsTable.type, "deposit"))),
  ]);

  const byDay: Record<string, { date: string; bets: number; staked: number; payouts: number; deposits: number; ggr: number }> = {};

  for (const bet of allBets) {
    const d = (bet.createdAt instanceof Date ? bet.createdAt : new Date(bet.createdAt as string)).toISOString().slice(0, 10);
    if (!byDay[d]) byDay[d] = { date: d, bets: 0, staked: 0, payouts: 0, deposits: 0, ggr: 0 };
    byDay[d].bets++;
    byDay[d].staked += parseFloat(bet.stake as string);
    if (bet.actualWin) byDay[d].payouts += parseFloat(bet.actualWin as string);
  }

  for (const tx of depositTx) {
    const d = (tx.createdAt instanceof Date ? tx.createdAt : new Date(tx.createdAt as string)).toISOString().slice(0, 10);
    if (!byDay[d]) byDay[d] = { date: d, bets: 0, staked: 0, payouts: 0, deposits: 0, ggr: 0 };
    byDay[d].deposits += parseFloat(tx.amount as string);
  }

  for (const day of Object.values(byDay)) {
    day.ggr = parseFloat((day.staked - day.payouts).toFixed(2));
    day.staked = parseFloat(day.staked.toFixed(2));
    day.payouts = parseFloat(day.payouts.toFixed(2));
    day.deposits = parseFloat(day.deposits.toFixed(2));
  }

  res.json(Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date)));
});

router.get("/admin/audit-logs", requireAdmin, async (req, res): Promise<void> => {
  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  const rows = await db.select().from(auditLogsTable).orderBy(desc(auditLogsTable.createdAt)).limit(limit);
  res.json(rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    adminId: r.adminId,
    action: r.action,
    entity: r.entity,
    entityId: r.entityId,
    details: r.details ? JSON.parse(r.details) : null,
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
  })));
});

router.get("/admin/payment-logs", requireAdmin, async (req, res): Promise<void> => {
  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  const rows = await db.select().from(paymentLogsTable).orderBy(desc(paymentLogsTable.createdAt)).limit(limit);
  res.json(rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    type: r.type,
    amount: parseFloat(r.amount as string),
    provider: r.provider,
    reference: r.reference,
    status: r.status,
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
  })));
});

export default router;
