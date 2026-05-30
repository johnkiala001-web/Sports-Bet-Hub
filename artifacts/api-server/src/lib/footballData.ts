import { db, matchesTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { logger } from "./logger";

const BASE_URL = "https://api.football-data.org/v4";

// Competition codes available on the free tier that match requested leagues
const COMPETITION_CODES = [
  "PL",   // Premier League
  "PD",   // La Liga (Primera Division)
  "SA",   // Serie A
  "BL1",  // Bundesliga
  "FL1",  // Ligue 1
  "CL",   // UEFA Champions League
  "EL",   // UEFA Europa League (may not be on free tier — handled gracefully)
  "DED",  // Eredivisie
  "PPL",  // Primeira Liga
  "BSA",  // Campeonato Brasileiro Série A
  "CLI",  // Copa Libertadores (covers CAF-style continental)
];

interface FDMatch {
  id: number;
  utcDate: string;
  status: string;
  minute?: number | null;
  competition: { name: string; code: string };
  homeTeam: { name: string; shortName?: string };
  awayTeam: { name: string; shortName?: string };
  score: {
    fullTime: { home: number | null; away: number | null };
    halfTime: { home: number | null; away: number | null };
  };
  odds?: { homeWin?: number; draw?: number; awayWin?: number };
}

function mapStatus(fdStatus: string): string {
  switch (fdStatus) {
    case "IN_PLAY":
    case "PAUSED":
      return "live";
    case "FINISHED":
    case "AWARDED":
      return "finished";
    case "POSTPONED":
    case "CANCELLED":
    case "SUSPENDED":
      return "cancelled";
    default:
      return "upcoming";
  }
}

function teamName(team: { name: string; shortName?: string }): string {
  return team.shortName || team.name;
}

// Generate realistic placeholder odds based on competition prestige
function placeholderOdds(competition: string): { home: number; draw: number; away: number } {
  const seed = competition.charCodeAt(0) + competition.charCodeAt(1 % competition.length);
  const home = 1.5 + (seed % 20) * 0.1;
  const draw = 3.0 + (seed % 10) * 0.1;
  const away = 2.0 + (seed % 15) * 0.1;
  return { home: parseFloat(home.toFixed(2)), draw: parseFloat(draw.toFixed(2)), away: parseFloat(away.toFixed(2)) };
}

async function fetchMatchesForCompetition(code: string, dateFrom: string, dateTo: string): Promise<FDMatch[]> {
  const apiKey = process.env["FOOTBALL_DATA_API_KEY"];
  if (!apiKey) throw new Error("FOOTBALL_DATA_API_KEY not set");

  const url = `${BASE_URL}/competitions/${code}/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`;

  const res = await fetch(url, {
    headers: { "X-Auth-Token": apiKey },
  });

  if (res.status === 429) {
    logger.warn({ code }, "Football-Data rate limited");
    return [];
  }
  if (res.status === 403) {
    logger.warn({ code }, "Football-Data competition not available on this plan");
    return [];
  }
  if (!res.ok) {
    logger.warn({ code, status: res.status }, "Football-Data fetch failed");
    return [];
  }

  const data = await res.json() as { matches: FDMatch[] };
  return data.matches || [];
}

export async function syncFixtures(): Promise<number> {
  const apiKey = process.env["FOOTBALL_DATA_API_KEY"];
  if (!apiKey) {
    logger.error("FOOTBALL_DATA_API_KEY missing — skipping sync");
    return 0;
  }

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const nextWeek = new Date(today);
  nextWeek.setDate(today.getDate() + 7);

  const fmt = (d: Date) => d.toISOString().split("T")[0];
  const dateFrom = fmt(yesterday);
  const dateTo = fmt(nextWeek);

  logger.info({ dateFrom, dateTo }, "Syncing fixtures from Football-Data");

  // Fetch all competitions with a small delay between requests to avoid rate limits
  const allMatches: FDMatch[] = [];
  for (const code of COMPETITION_CODES) {
    try {
      const matches = await fetchMatchesForCompetition(code, dateFrom, dateTo);
      allMatches.push(...matches);
      // Respect rate limit: free tier allows 10 req/min
      await new Promise((r) => setTimeout(r, 200));
    } catch (err) {
      logger.warn({ code, err }, "Error fetching competition");
    }
  }

  if (allMatches.length === 0) {
    logger.info("No fixtures returned from Football-Data");
    return 0;
  }

  // Upsert matches
  let upserted = 0;
  for (const m of allMatches) {
    try {
      const externalId = `fd-${m.id}`;
      const status = mapStatus(m.status);
      const odds = placeholderOdds(m.competition.code);
      const homeScore = m.score?.fullTime?.home ?? null;
      const awayScore = m.score?.fullTime?.away ?? null;

      // For live matches use half time if full time not available
      const liveHome = status === "live"
        ? (m.score?.halfTime?.home ?? homeScore)
        : homeScore;
      const liveAway = status === "live"
        ? (m.score?.halfTime?.away ?? awayScore)
        : awayScore;

      const isFeatured = ["PL", "PD", "SA", "BL1", "FL1", "CL"].includes(m.competition.code);

      await db
        .insert(matchesTable)
        .values({
          externalId,
          homeTeam: teamName(m.homeTeam),
          awayTeam: teamName(m.awayTeam),
          sport: "football",
          league: m.competition.name,
          status,
          kickoff: new Date(m.utcDate),
          homeScore: status === "finished" ? homeScore : (status === "live" ? liveHome : null),
          awayScore: status === "finished" ? awayScore : (status === "live" ? liveAway : null),
          minute: status === "live" ? (m.minute ?? null) : null,
          homeOdds: odds.home.toString(),
          drawOdds: odds.draw.toString(),
          awayOdds: odds.away.toString(),
          hasOddsBoost: false,
          isFeatured,
        })
        .onConflictDoUpdate({
          target: matchesTable.externalId,
          set: {
            status,
            homeScore: status === "finished" ? homeScore : (status === "live" ? liveHome : null),
            awayScore: status === "finished" ? awayScore : (status === "live" ? liveAway : null),
            minute: status === "live" ? (m.minute ?? null) : null,
            updatedAt: new Date(),
          },
        });

      upserted++;
    } catch (err) {
      logger.warn({ matchId: m.id, err }, "Failed to upsert match");
    }
  }

  logger.info({ upserted, total: allMatches.length }, "Fixtures synced");
  return upserted;
}

let syncInterval: ReturnType<typeof setInterval> | null = null;

export function startFixtureSync(intervalMs = 60_000): void {
  // Run immediately on start
  syncFixtures().catch((err) => logger.error({ err }, "Initial fixture sync failed"));

  syncInterval = setInterval(() => {
    syncFixtures().catch((err) => logger.error({ err }, "Fixture sync failed"));
  }, intervalMs);

  logger.info({ intervalMs }, "Fixture sync scheduler started");
}

export function stopFixtureSync(): void {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}
