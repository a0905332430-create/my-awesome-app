import { z } from "zod";
import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { TRPCError } from "@trpc/server";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { generateExampleSentence, generateWordTranslation } from "./exampleGeneration";
import { getCachedWord, upsertCachedWord } from "./db";

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
