import { eq, and, inArray } from "drizzle-orm";
import {
  db,
  betsTable,
  betSelectionsTable,
  matchesTable,
  walletsTable,
  transactionsTable,
  notificationsTable,
  loyaltyPointsTable,
} from "@workspace/db";
import { logger } from "./logger";

interface ScoreContext {
  homeScore: number;
  awayScore: number;
  htHomeScore: number | null;
  htAwayScore: number | null;
}

type Verdict = "won" | "lost" | "void";

// Parse "Over 2.5" / "Under 2.5" style labels, common across several markets
function parseOverUnder(label: string): { isOver: boolean; threshold: number } | null {
  const m = label.match(/^(Over|Under)\s+([\d.]+)$/i);
  if (!m) return null;
  return { isOver: m[1].toLowerCase() === "over", threshold: parseFloat(m[2]) };
}

function resultFromTotal(total: number, ou: { isOver: boolean; threshold: number }): Verdict {
  if (ou.isOver) return total > ou.threshold ? "won" : "lost";
  return total < ou.threshold ? "won" : "lost";
}

function matchResultLabel(label: string, home: number, away: number): Verdict {
  if (label === "1" || label === "Home") return home > away ? "won" : "lost";
  if (label === "X" || label === "Draw") return home === away ? "won" : "lost";
  if (label === "2" || label === "Away") return away > home ? "won" : "lost";
  return "lost";
}

function determineSelectionResult(market: string, label: string, ctx: ScoreContext): Verdict {
  const { homeScore: home, awayScore: away, htHomeScore, htAwayScore } = ctx;
  const total = home + away;
  const name = market.trim();

  // ── Markets requiring only the final score ──────────────────────────────
  if (name === "Match Result") {
    return matchResultLabel(label, home, away);
  }

  if (name === "Double Chance") {
    if (label === "1X") return home >= away ? "won" : "lost";
    if (label === "12") return home !== away ? "won" : "lost";
    if (label === "X2") return away >= home ? "won" : "lost";
    return "lost";
  }

  if (name === "Draw No Bet") {
    if (home === away) return "void";
    if (label === "Home") return home > away ? "won" : "lost";
    if (label === "Away") return away > home ? "won" : "lost";
    return "lost";
  }

  if (name === "Both Teams To Score") {
    const btts = home > 0 && away > 0;
    if (label === "Yes") return btts ? "won" : "lost";
    if (label === "No") return !btts ? "won" : "lost";
    return "lost";
  }

  if (name === "Correct Score") {
    return label === `${home}-${away}` ? "won" : "lost";
  }

  if (name === "Odd/Even Goals") {
    const isOdd = total % 2 === 1;
    if (label === "Odd") return isOdd ? "won" : "lost";
    if (label === "Even") return !isOdd ? "won" : "lost";
    return "lost";
  }

  if (name === "Clean Sheet - Home") {
    const yes = away === 0;
    return label === "Yes" ? (yes ? "won" : "lost") : (yes ? "lost" : "won");
  }
  if (name === "Clean Sheet - Away") {
    const yes = home === 0;
    return label === "Yes" ? (yes ? "won" : "lost") : (yes ? "lost" : "won");
  }
  if (name === "Win To Nil - Home") {
    const yes = home > away && away === 0;
    return label === "Yes" ? (yes ? "won" : "lost") : (yes ? "lost" : "won");
  }
  if (name === "Win To Nil - Away") {
    const yes = away > home && home === 0;
    return label === "Yes" ? (yes ? "won" : "lost") : (yes ? "lost" : "won");
  }

  if (name === "Exact Goals") {
    if (label === "5+ Goals") return total >= 5 ? "won" : "lost";
    const m = label.match(/^(\d+)\s+Goals?$/);
    if (!m) return "lost";
    return total === parseInt(m[1], 10) ? "won" : "lost";
  }

  if (name.startsWith("Multi Goals")) {
    const m = name.match(/(\d+)-(\d+)/);
    if (!m) return "lost";
    const [min, max] = [parseInt(m[1], 10), parseInt(m[2], 10)];
    const inRange = total >= min && total <= max;
    if (label === "Yes") return inRange ? "won" : "lost";
    if (label === "No") return !inRange ? "won" : "lost";
    return "lost";
  }

  if (name === "European Handicap") {
    const margin = home - away;
    const adjusted = margin - 1;
    if (label === "Home -1") return adjusted > 0 ? "won" : "lost";
    if (label === "Draw") return adjusted === 0 ? "won" : "lost";
    if (label === "Away +1") return adjusted < 0 ? "won" : "lost";
    return "lost";
  }

  if (name === "Asian Handicap") {
    const m = label.match(/^(Home|Away)\s+([+-]?[\d.]+)$/);
    if (!m) return "lost";
    const team = m[1];
    const handicap = parseFloat(m[2]);
    const adjustedHome = team === "Home" ? home + handicap : home;
    const adjustedAway = team === "Away" ? away + handicap : away;
    if (adjustedHome === adjustedAway) return "void";
    if (team === "Home") return adjustedHome > adjustedAway ? "won" : "lost";
    return adjustedAway > adjustedHome ? "won" : "lost";
  }

  // ── Generic Over/Under-style markets (total, home-only, away-only) ─────
  if (name.startsWith("Over/Under")) {
    const ou = parseOverUnder(label);
    return ou ? resultFromTotal(total, ou) : "lost";
  }
  if (name.startsWith("Home Team Over/Under")) {
    const ou = parseOverUnder(label);
    return ou ? resultFromTotal(home, ou) : "lost";
  }
  if (name.startsWith("Away Team Over/Under")) {
    const ou = parseOverUnder(label);
    return ou ? resultFromTotal(away, ou) : "lost";
  }

  // ── Markets requiring halftime score ─────────────────────────────────────
  if (htHomeScore == null || htAwayScore == null) {
    if (
      name === "Half Time Result" ||
      name === "HT/FT" ||
      name === "Second Half Result" ||
      name.startsWith("2nd Half Over/Under") ||
      name === "HT Over/Under 1.5"
    ) {
      return "void"; // can't determine without halftime data
    }
  } else {
    if (name === "Half Time Result") {
      return matchResultLabel(label, htHomeScore, htAwayScore);
    }
    if (name === "HT/FT") {
      const htLetter = htHomeScore > htAwayScore ? "1" : htHomeScore < htAwayScore ? "2" : "X";
      const ftLetter = home > away ? "1" : home < away ? "2" : "X";
      return label === `${htLetter}/${ftLetter}` ? "won" : "lost";
    }
    const secondHalfHome = home - htHomeScore;
    const secondHalfAway = away - htAwayScore;
    if (name === "Second Half Result") {
      return matchResultLabel(label, secondHalfHome, secondHalfAway);
    }
    if (name.startsWith("2nd Half Over/Under")) {
      const ou = parseOverUnder(label);
      return ou ? resultFromTotal(secondHalfHome + secondHalfAway, ou) : "lost";
    }
    if (name === "HT Over/Under 1.5") {
      const ou = parseOverUnder(label);
      return ou ? resultFromTotal(htHomeScore + htAwayScore, ou) : "lost";
    }
  }

  // ── Markets with no trackable data source (corners, cards, goal timing) ──
  // We don't track corners, cards, red cards, penalties, or goal-by-goal
  // timing, so these markets can't be fairly graded — void and refund.
  if (
    name.startsWith("Corners Over/Under") ||
    name === "Cards Over/Under 3.5" ||
    name === "First Goal" ||
    name === "Last Goal" ||
    name === "Next Goal" ||
    name.startsWith("Race To") ||
    name === "Red Card in Match" ||
    name === "Penalty Awarded"
  ) {
    return "void";
  }

  return "lost";
}

