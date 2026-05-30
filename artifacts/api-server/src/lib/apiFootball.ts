import { db, matchesTable } from "@workspace/db";
import { logger } from "./logger";

const BASE_URL = "https://v3.football.api-sports.io";

// ─── League registry ──────────────────────────────────────────────────────────
// Each entry: [leagueId, season, displayName]
// Grouped into tiers so we can spread 100 daily requests sensibly.
// Tier 1 (~30 req): big 5 + UCL/UEL + African + regional priorities
// Tier 2 (~40 req): rest of Europe + Americas + Asia + cups
// Tier 3 (~20 req): lower divisions + friendlies + qualifiers (skipped when quota tight)

export const LEAGUES: Array<{ id: number; season: number; name: string; tier: 1 | 2 | 3 }> = [
  // ── England ──────────────────────────────────────────────────────────────
  { id: 39,   season: 2025, name: "Premier League",              tier: 1 },
  { id: 40,   season: 2025, name: "Championship",                tier: 2 },
  { id: 45,   season: 2025, name: "FA Cup",                      tier: 2 },
  { id: 48,   season: 2025, name: "EFL Cup",                     tier: 3 },

  // ── Spain ────────────────────────────────────────────────────────────────
  { id: 140,  season: 2025, name: "La Liga",                     tier: 1 },
  { id: 141,  season: 2025, name: "La Liga 2",                   tier: 2 },
  { id: 143,  season: 2025, name: "Copa del Rey",                tier: 2 },

  // ── Italy ────────────────────────────────────────────────────────────────
  { id: 135,  season: 2025, name: "Serie A",                     tier: 1 },
  { id: 136,  season: 2025, name: "Serie B",                     tier: 2 },
  { id: 137,  season: 2025, name: "Coppa Italia",                tier: 2 },

  // ── Germany ──────────────────────────────────────────────────────────────
  { id: 78,   season: 2025, name: "Bundesliga",                  tier: 1 },
  { id: 79,   season: 2025, name: "Bundesliga 2",                tier: 2 },
  { id: 81,   season: 2025, name: "DFB Pokal",                   tier: 2 },

  // ── France ───────────────────────────────────────────────────────────────
  { id: 61,   season: 2025, name: "Ligue 1",                     tier: 1 },
  { id: 62,   season: 2025, name: "Ligue 2",                     tier: 2 },
  { id: 66,   season: 2025, name: "Coupe de France",             tier: 2 },

  // ── Netherlands ──────────────────────────────────────────────────────────
  { id: 88,   season: 2025, name: "Eredivisie",                  tier: 2 },
  { id: 90,   season: 2025, name: "KNVB Cup",                    tier: 3 },

  // ── Portugal ─────────────────────────────────────────────────────────────
  { id: 94,   season: 2025, name: "Primeira Liga",               tier: 2 },
  { id: 96,   season: 2025, name: "Taça de Portugal",            tier: 3 },

  // ── Europe ───────────────────────────────────────────────────────────────
  { id: 66,   season: 2025, name: "Belgian Pro League",          tier: 2 },
  { id: 207,  season: 2025, name: "Swiss Super League",          tier: 2 },
  { id: 218,  season: 2025, name: "Austrian Bundesliga",         tier: 2 },
  { id: 179,  season: 2025, name: "Scottish Premiership",        tier: 2 },
  { id: 203,  season: 2025, name: "Turkish Süper Lig",           tier: 2 },
  { id: 197,  season: 2025, name: "Greek Super League",          tier: 2 },
  { id: 119,  season: 2025, name: "Danish Superliga",            tier: 3 },
  { id: 103,  season: 2026, name: "Norwegian Eliteserien",       tier: 3 },
  { id: 113,  season: 2026, name: "Swedish Allsvenskan",         tier: 3 },
  { id: 106,  season: 2025, name: "Polish Ekstraklasa",          tier: 3 },
  { id: 345,  season: 2025, name: "Czech First League",          tier: 3 },
  { id: 283,  season: 2025, name: "Romanian Liga I",             tier: 3 },
  { id: 333,  season: 2025, name: "Ukrainian Premier League",    tier: 3 },

  // ── UEFA competitions ────────────────────────────────────────────────────
  { id: 2,    season: 2025, name: "UEFA Champions League",       tier: 1 },
  { id: 3,    season: 2025, name: "UEFA Europa League",          tier: 1 },
  { id: 848,  season: 2025, name: "UEFA Conference League",      tier: 2 },

  // ── Middle East ──────────────────────────────────────────────────────────
  { id: 307,  season: 2025, name: "Saudi Pro League",            tier: 2 },
  { id: 435,  season: 2025, name: "Saudi First Division",        tier: 3 },

  // ── Africa ───────────────────────────────────────────────────────────────
  { id: 233,  season: 2025, name: "Egypt Premier League",        tier: 2 },
  { id: 200,  season: 2025, name: "Moroccan Botola Pro",         tier: 2 },
  { id: 186,  season: 2025, name: "Algerian Ligue 1",            tier: 2 },
  { id: 202,  season: 2025, name: "Tunisian Ligue 1",            tier: 2 },
  { id: 288,  season: 2025, name: "South African Premier Division", tier: 2 },
  { id: 276,  season: 2025, name: "FKF Premier League",          tier: 3 },
  { id: 12,   season: 2025, name: "CAF Champions League",        tier: 1 },
  { id: 20,   season: 2025, name: "CAF Confederation Cup",       tier: 2 },
  { id: 6,    season: 2025, name: "Africa Cup of Nations",       tier: 2 },

  // ── USA / CONCACAF ───────────────────────────────────────────────────────
  { id: 253,  season: 2025, name: "MLS",                         tier: 2 },
  { id: 255,  season: 2026, name: "USL Championship",            tier: 3 },
  { id: 262,  season: 2025, name: "Liga MX",                     tier: 2 },
  { id: 479,  season: 2026, name: "Canadian Premier League",     tier: 3 },

  // ── Brazil ───────────────────────────────────────────────────────────────
  { id: 71,   season: 2026, name: "Brazil Serie A",              tier: 1 },
  { id: 72,   season: 2026, name: "Brazil Serie B",              tier: 2 },
  { id: 73,   season: 2026, name: "Copa do Brasil",              tier: 2 },
  { id: 475,  season: 2026, name: "Campeonato Paulista",         tier: 3 },
  { id: 624,  season: 2026, name: "Campeonato Carioca",          tier: 3 },

  // ── South America ────────────────────────────────────────────────────────
  { id: 128,  season: 2026, name: "Argentina Primera Division",  tier: 1 },
  { id: 130,  season: 2026, name: "Copa Argentina",              tier: 3 },
  { id: 11,   season: 2025, name: "Copa Libertadores",           tier: 1 },
  { id: 13,   season: 2025, name: "Copa Sudamericana",           tier: 2 },
  { id: 239,  season: 2026, name: "Colombian Primera A",         tier: 2 },
  { id: 265,  season: 2026, name: "Chilean Primera Division",    tier: 2 },
  { id: 281,  season: 2026, name: "Peruvian Liga 1",             tier: 3 },
  { id: 268,  season: 2026, name: "Uruguayan Primera Division",  tier: 2 },

  // ── Asia / Oceania ───────────────────────────────────────────────────────
  { id: 188,  season: 2025, name: "A-League",                    tier: 3 },
  { id: 98,   season: 2026, name: "J1 League",                   tier: 2 },
  { id: 292,  season: 2026, name: "K League 1",                  tier: 2 },
  { id: 169,  season: 2026, name: "Chinese Super League",        tier: 2 },
  { id: 323,  season: 2025, name: "Indian Super League",         tier: 3 },

  // ── International ────────────────────────────────────────────────────────
  { id: 1,    season: 2026, name: "FIFA World Cup",              tier: 1 },
  { id: 4,    season: 2024, name: "UEFA Euro",                   tier: 2 },
  { id: 9,    season: 2024, name: "Copa America",                tier: 2 },
  { id: 6,    season: 2025, name: "Africa Cup of Nations",       tier: 2 },
  { id: 32,   season: 2024, name: "World Cup Qualifiers Europe", tier: 3 },
  { id: 34,   season: 2026, name: "World Cup Qualifiers S.America", tier: 3 },
  { id: 30,   season: 2026, name: "World Cup Qualifiers Asia",   tier: 3 },
  { id: 31,   season: 2026, name: "World Cup Qualifiers CONCACAF", tier: 3 },
  { id: 36,   season: 2027, name: "AFCON Qualifiers",            tier: 3 },
];

