import { pgTable, serial, integer, numeric, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const betsTable = pgTable("bets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  stake: numeric("stake", { precision: 18, scale: 2 }).notNull(),
  totalOdds: numeric("total_odds", { precision: 18, scale: 4 }).notNull(),
  potentialWin: numeric("potential_win", { precision: 18, scale: 2 }).notNull(),
  actualWin: numeric("actual_win", { precision: 18, scale: 2 }),
  status: text("status").notNull().default("pending"),
  type: text("type").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const betSelectionsTable = pgTable("bet_selections", {
  id: serial("id").primaryKey(),
  betId: integer("bet_id").notNull(),
  matchId: integer("match_id").notNull(),
  homeTeam: text("home_team").notNull(),
  awayTeam: text("away_team").notNull(),
  market: text("market").notNull(),
  label: text("label").notNull(),
  odds: numeric("odds", { precision: 8, scale: 2 }).notNull(),
  result: text("result").notNull().default("pending"),
});

export const insertBetSchema = createInsertSchema(betsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertBet = z.infer<typeof insertBetSchema>;
export type Bet = typeof betsTable.$inferSelect;
export type BetSelection = typeof betSelectionsTable.$inferSelect;