export function describeOutcome(
  market: string,
  label: string,
  homeScore: number | null,
  awayScore: number | null,
): string | null {
  if (homeScore == null || awayScore == null) return null;
  const total = homeScore + awayScore;
  switch (market.toUpperCase()) {
    case "1X2":
    case "MATCH_WINNER":
    case "MATCH RESULT":
      if (homeScore > awayScore) return "Home";
      if (awayScore > homeScore) return "Away";
      return "Draw";
    case "OVER_UNDER":
    case "GOALS_OVER_UNDER": {
      const m = label.match(/^(Over|Under)\s+([\d.]+)$/i);
      if (!m) return null;
      const threshold = parseFloat(m[2]);
      return total > threshold ? `Over ${threshold}` : `Under ${threshold}`;
    }
    case "BTTS":
    case "BOTH_TEAMS_TO_SCORE":
    case "BOTH TEAMS TO SCORE":
      return homeScore > 0 && awayScore > 0 ? "Yes" : "No";
    case "DOUBLE_CHANCE":
    case "DOUBLE CHANCE": {
      if (homeScore === awayScore) return "1X/X2";
      if (homeScore > awayScore) return "1X";
      return "X2";
    }
    default:
      return null;
  }
}

async function settleBetsForMatch(
  matchId: number,
  homeScore: number,
  awayScore: number,
  htHomeScore: number | null = null,
  htAwayScore: number | null = null,
) {
  const selections = await db
    .select()
    .from(betSelectionsTable)
    .where(and(eq(betSelectionsTable.matchId, matchId), eq(betSelectionsTable.result, "pending")));

  if (selections.length === 0) return;

  logger.info({ matchId, homeScore, awayScore, count: selections.length }, "Settling selections");

  const ctx: ScoreContext = { homeScore, awayScore, htHomeScore, htAwayScore };

  for (const sel of selections) {
    const result = determineSelectionResult(sel.market, sel.label, ctx);
    await db.update(betSelectionsTable).set({ result }).where(eq(betSelectionsTable.id, sel.id));
  }

  const betIds = [...new Set(selections.map((s) => s.betId))];

  for (const betId of betIds) {
    const [bet] = await db.select().from(betsTable).where(eq(betsTable.id, betId));
    if (!bet || bet.status !== "pending") continue;

    const allSels = await db.select().from(betSelectionsTable).where(eq(betSelectionsTable.betId, betId));
    const hasPending = allSels.some((s) => s.result === "pending");
    if (hasPending) continue;

    const hasLost = allSels.some((s) => s.result === "lost");
    const allVoid = allSels.every((s) => s.result === "void");
    const hasVoid = allSels.some((s) => s.result === "void");

    let betStatus: string;
    let actualWin = 0;

    if (hasLost) {
      betStatus = "lost";
    } else if (allVoid) {
      betStatus = "void";
      actualWin = parseFloat(bet.stake as string);
    } else {
      betStatus = "won";
      const activeSels = allSels.filter((s) => s.result === "won");
      const effectiveOdds = hasVoid
        ? activeSels.reduce((acc, s) => acc * parseFloat(s.odds as string), 1)
        : parseFloat(bet.totalOdds as string);
      actualWin = parseFloat(bet.stake as string) * effectiveOdds;
      if (!hasVoid) actualWin = parseFloat(bet.potentialWin as string);
    }

    await db.update(betsTable).set({
      status: betStatus,
      actualWin: actualWin > 0 ? actualWin.toFixed(2) : null,
    }).where(eq(betsTable.id, betId));

    if (actualWin > 0) {
      const [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, bet.userId));
      if (wallet) {
        const newBalance = (parseFloat(wallet.balance as string) + actualWin).toFixed(2);
        await db.update(walletsTable).set({ balance: newBalance }).where(eq(walletsTable.userId, bet.userId));

        await db.insert(transactionsTable).values({
          userId: bet.userId,
          type: "win",
          amount: actualWin.toFixed(2),
          status: "completed",
          description: `Bet #${betId} ${betStatus} — KES ${actualWin.toFixed(2)} credited`,
          reference: `BET-${betId}`,
        });

        if (betStatus === "won") {
          const pointsEarned = Math.floor(actualWin / 10);
          if (pointsEarned > 0) {
            await db.insert(loyaltyPointsTable).values({
              userId: bet.userId,
              points: pointsEarned,
              action: "bet_won",
              referenceId: betId,
            });
          }
        }
      }
    }

    await db.insert(notificationsTable).values({
      userId: bet.userId,
      title: betStatus === "won" ? "🎉 You won!" : betStatus === "void" ? "Bet Voided" : "Bet Settled",
      message:
        betStatus === "won"
          ? `Your bet #${betId} won! KES ${actualWin.toFixed(2)} credited to your wallet.`
          : betStatus === "void"
            ? `Your bet #${betId} was voided. KES ${actualWin.toFixed(2)} refunded.`
            : `Your bet #${betId} did not win. Better luck next time!`,
      type: betStatus === "won" ? "success" : "info",
    });

    logger.info({ betId, betStatus, actualWin }, "Bet settled");
  }
}

