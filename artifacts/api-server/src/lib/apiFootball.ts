import { db, matchesTable, oddsMarketsTable, oddsSelectionsTable, betsTable, betSelectionsTable, walletsTable, transactionsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logger } from "./logger";
import { settleBetsForMatch } from "./betSettlement";

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

// Deterministic seeded value between 0-1 for market odds generation
function rnd(fixtureId: number, marketIdx: number, selIdx: number): number {
  const x = Math.sin(fixtureId * 127.1 + marketIdx * 31.7 + selIdx * 7.3) * 43758.5453;
  return x - Math.floor(x);
}

function o(val: number): string {
  return Math.max(1.05, val).toFixed(2);
}

// Build all 40 market definitions for a given match
function buildMarkets(fixtureId: number, h: number, d: number, a: number) {
  // Implied probs (normalize so they sum to ~1)
  const ph = 1 / h, pd = 1 / d, pa = 1 / a;
  const total = ph + pd + pa;
  const nph = ph / total, npd = pd / total, npa = pa / total;

  // helper: convert probability to odds with small random spread
  const prob2odds = (p: number, mIdx: number, sIdx: number) => {
    const spread = 0.85 + rnd(fixtureId, mIdx, sIdx) * 0.05;
    return parseFloat(o((spread / Math.max(0.01, p))));
  };

  const markets: Array<{ name: string; selections: Array<{ label: string; odds: string }> }> = [];
  let m = 0;

  // 1. Match Result (1X2)
  markets.push({ name: "Match Result", selections: [
    { label: "1", odds: o(h) },
    { label: "X", odds: o(d) },
    { label: "2", odds: o(a) },
  ]});
  m++;

  // 2. Double Chance (combined probability = sum of two outcomes)
  markets.push({ name: "Double Chance", selections: [
    { label: "1X", odds: prob2odds(nph + npd, m, 0).toFixed(2) },
    { label: "12", odds: prob2odds(nph + npa, m, 1).toFixed(2) },
    { label: "X2", odds: prob2odds(npd + npa, m, 2).toFixed(2) },
  ]});
  m++;

  // 3. Draw No Bet
  markets.push({ name: "Draw No Bet", selections: [
    { label: "Home", odds: prob2odds(nph / (nph + npa), m, 0).toFixed(2) },
    { label: "Away", odds: prob2odds(npa / (nph + npa), m, 1).toFixed(2) },
  ]});
  m++;

  // 4-7. Over/Under goals
  for (const [line, baseOverP] of [[0.5, 0.93], [1.5, 0.77], [2.5, 0.52], [3.5, 0.33]] as [number, number][]) {
    const overP = baseOverP + (rnd(fixtureId, m, 0) - 0.5) * 0.08;
    markets.push({ name: `Over/Under ${line}`, selections: [
      { label: `Over ${line}`,  odds: prob2odds(overP, m, 0).toFixed(2) },
      { label: `Under ${line}`, odds: prob2odds(1 - overP, m, 1).toFixed(2) },
    ]});
    m++;
  }

  // 8. Both Teams To Score
  const bttsP = 0.48 + rnd(fixtureId, m, 0) * 0.12;
  markets.push({ name: "Both Teams To Score", selections: [
    { label: "Yes", odds: prob2odds(bttsP, m, 0).toFixed(2) },
    { label: "No",  odds: prob2odds(1 - bttsP, m, 1).toFixed(2) },
  ]});
  m++;

  // 9. Correct Score (top 9 outcomes)
  const scores = ["0-0","1-0","0-1","1-1","2-0","0-2","2-1","1-2","2-2"];
  const scoreBaseOdds = [8.5, 7.2, 9.0, 6.5, 9.5, 11.0, 8.0, 10.0, 12.0];
  markets.push({ name: "Correct Score", selections: scores.map((s, i) => ({
    label: s,
    odds: parseFloat(o(scoreBaseOdds[i]! * (0.85 + rnd(fixtureId, m, i) * 0.3))).toFixed(2),
  }))});
  m++;

  // 10. Half Time Result
  markets.push({ name: "Half Time Result", selections: [
    { label: "1", odds: prob2odds(nph * 1.05, m, 0).toFixed(2) },
    { label: "X", odds: prob2odds(0.42 + rnd(fixtureId, m, 1) * 0.08, m, 1).toFixed(2) },
    { label: "2", odds: prob2odds(npa * 1.05, m, 2).toFixed(2) },
  ]});
  m++;

  // 11. Half Time / Full Time (6 most common combos)
  const htftLabels = ["1/1","1/X","X/1","X/X","X/2","2/2"];
  const htftBase   = [0.22, 0.05, 0.12, 0.14, 0.10, 0.18];
  markets.push({ name: "HT/FT", selections: htftLabels.map((l, i) => ({
    label: l,
    odds: prob2odds((htftBase[i]! + rnd(fixtureId, m, i) * 0.04) * (nph > npa ? 1 : 0.9), m, i).toFixed(2),
  }))});
  m++;

  // 12. Odd/Even Goals
  markets.push({ name: "Odd/Even Goals", selections: [
    { label: "Odd",  odds: (1.85 + rnd(fixtureId, m, 0) * 0.1).toFixed(2) },
    { label: "Even", odds: (1.90 + rnd(fixtureId, m, 1) * 0.1).toFixed(2) },
  ]});
  m++;

  // 13. First Goal
  markets.push({ name: "First Goal", selections: [
    { label: "Home",    odds: prob2odds(nph * 1.1, m, 0).toFixed(2) },
    { label: "Away",    odds: prob2odds(npa * 1.1, m, 1).toFixed(2) },
    { label: "No Goal", odds: (9.0 + rnd(fixtureId, m, 2) * 2.0).toFixed(2) },
  ]});
  m++;

  // 14. Last Goal
  markets.push({ name: "Last Goal", selections: [
    { label: "Home", odds: prob2odds(nph * 1.05, m, 0).toFixed(2) },
    { label: "Away", odds: prob2odds(npa * 1.05, m, 1).toFixed(2) },
  ]});
  m++;

  // 15. Asian Handicap
  const ahLines = ["-1.5","-1.0","-0.5","0","+0.5","+1.0"];
  markets.push({ name: "Asian Handicap", selections: ahLines.map((line, i) => ({
    label: `${i < 3 ? "Home" : "Away"} ${line}`,
    odds: (1.82 + rnd(fixtureId, m, i) * 0.22).toFixed(2),
  }))});
  m++;

  // 16. European Handicap
  markets.push({ name: "European Handicap", selections: [
    { label: "Home -1", odds: prob2odds(nph * 0.75, m, 0).toFixed(2) },
    { label: "Draw",    odds: (3.2 + rnd(fixtureId, m, 1) * 0.5).toFixed(2) },
    { label: "Away +1", odds: prob2odds((npa + npd * 0.4), m, 2).toFixed(2) },
  ]});
  m++;

  // 17. Clean Sheet Home
  const csHomeP = 0.30 + rnd(fixtureId, m, 0) * 0.12;
  markets.push({ name: "Clean Sheet - Home", selections: [
    { label: "Yes", odds: prob2odds(csHomeP, m, 0).toFixed(2) },
    { label: "No",  odds: prob2odds(1 - csHomeP, m, 1).toFixed(2) },
  ]});
  m++;

  // 18. Clean Sheet Away
  const csAwayP = 0.25 + rnd(fixtureId, m, 0) * 0.12;
  markets.push({ name: "Clean Sheet - Away", selections: [
    { label: "Yes", odds: prob2odds(csAwayP, m, 0).toFixed(2) },
    { label: "No",  odds: prob2odds(1 - csAwayP, m, 1).toFixed(2) },
  ]});
  m++;

  // 19. Win To Nil Home
  const wtnHomeP = nph * 0.40 + rnd(fixtureId, m, 0) * 0.05;
  markets.push({ name: "Win To Nil - Home", selections: [
    { label: "Yes", odds: prob2odds(wtnHomeP, m, 0).toFixed(2) },
    { label: "No",  odds: prob2odds(1 - wtnHomeP, m, 1).toFixed(2) },
  ]});
  m++;

  // 20. Win To Nil Away
  const wtnAwayP = npa * 0.38 + rnd(fixtureId, m, 0) * 0.05;
  markets.push({ name: "Win To Nil - Away", selections: [
    { label: "Yes", odds: prob2odds(wtnAwayP, m, 0).toFixed(2) },
    { label: "No",  odds: prob2odds(1 - wtnAwayP, m, 1).toFixed(2) },
  ]});
  m++;

  // 21-22. Home Team Goals Over/Under
  for (const [line, baseP] of [[0.5, 0.72], [1.5, 0.45]] as [number, number][]) {
    const p = baseP + rnd(fixtureId, m, 0) * 0.07;
    markets.push({ name: `Home Team Over/Under ${line}`, selections: [
      { label: `Over ${line}`,  odds: prob2odds(p, m, 0).toFixed(2) },
      { label: `Under ${line}`, odds: prob2odds(1 - p, m, 1).toFixed(2) },
    ]});
    m++;
  }

  // 23-24. Away Team Goals Over/Under
  for (const [line, baseP] of [[0.5, 0.68], [1.5, 0.40]] as [number, number][]) {
    const p = baseP + rnd(fixtureId, m, 0) * 0.07;
    markets.push({ name: `Away Team Over/Under ${line}`, selections: [
      { label: `Over ${line}`,  odds: prob2odds(p, m, 0).toFixed(2) },
      { label: `Under ${line}`, odds: prob2odds(1 - p, m, 1).toFixed(2) },
    ]});
    m++;
  }

  // 25-26. Corners
  for (const line of [8.5, 10.5]) {
    const p = line === 8.5 ? 0.63 : 0.42;
    const pv = p + rnd(fixtureId, m, 0) * 0.08;
    markets.push({ name: `Corners Over/Under ${line}`, selections: [
      { label: `Over ${line}`,  odds: prob2odds(pv, m, 0).toFixed(2) },
      { label: `Under ${line}`, odds: prob2odds(1 - pv, m, 1).toFixed(2) },
    ]});
    m++;
  }

  // 27. Cards Over/Under
  const cardP = 0.58 + rnd(fixtureId, m, 0) * 0.10;
  markets.push({ name: "Cards Over/Under 3.5", selections: [
    { label: "Over 3.5",  odds: prob2odds(cardP, m, 0).toFixed(2) },
    { label: "Under 3.5", odds: prob2odds(1 - cardP, m, 1).toFixed(2) },
  ]});
  m++;

  // 28. Next Goal
  markets.push({ name: "Next Goal", selections: [
    { label: "Home",    odds: prob2odds(nph * 1.05, m, 0).toFixed(2) },
    { label: "No Goal", odds: (6.0 + rnd(fixtureId, m, 1) * 2.0).toFixed(2) },
    { label: "Away",    odds: prob2odds(npa * 1.05, m, 2).toFixed(2) },
  ]});
  m++;

  // 29. Exact Goals
  const exactGoalProbs = [0.08, 0.20, 0.24, 0.22, 0.14, 0.12];
  const exactGoalLabels = ["0 Goals","1 Goal","2 Goals","3 Goals","4 Goals","5+ Goals"];
  markets.push({ name: "Exact Goals", selections: exactGoalLabels.map((l, i) => ({
    label: l,
    odds: prob2odds(exactGoalProbs[i]! + rnd(fixtureId, m, i) * 0.03, m, i).toFixed(2),
  }))});
  m++;

  // 30-32. Multi Goals
  for (const [label, p] of [["1-2", 0.40], ["2-3", 0.44], ["3-4", 0.35]] as [string, number][]) {
    const pv = p + rnd(fixtureId, m, 0) * 0.05;
    markets.push({ name: `Multi Goals ${label}`, selections: [
      { label: "Yes", odds: prob2odds(pv, m, 0).toFixed(2) },
      { label: "No",  odds: prob2odds(1 - pv, m, 1).toFixed(2) },
    ]});
    m++;
  }

  // 33-34. Race To Goals
  for (const goals of [2, 3]) {
    markets.push({ name: `Race To ${goals} Goals`, selections: [
      { label: "Home",    odds: prob2odds(nph * 1.1, m, 0).toFixed(2) },
      { label: "Neither", odds: (goals === 2 ? 3.5 : 5.5 + rnd(fixtureId, m, 1)).toFixed(2) },
      { label: "Away",    odds: prob2odds(npa * 1.1, m, 2).toFixed(2) },
    ]});
    m++;
  }

  // 35. Second Half Result
  markets.push({ name: "Second Half Result", selections: [
    { label: "1", odds: prob2odds(nph * 1.08, m, 0).toFixed(2) },
    { label: "X", odds: (2.4 + rnd(fixtureId, m, 1) * 0.3).toFixed(2) },
    { label: "2", odds: prob2odds(npa * 1.08, m, 2).toFixed(2) },
  ]});
  m++;

  // 36-37. Second Half Over/Under
  for (const [line, baseP] of [[0.5, 0.75], [1.5, 0.48]] as [number, number][]) {
    const p = baseP + rnd(fixtureId, m, 0) * 0.07;
    markets.push({ name: `2nd Half Over/Under ${line}`, selections: [
      { label: `Over ${line}`,  odds: prob2odds(p, m, 0).toFixed(2) },
      { label: `Under ${line}`, odds: prob2odds(1 - p, m, 1).toFixed(2) },
    ]});
    m++;
  }

  // 38. Half Time Over/Under 1.5
  const htOverP = 0.45 + rnd(fixtureId, m, 0) * 0.08;
  markets.push({ name: "HT Over/Under 1.5", selections: [
    { label: "Over 1.5",  odds: prob2odds(htOverP, m, 0).toFixed(2) },
    { label: "Under 1.5", odds: prob2odds(1 - htOverP, m, 1).toFixed(2) },
  ]});
  m++;

  // 39. Red Card in Match
  const redP = 0.18 + rnd(fixtureId, m, 0) * 0.10;
  markets.push({ name: "Red Card in Match", selections: [
    { label: "Yes", odds: prob2odds(redP, m, 0).toFixed(2) },
    { label: "No",  odds: prob2odds(1 - redP, m, 1).toFixed(2) },
  ]});
  m++;

  // 40. Penalty Awarded
  const penP = 0.28 + rnd(fixtureId, m, 0) * 0.10;
  markets.push({ name: "Penalty Awarded", selections: [
    { label: "Yes", odds: prob2odds(penP, m, 0).toFixed(2) },
    { label: "No",  odds: prob2odds(1 - penP, m, 1).toFixed(2) },
  ]});

  // ── Combination markets ──────────────────────────────────────────────────

  // 41. 1st Half - 1X2 & Total
  {
    const htHomeP = nph * 0.85 + rnd(fixtureId, m, 0) * 0.05;
    const htAwayP = npa * 0.85 + rnd(fixtureId, m, 1) * 0.05;
    const htDrawP = Math.max(0.05, 1 - htHomeP - htAwayP);
    const htOverP = 0.35 + rnd(fixtureId, m, 2) * 0.1;
    const combos: Array<[string, number]> = [["1", htHomeP], ["X", htDrawP], ["2", htAwayP]];
    const sels = [];
    let si = 0;
    for (const [res, p] of combos) {
      sels.push({ label: `${res} & Over 0.5`, odds: prob2odds(p * htOverP, m, si++).toFixed(2) });
      sels.push({ label: `${res} & Under 0.5`, odds: prob2odds(p * (1 - htOverP), m, si++).toFixed(2) });
    }
    markets.push({ name: "1st Half - 1X2 & Total", selections: sels });
  }
  m++;

  // 42. 1X2 & Both Teams To Score
  {
    const combos: Array<[string, number]> = [["1", nph], ["X", npd], ["2", npa]];
    const sels = [];
    let si = 0;
    for (const [res, p] of combos) {
      sels.push({ label: `${res} & Yes`, odds: prob2odds(p * bttsP, m, si++).toFixed(2) });
      sels.push({ label: `${res} & No`, odds: prob2odds(p * (1 - bttsP), m, si++).toFixed(2) });
    }
    markets.push({ name: "1X2 & Both Teams To Score", selections: sels });
  }
  m++;

  // 43. Total & Both Teams To Score
  {
    const overP = 0.52 + rnd(fixtureId, m, 0) * 0.1;
    const sels = [
      { label: "Over 2.5 & Yes", odds: prob2odds(overP * bttsP, m, 1).toFixed(2) },
      { label: "Over 2.5 & No", odds: prob2odds(overP * (1 - bttsP), m, 2).toFixed(2) },
      { label: "Under 2.5 & Yes", odds: prob2odds((1 - overP) * bttsP, m, 3).toFixed(2) },
      { label: "Under 2.5 & No", odds: prob2odds((1 - overP) * (1 - bttsP), m, 4).toFixed(2) },
    ];
    markets.push({ name: "Total & Both Teams To Score", selections: sels });
  }
  m++;

  // 44. 1st/2nd Half Both Teams To Score
  {
    const bttsFirstP = bttsP * 0.5 + rnd(fixtureId, m, 0) * 0.05;
    const bttsSecondP = bttsP * 0.75 + rnd(fixtureId, m, 1) * 0.05;
    const sels = [
      { label: "Yes/Yes", odds: prob2odds(bttsFirstP * bttsSecondP, m, 2).toFixed(2) },
      { label: "Yes/No", odds: prob2odds(bttsFirstP * (1 - bttsSecondP), m, 3).toFixed(2) },
      { label: "No/Yes", odds: prob2odds((1 - bttsFirstP) * bttsSecondP, m, 4).toFixed(2) },
      { label: "No/No", odds: prob2odds((1 - bttsFirstP) * (1 - bttsSecondP), m, 5).toFixed(2) },
    ];
    markets.push({ name: "1st/2nd Half Both Teams To Score", selections: sels });
  }
  m++;

  // 45. 1st Half - Correct Score
  {
    const htScores = ["0-0","1-0","0-1","1-1","2-0","0-2","2-1"];
    const htScoreBaseOdds = [3.2, 5.5, 6.5, 6.0, 12.0, 15.0, 15.0];
    markets.push({ name: "1st Half - Correct Score", selections: htScores.map((s, i) => ({
      label: s,
      odds: o(htScoreBaseOdds[i] * (0.85 + rnd(fixtureId, m, i) * 0.3)),
    }))});
  }
  m++;

  // 46. 2nd Half - 1X2 & Both Teams To Score
  {
    const shHomeP = nph * 1.05 + rnd(fixtureId, m, 0) * 0.03;
    const shAwayP = npa * 1.05 + rnd(fixtureId, m, 1) * 0.03;
    const shDrawP = Math.max(0.05, 1 - shHomeP - shAwayP);
    const bttsSecondP = bttsP * 0.75 + rnd(fixtureId, m, 2) * 0.05;
    const combos: Array<[string, number]> = [["1", shHomeP], ["X", shDrawP], ["2", shAwayP]];
    const sels = [];
    let si = 0;
    for (const [res, p] of combos) {
      sels.push({ label: `${res} & Yes`, odds: prob2odds(p * bttsSecondP, m, si++).toFixed(2) });
      sels.push({ label: `${res} & No`, odds: prob2odds(p * (1 - bttsSecondP), m, si++).toFixed(2) });
    }
    markets.push({ name: "2nd Half - 1X2 & Both Teams To Score", selections: sels });
  }
  m++;

  // 47. 2nd Half - 1X2 & Total
  {
    const shHomeP = nph * 1.05 + rnd(fixtureId, m, 0) * 0.03;
    const shAwayP = npa * 1.05 + rnd(fixtureId, m, 1) * 0.03;
    const shDrawP = Math.max(0.05, 1 - shHomeP - shAwayP);
    const shOverP = 0.42 + rnd(fixtureId, m, 2) * 0.08;
    const combos: Array<[string, number]> = [["1", shHomeP], ["X", shDrawP], ["2", shAwayP]];
    const sels = [];
    let si = 0;
    for (const [res, p] of combos) {
      sels.push({ label: `${res} & Over 0.5`, odds: prob2odds(p * shOverP, m, si++).toFixed(2) });
      sels.push({ label: `${res} & Under 0.5`, odds: prob2odds(p * (1 - shOverP), m, si++).toFixed(2) });
    }
    markets.push({ name: "2nd Half - 1X2 & Total", selections: sels });
  }
  m++;

  // 48. Halftime/Fulltime & Total
  {
    const overP = 0.52 + rnd(fixtureId, m, 0) * 0.1;
    const sels = [];
    let si = 1;
    for (let i = 0; i < htftLabels.length; i++) {
      const base = htftBase[i] + rnd(fixtureId, m, i) * 0.04;
      sels.push({ label: `${htftLabels[i]} & Over 2.5`, odds: prob2odds(base * overP, m, si++).toFixed(2) });
      sels.push({ label: `${htftLabels[i]} & Under 2.5`, odds: prob2odds(base * (1 - overP), m, si++).toFixed(2) });
    }
    markets.push({ name: "Halftime/Fulltime & Total", selections: sels });
  }
  m++;

  return markets;
}

