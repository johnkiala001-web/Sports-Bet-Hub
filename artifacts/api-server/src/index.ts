import app from "./app";
import { logger } from "./lib/logger";
import { startFixtureSync, startLiveSync } from "./lib/apiFootball";
import { startFDFixtureSync } from "./lib/footballData";
import { startBetSettlement } from "./lib/betSettlement";
import { startMarketLock } from "./lib/marketLock";
import { startWithdrawalTimeout } from "./lib/withdrawalTimeout";

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
  // Withdrawal timeout: auto-revert pending withdrawals stuck too long (every 1 min)
  startWithdrawalTimeout(60_000);
});
// trigger redeploy
