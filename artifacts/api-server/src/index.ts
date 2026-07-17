import app from "./app";
import { logger } from "./lib/logger";
import { startFixtureSync, startLiveSync } from "./lib/apiFootball";
import { startFDFixtureSync } from "./lib/footballData";
import { startBetSettlement } from "./lib/betSettlement";
import { startMarketLock } from "./lib/marketLock";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}


    try {
      const { db, matchesTable, oddsMarketsTable, oddsSelectionsTable } = await import("@workspace/db");
      console.log("Wiping stale match cache...");
      await db.delete(oddsSelectionsTable);
      await db.delete(oddsMarketsTable);
      await db.delete(matchesTable);
      console.log("Database cleared successfully!");
    } catch (err) {
      console.error("Auto-clear failed:", err);
    }
    
app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // API-Football: date-based sync every 20 min (4 req/cycle)
  startFixtureSync(20 * 60_000);

  // Football-Data.org: World Cup + major leagues, every 30 min
  startFDFixtureSync(30 * 60_000);

  // Live-only sync every 3 minutes (1 req/cycle) for real-time score + status updates
  startLiveSync(3 * 60_000);

  // Market lock: move upcoming → live when kickoff time passes (every 1 min)
  startMarketLock(60_000);

  // Bet settlement: settle bets on finished matches (every 5 min)
  startBetSettlement(5 * 60_000);
});
// trigger redeploy
