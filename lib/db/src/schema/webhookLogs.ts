import { pgTable, serial, jsonb, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const webhookLogsTable = pgTable("webhook_logs", {
  id: serial("id").primaryKey(),
  headers: jsonb("headers").notNull(),
  payload: jsonb("payload").notNull(),
  signature: text("signature"),
  verified: boolean("verified").notNull().default(false),
  processed: boolean("processed").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type WebhookLog = typeof webhookLogsTable.$inferSelect;