// Generate and persist all 40 markets for a match (idempotent — skips if already generated)
export async function generateMarketsForMatch(matchId: number, fixtureId: number, h: number, d: number, a: number): Promise<void> {
  const existing = await db
    .select({ id: oddsMarketsTable.id })
    .from(oddsMarketsTable)
    .where(eq(oddsMarketsTable.matchId, matchId))
    .limit(1);

  if (existing.length > 0) return; // already generated

  const markets = buildMarkets(fixtureId, h, d, a);

  for (const market of markets) {
    const [inserted] = await db
      .insert(oddsMarketsTable)
      .values({ matchId, name: market.name })
      .returning({ id: oddsMarketsTable.id });

    if (!inserted) continue;

    await db.insert(oddsSelectionsTable).values(
      market.selections.map(s => ({
        marketId: inserted.id,
        matchId,
        label: s.label,
        odds: s.odds,
        hasBoost: false,
      }))
    );
  }
}

// Auto-settle pending bets when a match finishes

// Target league IDs set for fast lookup
const TARGET_IDS = new Set(UNIQUE_LEAGUES.map(l => l.id));

// Sync only currently-live fixtures (1 API request) — called every few minutes
export async function syncLiveFixtures(): Promise<void> {
  const key = process.env["API_FOOTBALL_KEY"];
  if (!key) return;

  const fixtures = await apiFetch<AFFixture[]>("/fixtures?live=all");
  if (!fixtures || fixtures.length === 0) return;

  const relevant = fixtures.filter(f => TARGET_IDS.has(f.league.id));
  logger.info({ count: relevant.length }, "Live fixtures sync");

  for (const f of relevant) {
    try {
      const externalId = `af-${f.fixture.id}`;
      const status = mapStatus(f.fixture.status.short);

      const [existing] = await db
        .select({ id: matchesTable.id })
        .from(matchesTable)
        .where(eq(matchesTable.externalId, externalId));

      if (!existing) continue;

      await db
        .update(matchesTable)
        .set({
          status,
          homeScore: f.goals.home ?? null,
          awayScore: f.goals.away ?? null,
          minute: f.fixture.status.elapsed ?? null,
          updatedAt: new Date(),
        })
        .where(eq(matchesTable.externalId, externalId));

      if (status === "finished" && f.score.fulltime.home != null && f.score.fulltime.away != null) {
        await settleBetsForMatch(existing.id, f.score.fulltime.home, f.score.fulltime.away);
      }
    } catch (err) {
      logger.warn({ fixtureId: f.fixture.id, err }, "Live sync update failed");
    }
  }
}

