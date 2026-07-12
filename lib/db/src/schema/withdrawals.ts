import { pgTable, serial, integer, numeric, text, timestamp } from "drizzle-orm/pg-core";

export const withdrawalsTable = pgTable("withdrawals", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
  method: text("method").notNull().default("mpesa"),
  phone: text("phone"),
  accountNumber: text("account_number"),
  status: text("status").notNull().default("pending"),
  adminNote: text("admin_note"),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Withdrawal = typeof withdrawalsTable.$inferSelect;