// Deduplicate by league id (first wins)
const seen = new Set<number>();
const UNIQUE_LEAGUES = LEAGUES.filter(l => {
  if (seen.has(l.id)) return false;
  seen.add(l.id);
  return true;
});

// Featured leagues (shown on home + sorted first)
const FEATURED_IDS = new Set([2, 3, 39, 140, 135, 78, 61, 11, 12, 71, 128, 253, 262, 848, 307]);

interface AFFixture {
  fixture: {
    id: number;
    date: string;
    status: { short: string; elapsed: number | null };
  };
  league: { id: number; name: string };
  teams: {
    home: { id: number; name: string };
    away: { id: number; name: string };
  };
  goals: { home: number | null; away: number | null };
  score: {
    halftime: { home: number | null; away: number | null };
    fulltime: { home: number | null; away: number | null };
  };
}

interface AFOdds {
  fixture: { id: number };
  bookmakers: Array<{
    bets: Array<{
      name: string;
      values: Array<{ value: string; odd: string }>;
    }>;
  }>;
}

function mapStatus(short: string): string {
  switch (short) {
    case "1H": case "2H": case "ET": case "BT": case "P": case "LIVE": return "live";
    case "HT": return "live";
    case "FT": case "AET": case "PEN": return "finished";
    case "PST": case "CANC": case "ABD": case "AWD": case "WO": return "cancelled";
    case "SUSP": case "INT": return "live";
    default: return "upcoming";
  }
}