export { settleBetsForMatch };

export async function runBetSettlement() {
  const finishedMatches = await db
    .select()
    .from(matchesTable)
    .where(eq(matchesTable.status, "finished"));

  for (const match of finishedMatches) {
    if (match.homeScore == null || match.awayScore == null) continue;
    await settleBetsForMatch(
      match.id,
      match.homeScore,
      match.awayScore,
      match.halftimeHomeScore ?? null,
      match.halftimeAwayScore ?? null,
    );
  }
}

export function startBetSettlement(intervalMs = 5 * 60_000) {
  runBetSettlement().catch((err) => logger.error({ err }, "Bet settlement error"));
  return setInterval(() => {
    runBetSettlement().catch((err) => logger.error({ err }, "Bet settlement error"));
  }, intervalMs);
}

export async function voidBetsForMatch(matchId: number) {
  const selections = await db
    .select()
    .from(betSelectionsTable)
    .where(and(eq(betSelectionsTable.matchId, matchId), eq(betSelectionsTable.result, "pending")));

  for (const sel of selections) {
    await db.update(betSelectionsTable).set({ result: "void" }).where(eq(betSelectionsTable.id, sel.id));
  }

  const betIds = [...new Set(selections.map((s) => s.betId))];
  for (const betId of betIds) {
    await settleBetsForMatch(matchId, 0, 0);
  }

  logger.info({ matchId, count: betIds.length }, "Bets voided for cancelled match");
}
