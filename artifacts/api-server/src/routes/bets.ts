import { Router, type IRouter } from "express";
import { eq, and, count, sum, inArray } from "drizzle-orm";
import { db, betsTable, betSelectionsTable, walletsTable, transactionsTable, matchesTable } from "@workspace/db";
import { describeOutcome } from "../lib/betSettlement";
import { ListBetsQueryParams, PlaceBetBody } from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

async function formatBet(bet: typeof betsTable.$inferSelect, selections: (typeof betSelectionsTable.$inferSelect)[]) {
  const matchIds = [...new Set(selections.map((s) => s.matchId))];
  const matches = matchIds.length
    ? await db.select().from(matchesTable).where(inArray(matchesTable.id, matchIds))
    : [];
  const matchById = new Map(matches.map((m) => [m.id, m]));

  return {
    id: bet.id,
    stake: parseFloat(bet.stake as string),
    totalOdds: parseFloat(bet.totalOdds as string),
    potentialWin: parseFloat(bet.potentialWin as string),
    actualWin: bet.actualWin != null ? parseFloat(bet.actualWin as string) : null,
    status: bet.status,
    type: bet.type,
    createdAt: bet.createdAt instanceof Date ? bet.createdAt.toISOString() : bet.createdAt,
    selections: selections.map((s) => {
      const match = matchById.get(s.matchId);
      return {
        id: s.id,
        matchId: s.matchId,
        homeTeam: s.homeTeam,
        awayTeam: s.awayTeam,
        market: s.market,
        label: s.label,
        odds: parseFloat(s.odds as string),
        result: s.result,
        kickoff: match?.kickoff instanceof Date ? match.kickoff.toISOString() : match?.kickoff ?? null,
        matchStatus: match?.status ?? null,
        homeScore: match?.homeScore ?? null,
        awayScore: match?.awayScore ?? null,
        outcome: describeOutcome(s.market, s.label, match?.homeScore ?? null, match?.awayScore ?? null, match?.halftimeHomeScore ?? null, match?.halftimeAwayScore ?? null),
      };
    }),
  };
}

router.get("/bets", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: number }).userId;
  const parsed = ListBetsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { status, limit = 50, offset = 0 } = parsed.data;
  const conditions = [eq(betsTable.userId, userId)];
  if (status) conditions.push(eq(betsTable.status, status));

  const bets = await db
    .select()
    .from(betsTable)
    .where(and(...conditions))
    .orderBy(betsTable.createdAt)
    .limit(Number(limit))
    .offset(Number(offset));

  const result = await Promise.all(
    bets.map(async (bet) => {
      const selections = await db
        .select()
        .from(betSelectionsTable)
        .where(eq(betSelectionsTable.betId, bet.id));
      return formatBet(bet, selections);
    }),
  );

  res.json(result);
});

router.post("/bets", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: number }).userId;
  const parsed = PlaceBetBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { stake, selections } = parsed.data;
  if (selections.length === 0) {
    res.status(400).json({ error: "At least one selection is required" });
    return;
  }

  const [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, userId));
  if (!wallet) {
    res.status(400).json({ error: "Wallet not found" });
    return;
  }

  const currentBalance = parseFloat(wallet.balance as string);
  if (currentBalance < stake) {
    res.status(400).json({ error: "Insufficient balance" });
    return;
  }

  const totalOdds = selections.reduce((acc, s) => acc * s.odds, 1);
  const potentialWin = stake * totalOdds;
  const betType = selections.length > 1 ? "accumulator" : "single";

  const [bet] = await db.insert(betsTable).values({
    userId,
    stake: stake.toString(),
    totalOdds: totalOdds.toFixed(4),
    potentialWin: potentialWin.toFixed(2),
    status: "pending",
    type: betType,
  }).returning();

  for (const sel of selections) {
    const [match] = await db.select().from(matchesTable).where(eq(matchesTable.id, sel.matchId));
    await db.insert(betSelectionsTable).values({
      betId: bet.id,
      matchId: sel.matchId,
      homeTeam: match?.homeTeam ?? "Home",
      awayTeam: match?.awayTeam ?? "Away",
      market: sel.market,
      label: sel.label,
      odds: sel.odds.toString(),
      result: "pending",
    });
  }

  const newBalance = (currentBalance - stake).toFixed(2);
  await db.update(walletsTable).set({ balance: newBalance }).where(eq(walletsTable.userId, userId));

  await db.insert(transactionsTable).values({
    userId,
    type: "bet",
    amount: (-stake).toFixed(2),
    status: "completed",
    description: `Bet placed - ${betType} (${selections.length} selection${selections.length > 1 ? "s" : ""})`,
  });

  const allSelections = await db.select().from(betSelectionsTable).where(eq(betSelectionsTable.betId, bet.id));

  // Award loyalty points: 1 point per KES 10 staked
  const { awardLoyaltyPoints, trackWageringProgress } = await import("../lib/bonusEngine");
  await awardLoyaltyPoints(userId, stake, bet.id).catch(() => {});
  await trackWageringProgress(userId, stake).catch(() => {});

  res.status(201).json(await formatBet(bet, allSelections));
});

router.post("/bets/:betId/cashout", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: number }).userId;
  const raw = Array.isArray(req.params.betId) ? req.params.betId[0] : req.params.betId;
  const betId = parseInt(raw, 10);

  const [bet] = await db.select().from(betsTable).where(and(eq(betsTable.id, betId), eq(betsTable.userId, userId)));
  if (!bet) {
    res.status(404).json({ error: "Bet not found" });
    return;
  }
  if (bet.status !== "pending") {
    res.status(400).json({ error: "Bet cannot be cashed out" });
    return;
  }

  const cashoutAmount = parseFloat(bet.potentialWin as string) * 0.7;

  await db.update(betsTable).set({ status: "cashed_out", actualWin: cashoutAmount.toFixed(2) }).where(eq(betsTable.id, betId));
  await db.update(walletsTable).set({
    balance: String(parseFloat((await db.select().from(walletsTable).where(eq(walletsTable.userId, userId)))[0].balance as string) + cashoutAmount),
  }).where(eq(walletsTable.userId, userId));

  await db.insert(transactionsTable).values({
    userId,
    type: "win",
    amount: cashoutAmount.toFixed(2),
    status: "completed",
    description: `Cash out for bet #${betId}`,
  });

  const [updatedBet] = await db.select().from(betsTable).where(eq(betsTable.id, betId));
  const selections = await db.select().from(betSelectionsTable).where(eq(betSelectionsTable.betId, betId));
  res.json(await formatBet(updatedBet, selections));
});

router.get("/bets/summary", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: number }).userId;

  const allBets = await db.select().from(betsTable).where(eq(betsTable.userId, userId));
  const won = allBets.filter((b) => b.status === "won").length;
  const lost = allBets.filter((b) => b.status === "lost").length;
  const pending = allBets.filter((b) => b.status === "pending").length;
  const totalStaked = allBets.reduce((acc, b) => acc + parseFloat(b.stake as string), 0);
  const totalWinnings = allBets
    .filter((b) => b.actualWin != null)
    .reduce((acc, b) => acc + parseFloat(b.actualWin as string), 0);
  const winRate = allBets.length > 0 ? (won / allBets.length) * 100 : 0;

  res.json({
    totalBets: allBets.length,
    totalWon: won,
    totalLost: lost,
    totalPending: pending,
    totalStaked,
    totalWinnings,
    winRate: Math.round(winRate * 100) / 100,
  });
});

export default router;
