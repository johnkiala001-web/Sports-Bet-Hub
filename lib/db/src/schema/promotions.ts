import { pgTable, serial, integer, numeric, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const promotionsTable = pgTable("promotions", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  description: text("description").notNull(),
  bonusPercent: numeric("bonus_percent", { precision: 5, scale: 2 }),
  bonusAmount: numeric("bonus_amount", { precision: 18, scale: 2 }),
  minDeposit: numeric("min_deposit", { precision: 18, scale: 2 }),
  wageringRequirement: numeric("wagering_requirement", { precision: 5, scale: 2 }).notNull().default("5.00"),
  maxBonus: numeric("max_bonus", { precision: 18, scale: 2 }),
  isActive: boolean("is_active").notNull().default(true),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const loyaltyPointsTable = pgTable("loyalty_points", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  points: integer("points").notNull(),
  action: text("action").notNull(),
  referenceId: integer("reference_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Promotion = typeof promotionsTable.$inferSelect;
export type LoyaltyPoint = typeof loyaltyPointsTable.$inferSelect;
