import { eq, and, lt, inArray } from "drizzle-orm";
import { db, matchesTable } from "@workspace/db";
import { logger } from "./logger";

export async function runMarketLock() {
  const now = new Date();

  const toActivate = await db
    .select({ id: matchesTable.id })
    .from(matchesTable)
    .where(and(eq(matchesTable.status, "upcoming"), lt(matchesTable.kickoff, now)));

  if (toActivate.length === 0) return;

  const ids = toActivate.map((m) => m.id);
  await db.update(matchesTable).set({ status: "live" }).where(inArray(matchesTable.id, ids));
  logger.info({ ids }, "Markets locked — matches moved to live");
}

export function startMarketLock(intervalMs = 60_000) {
  runMarketLock().catch((err) => logger.error({ err }, "Market lock error"));
  return setInterval(() => {
    runMarketLock().catch((err) => logger.error({ err }, "Market lock error"));
  }, intervalMs);
}
