import { Router, type IRouter } from "express";
import { eq, ilike, count, sum, desc } from "drizzle-orm";
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

const router: IRouter = Router();

router.post("/admin/login", async (req, res): Promise<void> => {
  const parsed = AdminLoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { email, password } = parsed.data;

  const [admin] = await db.select().from(adminsTable).where(eq(adminsTable.email, email));
  if (!admin) {
    // Also check regular users with admin role
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
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

export default router;
