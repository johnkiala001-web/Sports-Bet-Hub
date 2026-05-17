import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, jackpotsTable, jackpotFixturesTable, matchesTable } from "@workspace/db";
import { GetJackpotParams } from "@workspace/api-zod";

const router: IRouter = Router();

function formatMatch(m: typeof matchesTable.$inferSelect) {
  return {
    id: m.id,
    homeTeam: m.homeTeam,
    awayTeam: m.awayTeam,
    sport: m.sport,
    league: m.league,
    leagueId: m.leagueId,
    status: m.status,
    kickoff: m.kickoff instanceof Date ? m.kickoff.toISOString() : m.kickoff,
    homeScore: m.homeScore,
    awayScore: m.awayScore,
    minute: m.minute,
    homeOdds: parseFloat(m.homeOdds as string),
    drawOdds: parseFloat(m.drawOdds as string),
    awayOdds: parseFloat(m.awayOdds as string),
    hasOddsBoost: m.hasOddsBoost,
    isFeatured: m.isFeatured,
  };
}

async function getJackpotWithFixtures(jackpot: typeof jackpotsTable.$inferSelect) {
  const fixtureLinks = await db
    .select()
    .from(jackpotFixturesTable)
    .where(eq(jackpotFixturesTable.jackpotId, jackpot.id));

  const fixtures = await Promise.all(
    fixtureLinks.map(async (f) => {
      const [match] = await db.select().from(matchesTable).where(eq(matchesTable.id, f.matchId));
      return match ? formatMatch(match) : null;
    }),
  );

  return {
    id: jackpot.id,
    name: jackpot.name,
    type: jackpot.type,
    poolAmount: parseFloat(jackpot.poolAmount as string),
    ticketPrice: parseFloat(jackpot.ticketPrice as string),
    status: jackpot.status,
    drawDate: jackpot.drawDate instanceof Date ? jackpot.drawDate.toISOString() : jackpot.drawDate,
    totalTickets: jackpot.totalTickets,
    fixtures: fixtures.filter(Boolean),
  };
}

router.get("/jackpots", async (_req, res): Promise<void> => {
  const jackpots = await db.select().from(jackpotsTable).where(eq(jackpotsTable.status, "open"));
  const result = await Promise.all(jackpots.map(getJackpotWithFixtures));
  res.json(result);
});

router.get("/jackpots/:jackpotId", async (req, res): Promise<void> => {
  const parsed = GetJackpotParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [jackpot] = await db.select().from(jackpotsTable).where(eq(jackpotsTable.id, parsed.data.jackpotId));
  if (!jackpot) {
    res.status(404).json({ error: "Jackpot not found" });
    return;
  }

  res.json(await getJackpotWithFixtures(jackpot));
});

export default router;
