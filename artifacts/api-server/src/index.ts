import app from "./app";
import { logger } from "./lib/logger";
import { startFixtureSync, startLiveSync } from "./lib/apiFootball";

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

  // Full date-based sync every 20 minutes (4 req/cycle × 72 cycles/day = 288 req/day budget)
  // In practice rate limiter will cap it — this ensures fresh upcoming fixtures
  startFixtureSync(20 * 60_000);

  // Live-only sync every 3 minutes (1 req/cycle) for real-time score + status updates
  startLiveSync(3 * 60_000);
});