async function apiFetch<T>(path: string): Promise<T | null> {
  const key = process.env["API_FOOTBALL_KEY"];
  if (!key) return null;
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { "x-apisports-key": key },
    });
    if (res.status === 429) {
      logger.warn({ path }, "API-Football rate limited");
      return null;
    }
    if (!res.ok) {
      logger.warn({ path, status: res.status }, "API-Football fetch failed");
      return null;
    }
    const data = await res.json() as { response: T; errors?: unknown };
    return data.response;
  } catch (err) {
    logger.warn({ path, err }, "API-Football request error");
    return null;
  }
}

async function fetchFixturesForDate(date: string): Promise<AFFixture[]> {
  const results = await apiFetch<AFFixture[]>(`/fixtures?date=${date}`);
  return results ?? [];
}

async function fetchOdds(fixtureId: number): Promise<{ home: number; draw: number; away: number } | null> {
  const results = await apiFetch<AFOdds[]>(`/odds?fixture=${fixtureId}&bookmaker=6&bet=1`);
  if (!results || results.length === 0) return null;

  const bets = results[0]?.bookmakers?.[0]?.bets?.[0]?.values;
  if (!bets) return null;

  const home = parseFloat(bets.find(v => v.value === "Home")?.odd ?? "0");
  const draw = parseFloat(bets.find(v => v.value === "Draw")?.odd ?? "0");
  const away = parseFloat(bets.find(v => v.value === "Away")?.odd ?? "0");

  if (!home || !away) return null;
  return { home, draw, away };
}

// Derive reasonable placeholder odds from fixture id (deterministic, varied)
function placeholderOdds(fixtureId: number, leagueId: number): { home: number; draw: number; away: number } {
  const seed = (fixtureId + leagueId * 17) % 100;
  const home = parseFloat((1.50 + (seed % 25) * 0.08).toFixed(2));
  const draw = parseFloat((3.00 + (seed % 15) * 0.12).toFixed(2));
  const away = parseFloat((1.80 + (seed % 20) * 0.10).toFixed(2));
  return { home, draw, away };
}

// Target league IDs set for fast lookup
const TARGET_IDS = new Set(UNIQUE_LEAGUES.map(l => l.id));

export async function syncFixtures(): Promise<number> {
  const key = process.env["API_FOOTBALL_KEY"];
  if (!key) {
    logger.error("API_FOOTBALL_KEY missing — skipping sync");
    return 0;
  }

  const today = new Date();
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const tomorrow  = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const in2days   = new Date(today); in2days.setDate(today.getDate() + 2);

  const fmt = (d: Date) => d.toISOString().split("T")[0];

  const dates = [fmt(yesterday), fmt(today), fmt(tomorrow), fmt(in2days)];

  logger.info({ dates }, "Syncing fixtures from API-Football");

  const allFixtures: AFFixture[] = [];

  // Fetch all dates (4 requests)
  for (const date of dates) {
    const fixtures = await fetchFixturesForDate(date);
    // Filter to only our target leagues
    const relevant = fixtures.filter(f => TARGET_IDS.has(f.league.id));
    allFixtures.push(...relevant);
    await new Promise(r => setTimeout(r, 150)); // gentle pacing
  }

  if (allFixtures.length === 0) {
    logger.info("No fixtures returned from API-Football");
    return 0;
  }

  logger.info({ count: allFixtures.length }, "Fixtures fetched, upserting...");

  let upserted = 0;

  for (const f of allFixtures) {
    try {
      const externalId = `af-${f.fixture.id}`;
      const status = mapStatus(f.fixture.status.short);
      const isFeatured = FEATURED_IDS.has(f.league.id);

      const homeScore = status === "finished"
        ? (f.score.fulltime.home ?? null)
        : status === "live"
          ? (f.goals.home ?? null)
          : null;
      const awayScore = status === "finished"
        ? (f.score.fulltime.away ?? null)
        : status === "live"
          ? (f.goals.away ?? null)
          : null;

      const odds = placeholderOdds(f.fixture.id, f.league.id);

      await db
        .insert(matchesTable)
        .values({
          externalId,
          homeTeam: f.teams.home.name,
          awayTeam: f.teams.away.name,
          sport: "football",
          league: f.league.name,
          status,
          kickoff: new Date(f.fixture.date),
          homeScore,
          awayScore,
          minute: status === "live" ? (f.fixture.status.elapsed ?? null) : null,
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
            homeScore,
            awayScore,
            minute: status === "live" ? (f.fixture.status.elapsed ?? null) : null,
            updatedAt: new Date(),
          },
        });

      upserted++;
    } catch (err) {
      logger.warn({ fixtureId: f.fixture.id, err }, "Failed to upsert fixture");
    }
  }

  logger.info({ upserted, total: allFixtures.length }, "Fixtures synced");
  return upserted;
}

let syncInterval: ReturnType<typeof setInterval> | null = null;

export function startFixtureSync(intervalMs = 60_000): void {
  syncFixtures().catch(err => logger.error({ err }, "Initial fixture sync failed"));

  syncInterval = setInterval(() => {
    syncFixtures().catch(err => logger.error({ err }, "Periodic fixture sync failed"));
  }, intervalMs);

  logger.info({ intervalMs }, "API-Football fixture sync started");
}

export function stopFixtureSync(): void {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}
