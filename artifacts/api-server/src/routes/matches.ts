import { Router, type IRouter } from "express";
import { eq, and, inArray, notInArray, sql, gte } from "drizzle-orm";
import { db, matchesTable, leaguesTable, oddsMarketsTable, oddsSelectionsTable } from "@workspace/db";
import { ListMatchesQueryParams } from "@workspace/api-zod";
import { syncFixtures, generateMarketsForMatch } from "../lib/apiFootball";
import { requireAdmin } from "../lib/auth";

const router: IRouter = Router();

function formatMatch(m: typeof matchesTable.$inferSelect, marketsCount = 0) {
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
    marketsCount,
  };
}

async function attachMarketsCounts(rows: (typeof matchesTable.$inferSelect)[]) {
  if (rows.length === 0) return rows.map(r => formatMatch(r));
  const ids = rows.map(r => r.id);
  const counts = await db
    .select({
      matchId: oddsMarketsTable.matchId,
      count: sql<number>`cast(count(*) as int)`,
    })
    .from(oddsMarketsTable)
    .where(inArray(oddsMarketsTable.matchId, ids))
    .groupBy(oddsMarketsTable.matchId);
  const countMap = new Map(counts.map(c => [c.matchId, c.count]));
  return rows.map(r => formatMatch(r, countMap.get(r.id) ?? 0));
}

router.get("/matches", async (req, res): Promise<void> => {
  const parsed = ListMatchesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { sport, status, limit = 50, offset = 0 } = parsed.data;

  const conditions = [];
  if (sport) conditions.push(eq(matchesTable.sport, sport));
  if (status) {
    conditions.push(eq(matchesTable.status, status));
    // For upcoming matches, only show from yesterday onward (skip stale fixtures)
    if (status === "upcoming") {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      conditions.push(gte(matchesTable.kickoff, yesterday));
    }
  } else {
    conditions.push(notInArray(matchesTable.status, ["cancelled", "finished"]));
  }

  const rows = await db
    .select()
    .from(matchesTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(matchesTable.kickoff)
    .limit(Number(limit))
    .offset(Number(offset));

  res.json(await attachMarketsCounts(rows));
});

router.get("/matches/live", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(matchesTable)
    .where(eq(matchesTable.status, "live"))
    .orderBy(matchesTable.kickoff);

  res.json(await attachMarketsCounts(rows));
});

router.get("/matches/featured", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(matchesTable)
    .where(eq(matchesTable.isFeatured, true))
    .orderBy(matchesTable.kickoff)
    .limit(10);

  res.json(rows.map(formatMatch));
});

router.get("/matches/:matchId", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.matchId) ? req.params.matchId[0] : req.params.matchId;
  const matchId = parseInt(raw, 10);
  if (isNaN(matchId)) {
    res.status(400).json({ error: "Invalid match ID" });
    return;
  }

  const [match] = await db.select().from(matchesTable).where(eq(matchesTable.id, matchId));
  if (!match) {
    res.status(404).json({ error: "Match not found" });
    return;
  }

  const markets = await db
    .select()
    .from(oddsMarketsTable)
    .where(eq(oddsMarketsTable.matchId, matchId));

  const marketsWithSelections = await Promise.all(
    markets.map(async (market) => {
      const selections = await db
        .select()
        .from(oddsSelectionsTable)
        .where(eq(oddsSelectionsTable.marketId, market.id));
      return {
        id: market.id,
        name: market.name,
        selections: selections.map((s) => ({
          id: s.id,
          label: s.label,
          odds: parseFloat(s.odds as string),
          hasBoost: s.hasBoost,
        })),
      };
    }),
  );

  res.json({
    ...formatMatch(match),
    markets: marketsWithSelections,
  });
});

router.get("/leagues", async (_req, res): Promise<void> => {
  const rows = await db.select().from(leaguesTable);
  res.json(
    rows.map((l) => ({
      id: l.id,
      name: l.name,
      sport: l.sport,
      country: l.country,
      logoUrl: l.logoUrl,
    })),
  );
});

// Manual sync trigger (admin only)
router.post("/matches/sync", requireAdmin, async (_req, res): Promise<void> => {
  try {
    const count = await syncFixtures();
    res.json({ synced: count, message: `Synced ${count} fixtures` });
  } catch (err) {
    res.status(500).json({ error: "Sync failed" });
  }
});

// One-off backfill: generate markets for any match missing them (admin only)
router.post("/matches/backfill-markets", requireAdmin, async (_req, res): Promise<void> => {
  try {
    const allMatches = await db.select().from(matchesTable);
    let processed = 0;
    let skipped = 0;

    for (const m of allMatches) {
      const before = await db
        .select({ id: oddsMarketsTable.id })
        .from(oddsMarketsTable)
        .where(eq(oddsMarketsTable.matchId, m.id))
        .limit(1);

      if (before.length > 0) {
        skipped++;
        continue;
      }

      const h = parseFloat(m.homeOdds as string);
      const d = parseFloat(m.drawOdds as string);
      const a = parseFloat(m.awayOdds as string);

      await generateMarketsForMatch(m.id, m.id, h, d, a);
      processed++;
    }

    res.json({ total: allMatches.length, processed, skipped });
  } catch (err) {
    res.status(500).json({ error: "Backfill failed", details: String(err) });
  }
});

export default router;
