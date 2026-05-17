import { pgTable, serial, text, numeric, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const jackpotsTable = pgTable("jackpots", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  poolAmount: numeric("pool_amount", { precision: 18, scale: 2 }).notNull(),
  ticketPrice: numeric("ticket_price", { precision: 18, scale: 2 }).notNull(),
  status: text("status").notNull().default("open"),
  drawDate: timestamp("draw_date", { withTimezone: true }).notNull(),
  totalTickets: integer("total_tickets").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const jackpotFixturesTable = pgTable("jackpot_fixtures", {
  id: serial("id").primaryKey(),
  jackpotId: integer("jackpot_id").notNull(),
  matchId: integer("match_id").notNull(),
});

export const insertJackpotSchema = createInsertSchema(jackpotsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertJackpot = z.infer<typeof insertJackpotSchema>;
export type Jackpot = typeof jackpotsTable.$inferSelect;