let liveInterval: ReturnType<typeof setInterval> | null = null;

export function startLiveSync(intervalMs = 3 * 60_000): void {
  syncLiveFixtures().catch(err => logger.error({ err }, "Initial live sync failed"));
  liveInterval = setInterval(() => {
    syncLiveFixtures().catch(err => logger.error({ err }, "Live sync failed"));
  }, intervalMs);
  logger.info({ intervalMs }, "Live fixture sync started");
}

export function stopLiveSync(): void {
  if (liveInterval) { clearInterval(liveInterval); liveInterval = null; }
}

export async function syncFixtures(): Promise<number> {
  const key = process.env["API_FOOTBALL_KEY"];
  if (!key) {
    logger.error("API_FOOTBALL_KEY missing — skipping sync");
    return 0;
  }

  const today = new Date();
  const tomorrow  = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const in2days   = new Date(today); in2days.setDate(today.getDate() + 2);
  const in3days   = new Date(today); in3days.setDate(today.getDate() + 3);

  const fmt = (d: Date) => d.toISOString().split("T")[0];

  // Only today and upcoming — no yesterday
  const dates = [fmt(today), fmt(tomorrow), fmt(in2days), fmt(in3days)];

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

      const realOdds = isFeatured ? await fetchOdds(f.fixture.id) : null;
      const odds = realOdds ?? placeholderOdds(f.fixture.id, f.league.id);

      const [row] = await db
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
            homeOdds: odds.home.toString(),
            drawOdds: odds.draw.toString(),
            awayOdds: odds.away.toString(),
            updatedAt: new Date(),
          },
        })
        .returning({ id: matchesTable.id });

      if (row) {
        await generateMarketsForMatch(row.id, f.fixture.id, odds.home, odds.draw, odds.away);

        // Settle any pending bets when match just finished
        if (status === "finished" && f.score.fulltime.home != null && f.score.fulltime.away != null) {
          await settleBetsForMatch(row.id, f.score.fulltime.home, f.score.fulltime.away);
        }
      }

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
