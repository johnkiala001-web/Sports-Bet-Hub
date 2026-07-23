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

function determineSelectionResult(
  market: string,
  label: string,
  homeScore: number,
  awayScore: number,
): "won" | "lost" {
  const total = homeScore + awayScore;
  switch (market.toUpperCase()) {
    case "1X2":
    case "MATCH_WINNER":
      if (label === "1" || label === "Home") return homeScore > awayScore ? "won" : "lost";
      if (label === "X" || label === "Draw") return homeScore === awayScore ? "won" : "lost";
      if (label === "2" || label === "Away") return awayScore > homeScore ? "won" : "lost";
      return "lost";
    case "OVER_UNDER":
    case "GOALS_OVER_UNDER": {
      const m = label.match(/^(Over|Under)\s+([\d.]+)$/i);
      if (!m) return "lost";
      const threshold = parseFloat(m[2]);
      return m[1].toLowerCase() === "over"
        ? total > threshold ? "won" : "lost"
        : total < threshold ? "won" : "lost";
    }
    case "BTTS":
    case "BOTH_TEAMS_TO_SCORE":
      if (label === "Yes") return homeScore > 0 && awayScore > 0 ? "won" : "lost";
      if (label === "No") return !(homeScore > 0 && awayScore > 0) ? "won" : "lost";
      return "lost";
    case "DOUBLE_CHANCE":
      if (label === "1X") return homeScore >= awayScore ? "won" : "lost";
      if (label === "12") return homeScore !== awayScore ? "won" : "lost";
      if (label === "X2") return awayScore >= homeScore ? "won" : "lost";
      return "lost";
    default:
      return "lost";
  }
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
      return homeScore > 0 && awayScore > 0 ? "Yes" : "No";
    case "DOUBLE_CHANCE": {
      if (homeScore >= awayScore && awayScore >= homeScore) return "1X/X2";
      if (homeScore > awayScore) return "1X";
      if (awayScore > homeScore) return "X2";
      return "1X/X2";
    }
    default:
      return null;
  }
}

async function settleBetsForMatch(matchId: number, homeScore: number, awayScore: number) {
  const selections = await db
    .select()
    .from(betSelectionsTable)
    .where(and(eq(betSelectionsTable.matchId, matchId), eq(betSelectionsTable.result, "pending")));

  if (selections.length === 0) return;

  logger.info({ matchId, homeScore, awayScore, count: selections.length }, "Settling selections");

  for (const sel of selections) {
    const result = determineSelectionResult(sel.market, sel.label, homeScore, awayScore);
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
      actualWin = parseFloat(bet.stake as string) * (hasVoid ? effectiveOdds : effectiveOdds);
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

export async function runBetSettlement() {
  const finishedMatches = await db
    .select()
    .from(matchesTable)
    .where(eq(matchesTable.status, "finished"));

  for (const match of finishedMatches) {
    if (match.homeScore == null || match.awayScore == null) continue;
    await settleBetsForMatch(match.id, match.homeScore, match.awayScore);
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
