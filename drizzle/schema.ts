import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const wordCache = mysqlTable("word_cache", {
  id: int("id").autoincrement().primaryKey(),
  normalizedWord: varchar("normalizedWord", { length: 191 }).notNull().unique(),
  word: varchar("word", { length: 191 }).notNull(),
  translation: varchar("translation", { length: 500 }).notNull(),
  exampleSentence: text("exampleSentence"),
  exampleTranslation: text("exampleTranslation"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type WordCache = typeof wordCache.$inferSelect;
export type InsertWordCache = typeof wordCache.$inferInsert;
