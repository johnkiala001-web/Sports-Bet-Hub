import { pgTable, serial, text, numeric, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const leaguesTable = pgTable("leagues", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  sport: text("sport").notNull(),
  country: text("country").notNull(),
  logoUrl: text("logo_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const matchesTable = pgTable("matches", {
  id: serial("id").primaryKey(),
  externalId: text("external_id").unique(),
  homeTeam: text("home_team").notNull(),
  awayTeam: text("away_team").notNull(),
  sport: text("sport").notNull(),
  league: text("league").notNull(),
  leagueId: integer("league_id"),
  status: text("status").notNull().default("upcoming"),
  kickoff: timestamp("kickoff", { withTimezone: true }).notNull(),
  homeScore: integer("home_score"),
  awayScore: integer("away_score"),
  halftimeHomeScore: integer("halftime_home_score"),
  halftimeAwayScore: integer("halftime_away_score"),
  minute: integer("minute"),
  homeOdds: numeric("home_odds", { precision: 8, scale: 2 }).notNull(),
  drawOdds: numeric("draw_odds", { precision: 8, scale: 2 }).notNull(),
  awayOdds: numeric("away_odds", { precision: 8, scale: 2 }).notNull(),
  hasOddsBoost: boolean("has_odds_boost").notNull().default(false),
  isFeatured: boolean("is_featured").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const oddsMarketsTable = pgTable("odds_markets", {
  id: serial("id").primaryKey(),
  matchId: integer("match_id").notNull(),
  name: text("name").notNull(),
});

export const oddsSelectionsTable = pgTable("odds_selections", {
  id: serial("id").primaryKey(),
  marketId: integer("market_id").notNull(),
  matchId: integer("match_id").notNull(),
  label: text("label").notNull(),
  odds: numeric("odds", { precision: 8, scale: 2 }).notNull(),
  hasBoost: boolean("has_boost").notNull().default(false),
});

export const insertMatchSchema = createInsertSchema(matchesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertMatch = z.infer<typeof insertMatchSchema>;
export type Match = typeof matchesTable.$inferSelect;
export type League = typeof leaguesTable.$inferSelect;
