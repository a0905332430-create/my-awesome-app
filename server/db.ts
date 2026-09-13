import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  InsertUserVocabularyData,
  InsertWordCache,
  User,
  users,
  UserVocabularyData,
  userVocabularyData,
  WordCache,
  wordCache,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  type TextField = (typeof textFields)[number];

  for (const field of textFields) {
    if (user[field] === undefined) continue;
    values[field] = user[field] ?? null;
    updateSet[field] = user[field] ?? null;
  }
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string): Promise<User | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export function normalizeWord(word: string) {
  return word.trim().toLocaleLowerCase("en-US");
}

export async function getCachedWord(word: string): Promise<WordCache | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(wordCache)
    .where(eq(wordCache.normalizedWord, normalizeWord(word)))
    .limit(1);
  return result[0];
}

export async function upsertCachedWord(input: {
  word: string;
  translation: string;
  exampleSentence?: string | null;
  exampleTranslation?: string | null;
}): Promise<WordCache | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const values: InsertWordCache = {
    normalizedWord: normalizeWord(input.word),
    word: input.word.trim(),
    translation: input.translation.trim(),
  };
  if (input.exampleSentence !== undefined) values.exampleSentence = input.exampleSentence;
  if (input.exampleTranslation !== undefined) values.exampleTranslation = input.exampleTranslation;
  const updateSet: Record<string, unknown> = {
    word: values.word,
    translation: values.translation,
    updatedAt: new Date(),
  };
  if (input.exampleSentence !== undefined) updateSet.exampleSentence = input.exampleSentence;
  if (input.exampleTranslation !== undefined) updateSet.exampleTranslation = input.exampleTranslation;
  await db.insert(wordCache).values(values).onDuplicateKeyUpdate({
    set: updateSet,
  });
  return getCachedWord(input.word);
}

export async function getUserVocabularyData(userOpenId: string): Promise<UserVocabularyData | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(userVocabularyData).where(eq(userVocabularyData.userOpenId, userOpenId)).limit(1);
  return result[0];
}

export async function upsertUserVocabularyData(input: {
  userOpenId: string;
  decksJson: string;
  statsJson: string;
}): Promise<UserVocabularyData | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const values: InsertUserVocabularyData = {
    userOpenId: input.userOpenId,
    decksJson: input.decksJson,
    statsJson: input.statsJson,
  };
  await db.insert(userVocabularyData).values(values).onDuplicateKeyUpdate({
    set: {
      decksJson: input.decksJson,
      statsJson: input.statsJson,
      updatedAt: new Date(),
    },
  });
  return getUserVocabularyData(input.userOpenId);
}
