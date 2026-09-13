import { z } from "zod";
import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { TRPCError } from "@trpc/server";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { generateExampleSentence, generateWordTranslation } from "./exampleGeneration";
import {
  deleteUserAndVocabulary,
  getCachedWord,
  getUserVocabularyData,
  listUsersWithVocabulary,
  updateUserProfile,
  upsertCachedWord,
  upsertUserVocabularyData,
} from "./db";

const wordInput = z.object({
  word: z.string().trim().min(1).max(80),
  translation: z.string().trim().min(1).max(500),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  userData: router({
    sync: protectedProcedure
      .input(z.object({ decks: z.array(z.unknown()), learningStats: z.record(z.string(), z.unknown()) }))
      .mutation(async ({ ctx, input }) => {
        const remote = await getUserVocabularyData(ctx.user.openId);
        if (remote) {
          try {
            return {
              source: "remote" as const,
              decks: JSON.parse(remote.decksJson) as unknown[],
              learningStats: JSON.parse(remote.statsJson) as Record<string, unknown>,
            };
          } catch {
            // Replace malformed legacy data with the validated local snapshot below.
          }
        }

        await upsertUserVocabularyData({
          userOpenId: ctx.user.openId,
          decksJson: JSON.stringify(input.decks),
          statsJson: JSON.stringify(input.learningStats),
        });
        return { source: "local" as const, decks: input.decks, learningStats: input.learningStats };
      }),
    save: protectedProcedure
      .input(z.object({ decks: z.array(z.unknown()), learningStats: z.record(z.string(), z.unknown()) }))
      .mutation(async ({ ctx, input }) => {
        await upsertUserVocabularyData({
          userOpenId: ctx.user.openId,
          decksJson: JSON.stringify(input.decks),
          statsJson: JSON.stringify(input.learningStats),
        });
        return { success: true as const };
      }),
  }),

  admin: router({
    users: router({
      list: adminProcedure.query(async () => {
        const rows = await listUsersWithVocabulary();
        return rows.map(({ user, vocabulary }) => ({
          id: user.id,
          openId: user.openId,
          name: user.name,
          email: user.email,
          loginMethod: user.loginMethod,
          role: user.role,
          createdAt: user.createdAt,
          lastSignedIn: user.lastSignedIn,
          updatedAt: user.updatedAt,
          decks: vocabulary ? JSON.parse(vocabulary.decksJson) : [],
          learningStats: vocabulary ? JSON.parse(vocabulary.statsJson) : null,
        }));
      }),
      update: adminProcedure
        .input(z.object({ openId: z.string().min(1), name: z.string().trim().max(200).nullable().optional(), email: z.string().email().nullable().optional(), role: z.enum(["user", "admin"]).optional() }))
        .mutation(async ({ ctx, input }) => {
          if (ctx.user.openId === input.openId && input.role === "user") {
            throw new TRPCError({ code: "BAD_REQUEST", message: "不能移除目前登入管理員的管理權限。" });
          }
          await updateUserProfile(input);
          return { success: true as const };
        }),
      remove: adminProcedure
        .input(z.object({ openId: z.string().min(1) }))
        .mutation(async ({ ctx, input }) => {
          if (ctx.user.openId === input.openId) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "不能刪除目前登入的管理員帳戶。" });
          }
          await deleteUserAndVocabulary(input.openId);
          return { success: true as const };
        }),
    }),
  }),

  words: router({
    resolve: publicProcedure
      .input(z.object({ word: z.string().trim().min(1).max(80), translation: z.string().trim().min(1).max(500).optional() }))
      .mutation(async ({ input }) => {
        try {
          const cached = await getCachedWord(input.word);
          if (cached) {
            return {
              word: cached.word,
              translation: cached.translation,
              cached: true,
            };
          }

          const translation = input.translation ?? (await generateWordTranslation(input.word));
          const stored = await upsertCachedWord({ word: input.word, translation });
          return {
            word: stored?.word ?? input.word.trim(),
            translation: stored?.translation ?? translation,
            cached: false,
          };
        } catch {
          throw new TRPCError({
            code: "BAD_GATEWAY",
            message: "單字解釋暫時載入失敗，請稍後再試。",
          });
        }
      }),
  }),

  examples: router({
    generate: publicProcedure
      .input(
        wordInput.extend({
          avoidSentence: z.string().trim().max(220).optional(),
          forceRegenerate: z.boolean().optional(),
        }),
      )
      .mutation(async ({ input }) => {
        try {
          const cached = await getCachedWord(input.word);
          if (!input.forceRegenerate && cached?.exampleSentence && cached.exampleTranslation) {
            return {
              sentence: cached.exampleSentence,
              translation: cached.exampleTranslation,
              cached: true,
            };
          }

          const result = await generateExampleSentence(
            input.word,
            input.translation,
            input.avoidSentence ?? cached?.exampleSentence ?? undefined,
          );
          const stored = await upsertCachedWord({
            word: input.word,
            translation: input.translation,
            exampleSentence: result.sentence,
            exampleTranslation: result.translation,
          });
          return {
            ...result,
            cached: false,
            replacedCache: Boolean(stored),
          };
        } catch {
          throw new TRPCError({
            code: "BAD_GATEWAY",
            message: "例句暫時載入失敗，請稍後再試。",
          });
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;
